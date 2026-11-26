import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_BOUNDS,
  PLAYER_RADIUS,
  STATIONS,
  computeWalkWaypoints,
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
    trolley: { state: 'PARKED', x: 3.72, z: 1.16, yaw: Math.PI, brakeLocked: true, latchedBayId: null, carriedCubId: null, transferProgress: 0 },
    cubicles: {
      'DG1': { id: 'DG1', isHV: true, vcbClosed: true, rackingTurns: 20, vcbExtracted: false, rackingPadlocked: false, castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false } },
      'BT1': { id: 'BT1', isHV: true, vcbClosed: true, rackingTurns: 20, vcbExtracted: false, rackingPadlocked: false, castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false } },
      'BT-M1': { id: 'BT-M1', isHV: true, vcbClosed: true, rackingTurns: 20, vcbExtracted: false, rackingPadlocked: false, castellKeyId: 'K1-BT', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], requiredEarthKeys: ['K1-BT'], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false }, testFunctionCheckedInTestPos: false },
      'TR1-HV': { id: 'TR1-HV', isHV: true, vcbClosed: true, rackingTurns: 20, vcbExtracted: false, rackingPadlocked: false, castellKeyId: 'K-HV', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], requiredEarthKeys: ['K-HV', 'K-LV'], doorOpen: false, topShutterPadlocked: false, cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false } },
      'ACB-TR1-LV': { id: 'ACB-TR1-LV', isHV: false, vcbClosed: true, rackingTurns: 0, vcbExtracted: false, rackingPadlocked: false, castellKeyId: 'K-LV', castellLockedOut: false, earthSwitchClosed: false, earthPadlocked: false, earthKeysInserted: [], doorOpen: false, cme: { pe: false, L1: false, L2: false, L3: false } },
    },
  };
}

test('resolveCollision clamps player within room bounds and outside switchboard AABB', () => {
  const farOut = resolveCollision(-10, 10, PLAYER_RADIUS);
  assert.ok(farOut.x >= ROOM_BOUNDS.minX + PLAYER_RADIUS - 1e-6);
  assert.ok(farOut.z <= ROOM_BOUNDS.maxZ - PLAYER_RADIUS + 1e-6);

  const intoBoard = resolveCollision(0, 0.2, PLAYER_RADIUS);
  assert.ok(intoBoard.z >= 0.60 + PLAYER_RADIUS - 1e-6, `Expected z >= ${0.60 + PLAYER_RADIUS}, got ${intoBoard.z}`);

  const intoLocker = resolveCollision(-4.7, 2.95, PLAYER_RADIUS);
  assert.ok(intoLocker.x >= -4.42 + PLAYER_RADIUS - 1e-6, `Expected x >= ${-4.42 + PLAYER_RADIUS}, got ${intoLocker.x}`);

  // Rear Bus-Tie Aisle behind switchboard is walkable
  const inRearAisle = resolveCollision(-0.84, -1.35, PLAYER_RADIUS);
  assert.ok(Math.abs(inRearAisle.x - (-0.84)) < 1e-6);
  assert.ok(Math.abs(inRearAisle.z - (-1.35)) < 1e-6);
});

test('stepPlayerMovement handles camera-relative WASD and click-to-walk arrival', () => {
  const start = { x: 0, z: 2.8, yaw: Math.PI, speed: 0, walkCycle: 0, targetPoint: null, isBusy: false };
  const moved = stepPlayerMovement(start, { forward: true, backward: false, left: false, right: false, cameraYaw: Math.PI }, 0.05);
  assert.ok(moved.z < start.z, 'Forward when facing -Z should reduce z');
  assert.ok(moved.speed > 1.0);

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
  assert.equal(getRecommendedTarget(sim).stationId, 'station:trolley');

  bt.vcbExtracted = true;
  sim.trolley.carriedCubId = 'BT-M1';
  sim.trolley.state = 'MAINTENANCE_PARKED';
  bt.topShutterPadlocked = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'station:test');

  sim.ptp.state = 1;
  assert.equal(getRecommendedTarget(sim).stationId, 'bay:BT-M1');

  sim.ptp.completedCubicles['BT-M1'] = true;
  assert.equal(getRecommendedTarget(sim).stationId, 'station:permit');
});

test('getStationActions provides individual L1, L2, L3 probe actions once VCB is withdrawn', () => {
  const sim = makeBaseSim(1);
  const bt = sim.cubicles['BT-M1'];
  bt.vcbClosed = false;
  bt.rackingTurns = 0;
  bt.earthSwitchClosed = true;
  bt.doorOpen = true;
  bt.vcbExtracted = true;
  sim.ptp.state = 1;

  const actions = getStationActions('bay:BT-M1', sim);
  assert.equal(actions.some((a) => a.id === 'probe_all_phases'), false);
  const p1 = actions.find((a) => a.id === 'probe_L1');
  const p2 = actions.find((a) => a.id === 'probe_L2');
  const p3 = actions.find((a) => a.id === 'probe_L3');
  assert.ok(p1 && p2 && p3);
  assert.equal(p1.exec, 'probePhase');
  assert.equal(p1.primary, true);
  assert.equal(p2.primary, false);

  sim.ptp.phasesTested.L1 = true;
  const actionsAfterL1 = getStationActions('bay:BT-M1', sim);
  assert.equal(actionsAfterL1.find((a) => a.id === 'probe_L1').done, true);
  assert.equal(actionsAfterL1.find((a) => a.id === 'probe_L2').primary, true);
});

test('resolveCollision respects dynamic trolley obstacle AABB when provided', () => {
  const trolleyBox = { id: 'vcb-trolley', minX: -0.36, maxX: 0.36, minZ: 1.80, maxZ: 2.64 };
  const blocked = resolveCollision(0, 2.2, PLAYER_RADIUS, [trolleyBox]);
  const distFromCenter = Math.max(Math.abs(blocked.x), Math.abs(blocked.z - 2.22));
  assert.ok(distFromCenter >= 0.36, 'Player should be pushed outside dynamic trolley AABB');
});

test('findNearestInteractable prioritizes parked VCB trolley when standing behind its push-bar', () => {
  const sim = makeBaseSim(1);
  // Stand at the auto-walk stop behind the starboard parked trolley push-bar
  const found = findNearestInteractable(3.72, 1.16 + 0.85, sim);
  assert.equal(found?.id, 'station:trolley');
});

test('computeWalkWaypoints routes around corridor from front room to Rear Bus-Tie Aisle', () => {
  const pts = computeWalkWaypoints(0.0, 2.8, -0.84, -1.28, 0);
  assert.ok(pts.length >= 3, 'Should emit intermediate corridor corners around switchboard');
  assert.ok(Math.abs(pts[0].x) >= 2.8, 'First waypoint should step out to side corridor');

  let p = {
    x: 0.0,
    z: 2.8,
    yaw: Math.PI,
    speed: 0,
    walkCycle: 0,
    targetPoint: pts[0],
    waypoints: pts.slice(1),
    isBusy: false,
  };
  let arrived = false;
  for (let i = 0; i < 240; i++) {
    p = stepPlayerMovement(p, { forward: false, backward: false, left: false, right: false }, 0.05);
    if (p.arrived) {
      arrived = true;
      break;
    }
  }
  assert.equal(arrived, true, 'Player should arrive at rear:BT1 without getting stuck on switchboard');
  assert.ok(Math.hypot(p.x - (-0.84), p.z - (-1.28)) < 0.14);

  const sim = makeBaseSim(1);
  const rearActions = getStationActions('rear:BT1', sim);
  assert.equal(rearActions[0]?.exec, 'toggleRearDoor');
});
