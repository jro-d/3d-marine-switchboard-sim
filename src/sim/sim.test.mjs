import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimState, getTopology } from './state.js';
import { createSimActions } from './interlocks.js';
import { getLotoSteps, initMission } from './missions.js';

function equipFullPpe(sim) {
  sim.ppe = { suit: true, glovesAirTested: true, gloves: true, bootsMat: true };
}

test('proveTesterOnUnit sets HV_TESTER and interactTerminal probes L1-L3 cleanly', () => {
  const sim = createSimState();
  const actions = createSimActions(sim);
  equipFullPpe(sim);

  actions.pressTripVCB('BT-M1');
  actions.rackVCB('BT-M1', -20);
  actions.toggleCastellVCBLock('BT-M1');
  actions.toggleRackingPadlock('BT-M1');
  actions.toggleEarthSwitchKey('BT-M1', 'K1-BT');
  actions.toggleIntegralEarthSwitch('BT-M1');
  actions.toggleEarthPadlock('BT-M1');
  actions.toggleSafetyKeyBox();
  actions.toggleDoor3D('BT-M1');
  actions.toggleShutterPadlock('BT-M1');

  actions.proveTesterOnUnit();
  assert.equal(sim.activeTool, 'HV_TESTER');
  assert.equal(sim.ptp.state, 1);

  // Probing is blocked while VCB cassette still occupies the compartment
  actions.interactTerminal('BT-M1', 'L1');
  assert.equal(sim.ptp.phasesTested.L1, false);

  // Latch VCB trolley & withdraw cassette before proving L1-L3
  actions.latchTrolley('BT-M1');
  actions.withdrawVcbToTrolley('BT-M1');
  actions.unlatchTrolley();
  actions.releaseTrolley();

  actions.interactTerminal('BT-M1', 'L1');
  actions.interactTerminal('BT-M1', 'L2');
  // Simulate defensive transition if VOLTAGE_TESTER was ever set externally
  sim.activeTool = 'VOLTAGE_TESTER';
  actions.interactTerminal('BT-M1', 'L3');

  assert.deepEqual(sim.ptp.phasesTested, { L1: true, L2: true, L3: true });
  assert.equal(sim.ptp.state, 2);
  assert.equal(sim.activeTool, 'HV_TESTER');

  actions.proveTesterOnUnit();
  assert.equal(sim.ptp.state, 3);
  assert.equal(sim.ptp.completedCubicles['BT-M1'], true);

  actions.issuePTW();
  const steps = getLotoSteps(sim);
  assert.equal(steps.every((s) => s.done), true);
});

test('Missions 3 and 4 start with BT-M1 VCB withdrawn on the trolley at the Maintenance Bay', () => {
  const sim = createSimState();
  for (const mId of [3, 4]) {
    initMission(sim, mId);
    assert.equal(sim.cubicles['BT-M1'].vcbExtracted, true);
    assert.equal(sim.trolley.state, 'MAINTENANCE_PARKED');
    assert.equal(sim.trolley.carriedCubId, 'BT-M1');
  }
});

test('getLotoSteps omits one-click actionFn macros across Missions 1-5', () => {
  const sim = createSimState();
  for (const mId of [1, 2, 3, 4, 5]) {
    initMission(sim, mId);
    const steps = getLotoSteps(sim);
    assert.equal(steps.length, 6);
    for (const step of steps) {
      assert.equal('actionFn' in step, false, `Mission ${mId} step should not define actionFn`);
      assert.equal('actionText' in step, false, `Mission ${mId} step should not define actionText`);
    }
  }
});

test('interlocks block live racking and live earthing with -5 score deduction', () => {
  const sim = createSimState();
  const violations = [];
  const actions = createSimActions(sim, {
    onViolation: (v) => violations.push(v),
  });
  equipFullPpe(sim);

  // Attempting to rack closed VCB triggers Tier 2 arc-flash interlock
  actions.rackVCB('BT-M1', -10);
  assert.equal(sim.score, 95);
  assert.equal(sim.cubicles['BT-M1'].rackingTurns, 20);
  assert.equal(violations.at(-1).catastrophic, true);

  // Topology reflects live bus on BT-M1 before trip
  assert.equal(getTopology(sim).btVolts, 6600);
});

test('toggleRearDoor blocks live or unearthed opening and opens safely once isolated', () => {
  const sim = createSimState();
  const actions = createSimActions(sim);
  equipFullPpe(sim);

  // Blocked while BT-M1 is energized in SERVICE
  assert.equal(actions.toggleRearDoor('BT-M1'), false);
  assert.equal(sim.cubicles['BT-M1'].rearDoorOpen, false);
  assert.equal(sim.score, 95);

  // Isolate and earth BT-M1
  actions.pressTripVCB('BT-M1');
  actions.rackVCB('BT-M1', -20);
  // Still blocked before EK6 earth switch is closed
  assert.equal(actions.toggleRearDoor('BT-M1'), false);
  assert.equal(sim.cubicles['BT-M1'].rearDoorOpen, false);

  actions.toggleCastellVCBLock('BT-M1');
  actions.toggleEarthSwitchKey('BT-M1', 'K1-BT');
  actions.toggleIntegralEarthSwitch('BT-M1');
  assert.equal(actions.toggleRearDoor('BT-M1'), true);
  assert.equal(sim.cubicles['BT-M1'].rearDoorOpen, true);

  // BT1 bus-tie rear splice chamber opens safely once BT1 VCB is withdrawn & red shutter padlocked
  actions.pressTripVCB('BT1');
  actions.rackVCB('BT1', -20);
  sim.cubicles['BT1'].doorOpen = true;
  actions.latchTrolley('BT1');
  actions.withdrawVcbToTrolley('BT1');
  actions.unlatchTrolley();
  actions.releaseTrolley();
  actions.toggleShutterPadlock('BT1');
  assert.equal(actions.toggleRearDoor('BT1'), true);
  assert.equal(sim.cubicles['BT1'].rearDoorOpen, true);
});

test('Mission 05 completes BT1 bus-tie isolation, DLRO tulip repair, rear bolt torque, and restoration at 100/100', () => {
  const sim = createSimState();
  const actions = createSimActions(sim);
  initMission(sim, 5);
  equipFullPpe(sim);

  // DG1 Bus A remains live while BT1 is isolated
  assert.equal(getTopology(sim).portLive, true);
  assert.equal(sim.cubicles['BT1'].vcbClosed, true);

  // Isolate BT1 & open compartment door
  actions.pressTripVCB('BT1');
  actions.rackVCB('BT1', -20);
  actions.toggleRackingPadlock('BT1');
  actions.toggleDoor3D('BT1');
  assert.equal(sim.cubicles['BT1'].doorOpen, true);

  // Withdraw BT1 VCB onto trolley & park at Maintenance Bay
  actions.grabTrolley();
  actions.latchTrolley('BT1');
  actions.withdrawVcbToTrolley('BT1');
  actions.unlatchTrolley();
  sim.trolley.x = -3.72;
  sim.trolley.z = 1.16;
  actions.releaseTrolley();
  assert.equal(sim.trolley.state, 'MAINTENANCE_PARKED');
  assert.equal(sim.trolley.carriedCubId, 'BT1');

  // Padlock red Bus-A shutter & Prove-Test-Prove L1-L3 dead on BT1
  actions.toggleShutterPadlock('BT1');
  actions.selectCubicle('BT1');
  actions.proveTesterOnUnit();
  assert.equal(sim.ptp.targetCubicle, 'BT1');
  actions.interactTerminal('BT1', 'L1');
  actions.interactTerminal('BT1', 'L2');
  actions.interactTerminal('BT1', 'L3');
  actions.proveTesterOnUnit();
  assert.equal(sim.ptp.completedCubicles['BT1'], true);

  // Workbench troubleshooting: DLRO test detects 184 uOhm fault -> replace L2 tulip cluster -> 22 uOhm PASS
  assert.equal(actions.runContactResistanceTest(), true);
  assert.equal(sim.troubleshooting.contactResistanceMicroOhm, 184);
  assert.equal(actions.replaceVcbTulipContact(), true);
  assert.equal(sim.troubleshooting.tulipReplaced, true);
  assert.equal(sim.troubleshooting.contactResistanceMicroOhm, 22);

  // Rear Aisle inspection: unbolt Rear C2, torque loose M16 splice bolt (18 -> 45 N·m), close Rear C2
  assert.equal(actions.toggleRearDoor('BT1'), true);
  assert.equal(actions.torqueRearBusTieBolt('BT1'), true);
  assert.equal(sim.troubleshooting.rearBoltTorqueNm, 45);
  assert.equal(actions.toggleRearDoor('BT1'), true);
  assert.equal(sim.cubicles['BT1'].rearDoorOpen, false);

  // Restore BT1 via trolley -> TEST (10/20) Close/Trip -> SERVICE (20/20)
  actions.toggleShutterPadlock('BT1');
  actions.grabTrolley();
  actions.latchTrolley('BT1');
  actions.reinsertVcbFromTrolley('BT1');
  actions.unlatchTrolley();
  actions.releaseTrolley();
  actions.toggleDoor3D('BT1');
  actions.toggleRackingPadlock('BT1');

  actions.rackVCB('BT1', 10);
  actions.pressCloseVCB('BT1');
  actions.pressTripVCB('BT1');
  actions.rackVCB('BT1', 10);

  assert.equal(sim.score, 100);
  assert.equal(getLotoSteps(sim).every((s) => s.done), true);
});
