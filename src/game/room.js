import * as THREE from 'three';
import { STATIONS } from './navigation.js';

function makeCanvasTexture(w, h, draw, repeatX = 1, repeatY = 1, maxAniso = 4) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(maxAniso, 8);
  return tex;
}

function makeSignMesh(width, height, title, subtitle, accent = '#1f6f78') {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = Math.max(140, Math.round((1024 * height) / width));
  const ctx = cv.getContext('2d');
  const w = cv.width;
  const h = cv.height;

  ctx.fillStyle = '#1e2730';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, Math.max(14, Math.round(h * 0.16)));
  ctx.strokeStyle = '#d4dde6';
  ctx.lineWidth = 8;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  const titleSize = Math.min(46, Math.round(h * 0.34));
  const subSize = Math.min(26, Math.round(h * 0.20));
  const maxTextWidth = w - 84;

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 ${titleSize}px "IBM Plex Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, subtitle ? h * 0.48 : h * 0.56, maxTextWidth);

  if (subtitle) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 ${subSize}px "IBM Plex Mono", monospace`;
    ctx.fillText(subtitle, w / 2, h * 0.78, maxTextWidth);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.12 });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

function makeFloorDecal(label, accent = '#1f6f78') {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(18, 18, 220, 220);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(24, 34, 44, 0.52)';
  ctx.fillRect(28, 92, 200, 72);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 28px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 128);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.008;
  return mesh;
}

export function createSwitchroom(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  const root = new THREE.Group();
  root.name = 'HVSwitchroom';

  const clickProxies = [];

  const deckTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#535e69';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#434d57';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = '#626f7c';
      for (let y = 16; y < h; y += 32) {
        for (let x = 16; x < w; x += 32) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(((x + y) % 64 === 0 ? 1 : -1) * Math.PI * 0.25);
          ctx.fillRect(-7, -2, 14, 4);
          ctx.restore();
        }
      }
    },
    10,
    8,
    maxAniso
  );

  const hazardTex = makeCanvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#d4a024';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1e242b';
      for (let i = -w; i < w * 2; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 16, 0);
        ctx.lineTo(i - h + 16, h);
        ctx.lineTo(i - h, h);
        ctx.closePath();
        ctx.fill();
      }
    },
    14,
    1,
    maxAniso
  );

  const wallTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#dde3ea';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8b97a4';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.fillStyle = '#1f6f78';
      ctx.fillRect(0, h * 0.76, w, h * 0.025);
      ctx.strokeStyle = '#c4cdd6';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    4,
    1,
    maxAniso
  );

  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.76, metalness: 0.22 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.65, metalness: 0.10 });
  const steelDarkMat = new THREE.MeshStandardMaterial({ color: 0x333c46, roughness: 0.55, metalness: 0.55 });
  const steelFrameMat = new THREE.MeshStandardMaterial({ color: 0x5d6875, roughness: 0.45, metalness: 0.48 });
  const tealLockerMat = new THREE.MeshStandardMaterial({ color: 0x265c66, roughness: 0.48, metalness: 0.25 });
  const deskWoodMat = new THREE.MeshStandardMaterial({ color: 0x8f7a62, roughness: 0.68, metalness: 0.05 });
  const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xd9a426, roughness: 0.42, metalness: 0.14 });
  const redBoxMat = new THREE.MeshStandardMaterial({ color: 0xb9372c, roughness: 0.42, metalness: 0.28 });

  const deckMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 7.2), deckMat);
  deckMesh.rotation.x = -Math.PI / 2;
  deckMesh.position.set(0, -0.006, 2.25);
  deckMesh.receiveShadow = true;
  deckMesh.userData.walkFloor = true;
  root.add(deckMesh);
  clickProxies.push(deckMesh);

  const hazardStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 0.14),
    new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.65,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  hazardStrip.rotation.x = -Math.PI / 2;
  hazardStrip.position.set(0, 0.002, 1.32);
  root.add(hazardStrip);

  const H = 3.30;
  const wallGeoSide = new THREE.BoxGeometry(0.14, H, 7.2);
  const portWall = new THREE.Mesh(wallGeoSide, wallMat);
  portWall.position.set(-4.30, H / 2, 2.25);
  portWall.receiveShadow = true;

  const stbdWall = new THREE.Mesh(wallGeoSide, wallMat);
  stbdWall.position.set(4.30, H / 2, 2.25);
  stbdWall.receiveShadow = true;

  const wallGeoFrontBack = new THREE.BoxGeometry(8.75, H, 0.14);
  const backWall = new THREE.Mesh(wallGeoFrontBack, wallMat);
  backWall.position.set(0, H / 2, -1.28);
  backWall.receiveShadow = true;

  const aftWall = new THREE.Mesh(wallGeoFrontBack, wallMat);
  aftWall.position.set(0, H / 2, 5.75);
  aftWall.receiveShadow = true;
  root.add(portWall, stbdWall, backWall, aftWall);

  const mainSign = makeSignMesh(3.4, 0.42, '6.6 kV HIGH-VOLTAGE SWITCHBOARD ROOM', 'DANGER · AUTHORIZED ETO PERSONNEL ONLY · 40 CAL/CM² PPE', '#b9372c');
  mainSign.position.set(0, 2.78, -1.19);
  root.add(mainSign);

  const ceilingGroup = new THREE.Group();
  const beamGeo = new THREE.BoxGeometry(8.5, 0.12, 0.14);
  const lampHousingGeo = new THREE.BoxGeometry(1.5, 0.06, 0.18);
  const lampTubeMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
  const lampTubeGeo = new THREE.BoxGeometry(1.42, 0.025, 0.10);

  for (const bz of [-0.2, 1.8, 3.8, 5.1]) {
    const beam = new THREE.Mesh(beamGeo, steelFrameMat);
    beam.position.set(0, H - 0.08, bz);
    ceilingGroup.add(beam);
  }
  for (const lx of [-2.2, 0, 2.2]) {
    for (const lz of [1.2, 3.6]) {
      const housing = new THREE.Mesh(lampHousingGeo, steelDarkMat);
      housing.position.set(lx, H - 0.16, lz);
      const tube = new THREE.Mesh(lampTubeGeo, lampTubeMat);
      tube.position.set(lx, H - 0.19, lz);
      ceilingGroup.add(housing, tube);
    }
  }
  root.add(ceilingGroup);

  // PPE Locker
  const ppeGroup = new THREE.Group();
  ppeGroup.position.set(-3.82, 0, 2.50);
  ppeGroup.rotation.y = Math.PI / 2;

  const lockerBody = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.06, 0.62), tealLockerMat);
  lockerBody.position.set(0, 1.03, 0);
  lockerBody.castShadow = true;
  lockerBody.receiveShadow = true;
  const lockerRecess = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.72, 0.10), steelDarkMat);
  lockerRecess.position.set(0, 1.04, 0.28);
  const lockerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.04, 0.42), steelFrameMat);
  lockerShelf.position.set(0, 0.62, 0.16);
  ppeGroup.add(lockerBody, lockerRecess, lockerShelf);

  const lockerSuit = new THREE.Group();
  const coatHang = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.16), new THREE.MeshStandardMaterial({ color: 0x3b4d47, roughness: 0.82 }));
  coatHang.position.set(-0.28, 1.24, 0.30);
  const hoodHang = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x455851, roughness: 0.78 }));
  hoodHang.position.set(-0.28, 1.72, 0.30);
  const visorHang = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: 0x2c9460, roughness: 0.15, transparent: true, opacity: 0.75 }));
  visorHang.position.set(-0.28, 1.72, 0.40);
  lockerSuit.add(coatHang, hoodHang, visorHang);
  ppeGroup.add(lockerSuit);

  const lockerGloves = new THREE.Group();
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xe68a1e, roughness: 0.55 });
  const gLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), gloveMat);
  gLeft.position.set(0.22, 1.24, 0.34);
  const gRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.08), gloveMat);
  gRight.position.set(0.38, 1.24, 0.34);
  lockerGloves.add(gLeft, gRight);
  ppeGroup.add(lockerGloves);

  const lockerBoots = new THREE.Group();
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x222930, roughness: 0.72 });
  const bL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.24), bootMat);
  bL.position.set(-0.22, 0.22, 0.24);
  const bR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.24), bootMat);
  bR.position.set(-0.04, 0.22, 0.24);
  const matRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.46, 14), safetyYellowMat);
  matRoll.rotation.z = Math.PI / 2;
  matRoll.position.set(0.30, 0.20, 0.26);
  lockerBoots.add(bL, bR, matRoll);
  ppeGroup.add(lockerBoots);

  const ppeSign = makeSignMesh(1.36, 0.30, 'HV PPE LOCKER', '40 CAL SUIT · CLASS 2 GLOVES · 15 kV MAT', '#d4a024');
  ppeSign.position.set(0, 2.26, 0.04);
  ppeGroup.add(ppeSign);
  root.add(ppeGroup);

  // Key Box & Tool Board
  const keysGroup = new THREE.Group();
  keysGroup.position.set(-2.22, 0, 5.18);
  keysGroup.rotation.y = Math.PI;

  const keyBenchTop = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.08, 0.68), steelFrameMat);
  keyBenchTop.position.set(0, 0.90, 0);
  keyBenchTop.castShadow = true;
  keysGroup.add(keyBenchTop);
  for (const lx of [-0.70, 0.70]) {
    for (const lz of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, 0.06), steelDarkMat);
      leg.position.set(lx, 0.44, lz);
      keysGroup.add(leg);
    }
  }
  const pegboard = new THREE.Mesh(new THREE.BoxGeometry(1.54, 1.05, 0.06), steelDarkMat);
  pegboard.position.set(0, 1.48, -0.28);
  const keyBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.24), redBoxMat);
  keyBox.position.set(-0.38, 1.07, 0.06);
  keyBox.castShadow = true;
  const keyBoxStatusLedMat = new THREE.MeshBasicMaterial({ color: 0xe69f00 });
  const keyBoxLed = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), keyBoxStatusLedMat);
  keyBoxLed.position.set(-0.38, 1.22, 0.14);
  const wallCrank = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 8), steelFrameMat);
  wallCrank.position.set(0.12, 1.44, -0.22);
  const wallStick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.95, 8), safetyYellowMat);
  wallStick.rotation.z = Math.PI / 2;
  wallStick.position.set(0.18, 1.76, -0.22);
  const keysSign = makeSignMesh(1.52, 0.30, 'LOTO KEY BOX & TOOLS', 'CASTELL KEYS · PADLOCKS · RACKING CRANK', '#1f6f78');
  keysSign.position.set(0, 2.22, -0.24);
  keysGroup.add(pegboard, keyBox, keyBoxLed, wallCrank, wallStick, keysSign);
  root.add(keysGroup);

  // Proving Unit & 5 kV Megger Bench
  const testGroup = new THREE.Group();
  testGroup.position.set(2.22, 0, 5.18);
  testGroup.rotation.y = Math.PI;

  const testBenchTop = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.08, 0.68), steelFrameMat);
  testBenchTop.position.set(0, 0.90, 0);
  testBenchTop.castShadow = true;
  testGroup.add(testBenchTop);
  for (const lx of [-0.70, 0.70]) {
    for (const lz of [-0.26, 0.26]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, 0.06), steelDarkMat);
      leg.position.set(lx, 0.44, lz);
      testGroup.add(leg);
    }
  }
  const provingUnit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.48 }));
  provingUnit.position.set(-0.42, 1.05, 0.04);
  const provingLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const provingLed = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), provingLedMat);
  provingLed.position.set(-0.42, 1.17, 0.11);
  const benchWand = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.92, 10), safetyYellowMat);
  benchWand.rotation.z = Math.PI / 2;
  benchWand.position.set(0.02, 0.98, 0.16);
  const meggerCase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.30), safetyYellowMat);
  meggerCase.position.set(0.44, 1.06, -0.02);
  const meggerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshBasicMaterial({ color: 0x132c22 }));
  meggerScreen.position.set(0.44, 1.09, 0.135);
  const testSign = makeSignMesh(1.52, 0.30, 'PROVING & MEGGER BENCH', '6.6 kV PROVING UNIT · 5 kV PI INSULATION TESTER', '#d4a024');
  testSign.position.set(0, 2.22, -0.24);
  testGroup.add(provingUnit, provingLed, benchWand, meggerCase, meggerScreen, testSign);
  root.add(testGroup);

  // Permit Desk
  const permitGroup = new THREE.Group();
  permitGroup.position.set(3.82, 0, 2.50);
  permitGroup.rotation.y = -Math.PI / 2;

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.68), deskWoodMat);
  deskTop.position.set(0, 0.94, 0);
  deskTop.castShadow = true;
  const deskBase = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.90, 0.56), steelDarkMat);
  deskBase.position.set(0, 0.45, -0.03);
  const ptwBinder = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 0.38), redBoxMat);
  ptwBinder.position.set(-0.24, 0.99, 0.04);
  ptwBinder.rotation.y = 0.08;
  const sftFolder = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.36), safetyYellowMat);
  sftFolder.position.set(0.24, 0.99, 0.04);
  sftFolder.rotation.y = -0.10;
  const permitLampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.24, 10), steelFrameMat);
  permitLampStem.position.set(0, 1.09, -0.18);
  const permitBeaconMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
  const permitBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), permitBeaconMat);
  permitBeacon.position.set(0, 1.24, -0.18);
  const permitSign = makeSignMesh(1.38, 0.30, 'PERMIT-TO-WORK DESK', 'PTW & SANCTION-FOR-TEST AUTHORIZATION', '#1f6f78');
  permitSign.position.set(0, 2.26, 0.04);
  permitGroup.add(deskTop, deskBase, ptwBinder, sftFolder, permitLampStem, permitBeacon, permitSign);
  root.add(permitGroup);

  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const stationProxySpecs = [
    { id: 'station:ppe', pos: [-3.80, 1.15, 2.50], size: [0.85, 2.3, 1.55], decal: 'PPE', accent: '#d4a024' },
    { id: 'station:keys', pos: [-2.22, 1.15, 5.15], size: [1.65, 2.3, 0.85], decal: 'KEYS', accent: '#1f6f78' },
    { id: 'station:test', pos: [2.22, 1.15, 5.15], size: [1.65, 2.3, 0.85], decal: 'TEST', accent: '#d4a024' },
    { id: 'station:permit', pos: [3.80, 1.15, 2.50], size: [0.85, 2.3, 1.55], decal: 'PTW', accent: '#1f6f78' },
  ];

  for (const spec of stationProxySpecs) {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), proxyMat);
    proxy.position.set(...spec.pos);
    proxy.userData.stationId = spec.id;
    root.add(proxy);
    clickProxies.push(proxy);

    const st = STATIONS.find((s) => s.id === spec.id);
    if (st) {
      const decal = makeFloorDecal(spec.decal, spec.accent);
      decal.position.x = st.anchor.x;
      decal.position.z = st.anchor.z;
      root.add(decal);
    }
  }

  for (const st of STATIONS.filter((s) => s.kind === 'bay')) {
    const bayProxy = new THREE.Mesh(new THREE.BoxGeometry(0.80, 2.20, 0.90), proxyMat);
    bayProxy.position.set(st.anchor.x, 1.10, 0.15);
    bayProxy.userData.stationId = st.id;
    root.add(bayProxy);
    clickProxies.push(bayProxy);
  }

  const waypointGroup = new THREE.Group();
  const wpOuter = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.44, 32),
    new THREE.MeshBasicMaterial({ color: 0x1f6f78, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
  );
  wpOuter.rotation.x = -Math.PI / 2;
  wpOuter.position.y = 0.014;
  const wpInner = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.65, depthWrite: false })
  );
  wpInner.rotation.x = -Math.PI / 2;
  wpInner.position.y = 0.015;
  waypointGroup.add(wpOuter, wpInner);
  root.add(waypointGroup);

  const walkMarkerMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const walkMarker = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.22, 24), walkMarkerMat);
  walkMarker.rotation.x = -Math.PI / 2;
  walkMarker.position.y = 0.016;
  walkMarker.visible = false;
  root.add(walkMarker);

  let walkMarkerTimer = 0;

  function showWalkMarker(x, z) {
    walkMarker.position.set(x, 0.016, z);
    walkMarker.scale.setScalar(1);
    walkMarker.visible = true;
    walkMarkerTimer = 0.85;
  }

  function syncRoomState(sim, recommendedStationId, dt, elapsed) {
    if (!sim) return;

    lockerSuit.visible = !sim.ppe.suit;
    lockerGloves.visible = !sim.ppe.gloves;
    lockerBoots.visible = !sim.ppe.bootsMat;

    keyBoxStatusLedMat.color.setHex(sim.keyBoxLocked ? 0x22c55e : 0xe69f00);
    provingLedMat.color.setHex(sim.ptp.state === 1 ? 0x38bdf8 : sim.ptp.state === 2 ? 0xfacc15 : 0x22c55e);

    if (sim.ptw.active) permitBeaconMat.color.setHex(0x22c55e);
    else if (sim.sft.active) permitBeaconMat.color.setHex(0xf59e0b);
    else permitBeaconMat.color.setHex(0x94a3b8);

    const showGuide = sim.mode !== 'EXAM' && Boolean(recommendedStationId);
    waypointGroup.visible = showGuide;
    if (showGuide) {
      const targetSt = STATIONS.find((s) => s.id === recommendedStationId);
      if (targetSt) {
        waypointGroup.position.x += (targetSt.anchor.x - waypointGroup.position.x) * Math.min(1, dt * 8);
        waypointGroup.position.z += (targetSt.anchor.z - waypointGroup.position.z) * Math.min(1, dt * 8);
        const s = 1 + Math.sin(elapsed * 3.5) * 0.08;
        wpOuter.scale.setScalar(s);
      }
    }

    if (walkMarkerTimer > 0) {
      walkMarkerTimer = Math.max(0, walkMarkerTimer - dt);
      const frac = 1 - walkMarkerTimer / 0.85;
      walkMarker.scale.setScalar(0.8 + frac * 0.7);
      walkMarkerMat.opacity = (1 - frac) * 0.85;
      if (walkMarkerTimer <= 0) walkMarker.visible = false;
    }
  }

  return {
    root,
    clickProxies,
    showWalkMarker,
    syncRoomState,
  };
}
