import * as THREE from 'three';
import {
  makeCanvasTex,
  makeBadgeTexture,
  makeLivePanel,
  drawMimic,
  MIMIC_DEFAULT,
  MIMIC_KINDS,
} from './textures.js';

const PART_KEYS = [
  'SK', 'CF', 'AR', 'FD', 'LD', 'PR', 'RL', 'TC', 'SD', 'MF',
  'AX', 'EP', 'VI', 'TL', 'SS', 'SP', 'ES', 'BB', 'CT',
];

export function buildLVBay({ bayX, MAT, SHARED_TEX, helpers }) {
  const {
    regMesh,
    createSocket,
    buildPadlock3D,
    buildCastellKey3D,
    addFasteners,
    rectPoints,
    addBoxRun,
    addEarthLead,
    addLiveMeter,
    buildLampBank,
    addLegend,
    addStormHandrail,
  } = helpers;

  const cubId = 'ACB-TR1-LV';
  const root = new THREE.Group();
  root.position.set(bayX, 0, 0.04);

  const W = 0.76;
  const subGroups = {};
  PART_KEYS.forEach((k) => { subGroups[k] = new THREE.Group(); });
  ['SK', 'CF', 'AR', 'FD', 'LD', 'PR', 'RL', 'TC', 'SS', 'SP', 'ES', 'BB', 'CT'].forEach((k) => {
    root.add(subGroups[k]);
  });
  ['SD', 'MF', 'AX', 'EP', 'VI', 'TL'].forEach((k) => {
    subGroups.TC.add(subGroups[k]);
  });

  // SK
  [-0.34, 0.34].forEach((sx) => {
    const rail = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.042, 1.04), MAT.skidSteel), 'SK', cubId);
    rail.position.set(sx, 0.035, 0);
    subGroups.SK.add(rail);
  });
  [[-0.33, -0.44], [0.33, -0.44], [-0.33, 0.44], [0.33, 0.44]].forEach(([cx, cz]) => {
    const pad = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.015, 0.068), MAT.rubberMount), 'SK', cubId);
    pad.position.set(cx, 0.0075, cz);
    const bolt = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.014, 6), MAT.brass), 'SK', cubId);
    bolt.position.set(cx, 0.062, cz);
    subGroups.SK.add(pad, bolt);
  });
  const lvKickPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.068, 0.012), MAT.navyBase), 'SK', cubId);
  lvKickPlate.position.set(0, 0.040, 0.502);
  subGroups.SK.add(lvKickPlate);

  // CF
  [-W / 2 + 0.008, W / 2 - 0.008].forEach((wx) => {
    const wall = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.98, 1.00), MAT.steelPanel), 'CF', cubId);
    wall.position.set(wx, 1.05, 0);
    subGroups.CF.add(wall);
    const sgn = Math.sign(wx);
    addFasteners(subGroups.CF, 'CF', cubId, rectPoints(-0.46, 0.46, 0.12, 1.98, 0.16, 'zy', wx + sgn * 0.006), { axis: 'x', dir: sgn, r: 0.0045, h: 0.0034 });
  });
  [0.48, 1.44].forEach((dy) => {
    const deck = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.016, 0.96), MAT.galvSteel), 'CF', cubId);
    deck.position.set(0, dy, 0);
    subGroups.CF.add(deck);
  });

  // AR
  const roof = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W, 0.020, 1.02), MAT.steelLight), 'AR', cubId);
  roof.position.set(0, 2.05, 0);
  const lvCanopyLip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.008, 0.028, 0.040), MAT.steelTrim), 'AR', cubId);
  lvCanopyLip.position.set(0, 2.046, 0.502);
  const lvHeader = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.024), new THREE.MeshStandardMaterial({ map: SHARED_TEX.headerLV, roughness: 0.35 })),
    'AR', cubId, { castShadow: false }
  );
  lvHeader.position.set(0, 2.046, 0.523);
  subGroups.AR.add(roof, lvCanopyLip, lvHeader);
  addFasteners(subGroups.AR, 'AR', cubId, rectPoints(-0.35, 0.35, -0.46, 0.46, 0.12, 'xz', 2.06), { axis: 'y', r: 0.0045, h: 0.0034 });
  [-0.30, 0.30].forEach((ex) => {
    const eye = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.005, 10, 18), MAT.brass), 'AR', cubId);
    eye.position.set(ex, 2.085, 0.34);
    subGroups.AR.add(eye);
  });

  // FD
  const dW = W - 0.03;
  const dShape = new THREE.Shape();
  dShape.moveTo(-dW / 2, -0.46);
  dShape.lineTo(dW / 2, -0.46);
  dShape.lineTo(dW / 2, 0.46);
  dShape.lineTo(-dW / 2, 0.46);
  dShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.22, -0.20);
  hole.lineTo(0.22, -0.20);
  hole.lineTo(0.22, 0.28);
  hole.lineTo(-0.22, 0.28);
  hole.closePath();
  dShape.holes.push(hole);
  const lvDoorGeo = new THREE.ExtrudeGeometry(dShape, { depth: 0.016, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002 });
  const lvFrontDoor = regMesh(new THREE.Mesh(lvDoorGeo, MAT.steelLight), 'FD', cubId);
  lvFrontDoor.position.set(0, 0.96, 0.49);
  const lowPanel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.40, 0.016), MAT.steelPanel), 'FD', cubId);
  lowPanel.position.set(0, 0.27, 0.49);
  const lvVentOpening = regMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.12), new THREE.MeshStandardMaterial({ color: 0x1d242b, roughness: 0.8 })), 'FD', cubId, { castShadow: false });
  lvVentOpening.position.set(0, 0.22, 0.499);
  subGroups.FD.add(lvFrontDoor, lowPanel, lvVentOpening);
  {
    const hL = -0.22;
    const hR = 0.22;
    const hB = 0.76;
    const hT = 1.24;
    const zf = 0.512;
    [
      [0, hT + 0.01, hR - hL + 0.04, 0.02],
      [0, hB - 0.01, hR - hL + 0.04, 0.02],
      [hL - 0.01, (hB + hT) / 2, 0.02, hT - hB],
      [hR + 0.01, (hB + hT) / 2, 0.02, hT - hB],
    ].forEach(([bx, by, bw, bh]) => {
      const bar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.008), MAT.steelTrim), 'FD', cubId);
      bar.position.set(bx, by, zf);
      subGroups.FD.add(bar);
    });
    addFasteners(subGroups.FD, 'FD', cubId, rectPoints(hL - 0.01, hR + 0.01, hB - 0.01, hT + 0.01, 0.07, 'xy', zf + 0.004), { r: 0.0040, h: 0.0034, mat: MAT.silverContact });
    [[-0.365, 0.66], [-0.365, 0.96], [-0.365, 1.26]].forEach(([hx, hy]) => {
      const hinge = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.052, 16), MAT.darkConsole), 'FD', cubId);
      hinge.position.set(hx, hy, 0.505);
      subGroups.FD.add(hinge);
    });
    const handleEsc = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.17, 0.012), MAT.darkConsole), 'FD', cubId);
    handleEsc.position.set(0.31, 0.96, 0.513);
    const handleLever = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.022), MAT.louverBlack), 'FD', cubId);
    handleLever.position.set(0.31, 0.955, 0.525);
    subGroups.FD.add(handleEsc, handleLever);
    addFasteners(subGroups.FD, 'FD', cubId, [[-0.335, 0.53, 0.508], [0.335, 0.53, 0.508], [-0.335, 1.39, 0.508], [0.335, 1.39, 0.508]], { r: 0.0050, mat: MAT.silverContact });
    addFasteners(subGroups.FD, 'FD', cubId, [[-0.33, 0.44, 0.498], [0.33, 0.44, 0.498], [-0.33, 0.10, 0.498], [0.33, 0.10, 0.498]], { r: 0.0060, mat: MAT.silverContact });
  }
  for (let ly = 0.17; ly <= 0.27; ly += 0.032) {
    const louver = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.011, 0.009), MAT.louverBlack), 'FD', cubId);
    louver.position.set(0, ly, 0.501);
    louver.rotation.x = 0.35;
    subGroups.FD.add(louver);
  }

  // LD
  const upperDoor = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.58, 0.018), MAT.steelLight), 'LD', cubId);
  upperDoor.position.set(0, 1.74, 0.495);
  const strip = regMesh(new THREE.Mesh(new THREE.BoxGeometry(dW, 0.022, 0.008), new THREE.MeshStandardMaterial({ color: 0x4a8258, roughness: 0.35 })), 'LD', cubId);
  strip.position.set(0, 2.015, 0.506);
  const nameTex = makeBadgeTexture('C5 · ACB-LV', '440 V SECONDARY', '#f7f6f3', '#1f2529', '#4a8258');
  const nameMesh = regMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.095), new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.35 })), 'LD', cubId, { castShadow: false });
  nameMesh.position.set(-0.17, 1.93, 0.506);
  subGroups.LD.add(upperDoor, strip, nameMesh);
  addFasteners(subGroups.LD, 'LD', cubId, [[-0.345, 1.985, 0.504], [0.345, 1.985, 0.504], [-0.345, 1.475, 0.504], [0.345, 1.475, 0.504]], { r: 0.0048, mat: MAT.silverContact });

  const needleA = addLiveMeter(subGroups.LD, cubId, 0.075, 1.92, SHARED_TEX.lvAmp, 0.096, 0.516);
  const needleV = addLiveMeter(subGroups.LD, cubId, 0.220, 1.92, SHARED_TEX.lvVolt, 0.096, 0.516);

  const lvMimicPanel = makeLivePanel(300, 200, drawMimic, { ...MIMIC_DEFAULT, ...MIMIC_KINDS[cubId] });
  const lvMimicFrame = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.292, 0.196, 0.006), MAT.darkConsole), 'LD', cubId);
  lvMimicFrame.position.set(-0.17, 1.71, 0.506);
  const lvMimicPlane = regMesh(
    new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.184), new THREE.MeshStandardMaterial({ map: lvMimicPanel.tex, roughness: 0.45 })),
    'LD', cubId, { castShadow: false }
  );
  lvMimicPlane.position.set(-0.17, 1.71, 0.510);
  subGroups.LD.add(lvMimicFrame, lvMimicPlane);

  const lvLampBank = buildLampBank(subGroups.LD, cubId, 0.15, 1.72, 0.506, 0.066, ['red', 'green', 'amber', 'white']);
  addLegend(subGroups.LD, cubId, SHARED_TEX.lvLampLegend, 4, 96, 0.15, 1.685, 0.506, 0.066);
  addStormHandrail(subGroups.LD, 'LD', cubId, dW, 1.442, 0.504);

  // PR
  const lvRelay = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), MAT.iedCase), 'PR', cubId);
  lvRelay.position.set(-0.14, 1.72, 0.34);
  subGroups.PR.add(lvRelay);

  // TC & EP
  const acbBody = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.30), MAT.carriageSteel), 'TC', cubId);
  acbBody.position.set(0, 0.86, 0.25);
  const acbCradle = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.036, 0.34), MAT.skidSteel), 'TC', cubId);
  acbCradle.position.set(0, 0.63, 0.25);
  subGroups.TC.add(acbBody, acbCradle);
  [-0.232, 0.232].forEach((rx) => {
    const ribs = [];
    for (let ry = 0.69; ry <= 1.04; ry += 0.035) ribs.push([rx, ry, 0.25]);
    addBoxRun(subGroups.TC, 'TC', cubId, [0.008, 0.012, 0.27], ribs, MAT.iedCase);
  });
  const acbFrontFrame = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.45, 0.016), MAT.iedCase), 'TC', cubId);
  acbFrontFrame.position.set(0, 0.86, 0.405);
  subGroups.TC.add(acbFrontFrame);
  [-0.238, 0.238].forEach((cx) => {
    const railFlange = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.40, 0.32), MAT.galvSteel), 'TC', cubId);
    railFlange.position.set(cx, 0.86, 0.25);
    subGroups.TC.add(railFlange);
  });
  [-0.14, 0.0, 0.14].forEach((ax) => {
    const chute = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.22), MAT.iedCase), 'EP', cubId);
    chute.position.set(ax, 1.18, 0.24);
    const exhaustGrid = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.012, 0.20), MAT.bronzeMesh), 'EP', cubId);
    exhaustGrid.position.set(ax, 1.254, 0.24);
    const slots = [];
    for (let sz = -0.08; sz <= 0.081; sz += 0.02) slots.push([ax, 1.2615, 0.24 + sz]);
    addBoxRun(subGroups.EP, 'EP', cubId, [0.07, 0.004, 0.006], slots, MAT.louverBlack);
    for (let p = -3; p <= 3; p++) {
      const splitter = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.09, 0.006), MAT.galvSteel), 'VI', cubId);
      splitter.position.set(ax, 1.21, 0.24 + p * 0.024);
      subGroups.VI.add(splitter);
    }
    subGroups.EP.add(chute, exhaustGrid);
  });

  // MF
  const acbEsc = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.036), MAT.darkConsole), 'MF', cubId);
  acbEsc.position.set(0, 0.98, 0.44);
  const acbBezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.40, 0.008), MAT.steelTrim), 'MF', cubId);
  acbBezel.position.set(0, 0.98, 0.456);
  const acbTripScreen = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.010), MAT.iedCase), 'MF', cubId);
  acbTripScreen.position.set(-0.10, 0.98, 0.460);
  const acbBtnClose = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 16), MAT.shutterRed),
    'MF', cubId, { controlId: 'closeBtn', cloneMaterial: true }
  );
  acbBtnClose.rotation.x = Math.PI / 2;
  acbBtnClose.position.set(0.02, 1.03, 0.464);
  const acbBtnOpen = regMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 16), MAT.earthGreen),
    'MF', cubId, { controlId: 'tripBtn', cloneMaterial: true }
  );
  acbBtnOpen.rotation.x = Math.PI / 2;
  acbBtnOpen.position.set(0.02, 0.96, 0.464);
  const acbFlag = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.048, 0.012), MAT.shutterRed), 'MF', cubId, { cloneMaterial: true });
  acbFlag.position.set(-0.06, 1.10, 0.462);
  const acbChargeLever = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.15, 0.022), MAT.shutterYellow), 'MF', cubId);
  acbChargeLever.position.set(0.12, 1.02, 0.465);
  subGroups.MF.add(acbEsc, acbBezel, acbTripScreen, acbBtnClose, acbBtnOpen, acbFlag, acbChargeLever);
  {
    const lcd = makeCanvasTex(256, 96);
    lcd.ctx.fillStyle = '#2a0b09';
    lcd.ctx.fillRect(0, 0, 256, 96);
    lcd.ctx.fillStyle = '#ff4a36';
    lcd.ctx.font = '700 46px Consolas, monospace';
    lcd.ctx.textAlign = 'center';
    lcd.ctx.textBaseline = 'middle';
    lcd.ctx.fillText('2500 A', 128, 50);
    const lcdMesh = regMesh(
      new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.034), new THREE.MeshStandardMaterial({ map: lcd.tex, emissive: 0xffffff, emissiveMap: lcd.tex, emissiveIntensity: 0.55, roughness: 0.25 })),
      'MF', cubId, { castShadow: false }
    );
    lcdMesh.position.set(-0.10, 0.995, 0.4656);
    const lbl = makeCanvasTex(512, 96);
    lbl.ctx.fillStyle = '#c9cdcf';
    lbl.ctx.fillRect(0, 0, 512, 96);
    lbl.ctx.strokeStyle = '#59656b';
    lbl.ctx.lineWidth = 3;
    lbl.ctx.strokeRect(4, 4, 504, 88);
    lbl.ctx.fillStyle = '#1f2a30';
    lbl.ctx.font = '700 34px Segoe UI, Arial';
    lbl.ctx.fillText('ACB  440 V  3P  2500 A', 22, 44);
    lbl.ctx.font = '22px Segoe UI, Arial';
    lbl.ctx.fillText('WITHDRAWABLE  ·  ILLUSTRATIVE RATING', 22, 76);
    const lblMesh = regMesh(new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.041), new THREE.MeshStandardMaterial({ map: lbl.tex, roughness: 0.45, metalness: 0.2 })), 'MF', cubId, { castShadow: false });
    lblMesh.position.set(-0.02, 0.81, 0.4605);
    subGroups.MF.add(lcdMesh, lblMesh);
    addFasteners(subGroups.MF, 'MF', cubId, rectPoints(-0.18, 0.18, 0.79, 1.17, 0.19, 'xy', 0.460), { r: 0.0045, h: 0.0034, mat: MAT.silverContact });
    const rackSlot = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.006), MAT.louverBlack), 'MF', cubId, { castShadow: false });
    rackSlot.position.set(0.10, 0.80, 0.4625);
    subGroups.MF.add(rackSlot);
    [-0.235, 0.235].forEach((lx) => {
      const lug = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0045, 10, 28), MAT.silverContact), 'TC', cubId);
      lug.rotation.y = Math.PI / 2;
      lug.position.set(lx + Math.sign(lx) * 0.012, 1.06, 0.25);
      subGroups.TC.add(lug);
    });
  }

  const acbPadlockHasp = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.016), MAT.steelTrim), 'MF', cubId, { controlId: 'rackingPadlock', cloneMaterial: true });
  acbPadlockHasp.position.set(-0.10, 0.86, 0.464);
  subGroups.MF.add(acbPadlockHasp);

  const acbPadlock = buildPadlock3D('MF', cubId, { controlId: 'rackingPadlock' });
  acbPadlock.position.set(-0.10, 0.86, 0.472);
  acbPadlock.visible = false;
  subGroups.MF.add(acbPadlock);

  const acbKey = buildCastellKey3D('MF', cubId, { controlId: 'castellVcb' });
  acbKey.position.set(0.08, 0.86, 0.462);
  subGroups.MF.add(acbKey);

  const sockets = {
    closeBtn: createSocket(subGroups.MF, 'closeBtn', cubId, [0.02, 1.03, 0.474], { approachOffset: { x: 0.02, z: 1.36 } }),
    tripBtn: createSocket(subGroups.MF, 'tripBtn', cubId, [0.02, 0.96, 0.474], { approachOffset: { x: 0.02, z: 1.36 } }),
    rackingPadlock: createSocket(subGroups.MF, 'rackingPadlock', cubId, [-0.10, 0.86, 0.476], { approachOffset: { x: -0.08, z: 1.36 } }),
    castellVcb: createSocket(subGroups.MF, 'castellVcb', cubId, [0.08, 0.86, 0.486], { approachOffset: { x: 0.08, z: 1.36 } }),
  };

  // BB & CT
  [1.54, 1.66, 1.78, 1.90].forEach((by) => {
    const bar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.038, 0.012), MAT.copper), 'BB', cubId);
    bar.position.set(0, by, -0.28);
    subGroups.BB.add(bar);
  });
  const lvPhaseMats = [MAT.phaseL1, MAT.phaseL2, MAT.phaseL3];
  [-0.14, 0.0, 0.14].forEach((tx, i) => {
    [1.00, 0.72].forEach((ty) => {
      const spread = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.17), MAT.copper), 'SP', cubId);
      spread.position.set(tx, ty, 0.02);
      subGroups.SP.add(spread);
      addFasteners(subGroups.SP, 'SP', cubId, [[tx - 0.015, ty + 0.008, -0.03], [tx + 0.015, ty + 0.008, -0.03]], { axis: 'y', hex: true, r: 0.0055, h: 0.0042 });
    });
    const barY = [1.54, 1.66, 1.78][i];
    const riser = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.04, barY - 1.0, 0.012), MAT.copper), 'BB', cubId);
    riser.position.set(tx, (barY + 1.0) / 2, -0.064);
    const link = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.21), MAT.copper), 'BB', cubId);
    link.position.set(tx, barY, -0.17);
    const sleeve = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.06, 0.018), lvPhaseMats[i]), 'BB', cubId);
    sleeve.position.set(tx, 1.28, -0.064);
    subGroups.BB.add(riser, link, sleeve);
    addFasteners(subGroups.BB, 'BB', cubId, [[tx, barY, -0.272]], { dir: -1, hex: true, r: 0.0065, h: 0.005 });

    const cable = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.64, 28), MAT.xlpeCable), 'CT', cubId);
    cable.position.set(tx, 0.37, -0.075);
    const lug = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.04, 20), MAT.copper), 'CT', cubId);
    lug.position.set(tx, 0.70, -0.075);
    const tape = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.03, 28), lvPhaseMats[i]), 'CT', cubId);
    tape.position.set(tx, 0.62, -0.075);
    const gland = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.034, 6), MAT.brass), 'CT', cubId);
    gland.position.set(tx, 0.05, -0.075);
    subGroups.CT.add(cable, lug, tape, gland);
  });
  const lvGlandPlate = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.008, 0.22), MAT.galvSteel), 'CT', cubId);
  lvGlandPlate.position.set(0, 0.03, -0.08);
  subGroups.CT.add(lvGlandPlate);
  addEarthLead(subGroups.CT, 'CT', cubId, [[-0.25, 0.04, -0.17], [-0.26, 0.30, -0.20], [-0.24, 0.62, -0.12], [-0.20, 0.72, -0.05]], 0.0055);

  const rearCover = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.90, 0.014), MAT.steelPanel), 'BB', cubId);
  rearCover.position.set(0, 1.56, -0.495);
  subGroups.BB.add(rearCover);

  const tieDuct = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.075, 0.075), MAT.steelTrim), 'CT', cubId);
  tieDuct.position.set(-0.40, 0.24, -0.32);
  const rearLow = regMesh(new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 1.00, 0.014), MAT.steelPanel), 'CT', cubId);
  rearLow.position.set(0, 0.56, -0.495);
  subGroups.CT.add(tieDuct, rearLow);

  return {
    cubId,
    isHV: false,
    bayX,
    root,
    subGroups,
    sockets,
    acbBtnClose,
    acbBtnOpen,
    acbFlag,
    acbPadlock,
    acbKey,
    needleV,
    needleA,
    lampBank: lvLampBank,
    mimicPanel: lvMimicPanel,
    anim: { racking: 0, needleV: 0, needleA: 0 },
  };
}
