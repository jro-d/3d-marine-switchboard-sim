import * as THREE from 'three';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';
import { getSharedGltfLoader, resolvePublicAssetUrl } from './gltf-loader.js';
import {
  TOOL_TIP_OFFSETS,
  computeBodyPostureForSocket,
  computeChoreographedTipTarget,
  computeFirstPersonHandIK,
  computeWristGoalFromTip,
  solveTwoBoneArmIK,
} from './ik.js';

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _m4 = new THREE.Matrix4();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();

function addTipAnchor(group, zOffset) {
  const tip = new THREE.Object3D();
  tip.name = 'ToolTipAnchor';
  tip.position.set(0, 0, zOffset);
  group.add(tip);
  group.userData.tipAnchor = tip;
  return tip;
}

function createToolProps() {
  const props = {};

  const metalMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.82, roughness: 0.28 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e252c, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a024, metalness: 0.86, roughness: 0.24 });

  const crank = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), metalMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.13;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 10), metalMat);
  arm.position.set(0, -0.07, 0.01);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10), gripMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -0.14, -0.04);
  crank.add(shaft, arm, handle);
  addTipAnchor(crank, TOOL_TIP_OFFSETS.racking_handle);
  props.racking_handle = crank;

  const key = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16), brassMat);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.105, 8), brassMat);
  blade.rotation.x = Math.PI / 2;
  blade.position.z = 0.06;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.014), brassMat);
  bit.position.set(0.01, 0, 0.11);
  key.add(bow, blade, bit);
  addTipAnchor(key, TOOL_TIP_OFFSETS.castell_key);
  props.castell_key = key;

  const padlock = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.072, 0.032),
    new THREE.MeshStandardMaterial({ color: 0xc8372d, roughness: 0.42, metalness: 0.2 })
  );
  body.position.z = 0.035;
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI), metalMat);
  shackle.position.set(0, 0.036, 0.065);
  padlock.add(body, shackle);
  addTipAnchor(padlock, TOOL_TIP_OFFSETS.padlock);
  props.padlock = padlock;

  const wand = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe6b422, roughness: 0.36, metalness: 0.1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.80, 10), poleMat);
  pole.rotation.x = Math.PI / 2;
  pole.position.z = 0.40;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 14), gripMat);
  guard.rotation.x = Math.PI / 2;
  guard.position.z = 0.10;
  const tipHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.075, 12),
    new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.35 })
  );
  tipHead.rotation.x = Math.PI / 2;
  tipHead.position.z = 0.80;
  const collarLedMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    roughness: 0.22,
  });
  const collarLed = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 14), collarLedMat);
  collarLed.rotation.x = Math.PI / 2;
  collarLed.position.z = 0.74;
  const tipPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.005, 0.065, 8), metalMat);
  tipPin.rotation.x = Math.PI / 2;
  tipPin.position.z = 0.86;
  wand.add(pole, guard, collarLed, tipHead, tipPin);
  wand.userData.collarLedMat = collarLedMat;
  addTipAnchor(wand, TOOL_TIP_OFFSETS.proving_wand);
  props.proving_wand = wand;

  const megger = new THREE.Group();
  const redProbe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.012, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.45 })
  );
  redProbe.rotation.x = Math.PI / 2;
  redProbe.position.set(0.02, 0, 0.10);
  const blkProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.22, 8), gripMat);
  blkProbe.rotation.x = Math.PI / 2;
  blkProbe.position.set(-0.02, 0, 0.10);
  megger.add(redProbe, blkProbe);
  addTipAnchor(megger, TOOL_TIP_OFFSETS.megger_leads);
  props.megger_leads = megger;

  const cme = new THREE.Group();
  const cmePole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.015, 0.74, 10),
    new THREE.MeshStandardMaterial({ color: 0xd98a1e, roughness: 0.4 })
  );
  cmePole.rotation.x = Math.PI / 2;
  cmePole.position.z = 0.37;
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.055), brassMat);
  clamp.position.z = 0.75;
  cme.add(cmePole, clamp);
  addTipAnchor(cme, TOOL_TIP_OFFSETS.cme_stick);
  props.cme_stick = cme;

  const clipboard = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.014, 0.29),
    new THREE.MeshStandardMaterial({ color: 0x3b4856, roughness: 0.55 })
  );
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.016, 0.25),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 })
  );
  paper.position.y = 0.002;
  const headerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.017, 0.035),
    new THREE.MeshStandardMaterial({ color: 0xc8372d, roughness: 0.6 })
  );
  headerStripe.position.set(0, 0.003, -0.10);
  clipboard.add(board, paper, headerStripe);
  clipboard.rotation.x = 0.45;
  clipboard.position.set(-0.04, 0.02, 0.12);
  addTipAnchor(clipboard, TOOL_TIP_OFFSETS.ptw_clipboard);
  props.ptw_clipboard = clipboard;

  Object.values(props).forEach((p) => {
    p.visible = false;
  });
  return props;
}

/**
 * Orient a toolSocket so its local +Z axis points along `worldAimDir` with optional axial roll `twistRad`.
 */
function orientToolSocketToWorldAim(socketObj, worldAimDir, twistRad = 0, blend = 1, restQuat = null) {
  if (!socketObj.parent) return;
  socketObj.parent.updateMatrixWorld(true);
  socketObj.parent.getWorldQuaternion(_qA).invert();

  // Matrix4.lookAt(eye, target, up) sets +Z = normalize(eye - target), so eye = worldAimDir, target = 0 -> +Z = worldAimDir!
  _m4.lookAt(worldAimDir, _vC.set(0, 0, 0), _up);
  _qB.setFromRotationMatrix(_m4);
  if (Math.abs(twistRad) > 1e-4) {
    const rollQ = new THREE.Quaternion().setFromAxisAngle(_zAxis, twistRad);
    _qB.multiply(rollQ);
  }

  const desiredLocalQuat = _qA.multiply(_qB);
  if (blend >= 0.999 || !restQuat) {
    socketObj.quaternion.copy(desiredLocalQuat);
  } else {
    socketObj.quaternion.copy(restQuat).slerp(desiredLocalQuat, blend);
  }
}

export function createEngineerCharacter({ autoLoadGlb = true } = {}) {
  const root = new THREE.Group();
  root.name = 'MarineETOCharacter';

  if (typeof document !== 'undefined') {
    const shadowCv = document.createElement('canvas');
    shadowCv.width = 64;
    shadowCv.height = 64;
    const sCtx = shadowCv.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(15, 23, 32, 0.45)');
      grad.addColorStop(1, 'rgba(15, 23, 32, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
      const shadowTex = new THREE.CanvasTexture(shadowCv);
      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.72, 0.72),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.009;
      root.add(contactShadow);
    }
  }

  const coverallMat = new THREE.MeshStandardMaterial({ color: 0x20354b, roughness: 0.82, metalness: 0.05 });
  const arcCoatMat = new THREE.MeshStandardMaterial({ color: 0x3b4f47, roughness: 0.78, metalness: 0.06 });
  const hiVisMat = new THREE.MeshStandardMaterial({ color: 0xe6b830, roughness: 0.42, metalness: 0.25 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdcb393, roughness: 0.65, metalness: 0.02 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xe6841c, roughness: 0.52, metalness: 0.04 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.32, metalness: 0.12 });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x268e5c,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.72,
    clearcoat: 0.8,
  });
  const stdBootMat = new THREE.MeshStandardMaterial({ color: 0x252b32, roughness: 0.75, metalness: 0.08 });
  const hvBootSoleMat = new THREE.MeshStandardMaterial({ color: 0xd4a024, roughness: 0.62, metalness: 0.08 });

  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // =========================================================================
  // 1. Articulated Procedural Fallback Rig (active in headless tests / pre-GLB)
  //    Character faces local +Z: anatomical Left = +X, anatomical Right = -X
  // =========================================================================
  const proceduralGroup = new THREE.Group();
  proceduralGroup.name = 'ProceduralFallbackRig';
  bodyRoot.add(proceduralGroup);

  const hips = new THREE.Group();
  hips.position.y = 0.90;
  proceduralGroup.add(hips);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.20), coverallMat);
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  function makeLeg(xSign) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(xSign * 0.10, -0.05, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.40, 0.14), coverallMat);
    thigh.position.y = -0.20;
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.y = -0.40;
    hipPivot.add(kneePivot);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.36, 0.125), coverallMat);
    shin.position.y = -0.18;
    shin.castShadow = true;
    kneePivot.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.11, 0.24), stdBootMat);
    boot.position.set(0, -0.39, 0.045);
    boot.castShadow = true;
    kneePivot.add(boot);

    const hvSole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.032, 0.252), hvBootSoleMat);
    hvSole.position.set(0, -0.435, 0.045);
    hvSole.visible = false;
    kneePivot.add(hvSole);

    return { hipPivot, kneePivot, hvSole };
  }

  const leftLeg = makeLeg(1);
  const rightLeg = makeLeg(-1);
  hips.add(leftLeg.hipPivot, rightLeg.hipPivot);

  const torso = new THREE.Group();
  torso.position.y = 0.07;
  hips.add(torso);

  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.22), coverallMat);
  chestMesh.position.y = 0.24;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  const bandLow = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.045, 0.23), hiVisMat);
  bandLow.position.y = 0.14;
  const bandHigh = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.045, 0.23), hiVisMat);
  bandHigh.position.y = 0.34;
  torso.add(bandLow, bandHigh);

  function buildArcSuitCoatGroup() {
    const g = new THREE.Group();
    const coatBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.27), arcCoatMat);
    coatBody.position.y = 0.20;
    coatBody.castShadow = true;
    const coatStripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.28), hiVisMat);
    coatStripe.position.y = 0.18;
    const coatCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.09, 12), arcCoatMat);
    coatCollar.position.y = 0.49;
    g.add(coatBody, coatStripe, coatCollar);
    g.visible = false;
    return g;
  }

  function buildHardHatGroup() {
    const g = new THREE.Group();
    const hatDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.124, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
      helmetMat
    );
    hatDome.position.y = 0.155;
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.138, 0.016, 16), helmetMat);
    hatBrim.position.set(0, 0.16, 0.02);
    g.add(hatDome, hatBrim);
    return g;
  }

  function buildArcHoodGroup() {
    const g = new THREE.Group();
    const hoodShell = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.165, 0.30, 14), arcCoatMat);
    hoodShell.position.y = 0.15;
    const hoodCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      arcCoatMat
    );
    hoodCap.position.y = 0.29;
    const hoodVisor = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.07), visorMat);
    hoodVisor.position.set(0, 0.16, 0.13);
    g.add(hoodShell, hoodCap, hoodVisor);
    g.visible = false;
    return g;
  }

  const arcSuitCoat = buildArcSuitCoatGroup();
  torso.add(arcSuitCoat);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.08, 10), skinMat);
  neckMesh.position.y = 0.50;
  torso.add(neckMesh);

  const headGroup = new THREE.Group();
  headGroup.position.y = 0.53;
  torso.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.20, 12), skinMat);
  headMesh.position.y = 0.105;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const hardHat = buildHardHatGroup();
  const arcHood = buildArcHoodGroup();
  headGroup.add(hardHat, arcHood);

  function makeArm(xSign) {
    const shoulder = new THREE.Group();
    shoulder.position.set(xSign * 0.235, 0.45, 0);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.30, 0.105), coverallMat);
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.30;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.28, 0.095), coverallMat);
    forearm.position.y = -0.14;
    forearm.castShadow = true;
    elbow.add(forearm);

    const bareHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.10, 0.065), skinMat);
    bareHand.position.y = -0.28;
    elbow.add(bareHand);

    const hvGlove = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.22, 0.108), gloveMat);
    hvGlove.position.y = -0.23;
    hvGlove.visible = false;
    elbow.add(hvGlove);

    const toolSocket = new THREE.Group();
    toolSocket.position.set(0, -0.28, 0);
    const fingerTip = addTipAnchor(toolSocket, TOOL_TIP_OFFSETS.none);
    elbow.add(toolSocket);

    return { shoulder, elbow, bareHand, hvGlove, toolSocket, fingerTip };
  }

  const leftArm = makeArm(1);
  const rightArm = makeArm(-1);
  torso.add(leftArm.shoulder, rightArm.shoulder);

  const procTools = createToolProps();
  Object.values(procTools).forEach((t) => rightArm.toolSocket.add(t));

  // =========================================================================
  // 2. Rigged GLTF Engineer (`engineer.glb`) + AnimationMixer + CCDIKSolver
  // =========================================================================
  const riggedGroup = new THREE.Group();
  riggedGroup.name = 'RiggedGLBEngineer';
  riggedGroup.visible = false;
  bodyRoot.add(riggedGroup);

  const rigTools = createToolProps();
  let rigState = null;
  let currentHeldTool = 'none';
  let currentPpe = { suit: false, gloves: false, bootsMat: false };

  function attachLoadedEngineerGltf(gltf) {
    if (!gltf?.scene) return false;
    const skinnedMesh = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
    if (!skinnedMesh || !skinnedMesh.skeleton) return false;

    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;
    if (skinnedMesh.material) {
      skinnedMesh.material.vertexColors = true;
      skinnedMesh.material.needsUpdate = true;
    }

    const bones = skinnedMesh.skeleton.bones;
    const boneByName = Object.fromEntries(bones.map((b) => [b.name, b]));
    const boneIdx = (name) => bones.findIndex((b) => b.name === name);

    const rightTargetIdx = boneIdx('RightHandIKTarget');
    const rightHandIdx = boneIdx('RightHand');
    const rightForeIdx = boneIdx('RightForeArm');
    const rightUpperIdx = boneIdx('RightUpperArm');
    if (rightTargetIdx < 0 || rightHandIdx < 0 || rightForeIdx < 0 || rightUpperIdx < 0) {
      return false;
    }

    const ikSolver = new CCDIKSolver(skinnedMesh, [
      {
        target: rightTargetIdx,
        effector: rightHandIdx,
        links: [
          {
            index: rightForeIdx,
            rotationMin: new THREE.Vector3(-2.55, -0.5, -0.5),
            rotationMax: new THREE.Vector3(-0.02, 0.5, 0.5),
          },
          { index: rightUpperIdx },
        ],
        iteration: 16,
      },
    ]);

    // Attach PPE & tool sockets directly to rigged skeleton bones
    const rigArcCoat = buildArcSuitCoatGroup();
    rigArcCoat.position.set(0, -0.12, 0);
    boneByName.Chest?.add(rigArcCoat);

    const rigLeftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.30, 10), arcCoatMat);
    rigLeftSleeve.position.set(0, -0.15, 0);
    rigLeftSleeve.visible = false;
    boneByName.LeftUpperArm?.add(rigLeftSleeve);

    const rigRightSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.058, 0.30, 10), arcCoatMat);
    rigRightSleeve.position.set(0, -0.15, 0);
    rigRightSleeve.visible = false;
    boneByName.RightUpperArm?.add(rigRightSleeve);

    const rigHardHat = buildHardHatGroup();
    const rigArcHood = buildArcHoodGroup();
    boneByName.Head?.add(rigHardHat, rigArcHood);

    const rigLeftBareHand = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.088, 0.062), skinMat);
    rigLeftBareHand.position.set(0, -0.04, 0);
    boneByName.LeftHand?.add(rigLeftBareHand);

    const rigRightBareHand = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.088, 0.062), skinMat);
    rigRightBareHand.position.set(0, -0.04, 0);
    boneByName.RightHand?.add(rigRightBareHand);

    const rigLeftGlove = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.21, 10), gloveMat);
    rigLeftGlove.position.set(0, -0.19, 0);
    rigLeftGlove.visible = false;
    boneByName.LeftForeArm?.add(rigLeftGlove);

    const rigRightGlove = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.21, 10), gloveMat);
    rigRightGlove.position.set(0, -0.19, 0);
    rigRightGlove.visible = false;
    boneByName.RightForeArm?.add(rigRightGlove);

    const rigLeftSole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.032, 0.252), hvBootSoleMat);
    rigLeftSole.position.set(0, -0.055, 0.01);
    rigLeftSole.visible = false;
    boneByName.LeftFoot?.add(rigLeftSole);

    const rigRightSole = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.032, 0.252), hvBootSoleMat);
    rigRightSole.position.set(0, -0.055, 0.01);
    rigRightSole.visible = false;
    boneByName.RightFoot?.add(rigRightSole);

    const rigToolSocket = new THREE.Group();
    rigToolSocket.name = 'RigRightToolSocket';
    const rigFingerTip = addTipAnchor(rigToolSocket, TOOL_TIP_OFFSETS.none);
    Object.values(rigTools).forEach((t) => rigToolSocket.add(t));
    boneByName.RightHand.add(rigToolSocket);

    const mixer = new THREE.AnimationMixer(gltf.scene);
    const clipActions = {};
    for (const clip of gltf.animations || []) {
      const act = mixer.clipAction(clip);
      clipActions[clip.name] = act;
    }
    let activeClipName = null;
    if (clipActions.Idle) {
      clipActions.Idle.play();
      activeClipName = 'Idle';
    }

    riggedGroup.clear();
    riggedGroup.add(gltf.scene);
    riggedGroup.visible = true;
    proceduralGroup.visible = false;

    rigState = {
      scene: gltf.scene,
      armature: gltf.scene.getObjectByName('Armature') || gltf.scene,
      skinnedMesh,
      bones: boneByName,
      ikSolver,
      mixer,
      clipActions,
      getActiveClipName: () => activeClipName,
      crossFadeTo(nextName) {
        if (!clipActions[nextName] || activeClipName === nextName) return;
        const nextAct = clipActions[nextName];
        nextAct.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
        if (activeClipName && clipActions[activeClipName]) {
          clipActions[activeClipName].crossFadeTo(nextAct, 0.18, false);
        }
        activeClipName = nextName;
      },
      rigArcCoat,
      rigLeftSleeve,
      rigRightSleeve,
      rigHardHat,
      rigArcHood,
      rigLeftBareHand,
      rigRightBareHand,
      rigLeftGlove,
      rigRightGlove,
      rigLeftSole,
      rigRightSole,
      rigToolSocket,
      rigFingerTip,
    };

    setPpeVisuals(currentPpe);
    setHeldTool(currentHeldTool);
    return true;
  }

  if (autoLoadGlb && typeof window !== 'undefined') {
    const loader = getSharedGltfLoader();
    loader.load(
      resolvePublicAssetUrl('models/engineer.glb'),
      (gltf) => {
        attachLoadedEngineerGltf(gltf);
      },
      undefined,
      () => {
        // Keep articulated procedural fallback active if offline fetch fails
      }
    );
  }

  // =========================================================================
  // 3. First-Person Arms & Tool Rig (attached to Camera)
  // =========================================================================
  const fpGroup = new THREE.Group();
  fpGroup.visible = false;

  const fpForearmGeo = new THREE.CylinderGeometry(0.036, 0.044, 0.30, 10);
  fpForearmGeo.rotateX(Math.PI / 2);
  const fpHandGeo = new THREE.BoxGeometry(0.062, 0.052, 0.095);
  const fpGloveGeo = new THREE.CylinderGeometry(0.044, 0.052, 0.19, 10);
  fpGloveGeo.rotateX(Math.PI / 2);

  const fpLeftPivot = new THREE.Group();
  fpLeftPivot.position.set(-0.27, -0.32, -0.44);
  const fpLeftForearm = new THREE.Mesh(fpForearmGeo, coverallMat);
  const fpLeftHand = new THREE.Mesh(fpHandGeo, skinMat);
  fpLeftHand.position.z = -0.17;
  const fpLeftGlove = new THREE.Mesh(fpGloveGeo, gloveMat);
  fpLeftGlove.position.z = -0.11;
  fpLeftGlove.visible = false;
  fpLeftPivot.add(fpLeftForearm, fpLeftHand, fpLeftGlove);

  const fpRightPivot = new THREE.Group();
  fpRightPivot.position.set(0.27, -0.32, -0.44);
  const fpRightForearm = new THREE.Mesh(fpForearmGeo, coverallMat);
  const fpRightHand = new THREE.Mesh(fpHandGeo, skinMat);
  fpRightHand.position.z = -0.17;
  const fpRightGlove = new THREE.Mesh(fpGloveGeo, gloveMat);
  fpRightGlove.position.z = -0.11;
  fpRightGlove.visible = false;
  const fpToolSocket = new THREE.Group();
  fpToolSocket.position.set(0, 0.01, -0.19);
  fpToolSocket.rotation.y = Math.PI;
  const fpFingerTip = addTipAnchor(fpToolSocket, 0.02);
  fpRightPivot.add(fpRightForearm, fpRightHand, fpRightGlove, fpToolSocket);

  const firstPersonTools = createToolProps();
  Object.values(firstPersonTools).forEach((t) => fpToolSocket.add(t));
  fpGroup.add(fpLeftPivot, fpRightPivot);

  function setWandContactGlow(active) {
    for (const toolSet of [procTools, rigTools, firstPersonTools]) {
      const ledMat = toolSet.proving_wand?.userData?.collarLedMat;
      if (ledMat) {
        ledMat.emissive.setHex(active ? 0x22c55e : 0x000000);
        ledMat.emissiveIntensity = active ? 1.15 : 0.0;
      }
    }
  }

  function setPpeVisuals(ppe) {
    currentPpe = {
      suit: Boolean(ppe?.suit),
      gloves: Boolean(ppe?.gloves),
      bootsMat: Boolean(ppe?.bootsMat),
    };
    const { suit, gloves, bootsMat: boots } = currentPpe;

    arcSuitCoat.visible = suit;
    arcHood.visible = suit;
    hardHat.visible = !suit;

    leftArm.hvGlove.visible = gloves;
    rightArm.hvGlove.visible = gloves;
    leftArm.bareHand.visible = !gloves;
    rightArm.bareHand.visible = !gloves;

    leftLeg.hvSole.visible = boots;
    rightLeg.hvSole.visible = boots;

    fpLeftGlove.visible = gloves;
    fpRightGlove.visible = gloves;
    fpLeftHand.visible = !gloves;
    fpRightHand.visible = !gloves;

    if (rigState) {
      rigState.rigArcCoat.visible = suit;
      rigState.rigLeftSleeve.visible = suit;
      rigState.rigRightSleeve.visible = suit;
      rigState.rigArcHood.visible = suit;
      rigState.rigHardHat.visible = !suit;
      rigState.rigLeftGlove.visible = gloves;
      rigState.rigRightGlove.visible = gloves;
      rigState.rigLeftBareHand.visible = !gloves;
      rigState.rigRightBareHand.visible = !gloves;
      rigState.rigLeftSole.visible = boots;
      rigState.rigRightSole.visible = boots;
    }
  }

  function setHeldTool(toolId) {
    currentHeldTool = toolId || 'none';
    for (const [key, mesh] of Object.entries(procTools)) {
      mesh.visible = key === currentHeldTool;
    }
    for (const [key, mesh] of Object.entries(rigTools)) {
      mesh.visible = key === currentHeldTool;
    }
    for (const [key, mesh] of Object.entries(firstPersonTools)) {
      mesh.visible = key === currentHeldTool;
    }
  }

  function setFirstPersonMode(isFirst) {
    bodyRoot.visible = !isFirst;
    fpGroup.visible = isFirst;
  }

  function getActiveTipWorldPosition(isFirstPerson = false) {
    root.updateMatrixWorld(true);
    fpGroup.updateMatrixWorld(true);

    if (isFirstPerson) {
      const toolMesh = firstPersonTools[currentHeldTool];
      const anchor = toolMesh?.visible ? toolMesh.userData.tipAnchor : fpFingerTip;
      return anchor.getWorldPosition(new THREE.Vector3());
    }

    if (rigState && riggedGroup.visible) {
      const toolMesh = rigTools[currentHeldTool];
      const anchor = toolMesh?.visible ? toolMesh.userData.tipAnchor : rigState.rigFingerTip;
      return anchor.getWorldPosition(new THREE.Vector3());
    }

    const toolMesh = procTools[currentHeldTool];
    const anchor = toolMesh?.visible ? toolMesh.userData.tipAnchor : rightArm.fingerTip;
    return anchor.getWorldPosition(new THREE.Vector3());
  }

  const _restToolQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

  function updatePose({
    speed = 0,
    walkCycle = 0,
    elapsed = 0,
    dt = 0.016,
    anim = null,
    pushingTrolley = false,
    camera = null,
    characterYaw = Math.PI,
  }) {
    setWandContactGlow(false);

    // Reset 1st-person hands baseline
    fpLeftPivot.position.set(-0.27, -0.32, -0.44);
    fpLeftPivot.rotation.set(0.06, -0.14, 0);
    fpRightPivot.position.set(0.27, -0.32, -0.44);
    fpRightPivot.rotation.set(0.06, 0.14, 0);

    const hasSocketTarget = Boolean(anim && anim.type && anim.socketWorldPos);

    // -----------------------------------------------------------------------
    // A. Update Rigged GLTF Engineer (AnimationMixer + CCDIKSolver) if loaded
    // -----------------------------------------------------------------------
    if (rigState && riggedGroup.visible) {
      let desiredClip = 'Idle';
      if (pushingTrolley && !anim) desiredClip = 'PushTrolley';
      else if (!anim && speed > 2.9) desiredClip = 'Sprint';
      else if (!anim && speed > 0.08) desiredClip = 'Walk';

      rigState.crossFadeTo(desiredClip);
      rigState.mixer.update(Math.min(0.1, Math.max(0.001, dt)));
      rigState.rigToolSocket.quaternion.copy(_restToolQuat);

      if (hasSocketTarget) {
        const p = Math.min(1, Math.max(0, anim.elapsed / Math.max(anim.duration, 0.01)));
        const { tipWorldPos, reachWeight, twistRad, crankOrbitOffset, contactActive } =
          computeChoreographedTipTarget({
            socketWorldPos: anim.socketWorldPos,
            isRear: Boolean(anim.isRear),
            animType: anim.type,
            progress: p,
          });

        if (anim.tool === 'proving_wand' && contactActive) {
          setWandContactGlow(true);
        }

        // Ergonomic knee crouch & forward torso lean so low/deep sockets lie inside natural arm reach
        const posture = computeBodyPostureForSocket({
          socketWorldPos: anim.socketWorldPos,
          toolId: currentHeldTool,
          reachWeight,
        });
        if (rigState.bones.Hips) {
          rigState.bones.Hips.position.y = 0.90 - posture.crouchDrop;
        }
        if (rigState.bones.LeftThigh && rigState.bones.LeftShin) {
          rigState.bones.LeftThigh.rotation.x = -posture.kneeBend * 0.52;
          rigState.bones.LeftShin.rotation.x = posture.kneeBend;
        }
        if (rigState.bones.RightThigh && rigState.bones.RightShin) {
          rigState.bones.RightThigh.rotation.x = -posture.kneeBend * 0.52;
          rigState.bones.RightShin.rotation.x = posture.kneeBend;
        }
        if (rigState.bones.Chest) {
          rigState.bones.Chest.rotation.x += posture.torsoLean;
        }
        root.updateMatrixWorld(true);

        const shoulderWorld = rigState.bones.RightUpperArm.getWorldPosition(_vA).clone();
        const animWristWorld = rigState.bones.RightHand.getWorldPosition(_vB).clone();

        const { wristWorldPos } = computeWristGoalFromTip({
          shoulderWorldPos: shoulderWorld,
          tipWorldPos,
          characterYaw,
          toolId: currentHeldTool,
          maxArmReach: 0.568,
          crankOrbitOffset,
        });

        const blendedWristWorld = animWristWorld.lerp(wristWorldPos, reachWeight);
        const localTarget = rigState.armature.worldToLocal(blendedWristWorld.clone());
        rigState.bones.RightHandIKTarget.position.copy(localTarget);

        rigState.scene.updateMatrixWorld(true);
        rigState.ikSolver.update();
        rigState.scene.updateMatrixWorld(true);

        const postIkWristWorld = rigState.bones.RightHand.getWorldPosition(_vA);
        const worldAim = _vB.subVectors(tipWorldPos, postIkWristWorld);
        if (worldAim.lengthSq() > 1e-8) worldAim.normalize();
        else worldAim.set(Math.sin(characterYaw), 0, Math.cos(characterYaw));

        orientToolSocketToWorldAim(
          rigState.rigToolSocket,
          worldAim,
          twistRad,
          reachWeight,
          _restToolQuat
        );

        if (camera) {
          const fpPose = computeFirstPersonHandIK({
            camera,
            tipWorldPos,
            toolId: currentHeldTool,
            reachWeight,
            twistRad,
          });
          fpRightPivot.position.copy(fpPose.position);
          fpRightPivot.quaternion.copy(fpPose.quaternion);
          fpLeftPivot.position.set(-0.22, -0.28 + 0.04 * reachWeight, -0.42);
        }
        return;
      }

      if (anim && anim.type) {
        // Non-socket room actions (PPE, Permit Clipboard, Recoil)
        const p = Math.min(1, Math.max(0, anim.elapsed / Math.max(anim.duration, 0.01)));
        const bell = Math.sin(p * Math.PI);
        if (anim.type === 'recoil' && rigState.bones.Chest) {
          rigState.bones.Chest.rotation.x -= 0.30 * bell;
        }
      }
    }

    // -----------------------------------------------------------------------
    // B. Procedural Articulated Rig + 1st-Person Pose
    // -----------------------------------------------------------------------
    hips.position.y = 0.90;
    torso.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftLeg.hipPivot.rotation.set(0, 0, 0);
    leftLeg.kneePivot.rotation.set(0, 0, 0);
    rightLeg.hipPivot.rotation.set(0, 0, 0);
    rightLeg.kneePivot.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(0, 0, -0.08);
    leftArm.elbow.rotation.set(-0.12, 0, 0);
    rightArm.shoulder.rotation.set(0, 0, 0.08);
    rightArm.elbow.rotation.set(-0.12, 0, 0);
    rightArm.toolSocket.quaternion.copy(_restToolQuat);

    if (hasSocketTarget) {
      const p = Math.min(1, Math.max(0, anim.elapsed / Math.max(anim.duration, 0.01)));
      const { tipWorldPos, reachWeight, twistRad, crankOrbitOffset, contactActive } =
        computeChoreographedTipTarget({
          socketWorldPos: anim.socketWorldPos,
          isRear: Boolean(anim.isRear),
          animType: anim.type,
          progress: p,
        });

      if (anim.tool === 'proving_wand' && contactActive) {
        setWandContactGlow(true);
      }

      const posture = computeBodyPostureForSocket({
        socketWorldPos: anim.socketWorldPos,
        toolId: currentHeldTool,
        reachWeight,
      });
      hips.position.y = 0.90 - posture.crouchDrop;
      leftLeg.hipPivot.rotation.x = -posture.kneeBend * 0.52;
      leftLeg.kneePivot.rotation.x = posture.kneeBend;
      rightLeg.hipPivot.rotation.x = -posture.kneeBend * 0.52;
      rightLeg.kneePivot.rotation.x = posture.kneeBend;
      torso.rotation.x = posture.torsoLean;
      root.updateMatrixWorld(true);

      if (proceduralGroup.visible) {
        const shoulderWorld = rightArm.shoulder.getWorldPosition(_vA).clone();
        const restWristWorld = rightArm.toolSocket.getWorldPosition(_vB).clone();

        const { wristWorldPos } = computeWristGoalFromTip({
          shoulderWorldPos: shoulderWorld,
          tipWorldPos,
          characterYaw,
          toolId: currentHeldTool,
          maxArmReach: 0.568,
          crankOrbitOffset,
        });

        const blendedWristWorld = restWristWorld.lerp(wristWorldPos, reachWeight);
        const shoulderTorsoLocal = rightArm.shoulder.position.clone();
        const wristTorsoLocal = torso.worldToLocal(blendedWristWorld.clone());

        const ik = solveTwoBoneArmIK({
          shoulderPos: shoulderTorsoLocal,
          wristTargetPos: wristTorsoLocal,
          upperLen: 0.30,
          lowerLen: 0.28,
          poleDir: new THREE.Vector3(-0.25, -0.65, -0.72),
        });

        rightArm.shoulder.quaternion.copy(ik.upperQuat);
        rightArm.elbow.quaternion.copy(ik.lowerLocalQuat);
        root.updateMatrixWorld(true);

        const postIkWrist = rightArm.toolSocket.getWorldPosition(_vA);
        const worldAim = _vB.subVectors(tipWorldPos, postIkWrist);
        if (worldAim.lengthSq() > 1e-8) worldAim.normalize();
        else worldAim.set(Math.sin(characterYaw), 0, Math.cos(characterYaw));

        orientToolSocketToWorldAim(
          rightArm.toolSocket,
          worldAim,
          twistRad,
          reachWeight,
          _restToolQuat
        );
      }

      if (camera) {
        const fpPose = computeFirstPersonHandIK({
          camera,
          tipWorldPos,
          toolId: currentHeldTool,
          reachWeight,
          twistRad,
        });
        fpRightPivot.position.copy(fpPose.position);
        fpRightPivot.quaternion.copy(fpPose.quaternion);
        fpLeftPivot.position.set(-0.22, -0.28 + 0.04 * reachWeight, -0.42);
      }
      return;
    }

    if (anim && anim.type) {
      const p = Math.min(1, Math.max(0, anim.elapsed / Math.max(anim.duration, 0.01)));
      const bell = Math.sin(p * Math.PI);

      switch (anim.type) {
        case 'don_ppe': {
          const roll = Math.sin(p * Math.PI * 4) * 0.35;
          torso.rotation.x = 0.08 * bell;
          leftArm.shoulder.rotation.set(-1.15 * bell + roll * 0.2, -0.25 * bell, -0.25 * bell);
          leftArm.elbow.rotation.set(-1.1 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-1.25 * bell - roll * 0.2, 0.25 * bell, 0.25 * bell);
          rightArm.elbow.rotation.set(-1.1 * bell, 0, 0);
          headGroup.rotation.x = 0.18 * Math.sin(p * Math.PI * 2);
          fpLeftPivot.position.set(-0.14, -0.18 + 0.08 * bell, -0.34);
          fpLeftPivot.rotation.z = roll;
          fpRightPivot.position.set(0.14, -0.18 + 0.08 * bell, -0.34);
          fpRightPivot.rotation.z = -roll;
          break;
        }
        case 'sign_permit': {
          const scribble = Math.sin(p * Math.PI * 8) * 0.12;
          headGroup.rotation.x = 0.28 * bell;
          leftArm.shoulder.rotation.set(-0.95 * bell, -0.32 * bell, -0.18);
          leftArm.elbow.rotation.set(-1.05 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-0.95 * bell, 0.35 * bell + scribble, 0.15);
          rightArm.elbow.rotation.set(-1.10 * bell, 0, 0);
          fpLeftPivot.position.set(-0.16, -0.20, -0.38);
          fpRightPivot.position.set(0.12 + scribble * 0.3, -0.20, -0.40);
          break;
        }
        case 'recoil': {
          torso.rotation.x = -0.32 * bell;
          hips.position.y = 0.90 - 0.06 * bell;
          leftArm.shoulder.rotation.set(-1.65 * bell, -0.25 * bell, -0.45 * bell);
          leftArm.elbow.rotation.set(-0.95 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-1.65 * bell, 0.25 * bell, 0.45 * bell);
          rightArm.elbow.rotation.set(-0.95 * bell, 0, 0);
          fpLeftPivot.position.set(-0.18, -0.12 + 0.10 * bell, -0.30);
          fpRightPivot.position.set(0.18, -0.12 + 0.10 * bell, -0.30);
          break;
        }
        default: {
          const jab = Math.sin(Math.min(1, p * 1.35) * Math.PI);
          torso.rotation.x = 0.10 * jab;
          rightArm.shoulder.rotation.set(-1.25 * jab, 0, 0.06);
          rightArm.elbow.rotation.set(-0.35 * (1 - jab), 0, 0);
          fpRightPivot.position.set(0.16, -0.17 + 0.06 * jab, -0.38 - 0.14 * jab);
          break;
        }
      }
      return;
    }

    const moveBlend = Math.min(1, speed / 1.6);
    if (pushingTrolley) {
      if (moveBlend > 0.04) {
        const stride = Math.sin(walkCycle);
        const liftL = Math.max(0, Math.cos(walkCycle));
        const liftR = Math.max(0, -Math.cos(walkCycle));
        hips.position.y = 0.89 + Math.abs(Math.sin(walkCycle)) * 0.022 * moveBlend;
        leftLeg.hipPivot.rotation.x = -stride * 0.48 * moveBlend;
        leftLeg.kneePivot.rotation.x = liftL * 0.46 * moveBlend;
        rightLeg.hipPivot.rotation.x = stride * 0.48 * moveBlend;
        rightLeg.kneePivot.rotation.x = liftR * 0.46 * moveBlend;
      }
      torso.rotation.x = 0.14 + 0.06 * moveBlend;
      leftArm.shoulder.rotation.set(-1.12, -0.06, -0.05);
      leftArm.elbow.rotation.set(-0.32, 0, 0);
      rightArm.shoulder.rotation.set(-1.12, 0.06, 0.05);
      rightArm.elbow.rotation.set(-0.32, 0, 0);

      const bob = Math.sin(walkCycle * 2) * 0.01 * moveBlend;
      fpLeftPivot.position.set(-0.22, -0.22 + bob, -0.48);
      fpLeftPivot.rotation.set(0.18, -0.06, 0);
      fpRightPivot.position.set(0.22, -0.22 - bob, -0.48);
      fpRightPivot.rotation.set(0.18, 0.06, 0);
      return;
    }

    if (moveBlend > 0.04) {
      const stride = Math.sin(walkCycle);
      const liftL = Math.max(0, Math.cos(walkCycle));
      const liftR = Math.max(0, -Math.cos(walkCycle));

      hips.position.y = 0.90 + Math.abs(Math.sin(walkCycle)) * 0.032 * moveBlend;
      torso.rotation.x = 0.06 * moveBlend;
      torso.rotation.y = -stride * 0.09 * moveBlend;

      leftLeg.hipPivot.rotation.x = -stride * 0.56 * moveBlend;
      leftLeg.kneePivot.rotation.x = liftL * 0.52 * moveBlend;
      rightLeg.hipPivot.rotation.x = stride * 0.56 * moveBlend;
      rightLeg.kneePivot.rotation.x = liftR * 0.52 * moveBlend;

      leftArm.shoulder.rotation.x = stride * 0.46 * moveBlend;
      leftArm.elbow.rotation.x = -0.18 - Math.max(0, -stride) * 0.25 * moveBlend;
      rightArm.shoulder.rotation.x = -stride * 0.46 * moveBlend;
      rightArm.elbow.rotation.x = -0.18 - Math.max(0, stride) * 0.25 * moveBlend;

      fpLeftPivot.position.y = -0.32 + Math.sin(walkCycle * 2) * 0.014 * moveBlend;
      fpRightPivot.position.y = -0.32 + Math.cos(walkCycle * 2) * 0.014 * moveBlend;
    } else {
      const breath = Math.sin(elapsed * 2.1);
      hips.position.y = 0.90 + breath * 0.005;
      leftArm.shoulder.rotation.z = -0.08 - breath * 0.015;
      rightArm.shoulder.rotation.z = 0.08 + breath * 0.015;
      headGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.06;
    }
  }

  return {
    root,
    fpGroup,
    setPpeVisuals,
    setHeldTool,
    setFirstPersonMode,
    updatePose,
    attachLoadedEngineerGltf,
    getActiveTipWorldPosition,
    isRiggedGlbActive: () => Boolean(rigState && riggedGroup.visible),
  };
}
