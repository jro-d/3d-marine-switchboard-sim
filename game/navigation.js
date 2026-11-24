/**
 * Pure spatial navigation, collision resolution, station registry,
 * and mission guidance logic for the Marine HV 6.6 kV Switchroom Game.
 * Zero Three.js or DOM dependencies so all rules are unit-testable in Node.
 */

export const ROOM_BOUNDS = {
  minX: -3.95,
  maxX: 3.95,
  minZ: 0.92,
  maxZ: 5.15,
};

export const PLAYER_RADIUS = 0.28;
export const WALK_SPEED = 2.45;
export const SPRINT_SPEED = 3.55;
export const INTERACT_RADIUS = 1.38;

export const BAY_X = {
  'DG1': -1.68,
  'BT1': -0.84,
  'BT-M1': 0.0,
  'TR1-HV': 0.84,
  'ACB-TR1-LV': 1.68,
};

export const OBSTACLES = [
  // 5-bay 6.6 kV switchboard lineup footprint
  { id: 'switchboard', minX: -2.30, maxX: 2.30, minZ: -0.95, maxZ: 0.78 },
  // Port bulkhead PPE Locker
  { id: 'ppe-locker', minX: -4.25, maxX: -3.40, minZ: 1.75, maxZ: 3.25 },
  // Port-aft Key & Tool Board bench
  { id: 'key-bench', minX: -3.10, maxX: -1.35, minZ: 4.82, maxZ: 5.55 },
  // Starboard-aft Proving & Megger Test Bench
  { id: 'test-bench', minX: 1.35, maxX: 3.10, minZ: 4.82, maxZ: 5.55 },
  // Starboard bulkhead Permit Desk
  { id: 'permit-desk', minX: 3.40, maxX: 4.25, minZ: 1.75, maxZ: 3.25 },
];

export const STATIONS = [
  {
    id: 'bay:DG1',
    kind: 'bay',
    cubId: 'DG1',
    code: 'C1',
    label: 'C1 · DG1 Generator Incomer',
    shortLabel: 'C1 DG1',
    anchor: { x: BAY_X['DG1'], z: 1.36 },
    lookAt: { x: BAY_X['DG1'], z: 0.35 },
    faceYaw: Math.PI,
    radius: 0.92,
  },
  {
    id: 'bay:BT1',
    kind: 'bay',
    cubId: 'BT1',
    code: 'C2',
    label: 'C2 · 6.6 kV Bus-Tie (BT1)',
    shortLabel: 'C2 BT1',
    anchor: { x: BAY_X['BT1'], z: 1.36 },
    lookAt: { x: BAY_X['BT1'], z: 0.35 },
    faceYaw: Math.PI,
    radius: 0.92,
  },
  {
    id: 'bay:BT-M1',
    kind: 'bay',
    cubId: 'BT-M1',
    code: 'C3',
    label: 'C3 · Bow Thruster Feeder (BT-M1)',
    shortLabel: 'C3 BT-M1',
    anchor: { x: BAY_X['BT-M1'], z: 1.36 },
    lookAt: { x: BAY_X['BT-M1'], z: 0.35 },
    faceYaw: Math.PI,
    radius: 0.92,
  },
  {
    id: 'bay:TR1-HV',
    kind: 'bay',
    cubId: 'TR1-HV',
    code: 'C4',
    label: 'C4 · Transformer Primary (TR1-HV)',
    shortLabel: 'C4 TR1-HV',
    anchor: { x: BAY_X['TR1-HV'], z: 1.36 },
    lookAt: { x: BAY_X['TR1-HV'], z: 0.35 },
    faceYaw: Math.PI,
    radius: 0.92,
  },
  {
    id: 'bay:ACB-TR1-LV',
    kind: 'bay',
    cubId: 'ACB-TR1-LV',
    code: 'C5',
    label: 'C5 · 440 V LV Secondary (ACB)',
    shortLabel: 'C5 LV-ACB',
    anchor: { x: BAY_X['ACB-TR1-LV'], z: 1.36 },
    lookAt: { x: BAY_X['ACB-TR1-LV'], z: 0.35 },
    faceYaw: Math.PI,
    radius: 0.92,
  },
  {
    id: 'station:ppe',
    kind: 'room',
    code: 'PPE',
    label: 'HV PPE Locker · Port Bulkhead',
    shortLabel: 'PPE Locker',
    anchor: { x: -2.92, z: 2.50 },
    lookAt: { x: -3.85, z: 2.50 },
    faceYaw: -Math.PI / 2,
    radius: 1.35,
  },
  {
    id: 'station:keys',
    kind: 'room',
    code: 'KEYS',
    label: 'Key Box & Tool Board · Port-Aft',
    shortLabel: 'Key Board',
    anchor: { x: -2.22, z: 4.30 },
    lookAt: { x: -2.22, z: 5.10 },
    faceYaw: 0,
    radius: 1.35,
  },
  {
    id: 'station:test',
    kind: 'room',
    code: 'TEST',
    label: 'Proving Unit & 5 kV Megger Bench',
    shortLabel: 'Test Bench',
    anchor: { x: 2.22, z: 4.30 },
    lookAt: { x: 2.22, z: 5.10 },
    faceYaw: 0,
    radius: 1.35,
  },
  {
    id: 'station:permit',
    kind: 'room',
    code: 'PTW',
    label: 'Permit-to-Work Desk · Starboard',
    shortLabel: 'Permit Desk',
    anchor: { x: 2.92, z: 2.50 },
    lookAt: { x: 3.85, z: 2.50 },
    faceYaw: Math.PI / 2,
    radius: 1.35,
  },
];

export function getStationById(id) {
  return STATIONS.find((s) => s.id === id) || null;
}

export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dampAngle(current, target, lambda, dt) {
  const diff = normalizeAngle(target - current);
  const alpha = 1 - Math.exp(-lambda * dt);
  return normalizeAngle(current + diff * alpha);
}

/**
 * Clamp and slide a circle (x, z, radius) against room bounds and static AABB obstacles.
 */
export function resolveCollision(x, z, radius = PLAYER_RADIUS) {
  let rx = Math.max(ROOM_BOUNDS.minX + radius, Math.min(ROOM_BOUNDS.maxX - radius, x));
  let rz = Math.max(ROOM_BOUNDS.minZ + radius, Math.min(ROOM_BOUNDS.maxZ - radius, z));

  for (let pass = 0; pass < 2; pass++) {
    for (const box of OBSTACLES) {
      const nearestX = Math.max(box.minX, Math.min(box.maxX, rx));
      const nearestZ = Math.max(box.minZ, Math.min(box.maxZ, rz));
      const dx = rx - nearestX;
      const dz = rz - nearestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          // Inside AABB: push out along shallowest axis
          const penLeft = Math.abs(rx - box.minX);
          const penRight = Math.abs(box.maxX - rx);
          const penTop = Math.abs(rz - box.minZ);
          const penBottom = Math.abs(box.maxZ - rz);
          const m = Math.min(penLeft, penRight, penTop, penBottom);
          if (m === penLeft) rx = box.minX - radius;
          else if (m === penRight) rx = box.maxX + radius;
          else if (m === penTop) rz = box.minZ - radius;
          else rz = box.maxZ + radius;
        }
      }
    }
    rx = Math.max(ROOM_BOUNDS.minX + radius, Math.min(ROOM_BOUNDS.maxX - radius, rx));
    rz = Math.max(ROOM_BOUNDS.minZ + radius, Math.min(ROOM_BOUNDS.maxZ - radius, rz));
  }

  return { x: rx, z: rz };
}

/**
 * Step player locomotion from WASD input or active click-to-walk target.
 * Camera yaw convention: yaw = 0 looks toward +Z, yaw = PI looks toward -Z.
 */
export function stepPlayerMovement(player, input, dt) {
  const clampedDt = Math.min(Math.max(dt, 0), 0.1);
  if (player.isBusy) {
    return { ...player, speed: 0, arrived: false };
  }

  const moveForward = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
  const moveRight = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const hasManualInput = moveForward !== 0 || moveRight !== 0;

  let vx = 0;
  let vz = 0;
  let nextYaw = player.yaw;
  let targetPoint = player.targetPoint;
  let arrived = false;

  if (hasManualInput) {
    // Manual WASD cancels auto-walk
    targetPoint = null;
    const camYaw = input.cameraYaw ?? Math.PI;
    // Forward vector along camera look direction on XZ plane: (sin(camYaw), cos(camYaw))
    const fwdX = Math.sin(camYaw);
    const fwdZ = Math.cos(camYaw);
    // Right vector perpendicular to forward: (-cos(camYaw), sin(camYaw))
    const rightX = -Math.cos(camYaw);
    const rightZ = Math.sin(camYaw);

    let dirX = fwdX * moveForward + rightX * moveRight;
    let dirZ = fwdZ * moveForward + rightZ * moveRight;
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;

    const maxSpeed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    vx = dirX * maxSpeed;
    vz = dirZ * maxSpeed;

    const desiredYaw = Math.atan2(dirX, dirZ);
    nextYaw = dampAngle(player.yaw, desiredYaw, 12, clampedDt);
  } else if (targetPoint) {
    const dx = targetPoint.x - player.x;
    const dz = targetPoint.z - player.z;
    const dist = Math.hypot(dx, dz);

    if (dist <= 0.10) {
      arrived = true;
      if (typeof targetPoint.faceYaw === 'number') {
        nextYaw = dampAngle(player.yaw, targetPoint.faceYaw, 14, clampedDt);
      }
      targetPoint = null;
    } else {
      const speed = Math.min(WALK_SPEED * 1.12, dist / Math.max(clampedDt, 0.016));
      vx = (dx / dist) * speed;
      vz = (dz / dist) * speed;
      const desiredYaw = Math.atan2(dx, dz);
      nextYaw = dampAngle(player.yaw, desiredYaw, 12, clampedDt);
    }
  }

  const resolved = resolveCollision(player.x + vx * clampedDt, player.z + vz * clampedDt, PLAYER_RADIUS);
  const actualSpeed = clampedDt > 0 ? Math.hypot(resolved.x - player.x, resolved.z - player.z) / clampedDt : 0;
  const walkCycle = actualSpeed > 0.08 ? player.walkCycle + actualSpeed * clampedDt * 3.6 : player.walkCycle;

  return {
    ...player,
    x: resolved.x,
    z: resolved.z,
    yaw: nextYaw,
    speed: actualSpeed,
    walkCycle,
    targetPoint,
    arrived,
  };
}

/**
 * Find the closest interactive bay or room station within reach.
 */
export function findNearestInteractable(x, z) {
  let best = null;
  let bestScore = Infinity;

  for (const st of STATIONS) {
    const dx = x - st.anchor.x;
    const dz = z - st.anchor.z;
    const dist = Math.hypot(dx, dz);
    if (dist <= st.radius && dist < bestScore) {
      bestScore = dist;
      best = st;
    }
  }
  return best;
}

export function isFullPpeState(ppe) {
  return Boolean(ppe && ppe.suit && ppe.glovesAirTested && ppe.gloves && ppe.bootsMat);
}

/**
 * Compute the exact recommended physical room station / bay for the active mission step.
 * Powers the 3D floor guidance beacon and "Walk to Next Step" helper in Training Mode.
 */
export function getRecommendedTarget(sim) {
  if (!sim || !sim.cubicles || !sim.cubicles['BT-M1']) {
    return { stationId: 'station:ppe', hint: 'Walk to PPE Locker to don HV PPE' };
  }

  if (!isFullPpeState(sim.ppe)) {
    return {
      stationId: 'station:ppe',
      hint: 'Walk to the Port PPE Locker to air-test gloves & don full 40 cal/cm² PPE',
    };
  }

  const bt = sim.cubicles['BT-M1'];
  const tr = sim.cubicles['TR1-HV'];
  const lv = sim.cubicles['ACB-TR1-LV'];

  if (sim.missionId === 1) {
    if (bt.vcbClosed) return { stationId: 'bay:BT-M1', hint: 'Walk to C3 (BT-M1) and Trip Feeder VCB [O]' };
    if (bt.rackingTurns > 0) return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), crank VCB truck out to DISCONNECTED (0/20)' };
    if (!bt.castellLockedOut || !bt.rackingPadlocked) {
      return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), extract Castell key K1-BT & padlock racking port' };
    }
    if (!bt.earthKeysInserted.includes('K1-BT') || !bt.earthSwitchClosed || !bt.earthPadlocked) {
      return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), insert K1-BT, close EK6 earth switch & padlock it' };
    }
    if (!sim.keyBoxLocked) {
      return { stationId: 'station:keys', hint: 'Walk to the Key & Tool Board and lock the Safety Key Box' };
    }
    if (!bt.doorOpen || !bt.topShutterPadlocked) {
      return { stationId: 'bay:BT-M1', hint: 'Return to C3 (BT-M1), open VCB door & padlock red busbar shutter' };
    }
    if (!sim.ptp.completedCubicles['BT-M1']) {
      if (sim.ptp.state === 0 || sim.ptp.state === 2) {
        return { stationId: 'station:test', hint: 'Walk to the Proving Bench to verify the HV proving wand on the Proving Unit' };
      }
      return { stationId: 'bay:BT-M1', hint: 'Return to C3 (BT-M1) and probe L1, L2, L3 cable terminals dead' };
    }
    if (!sim.ptw.active) {
      return { stationId: 'station:permit', hint: 'Walk to the Starboard Permit Desk to sign & issue the PTW' };
    }
    return { stationId: 'station:permit', hint: 'Mission 01 Complete — Permit-to-Work issued!' };
  }

  if (sim.missionId === 2) {
    if (lv.vcbClosed || !lv.rackingPadlocked || !lv.castellLockedOut) {
      return { stationId: 'bay:ACB-TR1-LV', hint: 'Walk to C5 (440 V ACB) first to eliminate step-up back-feed & extract K-LV' };
    }
    if (tr.vcbClosed || tr.rackingTurns > 0 || !tr.rackingPadlocked || !tr.castellLockedOut) {
      return { stationId: 'bay:TR1-HV', hint: 'Walk to C4 (TR1-HV) to trip, rack out (0/20), padlock & extract K-HV' };
    }
    if (!tr.earthKeysInserted.includes('K-HV') || !tr.earthKeysInserted.includes('K-LV') || !tr.earthSwitchClosed || !tr.earthPadlocked) {
      return { stationId: 'bay:TR1-HV', hint: 'At C4 (TR1-HV), insert K-HV & K-LV, close & padlock EK6 earth switch' };
    }
    if (!sim.keyBoxLocked) {
      return { stationId: 'station:keys', hint: 'Walk to the Key & Tool Board to lock the Safety Key Box' };
    }
    if (!tr.doorOpen || !tr.topShutterPadlocked) {
      return { stationId: 'bay:TR1-HV', hint: 'Return to C4 (TR1-HV), open VCB door & padlock red shutter' };
    }
    if (!sim.ptp.completedCubicles['TR1-HV']) {
      if (sim.ptp.state === 0 || sim.ptp.state === 2) {
        return { stationId: 'station:test', hint: 'Walk to the Proving Bench to prove the HV detector on the Proving Unit' };
      }
      return { stationId: 'bay:TR1-HV', hint: 'At C4 (TR1-HV), probe L1, L2, L3 terminals dead with HV wand' };
    }
    if (!(tr.cme.pe && tr.cme.L1 && tr.cme.L2 && tr.cme.L3)) {
      return { stationId: 'bay:TR1-HV', hint: 'At C4 (TR1-HV), clamp portable earth leads (PE first, then L1/L2/L3)' };
    }
    if (!sim.ptw.active) {
      return { stationId: 'station:permit', hint: 'Walk to the Permit Desk to sign & issue Transformer PTW' };
    }
    return { stationId: 'station:permit', hint: 'Mission 02 Complete — Transformer TR1 safely isolated!' };
  }

  if (sim.missionId === 3) {
    if (!sim.ptw.cancelled || (!sim.sft.active && !sim.sft.cancelledAfterTest)) {
      return { stationId: 'station:permit', hint: 'Walk to the Permit Desk to cancel PTW & issue Sanction-for-Test (SFT)' };
    }
    if (bt.earthSwitchClosed && !sim.megger.tested) {
      return { stationId: 'bay:BT-M1', hint: 'Walk to C3 (BT-M1), unlock earth padlock & open EK6 earth switch for 5 kV test' };
    }
    if (!sim.megger.tested) {
      return { stationId: 'station:test', hint: 'Walk to the Megger Bench to connect 5 kV leads & run Polarization Index test' };
    }
    if (!sim.megger.dischargedProperly || sim.megger.windingChargeVolts > 0 || sim.megger.connectedCubicle) {
      return { stationId: 'station:test', hint: 'At the Megger Bench, bleed stored 4,850 V DC capacitive charge to 0 V' };
    }
    if (!bt.earthSwitchClosed || !bt.earthPadlocked) {
      return { stationId: 'bay:BT-M1', hint: 'Return to C3 (BT-M1) to re-close & padlock EK6 earth switch' };
    }
    if (!sim.sft.cancelledAfterTest) {
      return { stationId: 'station:permit', hint: 'Walk to the Permit Desk to cancel Sanction-for-Test (SFT)' };
    }
    return { stationId: 'station:permit', hint: 'Mission 03 Complete — 5 kV Megger & PI test verified!' };
  }

  // Mission 4: De-Isolation & Safe Restoration
  const cmeClean = !bt.cme.pe && !bt.cme.L1 && !bt.cme.L2 && !bt.cme.L3 && bt.cme.removedProperly;
  if (!sim.ptw.cancelled) {
    return { stationId: 'station:permit', hint: 'Walk to the Permit Desk to sign off & cancel PTW' };
  }
  if (!cmeClean) {
    return { stationId: 'bay:BT-M1', hint: 'Walk to C3 (BT-M1) & remove CME leads (L1/L2/L3 phases first, PE earth last)' };
  }
  if (bt.topShutterPadlocked || bt.doorOpen) {
    return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), unlock red shutter & close VCB compartment door' };
  }
  if (sim.keyBoxLocked) {
    return { stationId: 'station:keys', hint: 'Walk to the Key & Tool Board to unlock the Safety Key Box' };
  }
  if (bt.earthPadlocked || bt.earthSwitchClosed || bt.earthKeysInserted.includes('K1-BT') || bt.castellLockedOut) {
    return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), open EK6 earth switch & return Castell key K1-BT to VCB' };
  }
  if (!bt.testFunctionCheckedInTestPos) {
    return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), remove padlock, rack to TEST (10/20) & function-test Close/Trip' };
  }
  if (bt.rackingTurns < 20) {
    return { stationId: 'bay:BT-M1', hint: 'At C3 (BT-M1), crank VCB truck fully into SERVICE (20/20)' };
  }
  return { stationId: 'bay:BT-M1', hint: 'Mission 04 Complete — Feeder restored to SERVICE!' };
}

/**
 * Build contextual animated actions available when the character stands at a given station or bay.
 */
export function getStationActions(stationId, sim, topo) {
  if (!stationId || !sim) return [];

  if (stationId === 'station:ppe') {
    const actions = [];
    if (!isFullPpeState(sim.ppe)) {
      actions.push({
        id: 'ppe_all',
        label: 'Don Full 40 cal/cm² PPE & Air-Test Gloves',
        anim: 'don_ppe',
        tool: 'none',
        duration: 1.25,
        primary: true,
        exec: 'donAllPpe',
      });
    }
    actions.push(
      {
        id: 'ppe_roll',
        label: sim.ppe.glovesAirTested ? 'Class 2 Gloves Air-Tested (Done)' : 'Roll Air-Test Class 2 Gloves',
        anim: 'don_ppe',
        tool: 'none',
        duration: 0.9,
        done: sim.ppe.glovesAirTested,
        exec: 'rollTestGloves',
      },
      {
        id: 'ppe_suit',
        label: sim.ppe.suit ? 'Remove 40 cal/cm² Arc-Flash Suit' : 'Don 40 cal/cm² Arc-Flash Suit & Hood',
        anim: 'don_ppe',
        tool: 'none',
        duration: 1.0,
        done: sim.ppe.suit,
        exec: 'toggleSuit',
      },
      {
        id: 'ppe_gloves',
        label: sim.ppe.gloves ? 'Remove Class 2 HV Gloves' : 'Don Class 2 Insulating Gloves',
        anim: 'don_ppe',
        tool: 'none',
        duration: 0.85,
        done: sim.ppe.gloves,
        exec: 'toggleGloves',
      },
      {
        id: 'ppe_boots',
        label: sim.ppe.bootsMat ? 'Stow 15 kV Mat & Dielectric Boots' : 'Wear Boots & Roll Out 15 kV Floor Mat',
        anim: 'don_ppe',
        tool: 'none',
        duration: 0.95,
        done: sim.ppe.bootsMat,
        exec: 'toggleBootsMat',
      }
    );
    return actions;
  }

  if (stationId === 'station:keys') {
    return [
      {
        id: 'keybox_toggle',
        label: sim.keyBoxLocked ? 'Unlock Safety Key Box (Retrieve Padlock Key)' : 'Lock Safety Key Box (LOTO Control)',
        anim: 'turn_key',
        tool: 'padlock',
        duration: 0.95,
        primary: true,
        exec: 'toggleKeyBox',
      },
      {
        id: 'equip_racking',
        label: 'Hold Racking Crank Handle',
        anim: 'turn_key',
        tool: 'racking_handle',
        duration: 0.55,
        exec: 'equipTool',
        arg: 'racking_handle',
      },
      {
        id: 'equip_cme',
        label: 'Pick Up Portable Earth Leads (CME Hot-Stick)',
        anim: 'probe_wand',
        tool: 'cme_stick',
        duration: 0.65,
        exec: 'equipSimTool',
        arg: 'PORTABLE_EARTH',
      },
    ];
  }

  if (stationId === 'station:test') {
    const actions = [
      {
        id: 'prove_unit',
        label:
          sim.ptp.state === 2
            ? 'Re-Prove HV Wand on 6.6 kV Unit (Step 3/3)'
            : sim.ptp.state === 1
              ? 'Proving Unit Checked — Ready to Probe Bay'
              : 'Prove HV Detector on 6.6 kV Proving Unit',
        anim: 'probe_wand',
        tool: 'proving_wand',
        duration: 1.05,
        primary: sim.missionId !== 3,
        exec: 'proveUnit',
      },
    ];

    if (sim.missionId === 3 || sim.sft.active || sim.megger.connectedCubicle || sim.megger.tested) {
      if (!sim.megger.connectedCubicle && !sim.megger.tested) {
        actions.push({
          id: 'megger_connect',
          label: 'Connect 5 kV Megger Leads to BT-M1',
          anim: 'megger_test',
          tool: 'megger_leads',
          duration: 1.05,
          primary: sim.missionId === 3,
          exec: 'connectMegger',
        });
      }
      if (sim.megger.connectedCubicle && !sim.megger.tested) {
        actions.push({
          id: 'megger_run',
          label: 'Inject 5 kV DC & Run Polarization Index Test',
          anim: 'megger_test',
          tool: 'megger_leads',
          duration: 1.4,
          primary: sim.missionId === 3,
          exec: 'runMegger',
        });
      }
      if (sim.megger.windingChargeVolts > 0 || sim.megger.connectedCubicle) {
        actions.push({
          id: 'megger_bleed',
          label: `Bleed Capacitive Charge (${sim.megger.windingChargeVolts} V -> 0 V) & Disconnect`,
          anim: 'megger_test',
          tool: 'megger_leads',
          duration: 1.15,
          primary: sim.missionId === 3 && sim.megger.tested,
          exec: 'dischargeMegger',
        });
      }
    }
    return actions;
  }

  if (stationId === 'station:permit') {
    const actions = [];
    if (!sim.ptw.active && !sim.ptw.cancelled) {
      actions.push({
        id: 'issue_ptw',
        label: 'Sign & Issue Permit-to-Work (PTW)',
        anim: 'sign_permit',
        tool: 'ptw_clipboard',
        duration: 1.15,
        primary: true,
        exec: 'issuePTW',
      });
    }
    if (sim.ptw.active && !sim.ptw.cancelled) {
      actions.push({
        id: 'cancel_ptw',
        label: 'Sign Off & Cancel Active PTW',
        anim: 'sign_permit',
        tool: 'ptw_clipboard',
        duration: 1.1,
        primary: true,
        exec: 'cancelPTW',
      });
    }
    if ((sim.missionId === 3 || sim.ptw.cancelled) && !sim.sft.active && !sim.sft.cancelledAfterTest) {
      actions.push({
        id: 'issue_sft',
        label: 'Authorize & Issue Sanction-for-Test (SFT)',
        anim: 'sign_permit',
        tool: 'ptw_clipboard',
        duration: 1.1,
        primary: sim.ptw.cancelled,
        exec: 'issueSFT',
      });
    }
    if (sim.sft.active) {
      actions.push({
        id: 'cancel_sft',
        label: 'Cancel Sanction-for-Test (SFT)',
        anim: 'sign_permit',
        tool: 'ptw_clipboard',
        duration: 1.0,
        primary: true,
        exec: 'cancelSFT',
      });
    }
    actions.push({
      id: 'view_ptw',
      label: 'Inspect Formal PTW / SFT Document',
      anim: 'sign_permit',
      tool: 'ptw_clipboard',
      duration: 0.45,
      exec: 'openPtwModal',
    });
    return actions;
  }

  // Switchboard bay actions
  const st = getStationById(stationId);
  if (!st || st.kind !== 'bay') return [];
  const cub = sim.cubicles[st.cubId];
  if (!cub) return [];

  const actions = [];

  // 1. Breaker Trip / Close
  if (cub.vcbClosed) {
    actions.push({
      id: 'trip_vcb',
      label: `Trip ${cub.isHV ? 'VCB' : '440 V ACB'} [O]`,
      anim: 'push_button',
      tool: 'none',
      duration: 0.85,
      primary: true,
      exec: 'tripVcb',
      arg: cub.id,
    });
  } else {
    actions.push({
      id: 'close_vcb',
      label: `Close ${cub.isHV ? 'VCB' : '440 V ACB'} [I]`,
      anim: 'push_button',
      tool: 'none',
      duration: 0.85,
      exec: 'closeVcb',
      arg: cub.id,
    });
  }

  // 2. Racking (HV bays)
  if (cub.isHV) {
    if (cub.rackingTurns > 0) {
      actions.push({
        id: 'rack_out',
        label: `Crank VCB Truck Out (${cub.rackingTurns} -> ${Math.max(0, cub.rackingTurns - 10)}/20)`,
        anim: 'rack_crank',
        tool: 'racking_handle',
        duration: 1.35,
        primary: !cub.vcbClosed && cub.rackingTurns > 0,
        exec: 'rackOut',
        arg: cub.id,
      });
    }
    if (cub.rackingTurns < 20) {
      actions.push({
        id: 'rack_in',
        label: `Crank VCB Truck In (${cub.rackingTurns} -> ${Math.min(20, cub.rackingTurns + 10)}/20)`,
        anim: 'rack_crank',
        tool: 'racking_handle',
        duration: 1.35,
        exec: 'rackIn',
        arg: cub.id,
      });
    }
  }

  // 3. Padlock port & Castell Key
  actions.push({
    id: 'padlock_port',
    label: cub.rackingPadlocked ? 'Remove Racking Port Padlock' : 'Apply LOTO Padlock to Racking Port',
    anim: 'turn_key',
    tool: 'padlock',
    duration: 0.95,
    exec: 'toggleRackingPadlock',
    arg: cub.id,
  });

  if (cub.castellKeyId) {
    actions.push({
      id: 'castell_vcb',
      label: cub.castellLockedOut
        ? `Return Castell Key ${cub.castellKeyId} to Breaker`
        : `Lock Out & Extract Castell Key ${cub.castellKeyId}`,
      anim: 'turn_key',
      tool: 'castell_key',
      duration: 1.0,
      exec: 'toggleCastellVcb',
      arg: cub.id,
    });
  }

  // 4. Integral Earth Switch EK6 (HV bays with requiredEarthKeys)
  if (cub.isHV && cub.requiredEarthKeys) {
    for (const kId of cub.requiredEarthKeys) {
      const inserted = cub.earthKeysInserted.includes(kId);
      actions.push({
        id: `earth_key_${kId}`,
        label: inserted ? `Remove ${kId} from EK6 Cylinder` : `Insert ${kId} into EK6 Earth Cylinder`,
        anim: 'turn_key',
        tool: 'castell_key',
        duration: 0.95,
        exec: 'toggleEarthKey',
        arg: { cubId: cub.id, keyId: kId },
      });
    }
    actions.push({
      id: 'earth_switch',
      label: cub.earthSwitchClosed ? 'Open EK6 Integral Earth Switch' : 'Close EK6 Integral Earth Switch',
      anim: 'pull_lever',
      tool: 'none',
      duration: 1.1,
      exec: 'toggleEarthSwitch',
      arg: cub.id,
    });
    actions.push({
      id: 'earth_padlock',
      label: cub.earthPadlocked ? 'Remove EK6 Earth Padlock' : 'Padlock EK6 Earth Switch',
      anim: 'turn_key',
      tool: 'padlock',
      duration: 0.9,
      exec: 'toggleEarthPadlock',
      arg: cub.id,
    });
  }

  // 5. Compartment Door, Shutter Padlock, Live-Line Proving & Portable Earth CME (HV bays)
  if (cub.isHV) {
    actions.push({
      id: 'toggle_door',
      label: cub.doorOpen ? 'Close & Bolt VCB Door' : 'Open VCB Compartment Door',
      anim: 'open_door',
      tool: 'none',
      duration: 1.0,
      exec: 'toggleDoor',
      arg: cub.id,
    });

    if (cub.doorOpen) {
      actions.push({
        id: 'shutter_padlock',
        label: cub.topShutterPadlocked ? 'Remove Red Busbar Shutter Padlock' : 'Padlock Red Upper Busbar Shutter',
        anim: 'turn_key',
        tool: 'padlock',
        duration: 0.95,
        exec: 'toggleShutterPadlock',
        arg: cub.id,
      });

      const testedAll = sim.ptp.phasesTested.L1 && sim.ptp.phasesTested.L2 && sim.ptp.phasesTested.L3;
      if (!sim.ptp.completedCubicles[cub.id] && !testedAll) {
        actions.push({
          id: 'probe_all_phases',
          label: 'Probe L1, L2 & L3 Cable Spouts with HV Wand',
          anim: 'probe_wand',
          tool: 'proving_wand',
          duration: 1.45,
          primary: sim.ptp.state === 1,
          exec: 'probePhases',
          arg: cub.id,
        });
      }

      const cmeApplied = cub.cme.pe && cub.cme.L1 && cub.cme.L2 && cub.cme.L3;
      const cmeAny = cub.cme.pe || cub.cme.L1 || cub.cme.L2 || cub.cme.L3;
      if (!cmeApplied && sim.missionId === 2) {
        actions.push({
          id: 'cme_apply',
          label: 'Apply Portable Earth Leads (PE first, then L1/L2/L3)',
          anim: 'probe_wand',
          tool: 'cme_stick',
          duration: 1.45,
          exec: 'applyCme',
          arg: cub.id,
        });
      }
      if (cmeAny) {
        actions.push({
          id: 'cme_remove',
          label: 'Remove Portable Earth Leads (L1/L2/L3 first, PE last)',
          anim: 'probe_wand',
          tool: 'cme_stick',
          duration: 1.45,
          primary: sim.missionId === 4 && sim.ptw.cancelled,
          exec: 'removeCme',
          arg: cub.id,
        });
      }
    }
  }

  return actions;
}
