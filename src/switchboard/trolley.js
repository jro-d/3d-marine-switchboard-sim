import * as THREE from 'three';
import { getSharedGltfLoader, resolvePublicAssetUrl } from '../game/gltf-loader.js';

export const TROLLEY_PARK_POS = { x: 3.72, z: 1.16, yaw: Math.PI };
export const MAINTENANCE_ZONE_POS = { x: -3.72, z: 1.16, yaw: Math.PI };
export const TROLLEY_ALIGN_Z = 1.04;
export const TROLLEY_ALIGN_DIST = 0.68;
export const TROLLEY_PUSH_OFFSET = 0.90;
export const TROLLEY_HALF_W = 0.36;
export const TROLLEY_HALF_D = 0.42;

export const HV_BAY_X = {
  'DG1': -1.68,
  'BT1': -0.84,
  'BT-M1': 0.0,
  'TR1-HV': 0.84,
};

export function createTrolleyState(overrides = {}) {
  return {
    state: 'PARKED',
    x: TROLLEY_PARK_POS.x,
    z: TROLLEY_PARK_POS.z,
    yaw: TROLLEY_PARK_POS.yaw,
    brakeLocked: true,
    latchedBayId: null,
    carriedCubId: null,
    transferProgress: 0,
    ...overrides,
  };
}

export function isInMaintenanceZone(trolley) {
  if (!trolley) return false;
  return Math.hypot(trolley.x - MAINTENANCE_ZONE_POS.x, trolley.z - MAINTENANCE_ZONE_POS.z) <= 0.95;
}

export function getTrolleyObstacleAabb(trolley) {
  if (!trolley || trolley.state === 'PUSHING') return null;
  return {
    id: 'vcb-trolley',
    minX: trolley.x - TROLLEY_HALF_W,
    maxX: trolley.x + TROLLEY_HALF_W,
    minZ: trolley.z - TROLLEY_HALF_D,
    maxZ: trolley.z + TROLLEY_HALF_D,
  };
}

export function findAlignableBay(trolley, sim) {
  if (!trolley || !sim?.cubicles) return null;
  let best = null;
  for (const [cubId, bayX] of Object.entries(HV_BAY_X)) {
    const cub = sim.cubicles[cubId];
    if (!cub || !cub.isHV || !cub.doorOpen || cub.rackingTurns !== 0 || cub.vcbClosed) continue;
    const canWithdraw = !trolley.carriedCubId && !cub.vcbExtracted;
    const canReinsert = trolley.carriedCubId === cubId && cub.vcbExtracted;
    if (!canWithdraw && !canReinsert) continue;
    const dist = Math.hypot(trolley.x - bayX, trolley.z - TROLLEY_ALIGN_Z);
    if (dist <= TROLLEY_ALIGN_DIST && (!best || dist < best.dist)) {
      best = { cubId, bayX, dist, mode: canWithdraw ? 'withdraw' : 'reinsert' };
    }
  }
  return best;
}

export function stepTrolleyFollow(trolley, player, clampPosFn) {
  if (!trolley || trolley.state !== 'PUSHING' || !player) return trolley;
  const rawX = player.x + Math.sin(player.yaw) * TROLLEY_PUSH_OFFSET;
  const rawZ = player.z + Math.cos(player.yaw) * TROLLEY_PUSH_OFFSET;
  const clamped = clampPosFn ? clampPosFn(rawX, rawZ) : { x: rawX, z: rawZ };
  trolley.x = clamped.x;
  trolley.z = clamped.z;
  trolley.yaw = player.yaw;
  return trolley;
}

export function grabTrolleyState(trolley) {
  if (!trolley) return { ok: false, reason: 'Trolley unavailable.' };
  if (trolley.latchedBayId) {
    return { ok: false, reason: 'Unlatch trolley rail hooks from the cubicle before wheeling it away.' };
  }
  trolley.state = 'PUSHING';
  trolley.brakeLocked = false;
  return { ok: true };
}

export function releaseTrolleyState(trolley) {
  if (!trolley) return { ok: false, reason: 'Trolley unavailable.' };
  trolley.brakeLocked = true;
  if (trolley.latchedBayId) {
    trolley.state = trolley.carriedCubId ? 'EXTRACTED' : 'RAIL_ALIGNED';
  } else if (trolley.carriedCubId && isInMaintenanceZone(trolley)) {
    trolley.state = 'MAINTENANCE_PARKED';
  } else {
    trolley.state = 'PARKED';
  }
  return { ok: true };
}

export function latchTrolleyState(trolley, cubId, sim) {
  if (!trolley || !sim?.cubicles?.[cubId]) return { ok: false, reason: 'Invalid bay for trolley latch.' };
  const cub = sim.cubicles[cubId];
  if (!cub.isHV) return { ok: false, reason: 'VCB withdrawal trolley only docks to 6.6 kV HV bays.' };
  if (cub.vcbClosed || cub.rackingTurns !== 0) {
    return { ok: false, reason: 'Trip VCB and rack to DISCONNECTED (0/20) before docking trolley.' };
  }
  if (!cub.doorOpen) {
    return { ok: false, reason: 'Open the VCB compartment door before latching trolley guide rails.' };
  }
  if (trolley.carriedCubId && trolley.carriedCubId !== cubId) {
    return { ok: false, reason: `Trolley is already carrying ${trolley.carriedCubId} VCB.` };
  }
  if (!trolley.carriedCubId && cub.vcbExtracted) {
    return { ok: false, reason: `${cubId} VCB is already withdrawn.` };
  }
  trolley.x = HV_BAY_X[cubId];
  trolley.z = TROLLEY_ALIGN_Z;
  trolley.yaw = Math.PI;
  trolley.brakeLocked = true;
  trolley.latchedBayId = cubId;
  trolley.state = 'RAIL_ALIGNED';
  return { ok: true };
}

export function unlatchTrolleyState(trolley) {
  if (!trolley || !trolley.latchedBayId) {
    return { ok: false, reason: 'Trolley is not latched to any cubicle.' };
  }
  trolley.latchedBayId = null;
  trolley.brakeLocked = false;
  trolley.state = 'PUSHING';
  return { ok: true };
}

export function extractVcbState(trolley, sim) {
  if (!trolley || !trolley.latchedBayId) {
    return { ok: false, reason: 'Align and latch the VCB service trolley to the open cubicle first.' };
  }
  const cub = sim?.cubicles?.[trolley.latchedBayId];
  if (!cub || !cub.isHV) return { ok: false, reason: 'Invalid cubicle.' };
  if (trolley.carriedCubId) return { ok: false, reason: 'Trolley bed is already occupied.' };
  if (cub.vcbClosed || cub.rackingTurns !== 0 || !cub.doorOpen) {
    return { ok: false, reason: 'VCB must be OPEN, DISCONNECTED (0/20), and door open to withdraw.' };
  }
  if (cub.vcbExtracted) return { ok: false, reason: 'VCB is already withdrawn.' };

  cub.vcbExtracted = true;
  trolley.carriedCubId = cub.id;
  trolley.transferProgress = 1;
  trolley.state = 'EXTRACTED';
  return { ok: true, cubId: cub.id };
}

export function reinsertVcbState(trolley, sim) {
  if (!trolley || !trolley.latchedBayId) {
    return { ok: false, reason: 'Latch the loaded trolley to the cubicle rails before sliding VCB back in.' };
  }
  if (!trolley.carriedCubId || trolley.carriedCubId !== trolley.latchedBayId) {
    return { ok: false, reason: `Trolley must carry ${trolley.latchedBayId} VCB to re-insert here.` };
  }
  const cub = sim?.cubicles?.[trolley.latchedBayId];
  if (!cub || !cub.doorOpen || !cub.vcbExtracted) {
    return { ok: false, reason: 'Cubicle door must be open with empty bay slot to re-insert VCB.' };
  }

  cub.vcbExtracted = false;
  trolley.carriedCubId = null;
  trolley.transferProgress = 0;
  trolley.state = 'RAIL_ALIGNED';
  return { ok: true, cubId: cub.id };
}

/**
 * Builds the 3D Marine HV VCB Withdrawal Service Trolley.
 * Orientation convention: local +Z = front rail hooks (faces -Z switchboard when yaw = Math.PI);
 * local -Z = rear operator push-bar; bedAnchor rotated PI so reparented VCB fascia faces push-bar.
 */
export function createVcbTrolleyVisual(MAT) {
  const root = new THREE.Group();
  root.name = 'VcbWithdrawalTrolley';

  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd9a426, roughness: 0.42, metalness: 0.25 });
  const darkMat = MAT?.skidSteel || new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.55, metalness: 0.65 });
  const railMat = MAT?.galvSteel || new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.78 });
  const rubberMat = MAT?.rubberMount || new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.85, metalness: 0.05 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xb9372c, emissive: 0x330808, emissiveIntensity: 0.25, roughness: 0.45 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x64748b, emissive: 0x000000, emissiveIntensity: 0.0, roughness: 0.25 });

  const fallbackGroup = new THREE.Group();
  fallbackGroup.name = 'VcbTrolleyProceduralFallback';
  root.add(fallbackGroup);

  // Lower rolling chassis
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.044, 0.72), darkMat);
  basePlate.position.set(0, 0.145, 0);
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;
  fallbackGroup.add(basePlate);

  // Yellow safety bumpers along lower perimeter
  [[-0.345, 0], [0.345, 0]].forEach(([bx]) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.056, 0.74), yellowMat);
    side.position.set(bx, 0.148, 0);
    side.castShadow = true;
    fallbackGroup.add(side);
  });
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.056, 0.024), yellowMat);
  frontBumper.position.set(0, 0.148, 0.365);
  fallbackGroup.add(frontBumper);

  // 4 heavy caster wheels + rear foot-brake pedals
  const casterWheels = [];
  [[-0.27, -0.28], [0.27, -0.28], [-0.27, 0.28], [0.27, 0.28]].forEach(([cx, cz]) => {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.075, 0.046), railMat);
    fork.position.set(cx, 0.095, cz);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.036, 18), rubberMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(cx, 0.056, cz);
    wheel.castShadow = true;
    fallbackGroup.add(fork, wheel);
    casterWheels.push(wheel);
  });

  [-0.22, 0.22].forEach((bx) => {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.022, 0.055), brakeMat);
    pedal.position.set(bx, 0.105, -0.36);
    fallbackGroup.add(pedal);
  });

  // Scissor lift uprights supporting VCB transfer bed at exact cubicle rail height (y = 0.505)
  [-0.29, 0.29].forEach((ux) => {
    [-0.24, 0.24].forEach((uz) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.34, 0.036), yellowMat);
      col.position.set(ux, 0.33, uz);
      col.castShadow = true;
      fallbackGroup.add(col);
    });
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.56), darkMat);
    diag.position.set(ux, 0.33, 0);
    diag.rotation.x = 0.52;
    fallbackGroup.add(diag);
  });

  // Upper VCB carriage bed & twin precision guide rails matching hv-bay RL (x = ±0.27, y = 0.505)
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.024, 0.72), darkMat);
  bedFrame.position.set(0, 0.486, 0.01);
  bedFrame.receiveShadow = true;
  fallbackGroup.add(bedFrame);

  [-0.27, 0.27].forEach((rx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.026, 0.78), railMat);
    rail.position.set(rx, 0.506, 0.03);
    rail.castShadow = true;
    fallbackGroup.add(rail);
  });

  // Front mechanical rail-latching hooks (+Z faces switchboard cubicle sill)
  const latchHooks = [];
  [-0.27, 0.27].forEach((hx) => {
    const hookPivot = new THREE.Group();
    hookPivot.position.set(hx, 0.506, 0.41);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.028, 0.085), yellowMat);
    arm.position.set(0, 0, 0.035);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.044, 0.022), darkMat);
    claw.position.set(0, -0.022, 0.070);
    hookPivot.add(arm, claw);
    fallbackGroup.add(hookPivot);
    latchHooks.push(hookPivot);
  });

  // Alignment status beacon on front cross-rail
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), beaconMat);
  beacon.position.set(0, 0.535, 0.36);
  root.add(beacon);

  // Rear ergonomic push-bar (-Z faces operator)
  [-0.30, 0.30].forEach((px) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.84, 12), yellowMat);
    post.position.set(px, 0.55, -0.37);
    post.castShadow = true;
    fallbackGroup.add(post);
  });
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 14), darkMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 0.96, -0.37);
  handleBar.castShadow = true;
  fallbackGroup.add(handleBar);

  // High-poly Blender Draco VCB Trolley mount (`public/models/vcb-trolley.glb`)
  const glbMount = new THREE.Group();
  glbMount.name = 'VcbTrolleyGlbMount';
  root.add(glbMount);

  const glbWheels = [];
  const glbLatchHooks = [];
  if (typeof window !== 'undefined') {
    const loader = getSharedGltfLoader();
    loader.load(
      resolvePublicAssetUrl('models/vcb-trolley.glb'),
      (gltf) => {
        if (!gltf?.scene) return;
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        glbMount.add(gltf.scene);
        fallbackGroup.visible = false;

        for (let i = 0; i < 4; i++) {
          const w = gltf.scene.getObjectByName(`TrolleyWheel_${i}`);
          if (w) glbWheels.push(w);
        }
        for (const side of ['L', 'R']) {
          const h = gltf.scene.getObjectByName(`TrolleyLatchHook_${side}`);
          if (h) glbLatchHooks.push(h);
        }
        const brakeNode = gltf.scene.getObjectByName('TrolleyBrakePedals');
        if (brakeNode) {
          brakeNode.traverse((child) => {
            if (child.isMesh && child.material?.name === 'SafetyRedEnamel') {
              child.material = brakeMat;
            }
          });
        }
      },
      undefined,
      () => {
        // Keep procedural fallback active if offline/headless
      }
    );
  }

  // Anchor where a withdrawn VCB cassette (subGroups.TC) is reparented
  const bedAnchor = new THREE.Group();
  bedAnchor.name = 'TrolleyBedAnchor';
  bedAnchor.position.set(0, 0, 0.15);
  bedAnchor.rotation.y = Math.PI;
  root.add(bedAnchor);

  // Clickable proxy box for direct 3D interaction
  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 1.05, 0.88),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.set(0, 0.54, 0);
  hitMesh.userData.trolleyInteract = true;
  root.add(hitMesh);

  let prevX = TROLLEY_PARK_POS.x;
  let prevZ = TROLLEY_PARK_POS.z;

  function syncVisual(trolleyState, alignCandidate, dt = 0.016) {
    if (!trolleyState) return;
    root.position.set(trolleyState.x, 0, trolleyState.z);
    root.rotation.y = trolleyState.yaw;

    const travel = Math.hypot(trolleyState.x - prevX, trolleyState.z - prevZ);
    prevX = trolleyState.x;
    prevZ = trolleyState.z;
    if (travel > 0.0005) {
      const spin = travel / 0.056;
      casterWheels.forEach((w) => { w.rotation.x += spin; });
      glbWheels.forEach((w) => { w.rotation.x += spin; });
    }

    const hookTarget = trolleyState.latchedBayId ? 0.0 : -0.48;
    latchHooks.forEach((h) => {
      h.rotation.x += (hookTarget - h.rotation.x) * Math.min(1, dt * 12);
    });
    glbLatchHooks.forEach((h) => {
      h.rotation.x += (hookTarget - h.rotation.x) * Math.min(1, dt * 12);
    });

    if (trolleyState.brakeLocked) {
      brakeMat.color.setHex(0xb9372c);
      brakeMat.emissive.setHex(0x450a0a);
    } else {
      brakeMat.color.setHex(0x2f7450);
      brakeMat.emissive.setHex(0x0b3a22);
    }

    if (trolleyState.latchedBayId) {
      beaconMat.color.setHex(0x22c55e);
      beaconMat.emissive.setHex(0x22c55e);
      beaconMat.emissiveIntensity = 0.85;
    } else if (alignCandidate) {
      beaconMat.color.setHex(0x38bdf8);
      beaconMat.emissive.setHex(0x38bdf8);
      beaconMat.emissiveIntensity = 0.9;
    } else {
      beaconMat.color.setHex(0x64748b);
      beaconMat.emissive.setHex(0x000000);
      beaconMat.emissiveIntensity = 0.0;
    }
  }

  return {
    root,
    bedAnchor,
    hitMesh,
    syncVisual,
  };
}
