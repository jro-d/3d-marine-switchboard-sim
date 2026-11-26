import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimState } from '../sim/state.js';
import { createSimActions } from '../sim/interlocks.js';
import {
  MAINTENANCE_ZONE_POS,
  TROLLEY_ALIGN_Z,
  TROLLEY_PARK_POS,
  TROLLEY_PUSH_OFFSET,
  findAlignableBay,
  getTrolleyObstacleAabb,
  stepTrolleyFollow,
} from './trolley.js';

function prepOpenBayForWithdrawal(sim, actions, cubId = 'BT-M1') {
  sim.ppe = { suit: true, glovesAirTested: true, gloves: true, bootsMat: true };
  actions.pressTripVCB(cubId);
  actions.rackVCB(cubId, -20);
  actions.toggleCastellVCBLock(cubId);
  actions.toggleRackingPadlock(cubId);
  actions.toggleEarthSwitchKey(cubId, 'K1-BT');
  actions.toggleIntegralEarthSwitch(cubId);
  actions.toggleEarthPadlock(cubId);
  actions.toggleSafetyKeyBox();
  actions.toggleDoor3D(cubId);
}

test('VCB trolley completes full withdrawal and re-insertion state lifecycle', () => {
  const sim = createSimState();
  const actions = createSimActions(sim);
  prepOpenBayForWithdrawal(sim, actions, 'BT-M1');

  assert.equal(sim.trolley.state, 'PARKED');
  assert.equal(sim.trolley.x, TROLLEY_PARK_POS.x);
  assert.ok(getTrolleyObstacleAabb(sim.trolley));

  // Grab push-bar: PARKED -> PUSHING (no obstacle AABB while pushing)
  actions.grabTrolley();
  assert.equal(sim.trolley.state, 'PUSHING');
  assert.equal(sim.trolley.brakeLocked, false);
  assert.equal(getTrolleyObstacleAabb(sim.trolley), null);

  // Follow player in front of C3 (BT-M1)
  const playerAtC3 = { x: 0.0, z: TROLLEY_ALIGN_Z + TROLLEY_PUSH_OFFSET, yaw: Math.PI };
  stepTrolleyFollow(sim.trolley, playerAtC3);
  assert.ok(Math.abs(sim.trolley.x - 0.0) < 1e-6);
  assert.ok(Math.abs(sim.trolley.z - TROLLEY_ALIGN_Z) < 1e-6);

  const align = findAlignableBay(sim.trolley, sim);
  assert.ok(align);
  assert.equal(align.cubId, 'BT-M1');
  assert.equal(align.mode, 'withdraw');

  // Latch guide rails: PUSHING -> RAIL_ALIGNED
  actions.latchTrolley('BT-M1');
  assert.equal(sim.trolley.state, 'RAIL_ALIGNED');
  assert.equal(sim.trolley.latchedBayId, 'BT-M1');

  // Door cannot close while trolley is latched
  actions.toggleDoor3D('BT-M1');
  assert.equal(sim.cubicles['BT-M1'].doorOpen, true);

  // Withdraw VCB cassette onto trolley: RAIL_ALIGNED -> EXTRACTED
  actions.withdrawVcbToTrolley('BT-M1');
  assert.equal(sim.trolley.state, 'EXTRACTED');
  assert.equal(sim.trolley.carriedCubId, 'BT-M1');
  assert.equal(sim.cubicles['BT-M1'].vcbExtracted, true);

  // Unlatch and wheel loaded trolley to Port-Forward Maintenance Bay
  actions.unlatchTrolley();
  assert.equal(sim.trolley.state, 'PUSHING');
  assert.equal(sim.trolley.latchedBayId, null);

  const playerAtMaint = { x: MAINTENANCE_ZONE_POS.x, z: MAINTENANCE_ZONE_POS.z + TROLLEY_PUSH_OFFSET, yaw: Math.PI };
  stepTrolleyFollow(sim.trolley, playerAtMaint);
  actions.releaseTrolley();
  assert.equal(sim.trolley.state, 'MAINTENANCE_PARKED');
  assert.equal(sim.trolley.brakeLocked, true);

  // Reverse flow: wheel back to C3, latch, re-insert VCB, unlatch, close door
  actions.grabTrolley();
  stepTrolleyFollow(sim.trolley, playerAtC3);
  const reinsertAlign = findAlignableBay(sim.trolley, sim);
  assert.equal(reinsertAlign?.mode, 'reinsert');

  actions.latchTrolley('BT-M1');
  actions.reinsertVcbFromTrolley('BT-M1');
  assert.equal(sim.cubicles['BT-M1'].vcbExtracted, false);
  assert.equal(sim.trolley.carriedCubId, null);
  assert.equal(sim.trolley.state, 'RAIL_ALIGNED');

  actions.unlatchTrolley();
  actions.releaseTrolley();
  actions.toggleDoor3D('BT-M1');
  assert.equal(sim.cubicles['BT-M1'].doorOpen, false);
});

test('interlocks block racking, closing, and unlatched withdrawal when VCB is withdrawn or door closed', () => {
  const sim = createSimState();
  const actions = createSimActions(sim);
  sim.ppe = { suit: true, glovesAirTested: true, gloves: true, bootsMat: true };

  // Cannot latch to closed door
  actions.latchTrolley('BT-M1');
  assert.equal(sim.trolley.latchedBayId, null);

  prepOpenBayForWithdrawal(sim, actions, 'BT-M1');
  actions.latchTrolley('BT-M1');
  actions.withdrawVcbToTrolley('BT-M1');
  actions.unlatchTrolley();
  actions.releaseTrolley();

  // Cannot close or rack VCB while cassette is on the trolley
  actions.pressCloseVCB('BT-M1');
  assert.equal(sim.cubicles['BT-M1'].vcbClosed, false);

  actions.rackVCB('BT-M1', 10);
  assert.equal(sim.cubicles['BT-M1'].rackingTurns, 0);
});
