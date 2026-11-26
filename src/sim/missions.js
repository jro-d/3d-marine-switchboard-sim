import { createCubicles, isFullPPE } from './state.js';
import { createTrolleyState, MAINTENANCE_ZONE_POS } from '../switchboard/trolley.js';

export const MISSION_TITLES = {
  1: 'Mission 01 · Bow Thruster 6.6 kV Motor Isolation & PTW',
  2: 'Mission 02 · Transformer Dual-End Isolation (Back-Feed Trap)',
  3: 'Mission 03 · Sanction-for-Test & 5 kV Megger / PI Test',
  4: 'Mission 04 · De-Isolation & Safe Restoration to Service',
};

/**
 * Pure STCW LOTO step evaluation for Missions 1–4.
 * Training mode no longer exposes one-click auto-complete macros.
 */
export function getLotoSteps(sim) {
  const c = sim.cubicles;
  const bt = c['BT-M1'];
  const tr = c['TR1-HV'];
  const lv = c['ACB-TR1-LV'];

  if (sim.missionId === 1) {
    return [
      {
        title: 'Equip Full HV PPE & Roll Air-Test Gloves',
        desc: 'Walk to the Port PPE Locker, air-test Class 2 gloves, don 40 cal/cm² suit, and deploy dielectric boots & 15 kV mat.',
        done: isFullPPE(sim),
      },
      {
        title: 'Trip & Open Feeder VCB [O]',
        desc: 'At Bay C3 (BT-M1), interrupt 1,800 kW Bow Thruster load by tripping the Vacuum Circuit Breaker.',
        done: !bt.vcbClosed,
      },
      {
        title: 'Rack Out VCB to DISCONNECTED (0/20)',
        desc: 'Crank withdrawable carriage from SERVICE (20) through TEST (10) to DISCONNECTED (0).',
        done: !bt.vcbClosed && bt.rackingTurns === 0,
      },
      {
        title: 'Extract Castell Key K1-BT & Padlock Port',
        desc: 'Extract trapped key K1-BT, apply LOTO padlock to racking shutter, and post Danger tag.',
        done: bt.castellLockedOut && bt.rackingPadlocked,
      },
      {
        title: 'Close & Padlock Integral Earth Switch',
        desc: 'Insert K1-BT into EK6 cylinder, close & padlock Integral Earth Switch, then lock Safety Key Box at Key Board.',
        done: bt.earthSwitchClosed && bt.earthPadlocked && sim.keyBoxLocked,
      },
      {
        title: 'Withdraw VCB, Prove Dead & Issue PTW',
        desc: 'Open C3 door, latch VCB trolley & withdraw VCB cassette, padlock red busbar shutter, prove L1/L2/L3 dead, and issue PTW at Permit Desk.',
        done: bt.vcbExtracted && sim.ptw.active && Boolean(sim.ptp.completedCubicles['BT-M1']),
      },
    ];
  }

  if (sim.missionId === 2) {
    const cmeDone = tr.cme.pe && tr.cme.L1 && tr.cme.L2 && tr.cme.L3;
    return [
      {
        title: 'Equip Full HV PPE & Roll Air-Test Gloves',
        desc: 'Equip 40 cal/cm² suit, air-tested Class 2 gloves, and dielectric footwear/mat at the PPE Locker.',
        done: isFullPPE(sim),
      },
      {
        title: 'Isolate & Lock Out 440 V Secondary ACB',
        desc: 'Trip C5 (ACB-TR1-LV) first to eliminate 440 V -> 6.6 kV step-up back-feed, padlock, and extract K-LV.',
        done: !lv.vcbClosed && lv.rackingPadlocked && lv.castellLockedOut,
      },
      {
        title: 'Trip, Rack Out & Lock Out 6.6 kV Primary (TR1-HV)',
        desc: 'At C4 (TR1-HV), trip VCB, rack out to DISCONNECTED (0/20), padlock racking port, and extract K-HV.',
        done: !tr.vcbClosed && tr.rackingTurns === 0 && tr.rackingPadlocked && tr.castellLockedOut,
      },
      {
        title: 'Insert Dual Keys (K-HV + K-LV) & Close Earth Switch',
        desc: 'Insert both keys into TR1-HV dual-cylinder interlock, close & padlock earth switch, and lock Safety Key Box.',
        done: tr.earthKeysInserted.includes('K-HV') && tr.earthKeysInserted.includes('K-LV') && tr.earthSwitchClosed && tr.earthPadlocked && sim.keyBoxLocked,
      },
      {
        title: 'Withdraw VCB, Prove Dead & Apply CME',
        desc: 'Open door, withdraw TR1-HV VCB onto trolley, padlock red shutter, Prove–Test–Prove L1/L2/L3, then clamp PE first followed by L1, L2, L3.',
        done: tr.vcbExtracted && Boolean(sim.ptp.completedCubicles['TR1-HV']) && cmeDone,
      },
      {
        title: 'Sign & Issue Transformer Permit-to-Work',
        desc: 'Walk to the Permit Desk and issue signed Maritime High Voltage PTW for Transformer TR1-HV.',
        done: sim.ptw.active && sim.ptw.targetCubicle === 'TR1-HV',
      },
    ];
  }

  if (sim.missionId === 3) {
    return [
      {
        title: 'Equip Full HV PPE & Roll Air-Test Gloves',
        desc: 'Full HV protective gear is mandatory before Sanction-for-Test switching and 5 kV injection.',
        done: isFullPPE(sim),
      },
      {
        title: 'Cancel PTW & Issue Sanction-for-Test (SFT)',
        desc: 'At the Permit Desk, cancel active PTW, post SFT warning notice, and authorize Sanction-for-Test.',
        done: sim.ptw.cancelled && (sim.sft.active || sim.sft.cancelledAfterTest),
      },
      {
        title: 'Open Integral Earth Switch for 5 kV Test',
        desc: 'At C3 (BT-M1), remove earth padlock and open Integral Earth Switch so stator winding is ungrounded for IR test.',
        done: !bt.earthSwitchClosed || sim.megger.tested,
      },
      {
        title: 'Connect Leads & Run 5 kV PI Megger Test',
        desc: 'At the Test Bench, inject 5,000 V DC (1-min 450 MΩ, 10-min 1,120 MΩ, Polarization Index = 2.49 PASS).',
        done: sim.megger.tested && sim.megger.piRatio === 2.49,
      },
      {
        title: 'Discharge Winding Capacitive Charge to 0 V',
        desc: 'Bleed 4,850 V DC stored capacitive energy safely to 0 V DC and disconnect leads.',
        done: sim.megger.dischargedProperly && sim.megger.windingChargeVolts === 0 && !sim.megger.connectedCubicle,
      },
      {
        title: 'Re-Close Earth Switch & Cancel SFT',
        desc: 'Re-apply Integral Earth Switch & padlock at C3, then cancel Sanction-for-Test at Permit Desk.',
        done: bt.earthSwitchClosed && sim.sft.cancelledAfterTest,
      },
    ];
  }

  const cmeClean = !bt.cme.pe && !bt.cme.L1 && !bt.cme.L2 && !bt.cme.L3 && bt.cme.removedProperly;
  return [
    {
      title: 'Equip Full HV PPE & Roll Air-Test Gloves',
      desc: 'Ensure full PPE is worn prior to de-isolation and breaker restoration.',
      done: isFullPPE(sim),
    },
    {
      title: 'Sign Off Permit-to-Work Return & Cancellation',
      desc: 'At the Permit Desk, confirm working party and tools are clear, then formally cancel PTW.',
      done: sim.ptw.cancelled,
    },
    {
      title: 'Remove CME Leads: Phases First, PE Last',
      desc: 'At C3 (BT-M1), unclamp L1, L2, L3 phase leads via hot-stick first; unclamp ship earth bar (PE) last.',
      done: cmeClean,
    },
    {
      title: 'Re-Insert VCB via Trolley, Close Door & Open Earth Switch',
      desc: 'Unlock red shutter, wheel VCB back on trolley into 0/20, unlatch trolley, bolt door, unlock Key Box, open earth switch, and return K1-BT.',
      done: !bt.vcbExtracted && !sim.trolley?.latchedBayId && !bt.topShutterPadlocked && !bt.doorOpen && !sim.keyBoxLocked && !bt.earthSwitchClosed && !bt.castellLockedOut && sim.keys['K1-BT'] === 'VCB_TRAPPED',
    },
    {
      title: 'Rack to TEST (10/20) & Local Function Check',
      desc: 'Remove racking padlock, rack in to TEST (10/20), and verify Close [I] & Trip [O] operation.',
      done: bt.testFunctionCheckedInTestPos,
    },
    {
      title: 'Rack to SERVICE (20/20) Ready for Load',
      desc: 'Crank withdrawable VCB truck fully into SERVICE (20/20) primary spouts.',
      done: bt.testFunctionCheckedInTestPos && bt.rackingTurns === 20,
    },
  ];
}

export function initMission(sim, id, hooks = {}) {
  const { onLog = () => {}, onRender = () => {}, onReset = () => {} } = hooks;
  sim.missionId = Number(id);
  sim.score = 100;
  sim.missionCompleted = false;
  sim.activeTool = 'HAND';
  sim.lastProbedTerminal = null;
  sim.cubicles = createCubicles();

  sim.ppe = { suit: false, glovesAirTested: false, gloves: false, bootsMat: false };
  sim.keys = { 'K1-BT': 'VCB_TRAPPED', 'K-HV': 'VCB_TRAPPED', 'K-LV': 'VCB_TRAPPED' };
  sim.keyBoxLocked = false;

  sim.ptp = {
    state: 0,
    targetCubicle: sim.missionId === 2 ? 'TR1-HV' : 'BT-M1',
    phasesTested: { L1: false, L2: false, L3: false },
    completedCubicles: {},
  };

  sim.megger = {
    connectedCubicle: null,
    tested: false,
    ir1Min: null,
    ir10Min: null,
    piRatio: null,
    windingChargeVolts: 0,
    dischargedProperly: false,
  };

  sim.ptw = {
    active: false,
    cancelled: false,
    targetCubicle: sim.missionId === 2 ? 'TR1-HV' : 'BT-M1',
    signedETO: false,
    signedCompetent: false,
  };

  sim.sft = {
    active: false,
    cancelledAfterTest: false,
    targetCubicle: 'BT-M1',
    signedETO: false,
  };

  sim.trolley = createTrolleyState();

  if (sim.missionId === 1) {
    sim.selectedCubicle = 'BT-M1';
    onLog('Mission 01 loaded: Isolate Bow Thruster (BT-M1), withdraw VCB on trolley, and issue PTW.');
  } else if (sim.missionId === 2) {
    sim.selectedCubicle = 'ACB-TR1-LV';
    onLog('Mission 02 loaded: Isolate Transformer TR1 (isolate 440 V ACB first).');
  } else if (sim.missionId === 3) {
    sim.selectedCubicle = 'BT-M1';
    const bt = sim.cubicles['BT-M1'];
    bt.machineryRunning = false;
    bt.vcbClosed = false;
    bt.rackingTurns = 0;
    bt.vcbExtracted = true;
    bt.rackingPadlocked = true;
    bt.castellLockedOut = true;
    bt.earthKeysInserted = ['K1-BT'];
    bt.earthSwitchClosed = true;
    bt.earthPadlocked = true;
    bt.doorOpen = true;
    bt.topShutterPadlocked = true;
    bt.tags.danger = true;
    bt.tags.earth = true;
    sim.keys['K1-BT'] = 'EARTH_SWITCH';
    sim.ptp.completedCubicles['BT-M1'] = true;
    sim.ptw.active = true;
    sim.ptw.signedETO = true;
    sim.ptw.signedCompetent = true;
    sim.trolley = createTrolleyState({
      state: 'MAINTENANCE_PARKED',
      x: MAINTENANCE_ZONE_POS.x,
      z: MAINTENANCE_ZONE_POS.z,
      yaw: MAINTENANCE_ZONE_POS.yaw,
      brakeLocked: true,
      latchedBayId: null,
      carriedCubId: 'BT-M1',
      transferProgress: 1,
    });
    onLog('Mission 03 loaded: BT-M1 VCB withdrawn to Maintenance Bay; run Sanction-for-Test & 5 kV Megger PI test.');
  } else if (sim.missionId === 4) {
    sim.selectedCubicle = 'BT-M1';
    const bt = sim.cubicles['BT-M1'];
    bt.machineryRunning = false;
    bt.vcbClosed = false;
    bt.rackingTurns = 0;
    bt.vcbExtracted = true;
    bt.rackingPadlocked = true;
    bt.castellLockedOut = true;
    bt.earthKeysInserted = ['K1-BT'];
    bt.earthSwitchClosed = true;
    bt.earthPadlocked = true;
    bt.doorOpen = true;
    bt.topShutterPadlocked = true;
    bt.tags.danger = true;
    bt.tags.earth = true;
    bt.cme = { pe: true, L1: true, L2: true, L3: true, removedProperly: false };
    sim.keys['K1-BT'] = 'EARTH_SWITCH';
    sim.keyBoxLocked = true;
    sim.ptp.completedCubicles['BT-M1'] = true;
    sim.ptw.active = true;
    sim.ptw.signedETO = true;
    sim.ptw.signedCompetent = true;
    sim.trolley = createTrolleyState({
      state: 'MAINTENANCE_PARKED',
      x: MAINTENANCE_ZONE_POS.x,
      z: MAINTENANCE_ZONE_POS.z,
      yaw: MAINTENANCE_ZONE_POS.yaw,
      brakeLocked: true,
      latchedBayId: null,
      carriedCubId: 'BT-M1',
      transferProgress: 1,
    });
    onLog('Mission 04 loaded: Cancel PTW, remove CME leads, re-insert BT-M1 VCB via trolley & restore to SERVICE.');
  }

  onRender();
  onReset();
}
