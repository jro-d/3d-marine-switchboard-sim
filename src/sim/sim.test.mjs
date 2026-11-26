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

test('getLotoSteps omits one-click actionFn macros across Missions 1-4', () => {
  const sim = createSimState();
  for (const mId of [1, 2, 3, 4]) {
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
