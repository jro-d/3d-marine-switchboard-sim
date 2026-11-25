import * as THREE from 'three';
import {
  makeBadgeTexture,
  makeLivePanel,
  drawMimic,
  drawHmi,
  MIMIC_DEFAULT,
  HMI_DEFAULT,
  MIMIC_KINDS,
} from './textures.js';

const PART_KEYS = [
  'SK', 'CF', 'AR', 'FD', 'LD', 'PR', 'RL', 'TC', 'SD', 'MF',
  'AX', 'EP', 'VI', 'TL', 'SS', 'SP', 'ES', 'BB', 'CT',
];

export function buildHVBay({ cubId, bayX, titleText, subText, bayAccentHex, MAT, SHARED_TEX, helpers }) {
  const {
    regMesh,
    createSocket,
    buildPadlock3D,
    buildCastellKey3D,
    buildHelicalSpring,
    buildSheddedInsulator,
    addFasteners,
    rectPoints,
    terminationGeo,
    addEarthLead,
    addLiveMeter,
    buildLampBank,
    addLegend,
    addStormHandrail,
  } = helpers;

  const root = new THREE.Group();
  root.position.set(bayX, 0, 0);

  const W = 0.80;
  const subGroups = {};
  const sockets = {};
  PART_KEYS.forEach((k) => { subGroups[k] = new THREE.Group(); });

  ['SK', 'CF', 'AR', 'FD', 'LD', 'PR', 'RL', 'TC', 'SS', 'SP', 'ES', 'BB', 'CT'].forEach((k) => {
    root.add(subGroups[k]);
  });
  ['SD', 'MF', 'AX', 'EP', 'VI', 'TL'].forEach((k) => {
    subGroups.TC.add(subGroups[k]);
  });

  /* 01 · SK: BASE C-CHANNEL SKID, ANTI-VIBRATION CHOCKS & M20 ANCHOR BOLTS */
  [-0.365, 0.365].forEach((sx) => {
    const rail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.044, 1.22), MAT.skidSteel), 'SK', cubId);
    rail.position.set(sx, 0.036, -0.04);
    subGroups.SK.add(rail);
  });
  [-0.62, -0.04, 0.54].forEach((sz) => {
    const cross = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.040, 0.052), MAT.skidSteel), 'SK', cubId);
    cross.position.set(0, 0.036, sz);
    subGroups.SK.add(cross);
  });
  [[-0.36, -0.58], [0.36, -0.58], [-0.36, -0.04], [0.36, -0.04], [-0.36, 0.50], [0.36, 0.50]].forEach(([cx, cz]) => {
    const pad = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.016, 0.072), MAT.rubberMount), 'SK', cubId);
    pad.position.set(cx, 0.008, cz);
    const washer = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 12), MAT.galvSteel), 'SK', cubId);
    washer.position.set(cx, 0.060, cz);
    const hexBolt = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 6), MAT.brass), 'SK', cubId);
    hexBolt.position.set(cx, 0.066, cz);
    subGroups.SK.add(pad, washer, hexBolt);
  });

  const kickPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.070, 0.012), MAT.navyBase), 'SK', cubId);
  kickPlate.position.set(0, 0.040, 0.566);
  subGroups.SK.add(kickPlate);

  /* 02 · CF: FORM 4b SEGREGATED SHEET-STEEL FRAME, CORNER POSTS & PARTITIONS */
  [[-0.388, -0.61], [0.388, -0.61], [-0.388, 0.53], [0.388, 0.53]].forEach(([px, pz]) => {
    const post = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.022, 2.10, 0.024), MAT.steelTrim), 'CF', cubId);
    post.position.set(px, 1.12, pz);
    subGroups.CF.add(post);
    for (let by = 0.24; by <= 2.04; by += 0.30) {
      const rivet = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 6), MAT.galvSteel), 'CF', cubId, { castShadow: false });
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(px, by, pz + (pz > 0 ? 0.014 : -0.014));
      subGroups.CF.add(rivet);
    }
  });

  [-W / 2 + 0.008, W / 2 - 0.008].forEach((wx) => {
    const wall = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.09, 1.16), MAT.steelPanel), 'CF', cubId);
    wall.position.set(wx, 1.12, -0.04);
    subGroups.CF.add(wall);
    const sgn = Math.sign(wx);
    addFasteners(subGroups.CF, 'CF', cubId, rectPoints(-0.585, 0.505, 0.11, 2.13, 0.16, 'zy', wx + sgn * 0.006), { axis: 'x', dir: sgn, r: 0.0045, h: 0.0034 });
    [0.65, 1.35, 1.85].forEach((ry) => {
      const rib = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.96), MAT.steelTrim), 'CF', cubId);
      rib.position.set(wx, ry, -0.04);
      subGroups.CF.add(rib);
    });
  });

  const vcbDeck = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.018, 0.60), MAT.galvSteel), 'CF', cubId);
  vcbDeck.position.set(0, 0.475, 0.14);
  const lvDeck = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.018, 0.56), MAT.galvSteel), 'CF', cubId);
  lvDeck.position.set(0, 1.50, 0.25);
  const busDeck = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.016, 0.44), MAT.galvSteel), 'CF', cubId);
  busDeck.position.set(0, 1.18, -0.40);
  const lvBackWall = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.66, 0.014), MAT.steelTrim), 'CF', cubId);
  lvBackWall.position.set(0, 1.84, -0.02);
  subGroups.CF.add(vcbDeck, lvDeck, busDeck, lvBackWall);

  /* 03 · AR: ROOF ARC-FAULT RELIEF FLAPS, BRONZE FLAME MESH & EYEBOLTS */
  const roofPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.01, 0.018, 1.18), MAT.steelLight), 'AR', cubId);
  roofPlate.position.set(0, 2.19, -0.04);
  const canopyLip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.008, 0.030, 0.042), MAT.steelTrim), 'AR', cubId);
  canopyLip.position.set(0, 2.186, 0.564);
  subGroups.AR.add(roofPlate, canopyLip);
  addFasteners(subGroups.AR, 'AR', cubId, rectPoints(-0.37, 0.37, -0.60, 0.50, 0.12, 'xz', 2.199), { axis: 'y', r: 0.0045, h: 0.0034 });
  if (cubId === 'BT-M1') {
    const msbHeader = regMesh(
      new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.026), new THREE.MeshStandardMaterial({ map: SHARED_TEX.headerMSB, roughness: 0.35 })),
      'AR', cubId, { castShadow: false }
    );
    msbHeader.position.set(0, 2.186, 0.586);
    subGroups.AR.add(msbHeader);
  }

  const arFlaps = [];
  [0.18, -0.30].forEach((fz) => {
    const meshScreen = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.012, 0.28), MAT.bronzeMesh), 'AR', cubId);
    meshScreen.position.set(0, 2.205, fz);
    const flap = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.014, 0.31), MAT.steelTrim), 'AR', cubId);
    flap.position.set(0, 2.224, fz);
    flap.rotation.x = -0.08;
    arFlaps.push({ mesh: flap, baseY: 2.224, baseRotX: -0.08 });
    const hingePin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.58, 10), MAT.galvSteel), 'AR', cubId);
    hingePin.rotation.z = Math.PI / 2;
    hingePin.position.set(0, 2.214, fz - 0.15);
    subGroups.AR.add(meshScreen, flap, hingePin);
  });

  [[-0.33, 0.44], [0.33, 0.44], [-0.33, -0.52], [0.33, -0.52]].forEach(([ex, ez]) => {
    const boss = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.020, 12), MAT.steelTrim), 'AR', cubId);
    boss.position.set(ex, 2.208, ez);
    const eye = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 10, 20), MAT.brass), 'AR', cubId);
    eye.position.set(ex, 2.238, ez);
    subGroups.AR.add(boss, eye);
  });

  /* 04 · FD: EXTRUDED HINGED FRONT VCB DOOR, BEZEL, ESPAGNOLETTE ROD & TAGS */
  const doorHingeGroup = new THREE.Group();
  doorHingeGroup.position.set(-W / 2 + 0.016, 0.99, 0.558);
  subGroups.FD.add(doorHingeGroup);

  const dW = W - 0.032;
  const dH = 0.98;
  const doorShape = new THREE.Shape();
  doorShape.moveTo(0, -dH / 2);
  doorShape.lineTo(dW, -dH / 2);
  doorShape.lineTo(dW, dH / 2);
  doorShape.lineTo(0, dH / 2);
  doorShape.closePath();

  const winHole = new THREE.Path();
  winHole.moveTo(dW * 0.16, -0.13);
  winHole.lineTo(dW * 0.84, -0.13);
  winHole.lineTo(dW * 0.84, 0.34);
  winHole.lineTo(dW * 0.16, 0.34);
  winHole.closePath();
  doorShape.holes.push(winHole);

  const opHole = new THREE.Path();
  opHole.moveTo(dW * 0.16, -0.38);
  opHole.lineTo(dW * 0.84, -0.38);
  opHole.lineTo(dW * 0.84, -0.22);
  opHole.lineTo(dW * 0.16, -0.22);
  opHole.closePath();
  doorShape.holes.push(opHole);

  const doorGeo = new THREE.ExtrudeGeometry(doorShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    bevelSegments: 2,
  });
  const vcbDoorMesh = regMesh(new THREE.Mesh(doorGeo, MAT.steelLight), 'FD', cubId);
  doorHingeGroup.add(vcbDoorMesh);

  const bL = dW * 0.16;
  const bR = dW * 0.84;
  const bB = -0.13;
  const bT = 0.34;
  const topBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(bR - bL + 0.04, 0.020, 0.010), MAT.steelTrim), 'FD', cubId);
  topBezel.position.set((bL + bR) * 0.5, bT + 0.01, 0.022);
  const botBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(bR - bL + 0.04, 0.020, 0.010), MAT.steelTrim), 'FD', cubId);
  botBezel.position.set((bL + bR) * 0.5, bB - 0.01, 0.022);
  const lftBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.020, bT - bB, 0.010), MAT.steelTrim), 'FD', cubId);
  lftBezel.position.set(bL - 0.01, (bB + bT) * 0.5, 0.022);
  const rgtBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.020, bT - bB, 0.010), MAT.steelTrim), 'FD', cubId);
  rgtBezel.position.set(bR + 0.01, (bB + bT) * 0.5, 0.022);
  doorHingeGroup.add(topBezel, botBezel, lftBezel, rgtBezel);

  // Operating port cutout trim
  [
    [(bL + bR) * 0.5, -0.212, bR - bL + 0.028, 0.014],
    [(bL + bR) * 0.5, -0.388, bR - bL + 0.028, 0.014],
    [bL - 0.007, -0.30, 0.014, 0.162],
    [bR + 0.007, -0.30, 0.014, 0.162],
  ].forEach(([bx, by, bw, bh]) => {
    const trim = regMesh(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.008), MAT.darkConsole), 'FD', cubId, { castShadow: false });
    trim.position.set(bx, by, 0.021);
    doorHingeGroup.add(trim);
  });

  addFasteners(doorHingeGroup, 'FD', cubId, rectPoints(bL - 0.01, bR + 0.01, bB - 0.01, bT + 0.01, 0.068, 'xy', 0.027), { r: 0.0040, h: 0.0034, mat: MAT.silverContact });
  [
    [(bL + bR) / 2, bT - 0.004, bR - bL, 0.008],
    [(bL + bR) / 2, bB + 0.004, bR - bL, 0.008],
    [bL + 0.004, (bB + bT) / 2, 0.008, bT - bB],
    [bR - 0.004, (bB + bT) / 2, 0.008, bT - bB],
  ].forEach(([gx, gy, gw, gh]) => {
    const gasket = regMesh(new THREE.Mesh(new THREE.BoxGeometry(gw, gh, 0.008), MAT.gasket), 'FD', cubId, { castShadow: false });
    gasket.position.set(gx, gy, 0.012);
    doorHingeGroup.add(gasket);
  });
  addFasteners(doorHingeGroup, 'FD', cubId, [[0.03, -dH / 2 + 0.03, 0.021], [dW - 0.03, -dH / 2 + 0.03, 0.021], [0.03, dH / 2 - 0.03, 0.021], [dW - 0.03, dH / 2 - 0.03, 0.021]], { r: 0.0050, mat: MAT.silverContact });

  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(bR - bL, bT - bB), MAT.windowGlass);
  glassPane.position.set((bL + bR) * 0.5, (bB + bT) * 0.5, 0.010);
  doorHingeGroup.add(glassPane);

  [-0.38, 0.0, 0.38].forEach((hy) => {
    const hinge = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.052, 12), MAT.darkConsole), 'FD', cubId);
    hinge.position.set(0.0, hy, 0.014);
    doorHingeGroup.add(hinge);
  });

  const handleEsc = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.19, 0.014), MAT.darkConsole),
    'FD', cubId, { controlId: 'doorHandle', cloneMaterial: true }
  );
  handleEsc.position.set(dW - 0.048, 0.02, 0.024);
  const handleLever = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.13, 0.026), MAT.silverContact),
    'FD', cubId, { controlId: 'doorHandle', cloneMaterial: true }
  );
  handleLever.position.set(dW - 0.048, 0.00, 0.037);
  const latchRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.88, 10), MAT.galvSteel), 'FD', cubId);
  latchRod.position.set(dW - 0.055, 0.0, -0.008);
  doorHingeGroup.add(handleEsc, handleLever, latchRod);
  sockets.doorHandle = createSocket(doorHingeGroup, 'doorHandle', cubId, [dW - 0.048, 0.0, 0.048], {
    approachOffset: { x: 0.24, z: 1.38 },
  });

  // Hinged lower cable & earth inspection door
  const lowerDoorHingeGroup = new THREE.Group();
  lowerDoorHingeGroup.position.set(-W / 2 + 0.016, 0.255, 0.556);
  subGroups.FD.add(lowerDoorHingeGroup);

  const lowerDoor = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.355, 0.016), MAT.steelPanel), 'FD', cubId);
  lowerDoor.position.set(dW * 0.5, 0, 0);
  lowerDoorHingeGroup.add(lowerDoor);
  for (let ly = -0.105; ly <= -0.005; ly += 0.032) {
    const louver = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.010), MAT.louverBlack), 'FD', cubId);
    louver.position.set(dW * 0.5, ly, 0.010);
    louver.rotation.x = 0.35;
    lowerDoorHingeGroup.add(louver);
  }

  const hazardPlate = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.60, 0.094), new THREE.MeshStandardMaterial({ map: SHARED_TEX.doorHazard, roughness: 0.4 })),
    'FD', cubId, { castShadow: false }
  );
  hazardPlate.position.set(dW * 0.5, 0.428, 0.0222);
  doorHingeGroup.add(hazardPlate);

  const ventOpening = regMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.13), new THREE.MeshStandardMaterial({ color: 0x1d242b, roughness: 0.8 })), 'FD', cubId, { castShadow: false });
  ventOpening.position.set(dW * 0.5, -0.055, 0.0086);
  lowerDoorHingeGroup.add(ventOpening);
  [0.015, -0.125].forEach((vy) => {
    const vbar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.006), MAT.louverBlack), 'FD', cubId, { castShadow: false });
    vbar.position.set(dW * 0.5, vy, 0.0095);
    lowerDoorHingeGroup.add(vbar);
  });
  [-0.206, 0.206].forEach((vx) => {
    const vbar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.14, 0.006), MAT.louverBlack), 'FD', cubId, { castShadow: false });
    vbar.position.set(dW * 0.5 + vx, -0.055, 0.0095);
    lowerDoorHingeGroup.add(vbar);
  });
  const coverLabel = regMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.0475), new THREE.MeshStandardMaterial({ map: SHARED_TEX.coverLabel, roughness: 0.4 })), 'FD', cubId, { castShadow: false });
  coverLabel.position.set(dW * 0.5, 0.125, 0.0088);
  const lowerLatch = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.018), MAT.silverContact),
    'FD', cubId, { controlId: 'doorHandle', cloneMaterial: true }
  );
  lowerLatch.position.set(dW - 0.048, 0.08, 0.016);
  lowerDoorHingeGroup.add(coverLabel, lowerLatch);
  [[dW * 0.5 - 0.35, -0.14], [dW * 0.5 + 0.35, -0.14], [dW * 0.5 - 0.35, 0.145], [dW * 0.5 + 0.35, 0.145]].forEach(([sx, sy]) => {
    const screw = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 10), MAT.galvSteel), 'FD', cubId, { castShadow: false });
    screw.rotation.x = Math.PI / 2;
    screw.position.set(sx, sy, 0.0112);
    lowerDoorHingeGroup.add(screw);
  });

  const tagDangerMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.056), new THREE.MeshStandardMaterial({ map: SHARED_TEX.tagDanger, roughness: 0.4 }));
  tagDangerMesh.position.set(dW * 0.25, -0.436, 0.024);
  tagDangerMesh.visible = false;
  const tagEarthMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.056), new THREE.MeshStandardMaterial({ map: SHARED_TEX.tagEarth, roughness: 0.4 }));
  tagEarthMesh.position.set(dW * 0.50, -0.436, 0.024);
  tagEarthMesh.visible = false;
  const tagSftMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.056), new THREE.MeshStandardMaterial({ map: SHARED_TEX.tagSft, roughness: 0.4 }));
  tagSftMesh.position.set(dW * 0.75, -0.436, 0.024);
  tagSftMesh.visible = false;
  doorHingeGroup.add(tagDangerMesh, tagEarthMesh, tagSftMesh);

  /* 05 · LD: UPPER LV METERING DOOR, ANALOG METERS, CVI LEDS & CAM SWITCHES */
  const lvDoor = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.64, 0.020), MAT.steelLight), 'LD', cubId);
  lvDoor.position.set(0, 1.84, 0.562);
  subGroups.LD.add(lvDoor);
  addFasteners(subGroups.LD, 'LD', cubId, [[-0.36, 2.115, 0.572], [0.36, 2.115, 0.572], [-0.36, 1.545, 0.572], [0.36, 1.545, 0.572]], { r: 0.0048, mat: MAT.silverContact });

  const bayTopStrip = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(dW, 0.022, 0.008), new THREE.MeshStandardMaterial({ color: bayAccentHex, roughness: 0.35, metalness: 0.15 })),
    'LD', cubId
  );
  bayTopStrip.position.set(0, 2.145, 0.575);
  subGroups.LD.add(bayTopStrip);

  const badgeTex = makeBadgeTexture(titleText, subText, '#f7f6f3', '#1f2529', `#${bayAccentHex.toString(16).padStart(6, '0')}`);
  const nameplate = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.105), new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.35 })),
    'LD', cubId, { castShadow: false }
  );
  nameplate.position.set(-0.18, 2.05, 0.574);
  subGroups.LD.add(nameplate);

  const needleA = addLiveMeter(subGroups.LD, cubId, 0.08, 2.04, SHARED_TEX.ammeter, 0.106, 0.586);
  const needleKV = addLiveMeter(subGroups.LD, cubId, 0.24, 2.04, SHARED_TEX.voltmeter, 0.106, 0.586);

  const cviBox = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.10, 0.018), MAT.darkConsole), 'LD', cubId);
  cviBox.position.set(0.18, 1.82, 0.576);
  subGroups.LD.add(cviBox);

  const cviLedMeshes = [];
  [-0.068, 0.0, 0.068].forEach((lx) => {
    const led = regMesh(new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 14), MAT.shutterRed), 'LD', cubId, { castShadow: false, cloneMaterial: true });
    led.position.set(0.18 + lx, 1.838, 0.588);
    subGroups.LD.add(led);
    cviLedMeshes.push(led);

    const testJack = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.010, 10), MAT.brass), 'LD', cubId);
    testJack.rotation.x = Math.PI / 2;
    testJack.position.set(0.18 + lx, 1.798, 0.586);
    subGroups.LD.add(testJack);
  });

  const mimicPanel = makeLivePanel(300, 200, drawMimic, { ...MIMIC_DEFAULT, ...MIMIC_KINDS[cubId] });
  const hmiPanel = makeLivePanel(192, 128, drawHmi, { ...HMI_DEFAULT, tag: cubId === 'TR1-HV' ? 'TR1' : cubId });

  const hmiBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.145, 0.014), MAT.darkConsole), 'LD', cubId);
  hmiBezel.position.set(-0.19, 1.91, 0.579);
  const hmiLcd = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.10), new THREE.MeshStandardMaterial({ map: hmiPanel.tex, emissive: 0xffffff, emissiveMap: hmiPanel.tex, emissiveIntensity: 0.35, roughness: 0.25 })),
    'LD', cubId, { castShadow: false }
  );
  hmiLcd.position.set(-0.19, 1.915, 0.587);
  subGroups.LD.add(hmiBezel, hmiLcd);
  [-0.054, -0.018, 0.018, 0.054].forEach((kx) => {
    const key = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.010, 0.006), MAT.silverContact), 'LD', cubId, { castShadow: false });
    key.position.set(-0.19 + kx, 1.851, 0.588);
    subGroups.LD.add(key);
  });

  const mimicFrame = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.312, 0.212, 0.006), MAT.darkConsole), 'LD', cubId);
  mimicFrame.position.set(-0.19, 1.72, 0.575);
  const mimicPlane = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.20), new THREE.MeshStandardMaterial({ map: mimicPanel.tex, roughness: 0.45 })),
    'LD', cubId, { castShadow: false }
  );
  mimicPlane.position.set(-0.19, 1.72, 0.5795);
  subGroups.LD.add(mimicFrame, mimicPlane);

  const lampBank = buildLampBank(subGroups.LD, cubId, -0.195, 1.575, 0.5735, 0.07, ['red', 'green', 'amber', 'white']);
  addLegend(subGroups.LD, cubId, SHARED_TEX.lampLegend, 4, 64, -0.195, 1.543, 0.5735, 0.07);
  addLegend(subGroups.LD, cubId, SHARED_TEX.cviLegend, 3, 64, 0.18, 1.8885, 0.5735, 0.068);
  addLegend(subGroups.LD, cubId, SHARED_TEX.switchLegend, 2, 160, 0.15, 1.592, 0.5735, 0.18);

  [0.06, 0.24].forEach((sx, sIdx) => {
    const esc = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.056, 0.012), MAT.darkConsole), 'LD', cubId);
    esc.position.set(sx, 1.64, 0.576);
    const knob = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.044, 0.026), sIdx === 0 ? MAT.silverContact : MAT.brass), 'LD', cubId);
    knob.position.set(sx, 1.64, 0.592);
    knob.rotation.z = sIdx === 0 ? -0.45 : 0.45;
    subGroups.LD.add(esc, knob);
  });
  addStormHandrail(subGroups.LD, 'LD', cubId, dW, 1.505, 0.572);

  /* 06 · PR: ABB REF615 PROTECTION RELAY, DIN TERMINAL RAILS, MCBS & WIRING LOOM */
  const iedChassis = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.22), MAT.iedCase), 'PR', cubId);
  iedChassis.position.set(-0.18, 1.84, 0.38);
  const iedFace = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.21, 0.018), MAT.darkConsole), 'PR', cubId);
  iedFace.position.set(-0.18, 1.84, 0.495);
  const iedLcd = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.145, 0.098), new THREE.MeshStandardMaterial({ map: hmiPanel.tex, emissive: 0x1f6f78, emissiveIntensity: 0.14, roughness: 0.25 })),
    'PR', cubId, { castShadow: false }
  );
  iedLcd.position.set(-0.165, 1.86, 0.506);
  subGroups.PR.add(iedChassis, iedFace, iedLcd);

  [1.64, 1.98].forEach((dy, rIdx) => {
    const dinRail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.028, 0.010), MAT.galvSteel), 'PR', cubId);
    dinRail.position.set(0.14, dy, 0.16);
    subGroups.PR.add(dinRail);
    if (rIdx === 0) {
      for (let t = 0; t < 14; t++) {
        const tb = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.056, 0.044), MAT.dinBlock), 'PR', cubId);
        tb.position.set(0.01 + t * 0.020, dy, 0.185);
        subGroups.PR.add(tb);
      }
    } else {
      for (let m = 0; m < 4; m++) {
        const mcb = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.078, 0.058), MAT.steelLight), 'PR', cubId);
        mcb.position.set(0.04 + m * 0.046, dy, 0.19);
        const toggle = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.010, 0.018), MAT.phaseL3), 'PR', cubId);
        toggle.position.set(0.04 + m * 0.046, dy + 0.01, 0.224);
        subGroups.PR.add(mcb, toggle);
      }
    }
  });

  const loomCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 1.82, 0.26),
    new THREE.Vector3(-0.04, 1.74, 0.20),
    new THREE.Vector3(0.14, 1.66, 0.22),
    new THREE.Vector3(0.24, 1.56, 0.26),
  ]);
  subGroups.PR.add(regMesh(new THREE.Mesh(new THREE.TubeGeometry(loomCurve, 18, 0.013, 8, false), MAT.wireBlue), 'PR', cubId));

  /* 07 · RL: TELESCOPIC GUIDE RAILS, DETENT NOTCHES & LEAD-SCREW ANCHOR */
  [-0.27, 0.27].forEach((rx) => {
    const railWeb = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.58), MAT.galvSteel), 'RL', cubId);
    railWeb.position.set(rx, 0.505, 0.20);
    const railLip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.010, 0.58), MAT.steelTrim), 'RL', cubId);
    railLip.position.set(rx, 0.526, 0.20);
    subGroups.RL.add(railWeb, railLip);
    [0.01, 0.21, 0.41].forEach((dz) => {
      const det = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.022, 0.022), MAT.brass), 'RL', cubId);
      det.position.set(rx + (rx > 0 ? -0.022 : 0.022), 0.505, dz);
      subGroups.RL.add(det);
    });
  });

  const earthingStrip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.010, 0.52), MAT.copper), 'RL', cubId);
  earthingStrip.position.set(-0.21, 0.492, 0.18);
  const anchorBlock = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.048, 0.054), MAT.skidSteel), 'RL', cubId);
  anchorBlock.position.set(0, 0.512, -0.04);
  subGroups.RL.add(earthingStrip, anchorBlock);

  /* 08 · TC: WITHDRAWABLE VCB CARRIAGE CHASSIS, FLANGED WHEELS & LEAD-SCREW */
  const truckPan = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.036, 0.40), MAT.carriageSteel), 'TC', cubId);
  truckPan.position.set(0, 0.552, 0.15);
  const innerTray = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.010, 0.34), MAT.darkConsole), 'TC', cubId);
  innerTray.position.set(0, 0.568, 0.15);
  subGroups.TC.add(truckPan, innerTray);

  [-0.042, 0.342].forEach((bz) => {
    const beam = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.054, 0.024), MAT.skidSteel), 'TC', cubId);
    beam.position.set(0, 0.556, bz);
    subGroups.TC.add(beam);
    [-0.20, -0.10, 0.10, 0.20].forEach((bx) => {
      const bolt = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.008, 6), MAT.brass), 'TC', cubId, { castShadow: false });
      bolt.position.set(bx, 0.585, bz);
      subGroups.TC.add(bolt);
    });
  });
  [-0.16, 0.0, 0.16].forEach((rx) => {
    const rib = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.36), MAT.galvSteel), 'TC', cubId);
    rib.position.set(rx, 0.573, 0.15);
    subGroups.TC.add(rib);
  });

  [-0.165, 0.165].forEach((hx) => {
    [-0.032, 0.032].forEach((dx) => {
      const leg = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.026, 10), MAT.silverContact), 'TC', cubId);
      leg.rotation.x = Math.PI / 2;
      leg.position.set(hx + dx, 0.556, 0.362);
      subGroups.TC.add(leg);
    });
    const grip = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.076, 12), MAT.darkConsole), 'TC', cubId);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(hx, 0.556, 0.374);
    subGroups.TC.add(grip);
  });

  [-0.245, 0.245].forEach((sx) => {
    const cheek = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.070, 0.42), MAT.skidSteel), 'TC', cubId);
    cheek.position.set(sx, 0.558, 0.15);
    const topRail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.41), MAT.galvSteel), 'TC', cubId);
    topRail.position.set(sx, 0.593, 0.15);
    subGroups.TC.add(cheek, topRail);
    [0.06, 0.24].forEach((pz) => {
      const pawlHousing = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.038), MAT.brass), 'TC', cubId);
      pawlHousing.position.set(sx + (sx > 0 ? 0.012 : -0.012), 0.548, pz);
      const plungerPin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.022, 10), MAT.silverContact), 'TC', cubId);
      plungerPin.rotation.z = Math.PI / 2;
      plungerPin.position.set(sx + (sx > 0 ? 0.016 : -0.016), 0.536, pz);
      subGroups.TC.add(pawlHousing, plungerPin);
    });
    const releaseTab = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.026), MAT.shutterRed), 'TC', cubId);
    releaseTab.position.set(sx + (sx > 0 ? 0.008 : -0.008), 0.542, 0.355);
    subGroups.TC.add(releaseTab);
  });

  const earthShoe = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.018, 0.11), MAT.copper), 'TC', cubId);
  earthShoe.position.set(-0.21, 0.504, 0.15);
  const earthBracket = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.06), MAT.brass), 'TC', cubId);
  earthBracket.position.set(-0.21, 0.524, 0.15);
  const earthBraidCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.21, 0.510, 0.19),
    new THREE.Vector3(-0.19, 0.528, 0.22),
    new THREE.Vector3(-0.22, 0.548, 0.24),
  ]);
  const earthBraid = regMesh(new THREE.Mesh(new THREE.TubeGeometry(earthBraidCurve, 10, 0.005, 6, false), MAT.copper), 'TC', cubId);
  subGroups.TC.add(earthShoe, earthBracket, earthBraid);

  const leadScrew = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.45, 16), MAT.brass), 'TC', cubId);
  leadScrew.rotation.x = Math.PI / 2;
  leadScrew.position.set(0, 0.526, 0.155);
  const wormGearbox = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.048, 0.064), MAT.iedCase), 'TC', cubId);
  wormGearbox.position.set(0, 0.530, 0.305);
  const driveNutBlock = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.040, 0.052), MAT.brass), 'TC', cubId);
  driveNutBlock.position.set(0, 0.526, 0.16);
  const rearBearingBlock = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.038, 0.032), MAT.skidSteel), 'TC', cubId);
  rearBearingBlock.position.set(0, 0.526, -0.022);
  subGroups.TC.add(leadScrew, wormGearbox, driveNutBlock, rearBearingBlock);

  [-0.042, 0.042].forEach((gx) => {
    const guideRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.39, 10), MAT.silverContact), 'TC', cubId);
    guideRod.rotation.x = Math.PI / 2;
    guideRod.position.set(gx, 0.526, 0.15);
    subGroups.TC.add(guideRod);
  });

  const wheelGroups = [];
  [[-0.265, 0.00], [0.265, 0.00], [-0.265, 0.30], [0.265, 0.30]].forEach(([wx, wz]) => {
    const wg = new THREE.Group();
    wg.position.set(wx, 0.526, wz);
    const tread = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.020, 20), MAT.skidSteel), 'TC', cubId);
    tread.rotation.z = Math.PI / 2;
    const flange = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.006, 20), MAT.silverContact), 'TC', cubId);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = wx > 0 ? 0.011 : -0.011;
    const hubCap = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.026, 14), MAT.brass), 'TC', cubId);
    hubCap.rotation.z = Math.PI / 2;
    const spokeA = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.046, 0.008), MAT.brass), 'TC', cubId);
    const spokeB = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.046), MAT.brass), 'TC', cubId);
    wg.add(tread, flange, hubCap, spokeA, spokeB);
    for (let b = 0; b < 6; b++) {
      const ang = (b / 6) * Math.PI * 2;
      const stud = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.025, 6), MAT.galvSteel), 'TC', cubId, { castShadow: false });
      stud.rotation.z = Math.PI / 2;
      stud.position.set(0, Math.cos(ang) * 0.020, Math.sin(ang) * 0.020);
      wg.add(stud);
    }
    subGroups.TC.add(wg);
    wheelGroups.push(wg);
  });

  /* 09 · SD: OPEN-FRAME SPRING-CHARGING MECHANISM */
  const sdBackPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.456, 0.382, 0.014), MAT.carriageSteel), 'SD', cubId);
  sdBackPlate.position.set(0, 0.830, 0.205);
  const sdTopBridge = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.456, 0.016, 0.118), MAT.skidSteel), 'SD', cubId);
  sdTopBridge.position.set(0, 1.014, 0.258);
  const sdBotBridge = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.456, 0.018, 0.118), MAT.skidSteel), 'SD', cubId);
  sdBotBridge.position.set(0, 0.646, 0.258);
  const sdMidShelf = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.180, 0.012, 0.106), MAT.galvSteel), 'SD', cubId);
  sdMidShelf.position.set(0, 0.928, 0.260);
  subGroups.SD.add(sdBackPlate, sdTopBridge, sdBotBridge, sdMidShelf);

  [-0.222, -0.088, 0.088, 0.222].forEach((px, pIdx) => {
    const isOuter = pIdx === 0 || pIdx === 3;
    const plate = regMesh(
      new THREE.Mesh(new THREE.BoxGeometry(isOuter ? 0.012 : 0.009, 0.354, isOuter ? 0.114 : 0.102), isOuter ? MAT.carriageSteel : MAT.galvSteel),
      'SD', cubId
    );
    plate.position.set(px, 0.830, 0.258);
    subGroups.SD.add(plate);
  });

  [[-0.206, 0.994], [0.206, 0.994], [-0.206, 0.830], [0.206, 0.830], [-0.206, 0.666], [0.206, 0.666]].forEach(([tx, ty]) => {
    const tieRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.116, 6), MAT.silverContact), 'SD', cubId);
    tieRod.rotation.x = Math.PI / 2;
    tieRod.position.set(tx, ty, 0.262);
    const capNut = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.010, 6), MAT.brass), 'SD', cubId);
    capNut.rotation.x = Math.PI / 2;
    capNut.position.set(tx, ty, 0.322);
    subGroups.SD.add(tieRod, capNut);
  });

  const closeSpring = buildHelicalSpring(0.034, 0.24, 9, 0.0068, MAT.springCloseGreen, 'SD', cubId);
  closeSpring.position.set(-0.155, 0.842, 0.276);
  const closeGuideTube = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 14), MAT.silverContact), 'SD', cubId);
  closeGuideTube.position.set(-0.155, 0.842, 0.276);
  [0.720, 0.964].forEach((sy) => {
    const seat = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.014, 18), MAT.brass), 'SD', cubId);
    seat.position.set(-0.155, sy, 0.276);
    subGroups.SD.add(seat);
  });
  const closeTensionStud = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.048, 10), MAT.brass), 'SD', cubId);
  closeTensionStud.position.set(-0.155, 0.985, 0.276);
  const closeChainLink = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.018, 0.014), MAT.skidSteel), 'SD', cubId);
  closeChainLink.position.set(-0.105, 0.722, 0.292);
  closeChainLink.rotation.z = 0.22;
  subGroups.SD.add(closeSpring, closeGuideTube, closeTensionStud, closeChainLink);

  const tripSpring = buildHelicalSpring(0.025, 0.20, 8, 0.0056, MAT.springTripRed, 'SD', cubId);
  tripSpring.position.set(0.140, 0.858, 0.276);
  const tripGuideRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.23, 12), MAT.silverContact), 'SD', cubId);
  tripGuideRod.position.set(0.140, 0.858, 0.276);
  [0.755, 0.960].forEach((sy) => {
    const seat = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.012, 16), MAT.brass), 'SD', cubId);
    seat.position.set(0.140, sy, 0.276);
    subGroups.SD.add(seat);
  });
  subGroups.SD.add(tripSpring, tripGuideRod);

  const dashpotBody = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 14), MAT.iedCase), 'SD', cubId);
  dashpotBody.position.set(0.190, 0.720, 0.280);
  const dashpotPiston = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 10), MAT.silverContact), 'SD', cubId);
  dashpotPiston.position.set(0.190, 0.795, 0.280);
  for (let df = 0; df < 5; df++) {
    const fin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 14), MAT.galvSteel), 'SD', cubId, { castShadow: false });
    fin.position.set(0.190, 0.688 + df * 0.016, 0.280);
    subGroups.SD.add(fin);
  }
  subGroups.SD.add(dashpotBody, dashpotPiston);

  const ratchetWheel = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.016, 24), MAT.skidSteel), 'SD', cubId);
  ratchetWheel.rotation.x = Math.PI / 2;
  ratchetWheel.position.set(0, 0.850, 0.286);
  subGroups.SD.add(ratchetWheel);
  for (let t = 0; t < 24; t++) {
    const ang = (t / 24) * Math.PI * 2;
    const tooth = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.010, 0.016), MAT.galvSteel), 'SD', cubId, { castShadow: false });
    tooth.position.set(Math.cos(ang) * 0.060, 0.850 + Math.sin(ang) * 0.060, 0.286);
    tooth.rotation.z = ang + 0.25;
    subGroups.SD.add(tooth);
  }

  const camDisc = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.020, 20), MAT.brass), 'SD', cubId);
  camDisc.rotation.x = Math.PI / 2;
  camDisc.position.set(0, 0.850, 0.304);
  const camLobe = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.022, 16), MAT.brass), 'SD', cubId);
  camLobe.rotation.x = Math.PI / 2;
  camLobe.position.set(-0.014, 0.834, 0.305);
  const camHub = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.032, 14), MAT.silverContact), 'SD', cubId);
  camHub.rotation.x = Math.PI / 2;
  camHub.position.set(0, 0.850, 0.308);
  subGroups.SD.add(camDisc, camLobe, camHub);

  const chargePawl = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.012, 0.014), MAT.brass), 'SD', cubId);
  chargePawl.position.set(0.048, 0.896, 0.288);
  chargePawl.rotation.z = -0.45;
  const toggleRocker = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.096, 0.018), MAT.galvSteel), 'SD', cubId);
  toggleRocker.position.set(0.018, 0.778, 0.278);
  toggleRocker.rotation.z = -0.18;
  const camFollowerRoller = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 12), MAT.silverContact), 'SD', cubId);
  camFollowerRoller.rotation.x = Math.PI / 2;
  camFollowerRoller.position.set(0.010, 0.812, 0.296);
  subGroups.SD.add(chargePawl, toggleRocker, camFollowerRoller);

  const jackShaft = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 14), MAT.galvSteel), 'SD', cubId);
  jackShaft.rotation.z = Math.PI / 2;
  jackShaft.position.set(0, 0.718, 0.246);
  subGroups.SD.add(jackShaft);
  [-0.21, -0.088, 0.088, 0.21].forEach((bx) => {
    const bearing = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.036, 0.036), MAT.brass), 'SD', cubId);
    bearing.position.set(bx, 0.718, 0.246);
    subGroups.SD.add(bearing);
  });
  [-0.19, 0.0, 0.19].forEach((px) => {
    const bellCrank = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.056), MAT.skidSteel), 'SD', cubId);
    bellCrank.position.set(px, 0.726, 0.224);
    const clevisPin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.028, 10), MAT.brass), 'SD', cubId);
    clevisPin.rotation.z = Math.PI / 2;
    clevisPin.position.set(px, 0.732, 0.204);
    subGroups.SD.add(bellCrank, clevisPin);
  });

  const chargeMotor = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.125, 16), MAT.darkConsole), 'SD', cubId);
  chargeMotor.rotation.z = Math.PI / 2;
  chargeMotor.position.set(-0.048, 0.674, 0.296);
  const motorEndCap = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.018, 16), MAT.copper), 'SD', cubId);
  motorEndCap.rotation.z = Math.PI / 2;
  motorEndCap.position.set(-0.116, 0.674, 0.296);
  const motorGearbox = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.054, 0.050), MAT.galvSteel), 'SD', cubId);
  motorGearbox.position.set(0.034, 0.674, 0.294);
  const eccentricRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.16, 8), MAT.brass), 'SD', cubId);
  eccentricRod.position.set(0.052, 0.768, 0.298);
  eccentricRod.rotation.z = -0.08;
  subGroups.SD.add(chargeMotor, motorEndCap, motorGearbox, eccentricRod);
  for (let mf = 0; mf < 6; mf++) {
    const fin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 16), MAT.iedCase), 'SD', cubId, { castShadow: false });
    fin.rotation.z = Math.PI / 2;
    fin.position.set(-0.092 + mf * 0.017, 0.674, 0.296);
    subGroups.SD.add(fin);
  }

  [
    { cx: -0.056, mat: MAT.phaseL3 },
    { cx: 0.000, mat: MAT.phaseL1 },
    { cx: 0.056, mat: MAT.shutterYellow },
  ].forEach(({ cx, mat }) => {
    const yoke = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.058, 0.044), MAT.galvSteel), 'SD', cubId);
    yoke.position.set(cx, 0.968, 0.284);
    const bobbin = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.046, 0.048), mat), 'SD', cubId);
    bobbin.position.set(cx, 0.968, 0.288);
    const copperCore = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.050, 12), MAT.copper), 'SD', cubId);
    copperCore.rotation.x = Math.PI / 2;
    copperCore.position.set(cx, 0.968, 0.290);
    const plunger = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.028, 10), MAT.silverContact), 'SD', cubId);
    plunger.position.set(cx, 0.935, 0.292);
    subGroups.SD.add(yoke, bobbin, copperCore, plunger);
  });
  const tripPaddleBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.156, 0.008, 0.014), MAT.brass), 'SD', cubId);
  tripPaddleBar.position.set(0, 0.922, 0.294);
  subGroups.SD.add(tripPaddleBar);

  const auxSwitchBank = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.082, 0.056), MAT.iedCase), 'SD', cubId);
  auxSwitchBank.position.set(0.142, 0.962, 0.252);
  subGroups.SD.add(auxSwitchBank);
  for (let d = 0; d < 5; d++) {
    const deckWafer = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.006, 0.060), MAT.dinBlock), 'SD', cubId, { castShadow: false });
    deckWafer.position.set(0.142, 0.930 + d * 0.015, 0.252);
    const termPin = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.004, 0.006), MAT.brass), 'SD', cubId, { castShadow: false });
    termPin.position.set(0.142, 0.930 + d * 0.015, 0.282);
    subGroups.SD.add(deckWafer, termPin);
  }

  /* 10 · MF: BREAKER OPERATOR ESCUTCHEON, PUSHBUTTONS, FLAGS, COUNTER & LOCKS */
  const fasciaShell = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.030), MAT.steelLight), 'MF', cubId);
  fasciaShell.position.set(0, 0.84, 0.376);
  const fasciaOuterBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.456, 0.386, 0.008), MAT.steelTrim), 'MF', cubId);
  fasciaOuterBezel.position.set(0, 0.84, 0.392);
  const fasciaPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.37, 0.010), MAT.darkConsole), 'MF', cubId);
  fasciaPlate.position.set(0, 0.84, 0.395);
  const fasciaScreen = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.436, 0.366), new THREE.MeshStandardMaterial({ map: SHARED_TEX.vcbFascia, roughness: 0.38 })),
    'MF', cubId, { castShadow: false }
  );
  fasciaScreen.position.set(0, 0.84, 0.4008);
  subGroups.MF.add(fasciaShell, fasciaOuterBezel, fasciaPlate, fasciaScreen);

  [
    [-0.226, 1.032], [0.0, 1.032], [0.226, 1.032],
    [-0.226, 0.840], [0.226, 0.840],
    [-0.226, 0.648], [0.0, 0.648], [0.226, 0.648],
  ].forEach(([sx, sy]) => {
    const screw = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 6), MAT.silverContact), 'MF', cubId, { castShadow: false });
    screw.rotation.x = Math.PI / 2;
    screw.position.set(sx, sy, 0.393);
    subGroups.MF.add(screw);
  });
  [-0.230, 0.230].forEach((hx) => {
    const sideGrip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.11, 0.016), MAT.steelTrim), 'MF', cubId);
    sideGrip.position.set(hx, 0.84, 0.398);
    subGroups.MF.add(sideGrip);
  });

  [-0.12, -0.02].forEach((bx) => {
    const shroud = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.025, 0.014, 18), MAT.silverContact), 'MF', cubId);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(bx, 0.96, 0.403);
    subGroups.MF.add(shroud);
  });
  const btnClose3D = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 0.018, 16), MAT.shutterRed),
    'MF', cubId, { controlId: 'closeBtn', cloneMaterial: true }
  );
  btnClose3D.rotation.x = Math.PI / 2;
  btnClose3D.position.set(-0.12, 0.96, 0.405);
  const btnCloseCap = regMesh(
    new THREE.Mesh(
      new THREE.CircleGeometry(0.015, 20),
      new THREE.MeshStandardMaterial({ map: SHARED_TEX.btnCloseCap, roughness: 0.35 })
    ),
    'MF', cubId, { controlId: 'closeBtn', cloneMaterial: true, castShadow: false, noRefine: true }
  );
  btnCloseCap.position.set(-0.12, 0.96, 0.415);

  const btnTrip3D = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.019, 0.018, 16), MAT.earthGreen),
    'MF', cubId, { controlId: 'tripBtn', cloneMaterial: true }
  );
  btnTrip3D.rotation.x = Math.PI / 2;
  btnTrip3D.position.set(-0.02, 0.96, 0.405);
  const btnTripCap = regMesh(
    new THREE.Mesh(
      new THREE.CircleGeometry(0.015, 20),
      new THREE.MeshStandardMaterial({ map: SHARED_TEX.btnOpenCap, roughness: 0.35 })
    ),
    'MF', cubId, { controlId: 'tripBtn', cloneMaterial: true, castShadow: false, noRefine: true }
  );
  btnTripCap.position.set(-0.02, 0.96, 0.415);

  [
    { wx: -0.11, wy: 0.85, w: 0.090, h: 0.044 },
    { wx: 0.01, wy: 0.85, w: 0.090, h: 0.044 },
    { wx: 0.01, wy: 0.77, w: 0.090, h: 0.036 },
    { wx: 0.13, wy: 0.96, w: 0.104, h: 0.036 },
  ].forEach(({ wx, wy, w, h }) => {
    const winBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.005), MAT.steelTrim), 'MF', cubId, { castShadow: false });
    winBezel.position.set(wx, wy, 0.400);
    subGroups.MF.add(winBezel);
  });

  const flagOpenClose = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.036, 0.010), MAT.shutterRed), 'MF', cubId, { cloneMaterial: true });
  flagOpenClose.position.set(-0.11, 0.85, 0.404);
  const flagSpring = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.036, 0.010), MAT.shutterYellow), 'MF', cubId, { cloneMaterial: true });
  flagSpring.position.set(0.01, 0.85, 0.404);
  const flagTruckPos = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.028, 0.008), MAT.earthGreen), 'MF', cubId, { cloneMaterial: true });
  flagTruckPos.position.set(0.01, 0.77, 0.404);

  const counterMesh = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.030), new THREE.MeshStandardMaterial({ map: SHARED_TEX.counter, roughness: 0.3 })),
    'MF', cubId, { castShadow: false }
  );
  counterMesh.position.set(0.13, 0.96, 0.403);

  const chargePivotBoss = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 16), MAT.steelTrim), 'MF', cubId);
  chargePivotBoss.rotation.x = Math.PI / 2;
  chargePivotBoss.position.set(0.16, 0.90, 0.403);
  const chargeHandle = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.135, 0.018), MAT.galvSteel), 'MF', cubId);
  chargeHandle.position.set(0.16, 0.84, 0.408);
  const chargeGrip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.048, 0.022), MAT.darkConsole), 'MF', cubId);
  chargeGrip.position.set(0.16, 0.785, 0.412);
  subGroups.MF.add(chargePivotBoss, chargeGrip);

  const rackFlange = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.008, 18), MAT.galvSteel), 'MF', cubId, { controlId: 'rackPort', cloneMaterial: true });
  rackFlange.rotation.x = Math.PI / 2;
  rackFlange.position.set(0, 0.68, 0.401);
  const rackPort = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.020, 16), MAT.steelTrim), 'MF', cubId, { controlId: 'rackPort', cloneMaterial: true });
  rackPort.rotation.x = Math.PI / 2;
  rackPort.position.set(0, 0.68, 0.404);
  const rackHex = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.024, 6), MAT.brass), 'MF', cubId, { controlId: 'rackPort', cloneMaterial: true });
  rackHex.rotation.x = Math.PI / 2;
  rackHex.position.set(0, 0.68, 0.406);
  const rackShutterFlap = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.016, 0.006), MAT.brass), 'MF', cubId, { controlId: 'rackPort', cloneMaterial: true });
  rackShutterFlap.position.set(0, 0.68, 0.415);
  const lotoHaspBracket = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.018), MAT.steelTrim), 'MF', cubId, { controlId: 'rackingPadlock', cloneMaterial: true });
  lotoHaspBracket.position.set(0.044, 0.68, 0.406);
  subGroups.MF.add(btnClose3D, btnCloseCap, btnTrip3D, btnTripCap, flagOpenClose, flagSpring, flagTruckPos, counterMesh, chargeHandle, rackFlange, rackPort, rackHex, rackShutterFlap, lotoHaspBracket);

  const rearInterlockBarV = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.26, 0.008), MAT.brass), 'MF', cubId);
  rearInterlockBarV.position.set(-0.14, 0.81, 0.358);
  const rearInterlockBarH = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.008), MAT.galvSteel), 'MF', cubId);
  rearInterlockBarH.position.set(-0.05, 0.68, 0.358);
  [-0.12, -0.02].forEach((px) => {
    const rearPlunger = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.018, 12), MAT.brass), 'MF', cubId);
    rearPlunger.rotation.x = Math.PI / 2;
    rearPlunger.position.set(px, 0.96, 0.356);
    subGroups.MF.add(rearPlunger);
  });
  subGroups.MF.add(rearInterlockBarV, rearInterlockBarH);

  const rackingPadlock3D = buildPadlock3D('MF', cubId, { controlId: 'rackingPadlock' });
  rackingPadlock3D.position.set(0.048, 0.672, 0.418);
  rackingPadlock3D.visible = false;
  subGroups.MF.add(rackingPadlock3D);

  const vcbCastellKey3D = buildCastellKey3D('MF', cubId, { controlId: 'castellVcb' });
  vcbCastellKey3D.position.set(-0.14, 0.70, 0.404);
  subGroups.MF.add(vcbCastellKey3D);

  sockets.closeBtn = createSocket(subGroups.MF, 'closeBtn', cubId, [-0.12, 0.96, 0.418], { approachOffset: { x: -0.10, z: 1.36 } });
  sockets.tripBtn = createSocket(subGroups.MF, 'tripBtn', cubId, [-0.02, 0.96, 0.418], { approachOffset: { x: -0.02, z: 1.36 } });
  sockets.rackPort = createSocket(subGroups.MF, 'rackPort', cubId, [0, 0.68, 0.420], { approachOffset: { x: 0.0, z: 1.38 } });
  sockets.rackingPadlock = createSocket(subGroups.MF, 'rackingPadlock', cubId, [0.048, 0.672, 0.426], { approachOffset: { x: 0.05, z: 1.36 } });
  sockets.castellVcb = createSocket(subGroups.MF, 'castellVcb', cubId, [-0.14, 0.70, 0.428], { approachOffset: { x: -0.14, z: 1.36 } });

  /* 11 · AX: 58-PIN UMBILICAL AUXILIARY CONTROL PLUG, BAILS & CONDUIT */
  const auxFlange = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.012, 0.082), MAT.steelTrim), 'AX', cubId);
  auxFlange.position.set(0.22, 1.454, 0.24);
  const auxSocket = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.048, 0.068), MAT.galvSteel), 'AX', cubId);
  auxSocket.position.set(0.22, 1.430, 0.24);
  const auxPinInsert = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.014, 0.050), MAT.brass), 'AX', cubId);
  auxPinInsert.position.set(0.22, 1.404, 0.24);
  const auxPlug = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.090, 0.054, 0.064), MAT.iedCase), 'AX', cubId);
  auxPlug.position.set(0.22, 1.376, 0.24);
  const auxGland = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.024, 6), MAT.brass), 'AX', cubId);
  auxGland.position.set(0.22, 1.342, 0.24);
  [-0.050, 0.050].forEach((bx) => {
    const bail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.072, 0.050), MAT.brass), 'AX', cubId);
    bail.position.set(0.22 + bx, 1.405, 0.24);
    const pivotPin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 8), MAT.silverContact), 'AX', cubId);
    pivotPin.rotation.z = Math.PI / 2;
    pivotPin.position.set(0.22 + bx, 1.432, 0.24);
    subGroups.AX.add(bail, pivotPin);
  });
  const bailRoller = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.106, 10), MAT.shutterRed), 'AX', cubId);
  bailRoller.rotation.z = Math.PI / 2;
  bailRoller.position.set(0.22, 1.372, 0.268);
  const auxCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.22, 1.34, 0.24),
    new THREE.Vector3(0.25, 1.31, 0.33),
    new THREE.Vector3(0.18, 1.28, 0.35),
  ]);
  const auxConduit = regMesh(new THREE.Mesh(new THREE.TubeGeometry(auxCurve, 16, 0.014, 10, false), MAT.conduitFlex), 'AX', cubId);
  subGroups.AX.add(auxFlange, auxSocket, auxPinInsert, auxPlug, auxGland, bailRoller, auxConduit);

  /* 12, 13, 14 · EP, VI, TL */
  const movingVacuumStems = [];
  const movingBellows = [];
  const polePhaseMats = [MAT.phaseL1, MAT.phaseL2, MAT.phaseL3];

  const poleBaseBeam = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.024, 0.115), MAT.galvSteel), 'EP', cubId);
  poleBaseBeam.position.set(0, 0.768, 0.10);
  subGroups.EP.add(poleBaseBeam);

  [-0.095, 0.095].forEach((bx) => {
    const barrier = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.46, 0.165), MAT.epoxyPole), 'EP', cubId);
    barrier.position.set(bx, 1.02, 0.075);
    const barrierEdge = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.46, 0.010), MAT.aluminaCeramic), 'EP', cubId);
    barrierEdge.position.set(bx, 1.02, 0.155);
    subGroups.EP.add(barrier, barrierEdge);
  });

  const poleShedGeo = new THREE.LatheGeometry(
    [[0.066, -0.009], [0.080, -0.006], [0.089, -0.002], [0.0905, 0.0], [0.089, 0.002], [0.080, 0.004], [0.066, 0.007]].map(
      ([r, y]) => new THREE.Vector2(r, y)
    ),
    48,
    Math.PI * 0.27,
    Math.PI * 1.46
  );

  [-0.19, 0.0, 0.19].forEach((px, pIdx) => {
    const poleShell = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.46, 24, 1, false, Math.PI * 0.27, Math.PI * 1.46), MAT.epoxyPole),
      'EP', cubId, { cloneMaterial: true }
    );
    poleShell.material.side = THREE.DoubleSide;
    poleShell.position.set(px, 1.02, 0.10);
    subGroups.EP.add(poleShell);

    [-0.067, 0.067].forEach((rx) => {
      const vRib = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.44, 0.016), MAT.epoxyPole), 'EP', cubId);
      vRib.position.set(px + rx, 1.02, 0.09);
      subGroups.EP.add(vRib);
    });

    [0.79, 1.25].forEach((cy) => {
      const cap = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.073, 0.028, 22), MAT.epoxyPole), 'EP', cubId);
      cap.position.set(px, cy, 0.10);
      subGroups.EP.add(cap);
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2;
        const bolt = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.034, 6), MAT.brass), 'EP', cubId, { castShadow: false });
        bolt.position.set(px + Math.cos(ang) * 0.058, cy, 0.10 + Math.sin(ang) * 0.058);
        subGroups.EP.add(bolt);
      }
    });

    const phaseCollar = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 16), polePhaseMats[pIdx]), 'EP', cubId);
    phaseCollar.position.set(px, 1.268, 0.10);
    subGroups.EP.add(phaseCollar);

    [0.86, 0.94, 1.02, 1.10, 1.18].forEach((ry) => {
      const shed = regMesh(new THREE.Mesh(poleShedGeo, MAT.epoxyPole), 'EP', cubId, { cloneMaterial: true });
      shed.material.side = THREE.DoubleSide;
      shed.position.set(px, ry, 0.10);
      subGroups.EP.add(shed);
    });

    const insPushRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.11, 12), MAT.aluminaCeramic), 'EP', cubId);
    insPushRod.position.set(px, 0.815, 0.10);
    const wipeSpring = buildHelicalSpring(0.019, 0.062, 6, 0.0036, MAT.silverContact, 'EP', cubId);
    wipeSpring.position.set(px, 0.815, 0.10);
    const clevisFork = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.028, 0.026), MAT.brass), 'EP', cubId);
    clevisFork.position.set(px, 0.758, 0.10);
    subGroups.EP.add(insPushRod, wipeSpring, clevisFork);

    [1.20, 0.82].forEach((ty) => {
      const saddleBlock = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.044, 0.068), MAT.copper), 'EP', cubId);
      saddleBlock.position.set(px, ty, 0.055);
      [-0.014, 0.0, 0.014].forEach((fy) => {
        const heatFin = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.004, 0.058), MAT.brass), 'EP', cubId, { castShadow: false });
        heatFin.position.set(px, ty + fy, 0.055);
        subGroups.EP.add(heatFin);
      });
      const stemArm = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 16), MAT.copper), 'EP', cubId);
      stemArm.rotation.x = Math.PI / 2;
      stemArm.position.set(px, ty, 0.02);
      const stemFlange = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.014, 16), MAT.brass), 'EP', cubId);
      stemFlange.rotation.x = Math.PI / 2;
      stemFlange.position.set(px, ty, -0.032);
      subGroups.EP.add(saddleBlock, stemArm, stemFlange);

      const tulipCluster = new THREE.Group();
      tulipCluster.position.set(px, ty, -0.095);
      const carrier = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.020, 18), MAT.copper), 'TL', cubId);
      carrier.rotation.x = Math.PI / 2;
      carrier.position.z = 0.022;
      const innerCage = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.042, 16), MAT.brass), 'TL', cubId);
      innerCage.rotation.x = Math.PI / 2;
      innerCage.position.z = 0.002;
      tulipCluster.add(carrier, innerCage);

      for (let f = 0; f < 18; f++) {
        const ang = (f / 18) * Math.PI * 2;
        const fx = Math.cos(ang) * 0.026;
        const fy = Math.sin(ang) * 0.026;
        const finger = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.0058, 0.0082, 0.056), MAT.silverContact), 'TL', cubId);
        finger.position.set(fx, fy, 0);
        finger.rotation.z = ang + Math.PI / 2;
        const nosePad = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.0064, 0.010, 0.012), MAT.silverContact), 'TL', cubId, { castShadow: false });
        nosePad.position.set(Math.cos(ang) * 0.0245, Math.sin(ang) * 0.0245, -0.020);
        nosePad.rotation.z = ang + Math.PI / 2;
        tulipCluster.add(finger, nosePad);
      }
      [-0.014, 0.000, 0.013].forEach((gz) => {
        const garter = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0036, 8, 22), MAT.galvSteel), 'TL', cubId);
        garter.position.z = gz;
        tulipCluster.add(garter);
      });
      subGroups.TL.add(tulipCluster);
    });

    const ceramicEnv = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.25, 22, 1, false, Math.PI * 0.24, Math.PI * 1.52), MAT.aluminaCeramic),
      'VI', cubId, { cloneMaterial: true }
    );
    ceramicEnv.material.side = THREE.DoubleSide;
    ceramicEnv.position.set(px, 1.02, 0.10);
    subGroups.VI.add(ceramicEnv);

    [0.910, 1.020, 1.130].forEach((by) => {
      const brazeRing = regMesh(
        new THREE.Mesh(new THREE.CylinderGeometry(0.0472, 0.0472, 0.010, 22, 1, false, Math.PI * 0.24, Math.PI * 1.52), MAT.brass),
        'VI', cubId, { cloneMaterial: true }
      );
      brazeRing.material.side = THREE.DoubleSide;
      brazeRing.position.set(px, by, 0.10);
      subGroups.VI.add(brazeRing);
    });

    const arcShield = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.115, 18, 1, true, Math.PI * 0.30, Math.PI * 1.40), MAT.brass),
      'VI', cubId, { cloneMaterial: true }
    );
    arcShield.material.side = THREE.DoubleSide;
    arcShield.position.set(px, 1.03, 0.10);
    subGroups.VI.add(arcShield);
    [0.974, 1.086].forEach((ly) => {
      const shieldLip = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0028, 8, 18, Math.PI * 1.40), MAT.silverContact), 'VI', cubId);
      shieldLip.rotation.x = Math.PI / 2;
      shieldLip.rotation.z = Math.PI * 0.30;
      shieldLip.position.set(px, ly, 0.10);
      subGroups.VI.add(shieldLip);
    });

    [0.90, 1.14].forEach((ey) => {
      const kovarCap = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.016, 22), MAT.silverContact), 'VI', cubId);
      kovarCap.position.set(px, ey, 0.10);
      subGroups.VI.add(kovarCap);
    });

    const fixedStem = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.085, 16), MAT.copper), 'VI', cubId);
    fixedStem.position.set(px, 1.082, 0.10);
    const fixedDisc = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.016, 20), MAT.copper), 'VI', cubId);
    fixedDisc.position.set(px, 1.038, 0.10);
    const fixedWearRing = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 18), MAT.silverContact), 'VI', cubId);
    fixedWearRing.position.set(px, 1.029, 0.10);
    subGroups.VI.add(fixedStem, fixedDisc, fixedWearRing);
    for (let sp = 0; sp < 6; sp++) {
      const ang = (sp / 6) * Math.PI * 2;
      const petal = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.005), MAT.brass), 'VI', cubId, { castShadow: false });
      petal.position.set(px + Math.cos(ang) * 0.024, 1.038, 0.10 + Math.sin(ang) * 0.024);
      petal.rotation.y = -ang + 0.45;
      subGroups.VI.add(petal);
    }

    const movingAssembly = new THREE.Group();
    movingAssembly.position.set(px, 1.021, 0.10);
    const movDisc = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.016, 20), MAT.copper), 'VI', cubId);
    const movWearRing = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 18), MAT.silverContact), 'VI', cubId);
    movWearRing.position.y = 0.009;
    const movStem = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.125, 16), MAT.copper), 'VI', cubId);
    movStem.position.y = -0.068;
    const shuntCollar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.018, 0.036), MAT.brass), 'VI', cubId);
    shuntCollar.position.y = -0.128;
    const flexShuntCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.128, -0.014),
      new THREE.Vector3(0.022, -0.148, -0.026),
      new THREE.Vector3(0, -0.172, -0.036),
    ]);
    const flexShunt = regMesh(new THREE.Mesh(new THREE.TubeGeometry(flexShuntCurve, 10, 0.0055, 6, false), MAT.copper), 'VI', cubId);
    movingAssembly.add(movDisc, movWearRing, movStem, shuntCollar, flexShunt);
    for (let sp = 0; sp < 6; sp++) {
      const ang = (sp / 6) * Math.PI * 2;
      const petal = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.005), MAT.brass), 'VI', cubId, { castShadow: false });
      petal.position.set(Math.cos(ang) * 0.024, 0, Math.sin(ang) * 0.024);
      petal.rotation.y = -ang - 0.45;
      movingAssembly.add(petal);
    }
    subGroups.VI.add(movingAssembly);
    movingVacuumStems.push(movingAssembly);

    const bellowsGroup = new THREE.Group();
    bellowsGroup.position.set(px, 0.920, 0.10);
    const guideSleeve = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 14), MAT.galvSteel), 'VI', cubId);
    guideSleeve.position.y = 0.022;
    bellowsGroup.add(guideSleeve);
    for (let b = 0; b < 7; b++) {
      const conv = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.0034, 8, 18), MAT.silverContact), 'VI', cubId);
      conv.rotation.x = Math.PI / 2;
      conv.position.y = b * 0.0075;
      bellowsGroup.add(conv);
    }
    subGroups.VI.add(bellowsGroup);
    movingBellows.push(bellowsGroup);
  });

  /* 15 · SS: AUTOMATIC RED & YELLOW IP2X SAFETY SHUTTERS & SCISSOR LINKAGES */
  const shutterUpper = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.135, 0.012), new THREE.MeshStandardMaterial({ map: SHARED_TEX.shutterRed, roughness: 0.4, metalness: 0.15 })),
    'SS', cubId, { controlId: 'shutterPadlock', cloneMaterial: true }
  );
  shutterUpper.position.set(0, 1.20, -0.048);
  const shutterLower = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.135, 0.012), new THREE.MeshStandardMaterial({ map: SHARED_TEX.shutterYel, roughness: 0.4, metalness: 0.15 })),
    'SS', cubId
  );
  shutterLower.position.set(0, 0.82, -0.048);
  subGroups.SS.add(shutterUpper, shutterLower);

  [-0.31, 0.31].forEach((sx) => {
    const track = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.66, 0.022), MAT.galvSteel), 'SS', cubId);
    track.position.set(sx, 1.01, -0.048);
    const arm1 = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.26, 0.014), MAT.brass), 'SS', cubId);
    arm1.position.set(sx + (sx > 0 ? -0.012 : 0.012), 1.01, -0.032);
    arm1.rotation.x = 0.18;
    subGroups.SS.add(track, arm1);
  });

  const redShutterHasp = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.034, 0.022), MAT.steelTrim),
    'SS', cubId, { controlId: 'shutterPadlock', cloneMaterial: true }
  );
  redShutterHasp.position.set(0.26, 1.20, -0.038);
  subGroups.SS.add(redShutterHasp);

  const redShutterPadlock3D = buildPadlock3D('SS', cubId, { controlId: 'shutterPadlock' });
  redShutterPadlock3D.position.set(0.26, 1.20, -0.022);
  redShutterPadlock3D.visible = false;
  subGroups.SS.add(redShutterPadlock3D);
  sockets.shutterPadlock = createSocket(subGroups.SS, 'shutterPadlock', cubId, [0.26, 1.20, -0.016], { approachOffset: { x: 0.24, z: 1.28 } });

  /* 16 · SP: STATIONARY MONOBLOC SPOUT BUSHINGS & FIXED COPPER CONTACT PINS */
  const spoutBulkhead = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.74, 0.020), MAT.galvSteel), 'SP', cubId);
  spoutBulkhead.position.set(0, 1.01, -0.145);
  subGroups.SP.add(spoutBulkhead);

  [-0.19, 0.0, 0.19].forEach((px) => {
    [1.20, 0.82].forEach((sy) => {
      const flange = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.135, 0.018), MAT.epoxyPole), 'SP', cubId);
      flange.position.set(px, sy, -0.135);
      const spout = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.058, 0.10, 20), MAT.epoxyPole), 'SP', cubId);
      spout.rotation.x = Math.PI / 2;
      spout.position.set(px, sy, -0.135);
      const pin = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.095, 16), MAT.copper), 'SP', cubId);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(px, sy, -0.13);
      const nose = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.023, 0.016, 16), MAT.silverContact), 'SP', cubId);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(px, sy, -0.088);
      subGroups.SP.add(flange, spout, pin, nose);
    });
  });

  /* 17 · ES: INTEGRAL EK6 EARTH SWITCH, DOUBLE KNIVES, PE BAR, KEYS & CME */
  const peBusbar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.034, 0.022), MAT.earthGreen), 'ES', cubId, { terminalId: 'PE', cloneMaterial: true });
  peBusbar.position.set(0, 0.14, 0.44);
  const peCopperCore = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.022, 0.026), MAT.copper), 'ES', cubId, { terminalId: 'PE', cloneMaterial: true });
  peCopperCore.position.set(0, 0.14, 0.44);
  const peLug = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.044, 16), MAT.earthGreen), 'ES', cubId, { terminalId: 'PE', cloneMaterial: true });
  peLug.rotation.x = Math.PI / 2;
  peLug.position.set(-0.28, 0.14, 0.465);
  const pePlacard = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.036), new THREE.MeshStandardMaterial({ map: SHARED_TEX.phasePE, roughness: 0.38 })),
    'ES', cubId, { terminalId: 'PE', cloneMaterial: true, castShadow: false }
  );
  pePlacard.position.set(-0.28, 0.095, 0.468);
  const peHitProxy = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.10, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })),
    'ES', cubId, { terminalId: 'PE', isHitProxy: true, castShadow: false, receiveShadow: false, noRefine: true }
  );
  peHitProxy.rotation.x = Math.PI / 2;
  peHitProxy.position.set(-0.28, 0.14, 0.472);
  subGroups.ES.add(peBusbar, peCopperCore, peLug, pePlacard, peHitProxy);

  const phaseNames = ['L1', 'L2', 'L3'];
  const phaseMats = [MAT.phaseL1, MAT.phaseL2, MAT.phaseL3];
  const phaseTexs = [SHARED_TEX.phaseL1, SHARED_TEX.phaseL2, SHARED_TEX.phaseL3];
  const termCoords = { PE: new THREE.Vector3(-0.28, 0.14, 0.478) };
  const terminalStatusRings = {};
  sockets.PE = createSocket(subGroups.ES, 'PE', cubId, [-0.28, 0.14, 0.478], { approachOffset: { x: -0.24, z: 1.28 } });

  [-0.20, 0.0, 0.20].forEach((px, idx) => {
    const pName = phaseNames[idx];
    const jawBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.22, 0.020), MAT.copper), 'ES', cubId, { terminalId: pName, cloneMaterial: true });
    jawBar.position.set(px, 0.33, 0.22);
    const stabArm = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.024, 0.24), MAT.copper), 'ES', cubId, { terminalId: pName, cloneMaterial: true });
    stabArm.position.set(px, 0.31, 0.34);
    const sleeve = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.044, 0.068), phaseMats[idx]), 'ES', cubId, { terminalId: pName, cloneMaterial: true });
    sleeve.position.set(px, 0.31, 0.39);
    const lug = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.048, 18), MAT.brass), 'ES', cubId, { terminalId: pName, cloneMaterial: true });
    lug.rotation.x = Math.PI / 2;
    lug.position.set(px, 0.31, 0.458);
    const lugTip = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.022, 16), MAT.copper), 'ES', cubId, { terminalId: pName, cloneMaterial: true });
    lugTip.rotation.x = Math.PI / 2;
    lugTip.position.set(px, 0.31, 0.484);

    const statusRing = regMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0048, 10, 24), MAT.darkConsole),
      'ES', cubId, { terminalId: pName, cloneMaterial: true, castShadow: false }
    );
    statusRing.position.set(px, 0.31, 0.478);
    terminalStatusRings[pName] = statusRing;

    const placard = regMesh(
      new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.044), new THREE.MeshStandardMaterial({ map: phaseTexs[idx], roughness: 0.38 })),
      'ES', cubId, { terminalId: pName, cloneMaterial: true, castShadow: false }
    );
    placard.position.set(px, 0.382, 0.468);
    placard.rotation.x = -0.28;

    const hitProxy = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.13, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })),
      'ES', cubId, { terminalId: pName, isHitProxy: true, castShadow: false, receiveShadow: false, noRefine: true }
    );
    hitProxy.rotation.x = Math.PI / 2;
    hitProxy.position.set(px, 0.32, 0.468);

    subGroups.ES.add(jawBar, stabArm, sleeve, lug, lugTip, statusRing, placard, hitProxy);
    termCoords[pName] = new THREE.Vector3(px, 0.31, 0.494);
    sockets[pName] = createSocket(subGroups.ES, pName, cubId, [px, 0.31, 0.494], {
      approachOffset: { x: px, z: 1.24 },
    });
  });

  const earthBladePivot = new THREE.Group();
  earthBladePivot.position.set(0, 0.14, 0.23);
  const earthShaft = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.56, 6), MAT.galvSteel), 'ES', cubId);
  earthShaft.rotation.z = Math.PI / 2;
  earthBladePivot.add(earthShaft);

  [-0.20, 0.0, 0.20].forEach((px) => {
    [-0.015, 0.015].forEach((bx) => {
      const blade = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.225, 0.014), MAT.copper), 'ES', cubId);
      blade.position.set(px + bx, 0.11, -0.012);
      earthBladePivot.add(blade);
    });
  });
  const crossBeam = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.024, 0.022), MAT.epoxyPole), 'ES', cubId);
  crossBeam.position.set(0, 0.14, -0.012);
  earthBladePivot.add(crossBeam);
  subGroups.ES.add(earthBladePivot);

  // Fixed mid-rail between VCB door & lower cable compartment door housing EK6 socket, padlock & Castell keys
  const ek6RailBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.056, 0.020), MAT.darkConsole), 'ES', cubId);
  ek6RailBar.position.set(0, 0.468, 0.556);
  const ek6RailFace = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(dW - 0.04, 0.048), new THREE.MeshStandardMaterial({ map: SHARED_TEX.ek6RailPlate, roughness: 0.4 })),
    'ES', cubId, { castShadow: false }
  );
  ek6RailFace.position.set(0, 0.468, 0.567);
  subGroups.ES.add(ek6RailBar, ek6RailFace);

  const driveRod = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 10), MAT.galvSteel), 'ES', cubId);
  driveRod.rotation.x = Math.PI / 2;
  driveRod.position.set(-0.18, 0.468, 0.39);
  const earthSocket = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.026, 16), MAT.steelTrim), 'ES', cubId, { controlId: 'ek6Socket', cloneMaterial: true });
  earthSocket.rotation.x = Math.PI / 2;
  earthSocket.position.set(-0.18, 0.468, 0.574);
  const earthSocketHex = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.028, 6), MAT.brass), 'ES', cubId, { controlId: 'ek6Socket', cloneMaterial: true });
  earthSocketHex.rotation.x = Math.PI / 2;
  earthSocketHex.position.set(-0.18, 0.468, 0.576);
  const earthHaspBracket = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.026, 0.018), MAT.steelTrim), 'ES', cubId, { controlId: 'ek6Padlock', cloneMaterial: true });
  earthHaspBracket.position.set(-0.11, 0.466, 0.574);
  subGroups.ES.add(driveRod, earthSocket, earthSocketHex, earthHaspBracket);

  const earthPadlock3D = buildPadlock3D('ES', cubId, { controlId: 'ek6Padlock' });
  earthPadlock3D.position.set(-0.11, 0.462, 0.586);
  earthPadlock3D.visible = false;
  subGroups.ES.add(earthPadlock3D);

  const earthKey1 = buildCastellKey3D('ES', cubId, { controlId: 'earthKey1' });
  earthKey1.position.set(0.08, 0.468, 0.574);
  subGroups.ES.add(earthKey1);

  sockets.ek6Socket = createSocket(subGroups.ES, 'ek6Socket', cubId, [-0.18, 0.468, 0.588], { approachOffset: { x: -0.18, z: 1.36 } });
  sockets.ek6Padlock = createSocket(subGroups.ES, 'ek6Padlock', cubId, [-0.11, 0.462, 0.592], { approachOffset: { x: -0.11, z: 1.36 } });
  sockets.earthKey1 = createSocket(subGroups.ES, 'earthKey1', cubId, [0.08, 0.468, 0.592], { approachOffset: { x: 0.08, z: 1.36 } });

  let earthKey2 = null;
  if (cubId === 'TR1-HV') {
    earthKey2 = buildCastellKey3D('ES', cubId, { controlId: 'earthKey2' });
    earthKey2.position.set(0.20, 0.468, 0.574);
    subGroups.ES.add(earthKey2);
    sockets.earthKey2 = createSocket(subGroups.ES, 'earthKey2', cubId, [0.20, 0.468, 0.592], { approachOffset: { x: 0.20, z: 1.36 } });
  }

  const cmeMeshes = {};
  const peClampMesh = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.036), MAT.cmeCable), 'ES', cubId);
  peClampMesh.position.copy(termCoords.PE);
  peClampMesh.visible = false;
  subGroups.ES.add(peClampMesh);
  cmeMeshes.pe = peClampMesh;

  phaseNames.forEach((pName) => {
    const curve = new THREE.CatmullRomCurve3([
      termCoords.PE.clone(),
      new THREE.Vector3((termCoords.PE.x + termCoords[pName].x) * 0.5, 0.09, 0.35),
      termCoords[pName].clone(),
    ]);
    const cableMesh = regMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.0085, 8, false), MAT.cmeCable), 'ES', cubId);
    cableMesh.visible = false;
    subGroups.ES.add(cableMesh);
    cmeMeshes[pName] = cableMesh;
  });

  let meggerLeadsGroup = null;
  if (cubId === 'BT-M1') {
    meggerLeadsGroup = new THREE.Group();
    const redCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.34, 0.08, 0.62),
      new THREE.Vector3(-0.18, 0.22, 0.42),
      termCoords.L1.clone(),
    ]);
    const blkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.30, 0.08, 0.62),
      new THREE.Vector3(-0.29, 0.11, 0.44),
      termCoords.PE.clone(),
    ]);
    meggerLeadsGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(redCurve, 16, 0.006, 8, false), MAT.shutterRed),
      new THREE.Mesh(new THREE.TubeGeometry(blkCurve, 16, 0.006, 8, false), MAT.darkConsole)
    );
    meggerLeadsGroup.visible = false;
    subGroups.ES.add(meggerLeadsGroup);
  }

  /* 18 · BB: DOUBLE-BAR 6.6 kV COPPER MAIN BUSBARS, PHASE SLEEVES & STANDOFFS */
  [1.64, 1.80, 1.96].forEach((by, bIdx) => {
    [-0.011, 0.011].forEach((bz) => {
      const bar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.052, 0.010), MAT.copper), 'BB', cubId);
      bar.position.set(0, by, -0.34 + bz);
      subGroups.BB.add(bar);
    });
    const sleeve = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.058, 0.036), phaseMats[bIdx]), 'BB', cubId);
    sleeve.position.set(0, by, -0.34);
    const splice = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.058, 0.038), MAT.brass), 'BB', cubId);
    splice.position.set(0.36, by, -0.34);
    subGroups.BB.add(sleeve, splice);
    addFasteners(subGroups.BB, 'BB', cubId, [[0.335, by, -0.321], [0.385, by, -0.321]], { hex: true, r: 0.0068, h: 0.0052, mat: MAT.galvSteel });
    addFasteners(subGroups.BB, 'BB', cubId, [[0.335, by, -0.359], [0.385, by, -0.359]], { hex: true, dir: -1, r: 0.0068, h: 0.0052, mat: MAT.galvSteel });

    const standoff = buildSheddedInsulator(0.034, 0.12, 4, MAT.epoxyPole, 'BB', cubId);
    standoff.rotation.x = Math.PI / 2;
    standoff.position.set(-0.28 + bIdx * 0.28, by, -0.43);
    subGroups.BB.add(standoff);

    const px = -0.19 + bIdx * 0.19;
    const riserH = by - 1.22;
    const riser = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, riserH, 0.014), MAT.copper), 'BB', cubId);
    riser.position.set(px, 1.22 + riserH * 0.5, -0.25);
    subGroups.BB.add(riser);
  });

  const rearUpperCover = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.96, 0.014), MAT.steelPanel), 'BB', cubId);
  rearUpperCover.position.set(0, 1.68, -0.635);
  subGroups.BB.add(rearUpperCover);
  addFasteners(subGroups.BB, 'BB', cubId, rectPoints(-0.36, 0.36, 1.23, 2.13, 0.15, 'xy', -0.642), { dir: -1, r: 0.0045, h: 0.0034 });

  /* 19 · CT: TOROIDAL PROTECTION CTs, CBCT, ZnO ARRESTERS, STRESS CONES & XLPE */
  [-0.19, 0.0, 0.19].forEach((px, idx) => {
    const lowerDrop = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.42, 0.014), MAT.copper), 'CT', cubId);
    lowerDrop.position.set(px, 0.62, -0.25);
    subGroups.CT.add(lowerDrop);

    const ctCore = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.022, 12, 22), MAT.ctResin), 'CT', cubId);
    ctCore.rotation.x = Math.PI / 2;
    ctCore.position.set(px, 0.68, -0.25);
    const ctBox = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.036, 0.042), MAT.dinBlock), 'CT', cubId);
    ctBox.position.set(px, 0.68, -0.325);
    subGroups.CT.add(ctCore, ctBox);

    const zno = buildSheddedInsulator(0.026, 0.19, 6, MAT.arresterSilicone, 'CT', cubId);
    zno.position.set(px, 0.56, -0.44);
    subGroups.CT.add(zno);

    const cone = regMesh(new THREE.Mesh(terminationGeo, MAT.stressCone), 'CT', cubId);
    cone.position.set(px, 0.40, -0.25);
    const lugBarrel = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 20), MAT.copper), 'CT', cubId);
    lugBarrel.position.set(px, 0.494, -0.25);
    const lugPalm = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.05, 0.008), MAT.copper), 'CT', cubId);
    lugPalm.position.set(px, 0.53, -0.236);
    subGroups.CT.add(lugBarrel, lugPalm);
    addFasteners(subGroups.CT, 'CT', cubId, [[px, 0.535, -0.232]], { hex: true, r: 0.0065, h: 0.005 });

    const pCollar = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0262, 0.0262, 0.03, 24), phaseMats[idx]), 'CT', cubId);
    pCollar.position.set(px, 0.298, -0.25);
    const pBand2 = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0265, 0.0265, 0.022, 24), phaseMats[idx]), 'CT', cubId);
    pBand2.position.set(px, 0.115, -0.25);
    subGroups.CT.add(pBand2);
    addEarthLead(subGroups.CT, 'CT', cubId, [
      [px + 0.022, 0.31, -0.255],
      [px + 0.04, 0.26, -0.30],
      [px * 0.7 + 0.03, 0.14, -0.38],
      [px * 0.7 + 0.03, 0.095, -0.405],
    ], 0.0042);

    const cable = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.28, 14), MAT.xlpeCable), 'CT', cubId);
    cable.position.set(px, 0.19, -0.25);
    const gland = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.042, 6), MAT.brass), 'CT', cubId);
    gland.position.set(px, 0.055, -0.25);
    subGroups.CT.add(cone, pCollar, cable, gland);
  });

  const znoBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.020, 0.030), MAT.galvSteel), 'CT', cubId);
  znoBar.position.set(0, 0.455, -0.44);
  const cbct = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.016, 10, 28), MAT.iedCase), 'CT', cubId);
  cbct.rotation.x = Math.PI / 2;
  cbct.scale.set(1.0, 0.38, 1.0);
  cbct.position.set(0, 0.16, -0.25);

  const cableEarthBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.03), MAT.copper), 'CT', cubId);
  cableEarthBar.position.set(0, 0.088, -0.41);
  subGroups.CT.add(cableEarthBar);
  addFasteners(subGroups.CT, 'CT', cubId, [-0.133, -0.003, 0.163].map((x) => [x, 0.094, -0.41]), { axis: 'y', hex: true, r: 0.006, h: 0.0045 });
  [-0.21, 0.21].forEach((sx) => {
    const so = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.05, 20), MAT.epoxyPole), 'CT', cubId);
    so.position.set(sx, 0.057, -0.41);
    subGroups.CT.add(so);
  });

  const cleatRail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.036, 0.02), MAT.galvSteel), 'CT', cubId);
  cleatRail.position.set(0, 0.235, -0.287);
  subGroups.CT.add(cleatRail);
  [-0.19, 0.0, 0.19].forEach((cx) => {
    const cleat = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0065, 10, 32, Math.PI), MAT.gasket), 'CT', cubId);
    cleat.rotation.x = Math.PI / 2;
    cleat.rotation.z = Math.PI;
    cleat.position.set(cx, 0.235, -0.27);
    subGroups.CT.add(cleat);
    addFasteners(subGroups.CT, 'CT', cubId, [[cx - 0.036, 0.235, -0.277], [cx + 0.036, 0.235, -0.277]], { hex: true, r: 0.005, h: 0.004 });
  });

  const glandPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.008, 0.26), MAT.galvSteel), 'CT', cubId);
  glandPlate.position.set(0, 0.030, -0.25);
  subGroups.CT.add(glandPlate);
  addFasteners(subGroups.CT, 'CT', cubId, rectPoints(-0.30, 0.30, -0.36, -0.14, 0.15, 'xz', 0.034), { axis: 'y', r: 0.0042, h: 0.003 });

  const rearLowerCover = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1.08, 0.014), MAT.steelPanel), 'CT', cubId);
  rearLowerCover.position.set(0, 0.62, -0.635);
  subGroups.CT.add(znoBar, cbct, rearLowerCover);
  addFasteners(subGroups.CT, 'CT', cubId, rectPoints(-0.36, 0.36, 0.11, 1.13, 0.17, 'xy', -0.642), { dir: -1, r: 0.0045, h: 0.0034 });

  return {
    cubId,
    isHV: true,
    bayX,
    root,
    subGroups,
    sockets,
    arFlaps,
    doorHingeGroup,
    lowerDoorHingeGroup,
    terminalStatusRings,
    wheelGroups,
    leadScrew,
    flagOpenClose,
    flagSpring,
    flagTruckPos,
    rackShutterFlap,
    rackingPadlock3D,
    vcbCastellKey3D,
    movingVacuumStems,
    movingBellows,
    shutterUpper,
    shutterLower,
    redShutterPadlock3D,
    earthBladePivot,
    earthPadlock3D,
    earthKey1,
    earthKey2,
    cmeMeshes,
    meggerLeadsGroup,
    cviLedMeshes,
    needleKV,
    needleA,
    lampBank,
    mimicPanel,
    hmiPanel,
    tagDangerMesh,
    tagEarthMesh,
    tagSftMesh,
    termCoords,
    anim: {
      racking: 0,
      doorAngle: 0,
      contactStroke: 1,
      earthAngle: 0,
      needleKV: 0,
      needleA: 0,
    },
  };
}
