/**
 * Pure simulation state, cubicle definitions, electrical topology solver,
 * and metering calculations. Zero DOM or Three.js dependencies.
 */
import { createTrolleyState } from '../switchboard/trolley.js';

export const BAY_COLOR_VARS = {
  'DG1': 'var(--bay-c1)',
  'BT1': 'var(--bay-c2)',
  'BT-M1': 'var(--bay-c3)',
  'TR1-HV': 'var(--bay-c4)',
  'ACB-TR1-LV': 'var(--bay-c5)',
};

export function createCubicles() {
  return {
    'DG1': {
      id: 'DG1',
      code: 'C1',
      shortLabel: 'DG1 Gen',
      name: 'Cubicle 1 · HV Diesel Generator 1 (DG1)',
      purpose: 'Receives 6.6 kV, 60 Hz 3-phase power from Port Diesel Generator 1 (3,600 kVA) onto Bus A.',
      isHV: true,
      vcbClosed: true,
      rackingTurns: 20,
      vcbExtracted: false,
      rackingPadlocked: false,
      castellLockedOut: false,
      earthSwitchClosed: false,
      earthPadlocked: false,
      earthKeysInserted: [],
      doorOpen: false,
      sftDoorBypass: false,
      topShutterPadlocked: false,
      tags: { danger: false, earth: false, sft: false },
      cme: { pe: false, L1: false, L2: false, L3: false },
    },
    'BT1': {
      id: 'BT1',
      code: 'C2',
      shortLabel: 'Bus-Tie',
      name: 'Cubicle 2 · 6.6 kV Bus-Tie Breaker (BT1)',
      purpose: 'Couples Port 6.6 kV Bus A and Starboard 6.6 kV Bus B for symmetrical redundancy or split-bus DP.',
      isHV: true,
      vcbClosed: true,
      rackingTurns: 20,
      vcbExtracted: false,
      rackingPadlocked: false,
      castellLockedOut: false,
      earthSwitchClosed: false,
      earthPadlocked: false,
      earthKeysInserted: [],
      doorOpen: false,
      sftDoorBypass: false,
      topShutterPadlocked: false,
      tags: { danger: false, earth: false, sft: false },
      cme: { pe: false, L1: false, L2: false, L3: false },
    },
    'BT-M1': {
      id: 'BT-M1',
      code: 'C3',
      shortLabel: 'Bow Thruster',
      name: 'Cubicle 3 · Bow Thruster Feeder (BT-M1)',
      purpose: 'Supplies 6.6 kV, 60 Hz 3-phase power to Bow Thruster variable-frequency drive (1,800 kW).',
      isHV: true,
      machineryRunning: true,
      vcbClosed: true,
      rackingTurns: 20,
      vcbExtracted: false,
      rackingPadlocked: false,
      castellKeyId: 'K1-BT',
      castellLockedOut: false,
      earthSwitchClosed: false,
      earthPadlocked: false,
      earthKeysInserted: [],
      requiredEarthKeys: ['K1-BT'],
      doorOpen: false,
      sftDoorBypass: false,
      topShutterPadlocked: false,
      tags: { danger: false, earth: false, sft: false },
      cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false },
      testFunctionCheckedInTestPos: false,
    },
    'TR1-HV': {
      id: 'TR1-HV',
      code: 'C4',
      shortLabel: 'TR1 Primary',
      name: 'Cubicle 4 · Transformer Primary (TR1-HV)',
      purpose: 'Feeds 2,500 kVA 6.6 kV / 440 V Ship Service Step-Down Transformer TR1 (dual-key interlocked).',
      isHV: true,
      machineryRunning: false,
      vcbClosed: true,
      rackingTurns: 20,
      vcbExtracted: false,
      rackingPadlocked: false,
      castellKeyId: 'K-HV',
      castellLockedOut: false,
      earthSwitchClosed: false,
      earthPadlocked: false,
      earthKeysInserted: [],
      requiredEarthKeys: ['K-HV', 'K-LV'],
      doorOpen: false,
      sftDoorBypass: false,
      topShutterPadlocked: false,
      tags: { danger: false, earth: false, sft: false },
      cme: { pe: false, L1: false, L2: false, L3: false, removedProperly: false },
    },
    'ACB-TR1-LV': {
      id: 'ACB-TR1-LV',
      code: 'C5',
      shortLabel: '440V ACB',
      name: 'Cubicle 5 · 440 V LV Secondary (ACB-TR1-LV)',
      purpose: '440 V secondary air circuit breaker linking Transformer TR1 to the energized 440 V LV Bus. Isolate first to prevent 6.6 kV step-up back-feed.',
      isHV: false,
      machineryRunning: true,
      vcbClosed: true,
      rackingTurns: 0,
      rackingPadlocked: false,
      castellKeyId: 'K-LV',
      castellLockedOut: false,
      earthSwitchClosed: false,
      earthPadlocked: false,
      earthKeysInserted: [],
      doorOpen: false,
      tags: { danger: false, earth: false, sft: false },
      cme: { pe: false, L1: false, L2: false, L3: false },
    },
  };
}

export function createSimState() {
  return {
    missionId: 1,
    mode: 'TRAIN',
    score: 100,
    missionCompleted: false,
    selectedCubicle: 'BT-M1',
    activeTool: 'HAND',
    lastProbedTerminal: null,

    ppe: {
      suit: false,
      glovesAirTested: false,
      gloves: false,
      bootsMat: false,
    },

    keys: {
      'K1-BT': 'VCB_TRAPPED',
      'K-HV': 'VCB_TRAPPED',
      'K-LV': 'VCB_TRAPPED',
    },
    keyBoxLocked: false,

    ptp: {
      state: 0,
      targetCubicle: 'BT-M1',
      phasesTested: { L1: false, L2: false, L3: false },
      completedCubicles: {},
    },

    megger: {
      connectedCubicle: null,
      tested: false,
      ir1Min: null,
      ir10Min: null,
      piRatio: null,
      windingChargeVolts: 0,
      dischargedProperly: false,
    },

    ptw: {
      active: false,
      cancelled: false,
      targetCubicle: 'BT-M1',
      signedETO: false,
      signedCompetent: false,
    },

    sft: {
      active: false,
      cancelledAfterTest: false,
      targetCubicle: 'BT-M1',
      signedETO: false,
    },

    trolley: createTrolleyState(),

    cubicles: createCubicles(),
  };
}

export function getTopology(sim) {
  if (!sim.cubicles || !sim.cubicles['DG1']) {
    sim.cubicles = createCubicles();
  }
  const c = sim.cubicles;
  const portLive = c['DG1'].vcbClosed && c['DG1'].rackingTurns === 20;
  const stbdLive = portLive && c['BT1'].vcbClosed && c['BT1'].rackingTurns === 20;

  let btVolts = 0;
  if (stbdLive && c['BT-M1'].vcbClosed && c['BT-M1'].rackingTurns === 20) {
    btVolts = 6600;
  } else if (sim.megger.connectedCubicle === 'BT-M1' && sim.megger.windingChargeVolts > 0) {
    btVolts = sim.megger.windingChargeVolts;
  }

  let trVolts = 0;
  let trBackfed = false;
  if (stbdLive && c['TR1-HV'].vcbClosed && c['TR1-HV'].rackingTurns === 20) {
    trVolts = 6600;
  } else if (c['ACB-TR1-LV'].vcbClosed) {
    trVolts = 6600;
    trBackfed = true;
  }

  const isEarthed = (id) => {
    const cub = c[id];
    return cub.earthSwitchClosed || (cub.cme.pe && cub.cme.L1 && cub.cme.L2 && cub.cme.L3);
  };

  return {
    portLive,
    stbdLive,
    btVolts,
    trVolts,
    trBackfed,
    btEarthed: isEarthed('BT-M1'),
    trEarthed: isEarthed('TR1-HV'),
  };
}

export function isFullPPE(sim) {
  return Boolean(sim?.ppe?.suit && sim?.ppe?.glovesAirTested && sim?.ppe?.gloves && sim?.ppe?.bootsMat);
}

export function rackPos(turns) {
  return turns >= 20 ? 20 : (turns <= 0 ? 0 : 10);
}

export function bayMetering(id, sim, topo) {
  const c = sim.cubicles;
  const btA = (topo.btVolts >= 6000 && c['BT-M1'].machineryRunning) ? 171 : 0;
  const trA = (topo.trVolts >= 6000 && !topo.trBackfed) ? 36 : 0;
  switch (id) {
    case 'DG1':
      return { kV: topo.portLive ? 6.6 : 0, amps: topo.portLive ? btA + trA : 0, bus: topo.portLive, load: true, earthed: c['DG1'].earthSwitchClosed, backfed: false };
    case 'BT1':
      return { kV: topo.stbdLive ? 6.6 : 0, amps: topo.stbdLive ? btA + trA : 0, bus: topo.portLive, load: topo.stbdLive, earthed: c['BT1'].earthSwitchClosed, backfed: false };
    case 'BT-M1':
      return { kV: topo.btVolts / 1000, amps: btA, bus: topo.stbdLive, load: topo.btVolts > 0, earthed: topo.btEarthed, backfed: false };
    default:
      return { kV: topo.trVolts / 1000, amps: trA, bus: topo.stbdLive, load: topo.trVolts > 0, earthed: topo.trEarthed, backfed: topo.trBackfed };
  }
}
