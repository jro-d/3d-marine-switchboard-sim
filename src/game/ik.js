import * as THREE from 'three';

/**
 * Exact distance (in meters) from the wrist/toolSocket origin along local +Z
 * to the active contact point of each tool or gloved fingertip.
 */
export const TOOL_TIP_OFFSETS = {
  none: 0.125,
  racking_handle: 0.255,
  castell_key: 0.115,
  padlock: 0.085,
  proving_wand: 0.885,
  megger_leads: 0.205,
  cme_stick: 0.770,
  ptw_clipboard: 0.140,
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);
const _m4 = new THREE.Matrix4();

export function smoothstep01(x) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Map any controller action (whether triggered by direct 3D raycast or HUD button)
 * to its target { cubId, socketId } on the switchboard.
 */
export function resolveActionSocketMeta(action, sim) {
  if (!action) return null;
  if (action.cubId && action.socketId) {
    return { cubId: action.cubId, socketId: action.socketId };
  }

  switch (action.exec) {
    case 'tripVcb':
      return { cubId: action.arg, socketId: 'tripBtn' };
    case 'closeVcb':
      return { cubId: action.arg, socketId: 'closeBtn' };
    case 'rackOut':
    case 'rackIn':
      return { cubId: action.arg, socketId: 'rackPort' };
    case 'toggleRackingPadlock':
      return { cubId: action.arg, socketId: 'rackingPadlock' };
    case 'toggleCastellVcb':
      return { cubId: action.arg, socketId: 'castellVcb' };
    case 'toggleEarthKey': {
      const cubId = action.arg?.cubId;
      const keyId = action.arg?.keyId;
      const cub = sim?.cubicles?.[cubId];
      const slot = cub?.requiredEarthKeys?.[1] === keyId ? 'earthKey2' : 'earthKey1';
      return cubId ? { cubId, socketId: slot } : null;
    }
    case 'toggleEarthSwitch':
      return { cubId: action.arg, socketId: 'ek6Socket' };
    case 'toggleEarthPadlock':
      return { cubId: action.arg, socketId: 'ek6Padlock' };
    case 'toggleDoor':
      return { cubId: action.arg, socketId: 'doorHandle' };
    case 'toggleRearDoor':
      return { cubId: action.arg, socketId: 'rearDoorHandle' };
    case 'toggleShutterPadlock':
      return { cubId: action.arg, socketId: 'shutterPadlock' };
    case 'probePhase':
    case 'cmeTerminal':
      return action.arg?.cubId && action.arg?.phase
        ? { cubId: action.arg.cubId, socketId: action.arg.phase }
        : null;
    case 'applyCme':
    case 'removeCme':
      return { cubId: action.arg, socketId: 'PE' };
    default:
      return null;
  }
}

/**
 * Compute an ergonomic micro-step stand position { x, z, faceYaw } in front of
 * (or behind, for rear panels) a 3D control socket so the engineer's right arm
 * or held hot-stick reaches the socket naturally without stretching or clipping.
 */
export function computeMicroStepPose({ socketWorldPos, socketId, toolId = 'none' }) {
  const isRear = socketId === 'rearDoorHandle' || socketWorldPos.z < -0.25;
  const isLongPole = toolId === 'proving_wand' || toolId === 'cme_stick';

  if (isRear) {
    // Facing +Z (yaw = 0), anatomical right shoulder is at world -X, so shift body +0.14 in X
    const x = socketWorldPos.x + 0.14;
    const z = -0.96;
    const faceYaw = Math.atan2(socketWorldPos.x - x, socketWorldPos.z - z);
    return { x, z, faceYaw };
  }

  if (isLongPole) {
    // Stand comfortably outside the open compartment while 0.88m wand reaches L1-L3/PE
    const x = socketWorldPos.x - 0.12;
    const z = 1.22;
    const faceYaw = Math.atan2(socketWorldPos.x - x, socketWorldPos.z - z);
    return { x, z, faceYaw };
  }

  // Front fascia / mid-rail / shutter hand & short-tool controls:
  // Facing -Z (yaw ~ PI), anatomical right shoulder is at world +X, so shift body -0.13 in X
  const standZ = toolId === 'racking_handle' ? 1.00 : 0.90;
  const x = socketWorldPos.x - 0.13;
  const z = standZ;
  const faceYaw = Math.atan2(socketWorldPos.x - x, socketWorldPos.z - z);
  return { x, z, faceYaw };
}

/**
 * Compute natural knee crouch drop (meters) and forward torso pitch (radians)
 * when reaching low controls (e.g. EK6 shaft at y=0.43) or recessed controls.
 */
export function computeBodyPostureForSocket({ socketWorldPos, toolId = 'none', reachWeight = 1 }) {
  const isLongPole = toolId === 'proving_wand' || toolId === 'cme_stick';
  if (isLongPole) {
    return {
      crouchDrop: 0.04 * reachWeight,
      kneeBend: 0.14 * reachWeight,
      torsoLean: 0.16 * reachWeight,
    };
  }
  const lowDelta = Math.max(0, 1.05 - socketWorldPos.y);
  const crouchDrop = Math.min(0.36, lowDelta * 0.60) * reachWeight;
  const kneeBend = Math.min(0.92, crouchDrop * 2.45);
  const depthNeed = socketWorldPos.z >= 0 ? Math.max(0, 0.56 - socketWorldPos.z) : 0.08;
  const torsoLean = Math.min(0.42, 0.18 + depthNeed * 0.72) * reachWeight;
  return { crouchDrop, kneeBend, torsoLean };
}

/**
 * Compute the live choreographed world target for the active fingertip/tool-tip,
 * reach blend weight [0..1], axial tool twist (rad), and contact pulse state.
 */
export function computeChoreographedTipTarget({
  socketWorldPos,
  isRear = false,
  animType = 'push_button',
  progress = 0.5,
}) {
  const p = Math.min(1, Math.max(0, progress));
  const normalZ = isRear ? -1 : 1;

  // Smooth reach-in (0..0.22), active engagement (0.22..0.80), smooth return (0.80..1.0)
  let reachWeight = 1;
  if (p < 0.22) reachWeight = smoothstep01(p / 0.22);
  else if (p > 0.80) reachWeight = 1 - smoothstep01((p - 0.80) / 0.20);

  const tipWorldPos = socketWorldPos.clone();
  let twistRad = 0;
  let crankOrbitOffset = null;
  let contactActive = false;

  switch (animType) {
    case 'push_button': {
      // Approach from 4.5 cm out, press 8 mm inward at commit peak (p ~ 0.54), release
      const pressWindow = p >= 0.26 && p <= 0.76 ? Math.sin(((p - 0.26) / 0.50) * Math.PI) : 0;
      const standoff = 0.042 * (1 - pressWindow) - 0.008 * pressWindow;
      tipWorldPos.z += normalZ * standoff;
      contactActive = pressWindow > 0.55;
      break;
    }

    case 'rack_crank': {
      // Insert hex shaft (0..0.20), crank 3 revolutions while shaft tip stays seated in rackPort
      if (p < 0.20) {
        tipWorldPos.z += normalZ * 0.06 * (1 - smoothstep01(p / 0.20));
      } else if (p <= 0.84) {
        const revP = (p - 0.20) / 0.64;
        const theta = revP * Math.PI * 6;
        twistRad = -theta;
        crankOrbitOffset = {
          x: Math.cos(theta) * 0.055,
          y: Math.sin(theta) * 0.055,
        };
        contactActive = true;
      } else {
        tipWorldPos.z += normalZ * 0.06 * smoothstep01((p - 0.84) / 0.16);
      }
      break;
    }

    case 'turn_key': {
      // Insert key/padlock along normal, twist 80 deg, withdraw
      if (p < 0.26) {
        tipWorldPos.z += normalZ * 0.055 * (1 - smoothstep01(p / 0.26));
      } else if (p <= 0.76) {
        const kP = (p - 0.26) / 0.50;
        twistRad = Math.sin(kP * Math.PI) * 1.38;
        contactActive = true;
      } else {
        tipWorldPos.z += normalZ * 0.055 * smoothstep01((p - 0.76) / 0.24);
      }
      break;
    }

    case 'pull_lever': {
      // Grip lever handle and sweep downward arc
      const pullP = smoothstep01(Math.min(1, Math.max(0, (p - 0.20) / 0.56)));
      tipWorldPos.y += 0.055 - pullP * 0.11;
      tipWorldPos.z += normalZ * 0.015;
      contactActive = p >= 0.24 && p <= 0.78;
      break;
    }

    case 'open_door': {
      // Grip handle, twist espagnolette latch (0.18..0.38), follow hinged door arc
      if (p >= 0.16 && p <= 0.44) {
        twistRad = Math.sin(((p - 0.16) / 0.28) * Math.PI) * 0.72;
      }
      contactActive = p >= 0.20 && p <= 0.82;
      break;
    }

    case 'probe_wand':
    case 'megger_test': {
      // Glide wand probe pin straight onto terminal stab and hold steady contact
      const standoff =
        p < 0.28
          ? 0.09 * (1 - smoothstep01(p / 0.28))
          : p > 0.78
            ? 0.09 * smoothstep01((p - 0.78) / 0.22)
            : 0.0;
      tipWorldPos.z += normalZ * standoff;
      contactActive = p >= 0.28 && p <= 0.78;
      break;
    }

    default:
      break;
  }

  return { tipWorldPos, reachWeight, twistRad, crankOrbitOffset, contactActive };
}

/**
 * Given the shoulder world position S and desired fingertip/tool-tip world position T,
 * compute the exact wrist/toolSocket world position W and forward aim direction such that:
 *   1. |T - W| === L_tip (so orienting the tool along aimDir places its tip at T with 0 error)
 *   2. |W - S| <= maxArmReach (so the elbow stays naturally bent without stretching)
 */
export function computeWristGoalFromTip({
  shoulderWorldPos,
  tipWorldPos,
  characterYaw = Math.PI,
  toolId = 'none',
  maxArmReach = 0.515,
  crankOrbitOffset = null,
}) {
  const tipLen = TOOL_TIP_OFFSETS[toolId] ?? TOOL_TIP_OFFSETS.none;
  const fwdX = Math.sin(characterYaw);
  const fwdZ = Math.cos(characterYaw);

  // Preferred ergonomic grip anchor relative to shoulder
  const isLongPole = tipLen > 0.45;
  const idealGrip = _v1.set(
    shoulderWorldPos.x + (crankOrbitOffset ? crankOrbitOffset.x : 0),
    shoulderWorldPos.y - (isLongPole ? 0.26 : 0.10) + (crankOrbitOffset ? crankOrbitOffset.y : 0),
    shoulderWorldPos.z + fwdZ * (isLongPole ? 0.26 : 0.14)
  );
  if (Math.abs(fwdX) > 1e-4) {
    idealGrip.x += fwdX * (isLongPole ? 0.26 : 0.14);
  }

  // Initial direction from preferred grip to tip
  const gripToTip = _v2.subVectors(tipWorldPos, idealGrip);
  if (gripToTip.lengthSq() < 1e-8) {
    gripToTip.set(fwdX, -0.2, fwdZ).normalize();
  } else {
    gripToTip.normalize();
  }

  const wristWorldPos = new THREE.Vector3().copy(tipWorldPos).addScaledVector(gripToTip, -tipLen);

  // Enforce arm reach sphere |W - S| <= maxArmReach while preserving |T - W| === tipLen
  const sToW = _v3.subVectors(wristWorldPos, shoulderWorldPos);
  const distSW = sToW.length();

  if (distSW > maxArmReach) {
    const sToT = _v2.subVectors(tipWorldPos, shoulderWorldPos);
    const d = sToT.length();
    if (d >= maxArmReach + tipLen - 1e-4 || d < 1e-5) {
      // Target is at or beyond total arm + tool reach: extend straight toward T
      const dir = d > 1e-5 ? sToT.multiplyScalar(1 / d) : new THREE.Vector3(fwdX, 0, fwdZ).normalize();
      wristWorldPos.copy(shoulderWorldPos).addScaledVector(dir, maxArmReach);
    } else if (d <= Math.abs(tipLen - maxArmReach) + 1e-4) {
      // Very close target with long tool: pull wrist back to maxArmReach behind shoulder->tip
      const dir = sToT.multiplyScalar(1 / d);
      wristWorldPos.copy(tipWorldPos).addScaledVector(dir, -tipLen);
    } else {
      // Exact law-of-cosines sphere-sphere intersection on the ergonomic plane
      const dirST = sToT.clone().multiplyScalar(1 / d);
      const xAlong = (d * d + maxArmReach * maxArmReach - tipLen * tipLen) / (2 * d);
      const hPerp = Math.sqrt(Math.max(0, maxArmReach * maxArmReach - xAlong * xAlong));

      // Project preferred grip offset perpendicular to dirST so elbow/grip stays low & natural
      const prefVec = _v1.subVectors(idealGrip, shoulderWorldPos);
      prefVec.addScaledVector(dirST, -prefVec.dot(dirST));
      if (prefVec.lengthSq() < 1e-6) {
        prefVec.set(0, -1, 0).addScaledVector(dirST, -dirST.y);
      }
      prefVec.normalize();

      wristWorldPos
        .copy(shoulderWorldPos)
        .addScaledVector(dirST, xAlong)
        .addScaledVector(prefVec, hPerp);
    }
  }

  const aimDir = new THREE.Vector3().subVectors(tipWorldPos, wristWorldPos);
  if (aimDir.lengthSq() < 1e-8) {
    aimDir.set(fwdX, 0, fwdZ).normalize();
  } else {
    aimDir.normalize();
  }

  return { wristWorldPos, aimDir, tipLen };
}

/**
 * Analytical 2-bone limb IK solver in character/chest local space.
 * Default bone rest direction is (0, -1, 0) (pointing straight down from shoulder -> elbow -> wrist).
 */
export function solveTwoBoneArmIK({
  shoulderPos,
  wristTargetPos,
  upperLen = 0.28,
  lowerLen = 0.25,
  poleDir = new THREE.Vector3(0, -0.6, -0.8),
}) {
  const toTarget = new THREE.Vector3().subVectors(wristTargetPos, shoulderPos);
  const rawDist = toTarget.length();
  const minReach = Math.abs(upperLen - lowerLen) + 0.015;
  const maxReach = upperLen + lowerLen - 0.004;
  const d = Math.min(maxReach, Math.max(minReach, rawDist || minReach));

  const dir = rawDist > 1e-6 ? toTarget.clone().multiplyScalar(1 / rawDist) : new THREE.Vector3(0, -1, 0);

  // Law of cosines for angle at shoulder between dir and upperArm
  const cosAlpha = THREE.MathUtils.clamp(
    (upperLen * upperLen + d * d - lowerLen * lowerLen) / (2 * upperLen * d),
    -1,
    1
  );
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Orthogonalize pole vector against dir
  const pole = poleDir.clone();
  pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-6) {
    pole.set(0, 0, -1).addScaledVector(dir, -dir.z);
  }
  pole.normalize();

  const upperDir = dir.clone().multiplyScalar(cosAlpha).addScaledVector(pole, sinAlpha).normalize();
  const elbowPos = shoulderPos.clone().addScaledVector(upperDir, upperLen);
  const clampedWristPos = shoulderPos.clone().addScaledVector(dir, d);
  const lowerDir = new THREE.Vector3().subVectors(clampedWristPos, elbowPos).normalize();

  // Build world/parent-space quaternions mapping rest axis (0, -1, 0) -> upperDir / lowerDir
  const upperQuat = new THREE.Quaternion().setFromUnitVectors(_down, upperDir);
  const lowerWorldQuat = new THREE.Quaternion().setFromUnitVectors(_down, lowerDir);
  const lowerLocalQuat = upperQuat.clone().invert().multiply(lowerWorldQuat);

  return {
    elbowPos,
    wristPos: clampedWristPos,
    upperQuat,
    lowerLocalQuat,
  };
}

/**
 * Compute 1st-person right hand local position & quaternion inside `camera` space
 * so the held tool tip (or gloved index finger) lands directly on `tipWorldPos`.
 */
export function computeFirstPersonHandIK({
  camera,
  tipWorldPos,
  toolId = 'none',
  reachWeight = 1,
  twistRad = 0,
  restPos = new THREE.Vector3(0.27, -0.32, -0.44),
  restEuler = new THREE.Euler(0.06, 0.14, 0),
}) {
  camera.updateMatrixWorld(true);
  const invCam = _m4.copy(camera.matrixWorld).invert();
  const tipCamLocal = tipWorldPos.clone().applyMatrix4(invCam);

  // In fpRightPivot, fpToolSocket is at (0, 0.01, -0.19) rotated Y = PI (so tool +Z points along pivot -Z).
  // Total distance from fpRightPivot origin along pivot's forward (-Z) axis to the active tip:
  const tipLen = TOOL_TIP_OFFSETS[toolId] ?? TOOL_TIP_OFFSETS.none;
  const pivotToTipDist = 0.19 + (toolId === 'none' ? 0.02 : tipLen);

  // Aim from ergonomic lower-right camera shoulder origin (0.24, -0.26, -0.12) through tipCamLocal
  const camOrigin = _v1.set(0.24, -0.26, -0.12);
  const aimDir = _v2.subVectors(tipCamLocal, camOrigin);
  if (aimDir.lengthSq() < 1e-6) {
    aimDir.set(0, 0, -1);
  } else {
    aimDir.normalize();
  }

  const targetPivotPos = tipCamLocal.clone().addScaledVector(aimDir, -pivotToTipDist);
  // Keep pivot comfortably in front of near clip plane
  targetPivotPos.z = Math.min(-0.16, targetPivotPos.z);

  // Recompute exact aim direction from clamped pivot to tipCamLocal so tip still points dead-on!
  const finalAim = _v3.subVectors(tipCamLocal, targetPivotPos);
  if (finalAim.lengthSq() > 1e-6) finalAim.normalize();
  else finalAim.set(0, 0, -1);

  // Build quaternion mapping pivot's forward axis (0, 0, -1) -> finalAim
  const lookMat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), finalAim, _up);
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMat);
  if (Math.abs(twistRad) > 1e-4) {
    const twistQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), twistRad);
    targetQuat.multiply(twistQ);
  }

  const restQuat = new THREE.Quaternion().setFromEuler(restEuler);
  const blendedPos = restPos.clone().lerp(targetPivotPos, reachWeight);
  const blendedQuat = restQuat.slerp(targetQuat, reachWeight);

  return { position: blendedPos, quaternion: blendedQuat, tipCamLocal };
}
