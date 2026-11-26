import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimState } from '../sim/state.js';
import { isControlAccessible, resolveControlInteraction } from './interaction.js';

test('isControlAccessible gates interior terminals and shutter padlock behind open compartment door', () => {
  const sim = createSimState();
  const bt = sim.cubicles['BT-M1'];

  bt.doorOpen = false;
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'L1' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'L2' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'L3' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'PE' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'shutterPadlock' }, sim), false);

  // Exterior controls remain accessible while door is closed
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'tripBtn' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'rackPort' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'doorHandle' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'ek6Socket' }, sim), true);

  bt.doorOpen = true;
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'L1' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'PE' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'shutterPadlock' }, sim), true);
});

test('resolveControlInteraction maps open phase terminals to proving wand or CME earth stick', () => {
  const sim = createSimState();
  sim.selectedCubicle = 'BT-M1';
  sim.cubicles['BT-M1'].doorOpen = true;
  sim.activeTool = 'HV_TESTER';
  sim.ptp.state = 1;

  const l2 = resolveControlInteraction({ cubId: 'BT-M1', terminalId: 'L2' }, sim);
  assert.ok(l2);
  assert.equal(l2.action.exec, 'probePhase');
  assert.deepEqual(l2.action.arg, { cubId: 'BT-M1', phase: 'L2' });
  assert.equal(l2.socketId, 'L2');

  // PE terminal always maps to CME ground lead
  const pe = resolveControlInteraction({ cubId: 'BT-M1', terminalId: 'PE' }, sim);
  assert.ok(pe);
  assert.equal(pe.action.exec, 'cmeTerminal');
  assert.deepEqual(pe.action.arg, { cubId: 'BT-M1', phase: 'PE' });

  // Portable earth tool switches L1-L3 click action to CME clamping
  sim.activeTool = 'PORTABLE_EARTH';
  const l1Cme = resolveControlInteraction({ cubId: 'BT-M1', terminalId: 'L1' }, sim);
  assert.equal(l1Cme.action.exec, 'cmeTerminal');
  assert.deepEqual(l1Cme.action.arg, { cubId: 'BT-M1', phase: 'L1' });
});

test('resolveControlInteraction handles TR1-HV dual Castell keys, racking port, and LV ACB controls', () => {
  const sim = createSimState();

  const k1 = resolveControlInteraction({ cubId: 'TR1-HV', controlId: 'earthKey1' }, sim);
  const k2 = resolveControlInteraction({ cubId: 'TR1-HV', controlId: 'earthKey2' }, sim);
  assert.deepEqual(k1.action.arg, { cubId: 'TR1-HV', keyId: 'K-HV' });
  assert.deepEqual(k2.action.arg, { cubId: 'TR1-HV', keyId: 'K-LV' });

  const rackOut = resolveControlInteraction({ cubId: 'BT-M1', controlId: 'rackPort' }, sim);
  assert.equal(rackOut.action.exec, 'rackOut');

  sim.cubicles['BT-M1'].rackingTurns = 0;
  const rackIn = resolveControlInteraction({ cubId: 'BT-M1', controlId: 'rackPort' }, sim);
  assert.equal(rackIn.action.exec, 'rackIn');

  sim.activeTool = 'PADLOCK';
  const rackPadlock = resolveControlInteraction({ cubId: 'BT-M1', controlId: 'rackPort' }, sim);
  assert.equal(rackPadlock.action.exec, 'toggleRackingPadlock');

  const lvTrip = resolveControlInteraction({ cubId: 'ACB-TR1-LV', controlId: 'tripBtn' }, sim);
  assert.equal(lvTrip.action.exec, 'tripVcb');
  assert.equal(lvTrip.action.arg, 'ACB-TR1-LV');
});

test('isControlAccessible disables breaker-mounted controls when VCB cassette is withdrawn onto trolley', () => {
  const sim = createSimState();
  const bt = sim.cubicles['BT-M1'];
  bt.doorOpen = true;
  bt.vcbExtracted = true;

  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'tripBtn' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'closeBtn' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'rackPort' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'rackingPadlock' }, sim), false);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'castellVcb' }, sim), false);

  // Stationary bay controls & terminals remain accessible
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'ek6Socket' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', controlId: 'shutterPadlock' }, sim), true);
  assert.equal(isControlAccessible({ cubId: 'BT-M1', terminalId: 'L1' }, sim), true);

  const rearCover = resolveControlInteraction({ cubId: 'BT1', controlId: 'rearDoorHandle' }, sim);
  assert.ok(rearCover);
  assert.equal(rearCover.action.exec, 'toggleRearDoor');
  assert.equal(rearCover.action.arg, 'BT1');

  assert.equal(isControlAccessible({ cubId: 'BT1', controlId: 'rearBusTieBolt' }, sim), false);
  sim.cubicles['BT1'].rearDoorOpen = true;
  assert.equal(isControlAccessible({ cubId: 'BT1', controlId: 'rearBusTieBolt' }, sim), true);
  const boltHit = resolveControlInteraction({ cubId: 'BT1', controlId: 'rearBusTieBolt' }, sim);
  assert.equal(boltHit.action.exec, 'torqueRearBolt');
  assert.equal(boltHit.socketId, 'rearBusTieBolt');
});
