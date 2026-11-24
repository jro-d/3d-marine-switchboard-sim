import * as THREE from 'three';

function createToolProps() {
  const props = {};

  // 1. L-shaped zinc-plated VCB Racking Crank Handle
  const crank = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.82, roughness: 0.28 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1e252c, roughness: 0.85 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), metalMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.13;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.16, 10), metalMat);
  arm.position.set(0, -0.07, 0.01);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10), gripMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -0.14, -0.04);
  crank.add(shaft, arm, handle);
  props.racking_handle = crank;

  // 2. Brass Castell Trapped Key
  const key = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4a024, metalness: 0.86, roughness: 0.24 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16), brassMat);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 8), brassMat);
  blade.rotation.x = Math.PI / 2;
  blade.position.z = 0.06;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.014), brassMat);
  bit.position.set(0.01, 0, 0.095);
  key.add(bow, blade, bit);
  props.castell_key = key;

  // 3. Red LOTO Safety Padlock
  const padlock = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.072, 0.032), new THREE.MeshStandardMaterial({ color: 0xc8372d, roughness: 0.42, metalness: 0.2 }));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 16, Math.PI), metalMat);
  shackle.position.y = 0.036;
  padlock.add(body, shackle);
  props.padlock = padlock;

  // 4. 6.6 kV Insulated Yellow HV Proving Wand
  const wand = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe6b422, roughness: 0.36, metalness: 0.1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.86, 10), poleMat);
  pole.rotation.x = Math.PI / 2;
  pole.position.z = 0.36;
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 14), gripMat);
  guard.rotation.x = Math.PI / 2;
  guard.position.z = 0.08;
  const tipHead = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.35 }));
  tipHead.rotation.x = Math.PI / 2;
  tipHead.position.z = 0.80;
  const tipPin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 8), metalMat);
  tipPin.rotation.x = Math.PI / 2;
  tipPin.position.z = 0.88;
  wand.add(pole, guard, tipHead, tipPin);
  props.proving_wand = wand;

  // 5. 5 kV Megger Twin HV Test Leads
  const megger = new THREE.Group();
  const redProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xd93829, roughness: 0.45 }));
  redProbe.rotation.x = Math.PI / 2;
  redProbe.position.set(0.025, 0, 0.10);
  const blkProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.22, 8), gripMat);
  blkProbe.rotation.x = Math.PI / 2;
  blkProbe.position.set(-0.025, 0, 0.10);
  megger.add(redProbe, blkProbe);
  props.megger_leads = megger;

  // 6. Portable Earth CME Hot-Stick & Clamp
  const cme = new THREE.Group();
  const cmePole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.82, 10), new THREE.MeshStandardMaterial({ color: 0xd98a1e, roughness: 0.4 }));
  cmePole.rotation.x = Math.PI / 2;
  cmePole.position.z = 0.34;
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.055), brassMat);
  clamp.position.z = 0.76;
  cme.add(cmePole, clamp);
  props.cme_stick = cme;

  // 7. Permit-to-Work Clipboard
  const clipboard = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.014, 0.29), new THREE.MeshStandardMaterial({ color: 0x3b4856, roughness: 0.55 }));
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.016, 0.25), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 }));
  paper.position.y = 0.002;
  const headerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.017, 0.035), new THREE.MeshStandardMaterial({ color: 0xc8372d, roughness: 0.6 }));
  headerStripe.position.set(0, 0.003, -0.10);
  clipboard.add(board, paper, headerStripe);
  clipboard.rotation.x = 0.45;
  clipboard.position.set(-0.04, 0.02, 0.12);
  props.ptw_clipboard = clipboard;

  Object.values(props).forEach((p) => { p.visible = false; });
  return props;
}

/**
 * Builds the articulated 3D Marine ETO character (grounded at y = 0, ~1.74m tall)
 * plus a first-person arms & tool rig synced to the exact same PPE and animation state.
 */
export function createEngineerCharacter() {
  const root = new THREE.Group();
  root.name = 'MarineETOCharacter';

  // Soft radial contact shadow under boots
  const shadowCv = document.createElement('canvas');
  shadowCv.width = 64;
  shadowCv.height = 64;
  const sCtx = shadowCv.getContext('2d');
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

  // Materials
  const coverallMat = new THREE.MeshStandardMaterial({ color: 0x20354b, roughness: 0.82, metalness: 0.05 });
  const arcCoatMat = new THREE.MeshStandardMaterial({ color: 0x3b4f47, roughness: 0.78, metalness: 0.06 });
  const hiVisMat = new THREE.MeshStandardMaterial({ color: 0xe6b830, roughness: 0.42, metalness: 0.25 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdcb393, roughness: 0.65, metalness: 0.02 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xe6841c, roughness: 0.52, metalness: 0.04 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.32, metalness: 0.12 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x268e5c, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.72, clearcoat: 0.8 });
  const stdBootMat = new THREE.MeshStandardMaterial({ color: 0x252b32, roughness: 0.75, metalness: 0.08 });
  const hvBootSoleMat = new THREE.MeshStandardMaterial({ color: 0xd4a024, roughness: 0.62, metalness: 0.08 });

  // Body container (hidden in 1st-person mode while keeping shadow/root intact)
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // Pelvis / Hips pivot at y = 0.90
  const hips = new THREE.Group();
  hips.position.y = 0.90;
  bodyRoot.add(hips);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.20), coverallMat);
  pelvisMesh.castShadow = true;
  hips.add(pelvisMesh);

  // Legs
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

    // Boot + dielectric HV yellow sole indicator
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

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);
  hips.add(leftLeg.hipPivot, rightLeg.hipPivot);

  // Torso (pivot at waist)
  const torso = new THREE.Group();
  torso.position.y = 0.07;
  hips.add(torso);

  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.22), coverallMat);
  chestMesh.position.y = 0.24;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // High-visibility safety bands across chest & shoulders
  const bandLow = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.045, 0.23), hiVisMat);
  bandLow.position.y = 0.14;
  const bandHigh = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.045, 0.23), hiVisMat);
  bandHigh.position.y = 0.34;
  torso.add(bandLow, bandHigh);

  // 40 cal/cm² Arc-Flash Heavy Coat Overlay (toggled when SIM.ppe.suit === true)
  const arcSuitCoat = new THREE.Group();
  const coatBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.27), arcCoatMat);
  coatBody.position.y = 0.22;
  coatBody.castShadow = true;
  const coatStripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.28), hiVisMat);
  coatStripe.position.y = 0.20;
  const coatCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.09, 12), arcCoatMat);
  coatCollar.position.y = 0.52;
  arcSuitCoat.add(coatBody, coatStripe, coatCollar);
  arcSuitCoat.visible = false;
  torso.add(arcSuitCoat);

  // Neck & Belt utility detail
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.08, 10), skinMat);
  neckMesh.position.y = 0.50;
  torso.add(neckMesh);

  const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.055, 0.235), stdBootMat);
  beltMesh.position.y = 0.03;
  const pouchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.06), stdBootMat);
  pouchMesh.position.set(0.16, 0.02, 0.12);
  torso.add(beltMesh, pouchMesh);

  // Head & Hard Hat / Arc-Flash Hood
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.53;
  torso.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.20, 12), skinMat);
  headMesh.position.y = 0.105;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Clear industrial safety glasses on front face (+Z)
  const glassesBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.042, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.35, metalness: 0.25 })
  );
  glassesBand.position.set(0, 0.125, 0.085);
  headGroup.add(glassesBand);

  // White Marine ETO Hard Hat
  const hardHat = new THREE.Group();
  const hatDome = new THREE.Mesh(new THREE.SphereGeometry(0.124, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMat);
  hatDome.position.y = 0.155;
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.138, 0.016, 16), helmetMat);
  hatBrim.position.set(0, 0.16, 0.02);
  hardHat.add(hatDome, hatBrim);
  headGroup.add(hardHat);

  // 40 cal/cm² Arc-Flash Hood + Green Polycarbonate Visor (toggled when SIM.ppe.suit === true)
  const arcHood = new THREE.Group();
  const hoodShell = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.165, 0.30, 14), arcCoatMat);
  hoodShell.position.y = 0.15;
  const hoodCap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), arcCoatMat);
  hoodCap.position.y = 0.29;
  const hoodVisor = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.07), visorMat);
  hoodVisor.position.set(0, 0.16, 0.13);
  arcHood.add(hoodShell, hoodCap, hoodVisor);
  arcHood.visible = false;
  headGroup.add(arcHood);

  // Articulated Arms
  function makeArm(xSign) {
    const shoulder = new THREE.Group();
    shoulder.position.set(xSign * 0.245, 0.44, 0);

    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.28, 0.105), coverallMat);
    upperArm.position.y = -0.14;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.28;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.25, 0.095), coverallMat);
    forearm.position.y = -0.125;
    forearm.castShadow = true;
    elbow.add(forearm);

    const bareHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.065), skinMat);
    bareHand.position.y = -0.28;
    elbow.add(bareHand);

    // Class 2 HV Rubber Gauntlet Glove overlay
    const hvGlove = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.22, 0.108), gloveMat);
    hvGlove.position.y = -0.22;
    hvGlove.visible = false;
    elbow.add(hvGlove);

    const toolSocket = new THREE.Group();
    toolSocket.position.set(0, -0.29, 0.02);
    elbow.add(toolSocket);

    return { shoulder, elbow, bareHand, hvGlove, toolSocket };
  }

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torso.add(leftArm.shoulder, rightArm.shoulder);

  const thirdPersonTools = createToolProps();
  Object.values(thirdPersonTools).forEach((t) => rightArm.toolSocket.add(t));

  // First-Person View Arms Rig (attached to camera space in controller)
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
  fpRightPivot.add(fpRightForearm, fpRightHand, fpRightGlove, fpToolSocket);

  const firstPersonTools = createToolProps();
  Object.values(firstPersonTools).forEach((t) => fpToolSocket.add(t));
  fpGroup.add(fpLeftPivot, fpRightPivot);

  function setPpeVisuals(ppe) {
    const suit = Boolean(ppe?.suit);
    const gloves = Boolean(ppe?.gloves);
    const boots = Boolean(ppe?.bootsMat);

    arcSuitCoat.visible = suit;
    arcHood.visible = suit;
    hardHat.visible = !suit;

    leftArm.hvGlove.visible = gloves;
    rightArm.hvGlove.visible = gloves;
    leftArm.bareHand.visible = !gloves;
    rightArm.bareHand.visible = !gloves;

    fpLeftGlove.visible = gloves;
    fpRightGlove.visible = gloves;
    fpLeftHand.visible = !gloves;
    fpRightHand.visible = !gloves;

    leftLeg.hvSole.visible = boots;
    rightLeg.hvSole.visible = boots;
  }

  function setHeldTool(toolId) {
    for (const [key, mesh] of Object.entries(thirdPersonTools)) {
      mesh.visible = key === toolId;
    }
    for (const [key, mesh] of Object.entries(firstPersonTools)) {
      mesh.visible = key === toolId;
    }
  }

  function setFirstPersonMode(isFirst) {
    bodyRoot.visible = !isFirst;
    fpGroup.visible = isFirst;
  }

  /**
   * Procedural skeletal pose solver for locomotion and every physical switchboard task.
   */
  function updatePose({ speed, walkCycle, elapsed, anim }) {
    // Reset defaults
    hips.position.y = 0.90;
    torso.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftLeg.hipPivot.rotation.set(0, 0, 0);
    leftLeg.kneePivot.rotation.set(0, 0, 0);
    rightLeg.hipPivot.rotation.set(0, 0, 0);
    rightLeg.kneePivot.rotation.set(0, 0, 0);
    leftArm.shoulder.rotation.set(0, 0, 0.08);
    leftArm.elbow.rotation.set(-0.12, 0, 0);
    rightArm.shoulder.rotation.set(0, 0, -0.08);
    rightArm.elbow.rotation.set(-0.12, 0, 0);

    // Reset first-person hands cleanly in lower corners
    fpLeftPivot.position.set(-0.27, -0.32, -0.44);
    fpLeftPivot.rotation.set(0.06, -0.14, 0);
    fpRightPivot.position.set(0.27, -0.32, -0.44);
    fpRightPivot.rotation.set(0.06, 0.14, 0);

    if (anim && anim.type) {
      const p = Math.min(1, Math.max(0, anim.elapsed / Math.max(anim.duration, 0.01)));
      const bell = Math.sin(p * Math.PI);

      switch (anim.type) {
        case 'don_ppe': {
          // Two-hand glove roll & pulling visor hood down
          const roll = Math.sin(p * Math.PI * 4) * 0.35;
          torso.rotation.x = 0.08 * bell;
          leftArm.shoulder.rotation.set(-1.15 * bell + roll * 0.2, 0.25 * bell, 0.25 * bell);
          leftArm.elbow.rotation.set(-1.1 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-1.25 * bell - roll * 0.2, -0.25 * bell, -0.25 * bell);
          rightArm.elbow.rotation.set(-1.1 * bell, 0, 0);
          headGroup.rotation.x = 0.18 * Math.sin(p * Math.PI * 2);

          fpLeftPivot.position.set(-0.14, -0.18 + 0.08 * bell, -0.34);
          fpLeftPivot.rotation.z = roll;
          fpRightPivot.position.set(0.14, -0.18 + 0.08 * bell, -0.34);
          fpRightPivot.rotation.z = -roll;
          break;
        }
        case 'push_button': {
          // Crisp reach forward and press VCB pushbutton
          const jab = Math.sin(Math.min(1, p * 1.35) * Math.PI);
          torso.rotation.x = 0.10 * jab;
          torso.rotation.y = -0.14 * jab;
          rightArm.shoulder.rotation.set(-1.45 * jab, 0, -0.05);
          rightArm.elbow.rotation.set(-0.25 * (1 - jab), 0, 0);
          leftArm.shoulder.rotation.set(-0.25 * jab, 0, 0.14);

          fpRightPivot.position.set(0.16, -0.16 + 0.07 * jab, -0.36 - 0.18 * jab);
          break;
        }
        case 'rack_crank': {
          // Lean into racking port and crank handle in 3 full circles
          const theta = p * Math.PI * 6;
          const cx = Math.cos(theta) * 0.18;
          const cy = Math.sin(theta) * 0.22;
          torso.rotation.x = 0.16 * bell;
          torso.rotation.y = -0.12 * bell + cx * 0.25;
          rightArm.shoulder.rotation.set(-1.12 + cy, 0.1 + cx, -0.15);
          rightArm.elbow.rotation.set(-0.78 - cy * 0.5, 0, 0);
          leftArm.shoulder.rotation.set(-0.85 * bell, 0.25 * bell, 0.18);
          leftArm.elbow.rotation.set(-0.65 * bell, 0, 0);

          fpRightPivot.position.set(0.15 + cx * 0.35, -0.18 + cy * 0.35, -0.44);
          fpRightPivot.rotation.z = -theta;
          break;
        }
        case 'turn_key': {
          // Insert Castell key / padlock and twist wrist 90 deg
          const twist = Math.sin(p * Math.PI * 2) * 0.85;
          torso.rotation.x = 0.08 * bell;
          rightArm.shoulder.rotation.set(-1.25 * bell, 0, -0.08);
          rightArm.elbow.rotation.set(-0.55 * bell, twist, 0);

          fpRightPivot.position.set(0.16, -0.17 + 0.06 * bell, -0.46);
          fpRightPivot.rotation.z = twist;
          break;
        }
        case 'pull_lever': {
          // Grip EK6 earth switch lever high and pull firmly downward
          const pull = Math.min(1, p * 1.4);
          const armPitch = -1.75 + pull * 1.05;
          torso.rotation.x = 0.14 * Math.sin(pull * Math.PI);
          rightArm.shoulder.rotation.set(armPitch * bell, 0, -0.12);
          rightArm.elbow.rotation.set(-0.40 * bell, 0, 0);

          fpRightPivot.position.set(0.18, -0.08 - pull * 0.18, -0.46);
          fpRightPivot.rotation.x = -pull * 0.55;
          break;
        }
        case 'open_door': {
          // Pull cubicle door open in horizontal arc
          const sweep = Math.sin(p * Math.PI);
          torso.rotation.y = 0.28 * sweep;
          rightArm.shoulder.rotation.set(-1.15 * sweep, -0.45 * sweep, -0.20 * sweep);
          rightArm.elbow.rotation.set(-0.45 * sweep, 0, 0);

          fpRightPivot.position.set(0.18 + 0.12 * sweep, -0.18, -0.46 + 0.10 * sweep);
          break;
        }
        case 'probe_wand':
        case 'megger_test': {
          // Steady two-hand insulated HV probing / Megger sweep across L1/L2/L3
          const sweepX = Math.sin(p * Math.PI * 3) * 0.24;
          torso.rotation.x = 0.10 * bell;
          torso.rotation.y = sweepX * 0.45;
          rightArm.shoulder.rotation.set(-1.25 * bell, sweepX, -0.12);
          rightArm.elbow.rotation.set(-0.35 * bell, 0, 0);
          leftArm.shoulder.rotation.set(-1.05 * bell, 0.35 * bell + sweepX * 0.6, 0.22);
          leftArm.elbow.rotation.set(-0.62 * bell, 0, 0);

          fpRightPivot.position.set(0.12 + sweepX * 0.4, -0.18 + 0.05 * bell, -0.46);
          fpLeftPivot.position.set(-0.14 + sweepX * 0.2, -0.22, -0.40);
          break;
        }
        case 'sign_permit': {
          // Hold PTW clipboard in left hand & sign with right hand
          const scribble = Math.sin(p * Math.PI * 8) * 0.12;
          headGroup.rotation.x = 0.28 * bell;
          leftArm.shoulder.rotation.set(-0.95 * bell, 0.32 * bell, 0.18);
          leftArm.elbow.rotation.set(-1.05 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-0.95 * bell, -0.35 * bell + scribble, -0.15);
          rightArm.elbow.rotation.set(-1.10 * bell, 0, 0);

          fpLeftPivot.position.set(-0.16, -0.20, -0.38);
          fpRightPivot.position.set(0.12 + scribble * 0.3, -0.20, -0.40);
          break;
        }
        case 'recoil': {
          // Defensive step-back recoil on interlock block or arc-flash
          torso.rotation.x = -0.32 * bell;
          hips.position.y = 0.90 - 0.06 * bell;
          leftArm.shoulder.rotation.set(-1.65 * bell, 0.25 * bell, 0.45 * bell);
          leftArm.elbow.rotation.set(-0.95 * bell, 0, 0);
          rightArm.shoulder.rotation.set(-1.65 * bell, -0.25 * bell, -0.45 * bell);
          rightArm.elbow.rotation.set(-0.95 * bell, 0, 0);

          fpLeftPivot.position.set(-0.18, -0.12 + 0.10 * bell, -0.30);
          fpRightPivot.position.set(0.18, -0.12 + 0.10 * bell, -0.30);
          break;
        }
      }
      return;
    }

    // Walking / Idle cycle
    const moveBlend = Math.min(1, speed / 1.6);
    if (moveBlend > 0.04) {
      const stride = Math.sin(walkCycle);
      const liftL = Math.max(0, Math.cos(walkCycle));
      const liftR = Math.max(0, -Math.cos(walkCycle));

      hips.position.y = 0.90 + Math.abs(Math.sin(walkCycle)) * 0.032 * moveBlend;
      torso.rotation.x = 0.06 * moveBlend;
      torso.rotation.y = -stride * 0.09 * moveBlend;

      leftLeg.hipPivot.rotation.x = stride * 0.56 * moveBlend;
      leftLeg.kneePivot.rotation.x = liftL * 0.52 * moveBlend;
      rightLeg.hipPivot.rotation.x = -stride * 0.56 * moveBlend;
      rightLeg.kneePivot.rotation.x = liftR * 0.52 * moveBlend;

      leftArm.shoulder.rotation.x = -stride * 0.46 * moveBlend;
      leftArm.elbow.rotation.x = -0.18 - Math.max(0, stride) * 0.25 * moveBlend;
      rightArm.shoulder.rotation.x = stride * 0.46 * moveBlend;
      rightArm.elbow.rotation.x = -0.18 - Math.max(0, -stride) * 0.25 * moveBlend;

      // Subtle first-person walk bob
      fpLeftPivot.position.y = -0.32 + Math.sin(walkCycle * 2) * 0.014 * moveBlend;
      fpRightPivot.position.y = -0.32 + Math.cos(walkCycle * 2) * 0.014 * moveBlend;
    } else {
      // Gentle idle breathing
      const breath = Math.sin(elapsed * 2.1);
      hips.position.y = 0.90 + breath * 0.005;
      leftArm.shoulder.rotation.z = 0.08 + breath * 0.015;
      rightArm.shoulder.rotation.z = -0.08 - breath * 0.015;
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
  };
}
