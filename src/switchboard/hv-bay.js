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
import { buildVcbCassette } from './vcb-cassette.js';

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

  const cassetteBayMount = new THREE.Group();
  cassetteBayMount.name = `CassetteBayMount:${cubId}`;
  root.add(cassetteBayMount);

  ['SK', 'CF', 'AR', 'FD', 'LD', 'PR', 'RL', 'SS', 'SP', 'ES', 'BB', 'CT'].forEach((k) => {
    root.add(subGroups[k]);
  });
  cassetteBayMount.add(subGroups.TC);
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

  const cassette = buildVcbCassette({
    cubId,
    MAT,
    SHARED_TEX,
    helpers,
    subGroups,
    sockets,
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

  // Dedicated 6.6 kV Bus-Tie splice links & M16 torque-witness bolts inside C2 (BT1) rear chamber
  if (cubId === 'BT1') {
    [-0.19, 0.0, 0.19].forEach((px, pIdx) => {
      const tieBar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.044, 0.016), MAT.copper), 'BB', cubId);
      tieBar.position.set(px, 0.88 - pIdx * 0.05, -0.39);
      const splicePlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.054, 0.024), MAT.copper), 'BB', cubId);
      splicePlate.position.set(px, 0.88 - pIdx * 0.05, -0.39);
      const witnessStripe = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.048, 0.028), MAT.shutterRed), 'BB', cubId, { castShadow: false });
      witnessStripe.position.set(px, 0.88 - pIdx * 0.05, -0.39);
      subGroups.BB.add(tieBar, splicePlate, witnessStripe);
      addFasteners(
        subGroups.BB,
        'BB',
        cubId,
        [
          [px - 0.032, 0.88 - pIdx * 0.05, -0.405],
          [px + 0.032, 0.88 - pIdx * 0.05, -0.405],
        ],
        { dir: -1, hex: true, r: 0.008, h: 0.007, mat: MAT.brass }
      );
    });
  }

  subGroups.CT.add(znoBar, cbct);

  // Hinged rear inspection cover (opens into the Rear Bus-Tie & Cable Aisle)
  const rearDoorHingeGroup = new THREE.Group();
  rearDoorHingeGroup.position.set(-W / 2 + 0.016, 0.62, -0.635);
  subGroups.CT.add(rearDoorHingeGroup);

  const rearW = W - 0.032;
  const rearLowerCover = regMesh(new THREE.Mesh(new THREE.BoxGeometry(rearW, 1.08, 0.014), MAT.steelPanel), 'CT', cubId);
  rearLowerCover.position.set(rearW * 0.5, 0, 0);
  rearDoorHingeGroup.add(rearLowerCover);

  // Rear bronze-mesh inspection window + bezel
  const rearWinScreen = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.016), MAT.bronzeMesh), 'CT', cubId);
  rearWinScreen.position.set(rearW * 0.5, 0.20, -0.002);
  const rearWinFrame = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.26, 0.010), MAT.steelTrim), 'CT', cubId);
  rearWinFrame.position.set(rearW * 0.5, 0.20, -0.009);
  rearDoorHingeGroup.add(rearWinFrame, rearWinScreen);

  // Rear bay identification nameplate & HV warning placard (facing -Z rear aisle)
  const rearBadgeTex = makeBadgeTexture(
    `${titleText} · REAR`,
    cubId === 'BT1' ? '6.6 kV BUS-TIE SPLICE' : 'CABLE & CT CHAMBER',
    '#f7f6f3',
    '#1f2529',
    `#${bayAccentHex.toString(16).padStart(6, '0')}`
  );
  const rearNameplate = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), new THREE.MeshStandardMaterial({ map: rearBadgeTex, roughness: 0.38 })),
    'CT',
    cubId,
    { castShadow: false }
  );
  rearNameplate.rotation.y = Math.PI;
  rearNameplate.position.set(rearW * 0.5, 0.43, -0.010);

  const rearHazard = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.075), new THREE.MeshStandardMaterial({ map: SHARED_TEX.doorHazard, roughness: 0.4 })),
    'CT',
    cubId,
    { castShadow: false }
  );
  rearHazard.rotation.y = Math.PI;
  rearHazard.position.set(rearW * 0.5, -0.04, -0.010);
  rearDoorHingeGroup.add(rearNameplate, rearHazard);

  // Rear hinges & interactive espagnolette latch handle
  [-0.42, 0.0, 0.42].forEach((hy) => {
    const rHinge = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.048, 10), MAT.darkConsole), 'CT', cubId);
    rHinge.position.set(0.0, hy, -0.012);
    rearDoorHingeGroup.add(rHinge);
  });

  const rearHandleEsc = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.17, 0.014), MAT.darkConsole),
    'CT',
    cubId,
    { controlId: 'rearDoorHandle', cloneMaterial: true }
  );
  rearHandleEsc.position.set(rearW - 0.048, 0.04, -0.014);
  const rearHandleLever = regMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.12, 0.024), MAT.silverContact),
    'CT',
    cubId,
    { controlId: 'rearDoorHandle', cloneMaterial: true }
  );
  rearHandleLever.position.set(rearW - 0.048, 0.02, -0.026);
  rearDoorHingeGroup.add(rearHandleEsc, rearHandleLever);
  addFasteners(rearDoorHingeGroup, 'CT', cubId, rectPoints(0.04, rearW - 0.04, -0.49, 0.49, 0.24, 'xy', -0.009), { dir: -1, r: 0.0045, h: 0.0034 });

  sockets.rearDoorHandle = createSocket(rearDoorHingeGroup, 'rearDoorHandle', cubId, [rearW - 0.048, 0.02, -0.038], {
    approachOffset: { x: 0.22, z: -1.28 },
  });

  return {
    cubId,
    isHV: true,
    bayX,
    root,
    subGroups,
    sockets,
    cassetteBayMount,
    ...cassette,
    arFlaps,
    doorHingeGroup,
    lowerDoorHingeGroup,
    rearDoorHingeGroup,
    terminalStatusRings,
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
      extractSlide: 0,
      doorAngle: 0,
      rearDoorAngle: 0,
      contactStroke: 1,
      earthAngle: 0,
      needleKV: 0,
      needleA: 0,
    },
  };
}
