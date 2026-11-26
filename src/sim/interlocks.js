import { getTopology, isFullPPE } from './state.js';
import {
  grabTrolleyState,
  releaseTrolleyState,
  latchTrolleyState,
  unlatchTrolleyState,
  extractVcbState,
  reinsertVcbState,
} from '../switchboard/trolley.js';

/**
 * Creates all STCW switching, LOTO interlock, proving wand, Megger, and PTW/SFT
 * action handlers bound to `sim` and UI/3D hooks.
 */
export function createSimActions(sim, hooks = {}) {
  const noop = () => {};
  const audio = hooks.audio || {
    playClunk: noop,
    playRatchet: noop,
    playPiezo: noop,
    playAlarm: noop,
    playInterlockBlock: noop,
    playArcFlashBlast: noop,
    playSuccess: noop,
  };
  const render = hooks.onRender || noop;
  const logEvent = hooks.onLog || noop;
  const onViolation = hooks.onViolation || noop;
  const onFocusCubicle = hooks.onFocusCubicle || noop;

  function triggerViolation(pts = 5, title, reason, catastrophic = false) {
    const deduct = 5;
    sim.score = Math.max(0, sim.score - deduct);
    const cub = sim.cubicles[sim.selectedCubicle] || sim.cubicles['BT-M1'];

    if (catastrophic) {
      audio.playArcFlashBlast();
      logEvent(`[ARC-FLASH HAZARD -${deduct} pts] ${title}`, 'danger');
    } else {
      audio.playInterlockBlock();
      logEvent(`[Interlock Block -${deduct} pts] ${title}`, 'danger');
    }
    onViolation({ pts: deduct, title, reason, catastrophic, cub });
    render();
  }

  function checkPpe(action) {
    if (!sim.ppe.glovesAirTested && sim.ppe.gloves) {
      triggerViolation(5, 'HV Gloves Donned Without Roll Air-Test', 'STCW requires pneumatic roll testing for pinholes prior to donning.');
      return false;
    }
    if (!isFullPPE(sim)) {
      triggerViolation(5, `Incomplete PPE for ${action}`, '40 cal/cm² arc-flash suit, air-tested Class 2 gloves, and dielectric boots/mat must be equipped.');
      return false;
    }
    return true;
  }

  function selectCubicle(cubId) {
    if (!sim.cubicles[cubId]) return;
    sim.selectedCubicle = cubId;
    onFocusCubicle(cubId);
    render();
  }

  function pressTripVCB(cubId) {
    if (!checkPpe('Trip Circuit Breaker')) return;
    const cub = sim.cubicles[cubId];
    if (!cub || !cub.vcbClosed) return;
    cub.vcbClosed = false;
    audio.playClunk(90);
    if (cub.rackingTurns === 10 && cub._closedInTest) {
      cub.testFunctionCheckedInTestPos = true;
      logEvent(`${cub.id}: Local Close/Trip check verified in TEST (10/20).`, 'safe');
    } else {
      logEvent(`${cub.id}: Circuit breaker tripped OPEN [O].`, 'info');
    }
    render();
  }

  function pressCloseVCB(cubId) {
    if (!checkPpe('Close Circuit Breaker')) return;
    const cub = sim.cubicles[cubId];
    if (!cub || cub.vcbClosed) return;
    if (cub.isHV) {
      if (cub.vcbExtracted) {
        triggerViolation(5, 'VCB Cassette Withdrawn onto Trolley', 'Re-insert the VCB cassette into DISCONNECTED (0/20) before attempting to close.');
        return;
      }
      if (cub.rackingTurns !== 20 && cub.rackingTurns !== 10) {
        triggerViolation(5, 'Cannot Close VCB in Mid-Travel or Disconnected Position', 'VCB must be in SERVICE (20) or TEST (10) position.');
        return;
      }
      if (cub.earthSwitchClosed) {
        triggerViolation(5, 'Cannot Close VCB on Closed Earth Switch', 'Closing a 6.6 kV breaker onto a closed earth switch creates a 40 kA bolted 3-phase short-circuit fault; mechanical interlock blocked closure.', true);
        return;
      }
      if (cub.castellLockedOut) {
        triggerViolation(5, 'VCB Locked Out by Castell Key', 'Return and unlock Castell key before closing.');
        return;
      }
    } else {
      if (cub.rackingPadlocked || cub.castellLockedOut) {
        triggerViolation(5, 'ACB-TR1-LV Padlocked or Locked Out', 'Remove LOTO padlock and Castell lock before closing.');
        return;
      }
    }
    cub.vcbClosed = true;
    audio.playClunk(115);
    if (cub.rackingTurns === 10) cub._closedInTest = true;
    logEvent(`${cub.id}: Circuit breaker CLOSED [I].`, 'warn');
    render();
  }

  function rackVCB(cubId, delta) {
    if (!checkPpe('Rack VCB Truck')) return;
    const cub = sim.cubicles[cubId];
    if (!cub || !cub.isHV) return;
    if (cub.vcbExtracted) {
      triggerViolation(5, 'VCB Cassette Withdrawn onto Trolley', 'Re-insert the VCB cassette from the trolley into DISCONNECTED (0/20) before racking.');
      return;
    }
    if (cub.vcbClosed) {
      triggerViolation(5, 'Live Racking Prevention Interlock Engaged', 'Attempting to rack a CLOSED 6.6 kV breaker draws a lethal open-air plasma arc across the primary tulip spouts. Trip VCB OPEN [O] first.', true);
      return;
    }
    if (cub.rackingPadlocked) {
      triggerViolation(5, 'Racking Port Padlocked', 'Remove LOTO padlock from racking shutter first.');
      return;
    }
    if (cub.castellLockedOut) {
      triggerViolation(5, 'VCB Castell Key Extracted', 'Return Castell key to VCB before racking in.');
      return;
    }
    const next = Math.max(0, Math.min(20, cub.rackingTurns + delta));
    if (next !== cub.rackingTurns) {
      cub.rackingTurns = next;
      audio.playRatchet();
      const posLbl = next === 20 ? 'SERVICE' : next === 10 ? 'TEST' : next === 0 ? 'DISCONNECTED' : 'TRANSIT';
      logEvent(`${cub.id}: Racked to ${posLbl} (${cub.rackingTurns}/20 turns).`, 'info');
      render();
    }
  }

  function toggleRackingPadlock(cubId) {
    if (!checkPpe('Apply/Remove Padlock')) return;
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    cub.rackingPadlocked = !cub.rackingPadlocked;
    if (cub.rackingPadlocked && cub.castellLockedOut) {
      cub.tags.danger = true;
    } else if (!cub.rackingPadlocked && !cub.castellLockedOut) {
      cub.tags.danger = false;
    }
    audio.playRatchet();
    logEvent(`${cub.id}: Racking port padlock ${cub.rackingPadlocked ? 'applied' : 'removed'}.`, 'info');
    render();
  }

  function toggleCastellVCBLock(cubId) {
    if (!checkPpe('Operate Castell Interlock')) return;
    const cub = sim.cubicles[cubId];
    const kId = cub?.castellKeyId;
    if (!kId) return;
    if (!cub.castellLockedOut) {
      if (cub.isHV && (cub.vcbClosed || cub.rackingTurns !== 0)) {
        triggerViolation(5, 'Castell Key Trapped in VCB', 'VCB must be OPEN and at DISCONNECTED (0/20) to release key.');
        return;
      }
      if (!cub.isHV && cub.vcbClosed) {
        triggerViolation(5, 'Castell Key Trapped in ACB', '440 V ACB must be OPEN [O] to release K-LV.');
        return;
      }
      cub.castellLockedOut = true;
      sim.keys[kId] = 'HAND';
      if (cub.rackingPadlocked) cub.tags.danger = true;
      audio.playRatchet();
      logEvent(`${cub.id}: Castell key ${kId} extracted to hand.`, 'safe');
    } else {
      if (sim.keys[kId] !== 'HAND') {
        triggerViolation(5, 'Key Not in Hand', `Key ${kId} is currently at ${sim.keys[kId]}. Extract from Earth Switch first.`);
        return;
      }
      cub.castellLockedOut = false;
      sim.keys[kId] = 'VCB_TRAPPED';
      if (!cub.rackingPadlocked) cub.tags.danger = false;
      audio.playRatchet();
      logEvent(`${cub.id}: Castell key ${kId} returned to breaker.`, 'info');
    }
    render();
  }

  function toggleEarthSwitchKey(cubId, kId) {
    if (!checkPpe('Castell Key Transfer')) return;
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    const has = cub.earthKeysInserted.includes(kId);
    if (!has) {
      if (sim.keys[kId] !== 'HAND') {
        triggerViolation(5, 'Key Not in Hand', `Castell key ${kId} is at ${sim.keys[kId] || 'VCB'}. Extract it first.`);
        return;
      }
      cub.earthKeysInserted.push(kId);
      sim.keys[kId] = 'EARTH_SWITCH';
      audio.playRatchet();
      logEvent(`${cub.id}: Key ${kId} inserted into Earth Switch cylinder.`, 'info');
    } else {
      if (cub.earthSwitchClosed) {
        triggerViolation(5, 'Key Trapped in Closed Earth Switch', 'Open Integral Earth Switch before extracting key.');
        return;
      }
      cub.earthKeysInserted = cub.earthKeysInserted.filter((k) => k !== kId);
      sim.keys[kId] = 'HAND';
      audio.playRatchet();
      logEvent(`${cub.id}: Key ${kId} extracted from Earth Switch to hand.`, 'info');
    }
    render();
  }

  function toggleIntegralEarthSwitch(cubId) {
    if (!checkPpe('Operate Earth Switch')) return;
    const cub = sim.cubicles[cubId];
    if (!cub || !cub.isHV) return;
    if (!cub.earthSwitchClosed) {
      if (cub.vcbClosed || cub.rackingTurns !== 0) {
        triggerViolation(5, 'Cannot Earth Non-Disconnected Breaker Slot', 'Closing an earth switch while the 6.6 kV breaker is in-slot causes a 3-phase busbar earth fault. Rack VCB out to DISCONNECTED (0/20) first.', true);
        return;
      }
      const req = cub.requiredEarthKeys || [];
      req.forEach((k) => {
        if (!cub.earthKeysInserted.includes(k) && sim.keys[k] === 'HAND') {
          cub.earthKeysInserted.push(k);
          sim.keys[k] = 'EARTH_SWITCH';
        }
      });
      const missing = req.filter((k) => !cub.earthKeysInserted.includes(k));
      if (missing.length > 0) {
        triggerViolation(5, 'Missing Castell Key(s) for Earth Switch', `Requires [${missing.join(', ')}] inserted in cylinder.`);
        return;
      }
      cub.earthSwitchClosed = true;
      if (cub.earthPadlocked) cub.tags.earth = true;
      audio.playClunk(70);
      logEvent(`${cub.id}: Integral EK6 Earth Switch CLOSED (circuit earthed).`, 'safe');
    } else {
      if (cub.earthPadlocked) {
        triggerViolation(5, 'Earth Switch Padlocked', 'Remove earth switch padlock before opening.');
        return;
      }
      cub.earthSwitchClosed = false;
      cub.tags.earth = false;
      audio.playClunk(95);
      logEvent(`${cub.id}: Integral EK6 Earth Switch OPENED.`, 'warn');
    }
    render();
  }

  function toggleEarthPadlock(cubId) {
    if (!checkPpe('Padlock Earth Switch')) return;
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    cub.earthPadlocked = !cub.earthPadlocked;
    if (cub.earthSwitchClosed && cub.earthPadlocked) {
      cub.tags.earth = true;
    } else if (!cub.earthSwitchClosed && !cub.earthPadlocked) {
      cub.tags.earth = false;
    }
    audio.playRatchet();
    logEvent(`${cub.id}: Earth switch padlock ${cub.earthPadlocked ? 'applied' : 'removed'}.`, 'info');
    render();
  }

  function toggleSafetyKeyBox() {
    sim.keyBoxLocked = !sim.keyBoxLocked;
    audio.playRatchet();
    logEvent(`Safety key box ${sim.keyBoxLocked ? 'LOCKED' : 'OPENED'}.`, 'info');
    render();
  }

  function setDoorOpen(cubId, open) {
    sim.selectedCubicle = cubId;
    const cub = sim.cubicles[cubId];
    if (!cub || !cub.isHV) return;
    if (open) {
      if (!checkPpe('Open Enclosure Door')) return;
      if (cub.rackingTurns !== 0) {
        triggerViolation(5, 'Door Interlocked: VCB In-Slot', 'Opening an energized HV compartment while VCB is in SERVICE/TEST exposes personnel to 6.6 kV arc-flash. Rack VCB to DISCONNECTED (0/20) first.', cub.vcbClosed);
        return;
      }
      if (!cub.earthSwitchClosed && !cub.sftDoorBypass && !sim.sft.active) {
        triggerViolation(5, 'Door Interlocked: Earth Switch Open', 'Opening an unearthed 6.6 kV compartment exposes operator to lethal capacitive or back-fed voltage. Close Integral Earth Switch first.', true);
        return;
      }
      cub.doorOpen = true;
      audio.playClunk(90);
      logEvent(`${cub.id}: Front VCB compartment door unbolted & swung open.`, 'info');
    } else {
      if (sim.trolley?.latchedBayId === cubId) {
        triggerViolation(5, 'VCB Trolley Latched to Cubicle Sill', 'Unlatch and wheel the VCB trolley clear before closing the compartment door.');
        return;
      }
      cub.doorOpen = false;
      audio.playClunk(100);
      logEvent(`${cub.id}: Front VCB compartment door closed & bolted.`, 'info');
    }
    render();
  }

  function toggleDoor3D(cubId) {
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    setDoorOpen(cubId, !cub.doorOpen);
  }

  function setRearDoorOpen(cubId, open) {
    const cub = sim.cubicles[cubId];
    if (!cub) return false;
    if (open) {
      if (!checkPpe('Open Rear HV Inspection Panel')) return false;
      if (cub.vcbClosed || (cub.isHV && cub.rackingTurns > 0)) {
        triggerViolation(
          5,
          `Arc-Flash Hazard: Unbolted ${cub.id} Rear Cover While Energized`,
          'Trip breaker and rack out to DISCONNECTED (0/20) before opening rear cable/bus-tie panels.',
          true
        );
        return false;
      }
      const bt1SafeBusTie = cub.id === 'BT1' && cub.vcbExtracted && cub.topShutterPadlocked;
      if (cub.isHV && !cub.earthSwitchClosed && !bt1SafeBusTie) {
        triggerViolation(
          5,
          `Interlock Blocked: ${cub.id} Rear Compartment Not Earthed`,
          'Close & padlock the EK6 Integral Earth Switch (or for BT1 Bus-Tie, withdraw VCB & padlock red shutter) before unbolting rear panel.',
          false
        );
        return false;
      }
    }
    cub.rearDoorOpen = Boolean(open);
    audio.playClunk(95);
    logEvent(
      `${cub.id}: Rear cable & bus-tie inspection cover ${cub.rearDoorOpen ? 'unbolted and opened' : 'closed and bolted'}.`,
      cub.rearDoorOpen ? 'info' : 'safe'
    );
    render();
    return true;
  }

  function toggleRearDoor(cubId) {
    const cub = sim.cubicles[cubId];
    if (!cub) return false;
    return setRearDoorOpen(cubId, !cub.rearDoorOpen);
  }

  function toggleShutterPadlock(cubId) {
    if (!checkPpe('Padlock Red Busbar Shutter')) return;
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    cub.topShutterPadlocked = !cub.topShutterPadlocked;
    audio.playRatchet();
    logEvent(`${cub.id}: Red 6.6 kV busbar shutter ${cub.topShutterPadlocked ? 'padlocked closed' : 'unlocked'}.`, cub.topShutterPadlocked ? 'safe' : 'warn');
    render();
  }

  function proveTesterOnUnit() {
    if (!checkPpe('Prove HV Tester')) return;
    sim.activeTool = 'HV_TESTER';
    sim.lastProbedTerminal = 'PROVER';
    audio.playPiezo(true);
    const tgt = sim.selectedCubicle === 'TR1-HV' ? 'TR1-HV' : 'BT-M1';
    if (sim.ptp.state === 0 || sim.ptp.targetCubicle !== tgt) {
      sim.ptp.targetCubicle = tgt;
      sim.ptp.state = 1;
      sim.ptp.phasesTested = { L1: false, L2: false, L3: false };
      logEvent(`PTP Step 1: 6.6 kV wand proven on proving unit for ${tgt}. Now probe L1, L2, L3.`, 'info');
    } else if (sim.ptp.state === 2 && sim.ptp.targetCubicle === tgt) {
      sim.ptp.state = 3;
      sim.ptp.completedCubicles[tgt] = true;
      logEvent(`PTP Step 3: Wand re-proven! Prove–Test–Prove verified for ${tgt}.`, 'safe');
    }
    render();
  }

  function interactTerminal(cubId, term) {
    if (!checkPpe(`Interact with ${term}`)) return;
    const cub = sim.cubicles[cubId];
    if (!cub) return;
    const topo = getTopology(sim);
    const volts = cubId === 'TR1-HV' ? topo.trVolts : topo.btVolts;
    sim.lastProbedTerminal = `${cubId}:${term}`;

    // Accept both canonical HV_TESTER and legacy VOLTAGE_TESTER alias defensively
    if (sim.activeTool === 'HV_TESTER' || sim.activeTool === 'VOLTAGE_TESTER') {
      sim.activeTool = 'HV_TESTER';
      if (cub.isHV && !cub.vcbExtracted) {
        triggerViolation(5, 'VCB Obstructing Cable Compartment', 'Withdraw the VCB cassette completely onto the VCB Service Trolley before probing L1–L3.');
        return;
      }
      if (term === 'PE') {
        audio.playRatchet();
        logEvent('PE hull earth busbar verified at 0.0 V ground reference.', 'info');
        render();
        return;
      }
      if (volts > 0) {
        audio.playPiezo(true);
        triggerViolation(5, `LIVE VOLTAGE DETECTED ON ${cubId} ${term}`, `Feeder is still energized at ${volts} V (check upstream VCB, 440 V step-up back-feed, or stored Megger DC charge)!`, true);
        return;
      }
      if (sim.ptp.state === 0) {
        triggerViolation(5, 'Probed Phase Before Proving Wand', 'Always prove the 6.6 kV wand on a known proving unit before testing.');
        return;
      }
      sim.ptp.phasesTested[term] = true;
      audio.playRatchet();
      if (sim.ptp.phasesTested.L1 && sim.ptp.phasesTested.L2 && sim.ptp.phasesTested.L3) {
        sim.ptp.state = 2;
        logEvent('PTP Step 2: L1, L2, L3 confirmed 0.0 V DEAD. Re-prove wand on proving unit now.', 'safe');
      } else {
        logEvent(`${cubId} ${term} confirmed 0.0 V DEAD.`, 'info');
      }
      render();
      return;
    }

    if (sim.activeTool === 'PORTABLE_EARTH') {
      if (cub.isHV && !cub.vcbExtracted) {
        triggerViolation(5, 'VCB Obstructing Cable Compartment', 'Withdraw the VCB cassette completely onto the VCB Service Trolley before fitting CME leads.');
        return;
      }
      if (volts > 0) {
        triggerViolation(5, `Arc-Flash: Applied Portable Earth to Live Terminal (${volts} V)`, 'Catastrophic short-circuit.', true);
        return;
      }
      if (term === 'PE') {
        if (!cub.cme.pe) {
          cub.cme.pe = true;
          audio.playClunk(110);
          logEvent('CME earth clamp bolted to Ship Hull Earth Bar (PE) first.', 'safe');
        } else {
          if (cub.cme.L1 || cub.cme.L2 || cub.cme.L3) {
            triggerViolation(5, 'Removed PE Earth Clamp While Phase Clamps Attached', 'Remove L1, L2, L3 phase clamps first, and PE last.');
            return;
          }
          cub.cme.pe = false;
          cub.cme.removedProperly = true;
          audio.playClunk(110);
          logEvent('CME PE earth clamp removed last — safe de-earthing verified.', 'safe');
        }
      } else {
        if (!cub.cme[term]) {
          if (!cub.cme.pe) {
            triggerViolation(5, 'Applied Phase Clamp Before PE Earth Clamp', 'Connect PE hull earth clamp first so lead is grounded.');
            return;
          }
          cub.cme[term] = true;
          audio.playClunk(100);
          logEvent(`CME phase clamp attached to ${term}.`, 'safe');
        } else {
          cub.cme[term] = false;
          audio.playClunk(100);
          logEvent(`CME phase clamp removed from ${term}.`, 'info');
        }
      }
      render();
      return;
    }

    logEvent(`Equip the 6.6 kV Proving Wand or Portable Earth hot-stick to interact with ${term}.`, 'info');
    render();
  }

  function connectMegger() {
    if (!checkPpe('Connect Megger Leads')) return;
    const topo = getTopology(sim);
    if (topo.btVolts > 0 && sim.megger.windingChargeVolts === 0) {
      triggerViolation(5, 'Arc-Flash: Connected 5 kV Megger to Live 6.6 kV Feeder', 'Clipping Megger leads onto an energized 6,600 V AC feeder causes a catastrophic phase-to-ground arc-flash.', true);
      return;
    }
    sim.megger.connectedCubicle = 'BT-M1';
    audio.playRatchet();
    logEvent('5 kV Megger test leads clipped to BT-M1 Phase L1 & PE.', 'info');
    render();
  }

  function runMegger() {
    if (!checkPpe('Run 5 kV Megger Test')) return;
    const bt = sim.cubicles['BT-M1'];
    const topo = getTopology(sim);
    if (topo.btVolts > 0 && sim.megger.windingChargeVolts === 0) {
      triggerViolation(5, 'Arc-Flash: 5 kV Megger Injected into Live 6.6 kV Feeder', 'Injecting 5 kV DC Megger leads onto an energized 6,600 V AC feeder destroys the instrument and causes a catastrophic arc-flash.', true);
      return;
    }
    if (sim.ptw.active && !sim.sft.active) {
      triggerViolation(5, '5 kV Megger Blocked: PTW Active Without Sanction-for-Test', 'Cancel the Permit-to-Work and issue a Sanction-for-Test (SFT) before injecting 5,000 V DC.', false);
      return;
    }
    if (!sim.megger.connectedCubicle) {
      triggerViolation(5, 'Megger Test Leads Not Connected', 'Connect 5 kV Megger test leads to Phase L1 and PE before running the insulation test.', false);
      return;
    }
    if (bt.earthSwitchClosed) {
      audio.playAlarm();
      sim.megger.ir1Min = 0.0;
      sim.megger.piRatio = 0.0;
      logEvent('Megger reads 0.0 MΩ — Integral Earth Switch is still CLOSED.', 'warn');
      render();
      return;
    }
    audio.playPiezo(true);
    sim.megger.tested = true;
    sim.megger.ir1Min = 450;
    sim.megger.ir10Min = 1120;
    sim.megger.piRatio = 2.49;
    sim.megger.windingChargeVolts = 4850;
    sim.megger.dischargedProperly = false;
    logEvent('5 kV PI test complete (PI = 2.49 PASS). 4,850 V DC stored on winding!', 'warn');
    render();
  }

  function dischargeMegger() {
    audio.playClunk(130);
    sim.megger.windingChargeVolts = 0;
    sim.megger.dischargedProperly = true;
    sim.megger.connectedCubicle = null;
    logEvent('Capacitive winding charge bled safely to 0 V DC; leads removed.', 'safe');
    render();
  }

  function issuePTW() {
    const tgt = sim.missionId === 2 ? 'TR1-HV' : 'BT-M1';
    sim.ptw.active = true;
    sim.ptw.cancelled = false;
    sim.ptw.targetCubicle = tgt;
    sim.ptw.signedETO = true;
    sim.ptw.signedCompetent = true;
    audio.playClunk(120);
    logEvent(`High Voltage Permit-to-Work issued for ${tgt}.`, 'safe');
    render();
  }

  function cancelPTW() {
    sim.ptw.active = false;
    sim.ptw.cancelled = true;
    audio.playClunk(110);
    logEvent('Permit-to-Work formally signed off and cancelled.', 'info');
    render();
  }

  function issueSFT() {
    sim.sft.active = true;
    sim.sft.cancelledAfterTest = false;
    sim.sft.signedETO = true;
    sim.cubicles['BT-M1'].sftDoorBypass = true;
    audio.playClunk(120);
    logEvent('Sanction-for-Test (SFT) issued for BT-M1.', 'warn');
    render();
  }

  function cancelSFT() {
    if (sim.megger.windingChargeVolts > 0) {
      triggerViolation(5, 'Lethal Stored DC Charge on Winding (4,850 V DC)', 'Never cancel Sanction-for-Test while 4,850 V DC capacitive charge remains on the stator winding. Discharge winding to 0 V DC first.', true);
      return;
    }
    sim.sft.active = false;
    sim.sft.cancelledAfterTest = true;
    sim.cubicles['BT-M1'].sftDoorBypass = false;
    audio.playClunk(110);
    logEvent('Sanction-for-Test (SFT) cancelled.', 'safe');
    render();
  }

  function grabTrolley() {
    const res = grabTrolleyState(sim.trolley);
    if (!res.ok) {
      logEvent(res.reason, 'warn');
      audio.playInterlockBlock();
      return false;
    }
    audio.playClunk(105);
    logEvent('VCB Service Trolley wheel brakes unlocked — pushing trolley.', 'info');
    render();
    return true;
  }

  function releaseTrolley() {
    const res = releaseTrolleyState(sim.trolley);
    if (!res.ok) return false;
    audio.playClunk(95);
    logEvent(
      sim.trolley.state === 'MAINTENANCE_PARKED'
        ? `VCB Trolley parked & braked in Port Maintenance Bay with ${sim.trolley.carriedCubId} cassette.`
        : 'VCB Service Trolley wheel brakes locked.',
      sim.trolley.state === 'MAINTENANCE_PARKED' ? 'safe' : 'info'
    );
    render();
    return true;
  }

  function latchTrolley(cubId) {
    if (!checkPpe('Latch VCB Trolley Rails')) return false;
    const res = latchTrolleyState(sim.trolley, cubId, sim);
    if (!res.ok) {
      triggerViolation(5, 'Cannot Latch VCB Trolley', res.reason);
      return false;
    }
    sim.selectedCubicle = cubId;
    audio.playClunk(85);
    logEvent(`${cubId}: VCB Service Trolley aligned and rail hooks latched to cubicle sill.`, 'safe');
    render();
    return true;
  }

  function unlatchTrolley() {
    const prevBay = sim.trolley?.latchedBayId;
    const res = unlatchTrolleyState(sim.trolley);
    if (!res.ok) return false;
    audio.playRatchet();
    logEvent(`${prevBay || 'Bay'}: Trolley rail hooks unlatched — ready to wheel trolley clear.`, 'info');
    render();
    return true;
  }

  function withdrawVcbToTrolley(cubId) {
    if (!checkPpe('Withdraw VCB Cassette')) return false;
    if (cubId && sim.trolley && !sim.trolley.latchedBayId) {
      const latchRes = latchTrolleyState(sim.trolley, cubId, sim);
      if (!latchRes.ok) {
        triggerViolation(5, 'VCB Withdrawal Blocked', latchRes.reason);
        return false;
      }
    }
    const res = extractVcbState(sim.trolley, sim);
    if (!res.ok) {
      triggerViolation(5, 'VCB Withdrawal Blocked', res.reason);
      return false;
    }
    audio.playClunk(75);
    logEvent(`${res.cubId}: VCB cassette completely withdrawn onto service trolley. Cable spouts & shutters are now unobstructed.`, 'safe');
    render();
    return true;
  }

  function reinsertVcbFromTrolley(cubId) {
    if (!checkPpe('Re-Insert VCB Cassette')) return false;
    if (cubId && sim.trolley && !sim.trolley.latchedBayId) {
      const latchRes = latchTrolleyState(sim.trolley, cubId, sim);
      if (!latchRes.ok) {
        triggerViolation(5, 'VCB Re-Insertion Blocked', latchRes.reason);
        return false;
      }
    }
    const res = reinsertVcbState(sim.trolley, sim);
    if (!res.ok) {
      triggerViolation(5, 'VCB Re-Insertion Blocked', res.reason);
      return false;
    }
    audio.playClunk(85);
    logEvent(`${res.cubId}: VCB cassette rolled back into DISCONNECTED (0/20) rails.`, 'safe');
    render();
    return true;
  }

  return {
    triggerViolation,
    checkPpe,
    selectCubicle,
    pressTripVCB,
    pressCloseVCB,
    rackVCB,
    toggleRackingPadlock,
    toggleCastellVCBLock,
    toggleEarthSwitchKey,
    toggleIntegralEarthSwitch,
    toggleEarthPadlock,
    toggleSafetyKeyBox,
    setDoorOpen,
    toggleDoor3D,
    setRearDoorOpen,
    toggleRearDoor,
    toggleShutterPadlock,
    proveTesterOnUnit,
    interactTerminal,
    connectMegger,
    runMegger,
    dischargeMegger,
    issuePTW,
    cancelPTW,
    issueSFT,
    cancelSFT,
    grabTrolley,
    releaseTrolley,
    latchTrolley,
    unlatchTrolley,
    withdrawVcbToTrolley,
    reinsertVcbFromTrolley,
  };
}
