import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_BOUNDS,
  PLAYER_RADIUS,
  STATIONS,
  resolveCollision,
  stepPlayerMovement,
  findNearestInteractable,
  getRecommendedTarget,
  getStationActions,
} from './navigation.js';

function makeBaseSim(missionId = 1) {
  return {
    missionId,
    mode: 'TRAIN',
    ppe: { suit: false, glovesAirTested: false, gloves: false, bootsMat: false },
    keyBoxLocked: false,
    ptp: { state: 0, phasesTested: { L1: false, L2: false, L3: false }, completedCubicles: {} },
    megger: { connectedCubicle: null, tested: false, windingChargeVolts: 0, dischargedProperly: false },
    ptw: { active: false, cancelled: false, targetCubicle: 'BT-M1' },
    sft: { active: false, cancelledAfterTest: false },
    cubicles: {
      'DG1': { id: 'DG1', isHV: true, vcbClosed: true, rackingTurns: 20, rackingPadlocked: false, castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false } },
      'BT1': { id: 'BT1', isHV: true, vcbClosed: true, rackingTurns: 20, rackingPadlocked: false, castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false } },
      'BT-M1': { id: 'BT-M1', isHV: true, vcbClosed: true, rackingTurns: 20, rackingPadlocked: false, castellKeyId: 'K1-BT', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], requiredEarthKeys: ['K1-BT'], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false }, testFunctionCheckedInTestPos: false },
      'TR1-HV': { id: 'TR1-HV', isHV: true, vcbClosed: true, rackingTurns: 20, rackingPadlocked: false, castellKeyId: 'K-HV', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], requiredEarthKeys: ['K-HV', 'K-LV'], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false } },
      'ACB-TR1-LV': { id: 'ACB-TR1-LV', isHV: false, vcbClosed: true, rackingTurns: 0, rackingPadlocked: false, castellKeyId: 'K-LV', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, cme: { pe: false, L1: false, L2: false, L3: false } },
    },
  };
}

test('resolveCollision clamps player within room bounds and outside switchboard AABB', () => {
  const farOut = resolveCollision(-10, 10, PLAYER_RADIUS);
  assert.ok(farOut.x >= ROOM_BOUNDS.minX + PLAYER_RADIUS - 1e-6);
  assert.ok(farOut.z <= ROOM_BOUNDS.maxZ - PLAYER_RADIUS + 1e-6);

  // Attempting to walk inside switchboard bays should be pushed out to z >= 0.78 + radius
  const intoBoard = resolveCollision(0, 0.2, PLAYER_RADIUS);
  assert.ok(intoBoard.z >= 0.78 + PLAYER_RADIUS - 1e-6, `Expected z >= ${0.78 + PLAYER_RADIUS}, got ${intoBoard.z}`);

  // Attempting to walk inside PPE locker should be pushed clear of x = -3.40 + radius
  const intoLocker = resolveCollision(-3.7, 2.5, PLAYER_RADIUS);
  assert.ok(intoLocker.x >= -3.40 + PLAYER_RADIUS - 1e-6, `Expected x >= ${-3.40 + PLAYER_RADIUS}, got ${intoLocker.x}`);
});

test('stepPlayerMovement handles camera-relative WASD and click-to-walk arrival', () => {
  const start = { x: 0, z: 2.8, yaw: Math.PI, speed: 0, walkCycle: 0, targetPoint: null, isBusy: false };
  // Camera facing -Z (yaw = Math.PI): pressing forward decreases Z
  const moved = stepPlayerMovement(start, { forward: true, backward: false, left: false, right: false, cameraYaw: Math.PI }, 0.05);
  assert.ok(moved.z < start.z, 'Forward when facing -Z should reduce z');
  assert.ok(moved.speed > 1.0);

  // Click-to-walk arrives cleanly at destination
  let p = { ...start, targetPoint: { x: 0.4, z: 2.8, faceYaw: 0 } };
  let arrived = false;
  for (let i = 0; i < 30; i++) {
    p = stepPlayerMovement(p, { forward: false, backward: false, left: false, right: false }, 0.05);
    if (p.arrived) { arrived = true; break; }
  }
  assert.equal(arrived, true);
  assert.ok(Math.abs(p.x - 0.4) < 0.12);
});

test('findNearestInteractable detects bays and room stations at their anchors', () => {
  for (const st of STATIONS) {
    const found = findNearestInteractable(st.anchor.x, st.anchor.z);
    assert.equal(found?.id, st.id, `Expected ${st.id} at its anchor`);
  }
  const middle = findNearestInteractable(0, 3.0);
  assert.equal(middle, null, 'Center walkway should have no overlapping station');
});

test('getRecommendedTarget tracks full Mission 01 sequence across physical stations', () => {
  const sim = makeBaseSim(1);
  assert.equal(getRecommendedTarget(sim).stationId, 'station:ppe');

  sim.ppe = { suit: true, glovesAirTested: true, gloves: true, bootsMat: true };
  assert.equal(getRecommendedTarget(sim).stationId, 'bay:BT-M1');

  const bt = sim.cubicles['BT-M1'];
  bt.vcbClosed = false;
  bt.rackingTurns = 0;
  bt.castellLockedOut = true;
  bt.rackingPadlocked = true;
  bt.earthKeysInserted = ['K1-BT'];
  bt.earthSwitchClosed = true;
  bt.earthPadlocked = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'station:keys');

  sim.keyBoxLocked = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'bay:BT-M1');

  bt.doorOpen = true;
  bt.topShutterPadlocked = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'station:test');

  sim.ptp.state = 1;
  assert.equal(getRecommendedTarget(sim).stationId, 'bay:BT-M1');

  sim.ptp.completedCubicles['BT-M1'] = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'station:permit');
});

test('getStationActions provides animated actions with tools for stations and bays', () => {
  const sim = makeBaseSim(1);
  const ppeActions = getStationActions('station:ppe', sim, {});
  assert.ok(ppeActions.some((a) => a.exec === 'donAllPpe' && a.anim === 'don_ppe'));

  const bayActions = getStationActions('bay:BT-M1', sim, {});
  assert.ok(bayActions.some((a) => a.exec === 'tripVcb' && a.anim === 'push_button'));
  assert.ok(bayActions.some((a) => a.exec === 'rackOut' && a.tool === 'racking_handle'));
  assert.ok(bayActions.some((a) => a.exec === 'toggleEarthSwitch' && a.anim === 'pull_lever'));
});
