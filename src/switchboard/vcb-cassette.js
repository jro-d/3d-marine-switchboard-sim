import * as THREE from 'three';

/**
 * Builds the detachable withdrawable 6.6 kV VCB truck cassette (TC + SD/MF/AX/EP/VI/TL)
 * so it can roll out of an HV cubicle onto the physical VCB Withdrawal Trolley and back.
 */
export function buildVcbCassette({ cubId, MAT, SHARED_TEX, helpers, subGroups, sockets }) {
  const {
    regMesh,
    createSocket,
    buildPadlock3D,
    buildCastellKey3D,
    buildHelicalSpring,
  } = helpers;

  const cassetteRoot = subGroups.TC;

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
  const tulipFaultRings = [];
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
        const garter = regMesh(
          new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0036, 8, 22), MAT.galvSteel),
          'TL', cubId, { cloneMaterial: pIdx === 1 }
        );
        garter.position.z = gz;
        tulipCluster.add(garter);
        if (pIdx === 1) tulipFaultRings.push(garter);
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

  return {
    cassetteRoot,
    wheelGroups,
    leadScrew,
    btnClose3D,
    btnCloseCap,
    btnTrip3D,
    btnTripCap,
    rackHex,
    flagOpenClose,
    flagSpring,
    flagTruckPos,
    rackShutterFlap,
    rackingPadlock3D,
    vcbCastellKey3D,
    movingVacuumStems,
    movingBellows,
    tulipFaultRings,
  };
}
