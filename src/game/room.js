import * as THREE from 'three';
import { getSharedGltfLoader, resolvePublicAssetUrl } from './gltf-loader.js';
import { createPbrMaterialLibrary, pbrMapProps } from './materials-pbr.js';
import { STATIONS, BAY_X } from './navigation.js';
import {
  TROLLEY_PARK_POS,
  MAINTENANCE_ZONE_POS,
  TROLLEY_ALIGN_Z,
  findAlignableBay,
} from '../switchboard/trolley.js';

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

function makeFloorDecal(label, accent = '#1f6f78', size = 0.86) {
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

  ctx.fillStyle = 'rgba(24, 34, 44, 0.58)';
  ctx.fillRect(22, 92, 212, 72);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 26px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 128, 196);

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
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.008;
  return mesh;
}

function loadGlbPropInto(loader, url, parentGroup) {
  if (!loader || typeof window === 'undefined') return;
  loader.load(
    url,
    (gltf) => {
      if (!gltf?.scene) return;
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      parentGroup.add(gltf.scene);
    },
    undefined,
    () => {
      // Non-fatal fallback if offline/headless asset fetch is unavailable
    }
  );
}

export function createSwitchroom(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  const pbr = createPbrMaterialLibrary({ size: 128, maxAnisotropy: maxAniso });
  const root = new THREE.Group();
  root.name = 'HVSwitchroom';

  const clickProxies = [];

  // Marine checkerplate steel deck textures (albedo + tangent-space normalMap & roughnessMap)
  const deckTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#4e5964';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3f4953';
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.fillStyle = '#606d7a';
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
    13,
    12,
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
    16,
    1,
    maxAniso
  );

  const wallTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#dde3ea';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8592a0';
      ctx.fillRect(0, h * 0.78, w, h * 0.22);
      ctx.fillStyle = '#1f6f78';
      ctx.fillRect(0, h * 0.76, w, h * 0.025);
      ctx.strokeStyle = '#c1cbd5';
      ctx.lineWidth = 2;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    },
    5,
    1,
    maxAniso
  );

  const deckMat = new THREE.MeshStandardMaterial({
    map: deckTex,
    ...pbrMapProps(pbr.checkerplate, { normalScale: 0.92, roughnessMultiplier: 1.0 }),
    metalness: 0.34,
    envMapIntensity: 1.12,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    ...pbrMapProps(pbr.bulkheadWall, { normalScale: 0.46, roughnessMultiplier: 1.0 }),
    metalness: 0.14,
  });
  const steelDarkMat = new THREE.MeshStandardMaterial({
    color: 0x333c46,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.36, roughnessMultiplier: 1.12 }),
    metalness: 0.62,
    envMapIntensity: 1.15,
  });
  const steelFrameMat = new THREE.MeshStandardMaterial({
    color: 0x5d6875,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.34, roughnessMultiplier: 1.0 }),
    metalness: 0.56,
    envMapIntensity: 1.12,
  });
  const galvTrayMat = new THREE.MeshStandardMaterial({
    color: 0x8d9aa6,
    ...pbrMapProps(pbr.brushedSteel, { normalScale: 0.42, roughnessMultiplier: 1.18 }),
    metalness: 0.78,
    envMapIntensity: 1.28,
  });
  const hvacDuctMat = new THREE.MeshStandardMaterial({
    color: 0xaab4be,
    ...pbrMapProps(pbr.brushedSteel, { normalScale: 0.34, roughnessMultiplier: 1.22 }),
    metalness: 0.66,
    envMapIntensity: 1.18,
  });
  const hvCableRedMat = new THREE.MeshStandardMaterial({
    color: 0x9e2a25,
    ...pbrMapProps(pbr.rubberEsd, { normalScale: 0.32, roughnessMultiplier: 0.78 }),
    metalness: 0.08,
  });
  const tealLockerMat = new THREE.MeshStandardMaterial({
    color: 0x265c66,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.34, roughnessMultiplier: 1.04 }),
    metalness: 0.28,
  });
  const esdGreenMat = new THREE.MeshStandardMaterial({
    color: 0x1e5641,
    ...pbrMapProps(pbr.rubberEsd, { normalScale: 0.48, roughnessMultiplier: 0.94 }),
    metalness: 0.05,
  });
  const deskWoodMat = new THREE.MeshStandardMaterial({
    color: 0x8f7a62,
    ...pbrMapProps(pbr.laminatedWood, { normalScale: 0.40, roughnessMultiplier: 1.08 }),
    metalness: 0.04,
  });
  const safetyYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd9a426,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.30, roughnessMultiplier: 0.94 }),
    metalness: 0.16,
  });
  const redBoxMat = new THREE.MeshStandardMaterial({
    color: 0xb9372c,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.32, roughnessMultiplier: 0.94 }),
    metalness: 0.28,
  });
  const greenKitMat = new THREE.MeshStandardMaterial({
    color: 0x1f7a4c,
    ...pbrMapProps(pbr.powderCoat, { normalScale: 0.30, roughnessMultiplier: 0.94 }),
    metalness: 0.22,
  });

  // Expanded 10.4 m x 9.6 m walkable shipboard switchroom deck (x in [-5.2..5.2], z in [-2.8..6.8])
  const ROOM_W = 10.55;
  const ROOM_D = 9.75;
  const ROOM_CENTER_Z = 2.0;
  const H = 3.45;

  const deckMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), deckMat);
  deckMesh.rotation.x = -Math.PI / 2;
  deckMesh.position.set(0, -0.006, ROOM_CENTER_Z);
  deckMesh.receiveShadow = true;
  deckMesh.userData.walkFloor = true;
  root.add(deckMesh);
  clickProxies.push(deckMesh);

  // Front & Rear HV Arc-Flash Boundary Strips + Corridor Safety Lines
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazardTex,
    roughness: 0.65,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const frontHazardStrip = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 0.13), hazardMat);
  frontHazardStrip.rotation.x = -Math.PI / 2;
  frontHazardStrip.position.set(0, 0.002, 1.32);

  const rearHazardStrip = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 0.13), hazardMat);
  rearHazardStrip.rotation.x = -Math.PI / 2;
  rearHazardStrip.position.set(0, 0.002, -1.06);
  root.add(frontHazardStrip, rearHazardStrip);

  const corridorLineMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  for (const cx of [-2.85, 2.85]) {
    const corrStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.55), corridorLineMat);
    corrStripe.rotation.x = -Math.PI / 2;
    corrStripe.position.set(cx, 0.003, 0.05);
    root.add(corrStripe);
  }

  // Marine Bulkhead Walls + Vertical T-Bar Stiffeners
  const wallGeoSide = new THREE.BoxGeometry(0.14, H, ROOM_D);
  const portWall = new THREE.Mesh(wallGeoSide, wallMat);
  portWall.position.set(-5.20, H / 2, ROOM_CENTER_Z);
  portWall.receiveShadow = true;

  const stbdWall = new THREE.Mesh(wallGeoSide, wallMat);
  stbdWall.position.set(5.20, H / 2, ROOM_CENTER_Z);
  stbdWall.receiveShadow = true;

  const wallGeoFrontBack = new THREE.BoxGeometry(ROOM_W, H, 0.14);
  const fwdWall = new THREE.Mesh(wallGeoFrontBack, wallMat);
  fwdWall.position.set(0, H / 2, -2.80);
  fwdWall.receiveShadow = true;

  const aftWall = new THREE.Mesh(wallGeoFrontBack, wallMat);
  aftWall.position.set(0, H / 2, 6.80);
  aftWall.receiveShadow = true;
  root.add(portWall, stbdWall, fwdWall, aftWall);

  // Structural bulkhead stiffener ribs
  const ribGeoZ = new THREE.BoxGeometry(0.08, H - 0.12, 0.08);
  for (const sz of [-1.6, 0.4, 2.4, 4.4, 6.0]) {
    const pRib = new THREE.Mesh(ribGeoZ, steelFrameMat);
    pRib.position.set(-5.11, H / 2, sz);
    const sRib = new THREE.Mesh(ribGeoZ, steelFrameMat);
    sRib.position.set(5.11, H / 2, sz);
    root.add(pRib, sRib);
  }
  for (const sx of [-3.8, -1.9, 1.9, 3.8]) {
    const fRib = new THREE.Mesh(ribGeoZ, steelFrameMat);
    fRib.position.set(sx, H / 2, -2.71);
    const aRib = new THREE.Mesh(ribGeoZ, steelFrameMat);
    aRib.position.set(sx, H / 2, 6.71);
    root.add(fRib, aRib);
  }

  // Bulkhead Safety & Zone Signage
  const mainSign = makeSignMesh(
    3.6,
    0.42,
    '6.6 kV HIGH-VOLTAGE SWITCHBOARD ROOM',
    'DANGER · AUTHORIZED ETO PERSONNEL ONLY · 40 CAL/CM² PPE',
    '#b9372c'
  );
  mainSign.position.set(0, 2.88, -2.71);
  root.add(mainSign);

  const rearAisleSign = makeSignMesh(
    2.65,
    0.32,
    'REAR BUSBAR, CT & BUS-TIE AISLE',
    'ISOLATE & CLOSE EK6 EARTH BEFORE UNBOLTING REAR COVERS',
    '#d4a024'
  );
  rearAisleSign.position.set(0, 2.34, -2.71);
  root.add(rearAisleSign);

  // Overhead Deckhead Beams, Marine LED Battens, Cable Ladder Trays & HVAC Ducting
  const ceilingGroup = new THREE.Group();
  const beamGeo = new THREE.BoxGeometry(10.3, 0.13, 0.14);
  const lampHousingGeo = new THREE.BoxGeometry(1.55, 0.06, 0.18);
  const lampTubeMat = new THREE.MeshBasicMaterial({ color: 0xf7fbff });
  const lampTubeGeo = new THREE.BoxGeometry(1.46, 0.026, 0.10);

  for (const bz of [-2.1, -0.3, 1.5, 3.5, 5.5]) {
    const beam = new THREE.Mesh(beamGeo, steelFrameMat);
    beam.position.set(0, H - 0.08, bz);
    ceilingGroup.add(beam);
  }

  for (const lx of [-3.1, 0, 3.1]) {
    for (const lz of [-1.75, 1.45, 4.45]) {
      const housing = new THREE.Mesh(lampHousingGeo, steelDarkMat);
      housing.position.set(lx, H - 0.17, lz);
      const tube = new THREE.Mesh(lampTubeGeo, lampTubeMat);
      tube.position.set(lx, H - 0.20, lz);
      ceilingGroup.add(housing, tube);
    }
  }

  // Overhead Galvanized Cable Ladder Trays + 6.6 kV Armored XLPE Feeder Runs + Bulkhead MCTs
  const trayGroup = new THREE.Group();
  trayGroup.name = 'OverheadCableTrays';
  const mainTrayY = 2.78;
  // Longitudinal header tray above switchboard rear
  for (const railZ of [-0.62, -0.22]) {
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(4.40, 0.055, 0.024), galvTrayMat);
    sideRail.position.set(0, mainTrayY, railZ);
    trayGroup.add(sideRail);
  }
  for (let rx = -2.10; rx <= 2.12; rx += 0.28) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.40), galvTrayMat);
    rung.position.set(rx, mainTrayY - 0.018, -0.42);
    trayGroup.add(rung);
  }
  // Riser ladders + armored 6.6 kV feeder cables from C1..C5 roofs up to header tray & forward MCTs
  for (const cubId of ['DG1', 'BT1', 'BT-M1', 'TR1-HV', 'ACB-TR1-LV']) {
    const bx = BAY_X[cubId];
    const roofY = cubId === 'ACB-TR1-LV' ? 2.06 : 2.20;
    const riserH = mainTrayY - roofY;
    const glandCollar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.16), steelDarkMat);
    glandCollar.position.set(bx, roofY + 0.025, -0.42);
    trayGroup.add(glandCollar);

    for (const cxOff of [-0.09, 0.0, 0.09]) {
      const vertCable = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, riserH, 10), hvCableRedMat);
      vertCable.position.set(bx + cxOff, roofY + riserH / 2, -0.42);
      const runToBulkhead = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 2.34, 10), hvCableRedMat);
      runToBulkhead.rotation.x = Math.PI / 2;
      runToBulkhead.position.set(bx + cxOff, mainTrayY + 0.025, -1.59);
      trayGroup.add(vertCable, runToBulkhead);
    }

    // Forward bulkhead Multi-Cable Transit (MCT) frame
    const mctFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.08), steelDarkMat);
    mctFrame.position.set(bx, mainTrayY + 0.02, -2.72);
    trayGroup.add(mctFrame);
  }
  // Transverse bridge trays carrying feeders from switchboard to forward bulkhead MCTs
  for (const bx of [-1.68, 0.0, 1.68]) {
    for (const sOff of [-0.18, 0.18]) {
      const bridgeRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 2.32), galvTrayMat);
      bridgeRail.position.set(bx + sOff, mainTrayY, -1.58);
      trayGroup.add(bridgeRail);
    }
    for (let rz = -2.62; rz <= -0.60; rz += 0.32) {
      const bRung = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.016, 0.022), galvTrayMat);
      bRung.position.set(bx, mainTrayY - 0.018, rz);
      trayGroup.add(bRung);
    }
  }
  ceilingGroup.add(trayGroup);

  // Overhead Galvanized HVAC Supply Ventilation Trunking + Diffuser Grilles
  const hvacGroup = new THREE.Group();
  hvacGroup.name = 'VentilationTrunking';
  const mainDuct = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.24, 0.34), hvacDuctMat);
  mainDuct.position.set(0, 3.06, 2.55);
  hvacGroup.add(mainDuct);
  for (const fx of [-3.6, -1.8, 0.0, 1.8, 3.6]) {
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.27, 0.37), steelFrameMat);
    flange.position.set(fx, 3.06, 2.55);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.22), steelDarkMat);
    grille.position.set(fx + 0.65, 2.935, 2.55);
    hvacGroup.add(flange, grille);
  }
  ceilingGroup.add(hvacGroup);
  root.add(ceilingGroup);

  // Port Bulkhead: HV PPE Locker
  const ppeGroup = new THREE.Group();
  ppeGroup.position.set(-4.82, 0, 2.95);
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

  // Port-Forward: VCB Diagnostic & Troubleshooting Workbench + GLB Instruments
  const vcbBenchGroup = new THREE.Group();
  vcbBenchGroup.name = 'VCBDiagnosticWorkbench';
  vcbBenchGroup.position.set(-4.80, 0, -0.35);
  vcbBenchGroup.rotation.y = Math.PI / 2;

  const wbTop = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.07, 0.68), steelFrameMat);
  wbTop.position.set(0, 0.90, 0);
  wbTop.castShadow = true;
  wbTop.receiveShadow = true;
  const wbEsdMat = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.012, 0.54), esdGreenMat);
  wbEsdMat.position.set(0, 0.94, 0.02);
  const wbShelf = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.04, 0.56), steelDarkMat);
  wbShelf.position.set(0, 0.28, 0);
  const wbBackboard = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.92, 0.05), steelDarkMat);
  wbBackboard.position.set(0, 1.42, -0.30);
  const wbSign = makeSignMesh(1.48, 0.28, 'VCB DIAGNOSTIC WORKBENCH', '100A MICRO-OHMMETER · TULIP GAUGE · VDE TORQUE', '#22c55e');
  wbSign.position.set(0, 2.12, -0.26);
  vcbBenchGroup.add(wbTop, wbEsdMat, wbShelf, wbBackboard, wbSign);
  for (const lx of [-0.68, 0.68]) {
    for (const lz of [-0.27, 0.27]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, 0.06), steelDarkMat);
      leg.position.set(lx, 0.44, lz);
      vcbBenchGroup.add(leg);
    }
  }
  const wbToolsMount = new THREE.Group();
  wbToolsMount.position.set(0, 0.946, 0.04);
  vcbBenchGroup.add(wbToolsMount);
  root.add(vcbBenchGroup);

  // Port-Aft: Key Box & Tool Board
  const keysGroup = new THREE.Group();
  keysGroup.position.set(-2.78, 0, 6.18);
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

  // Starboard-Aft: Proving Unit & 5 kV Megger Bench
  const testGroup = new THREE.Group();
  testGroup.position.set(2.78, 0, 6.18);
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

  // Starboard Bulkhead: Permit Desk
  const permitGroup = new THREE.Group();
  permitGroup.position.set(4.82, 0, 2.95);
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

  // Aft Bulkhead Entry & Emergency Safety Station (.glb Watertight Door, Rescue Hook, CO2 Extinguisher + First-Aid Kit)
  const aftDoorMount = new THREE.Group();
  aftDoorMount.name = 'WatertightDoorMount';
  aftDoorMount.position.set(0, 0, 6.72);
  aftDoorMount.rotation.y = Math.PI;
  const doorSign = makeSignMesh(1.18, 0.22, 'WATERTIGHT BULKHEAD DOOR', 'KEEP DOGGED AT SEA · 6.6 kV HV ROOM', '#b9372c');
  doorSign.position.set(0, 2.40, 0.02);
  aftDoorMount.add(doorSign);
  root.add(aftDoorMount);

  const rescueHookMount = new THREE.Group();
  rescueHookMount.name = 'RescueHookMount';
  rescueHookMount.position.set(-1.12, 1.32, 6.71);
  rescueHookMount.rotation.y = Math.PI;
  const hookSign = makeSignMesh(0.62, 0.16, '45 kV RESCUE HOOK', 'EMERGENCY RELEASE', '#d4a024');
  hookSign.position.set(0, 1.06, 0.02);
  rescueHookMount.add(hookSign);
  root.add(rescueHookMount);

  const co2Mount = new THREE.Group();
  co2Mount.name = 'CO2ExtinguisherMount';
  co2Mount.position.set(1.06, 0.96, 6.71);
  co2Mount.rotation.y = Math.PI;
  const co2Sign = makeSignMesh(0.58, 0.16, 'CO2 FIRE POINT', 'LIVE HV SAFE', '#b9372c');
  co2Sign.position.set(0, 0.62, 0.02);
  co2Mount.add(co2Sign);
  root.add(co2Mount);

  const firstAidGroup = new THREE.Group();
  firstAidGroup.position.set(1.06, 2.02, 6.70);
  firstAidGroup.rotation.y = Math.PI;
  const faBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.14), greenKitMat);
  faBox.castShadow = true;
  const faCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.012), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  faCrossH.position.set(0, 0, 0.072);
  const faCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.012), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
  faCrossV.position.set(0, 0, 0.072);
  firstAidGroup.add(faBox, faCrossH, faCrossV);
  root.add(firstAidGroup);

  // Load binary .glb models from public/models/
  if (typeof window !== 'undefined') {
    const loader = getSharedGltfLoader();
    loadGlbPropInto(loader, resolvePublicAssetUrl('models/watertight-door.glb'), aftDoorMount);
    loadGlbPropInto(loader, resolvePublicAssetUrl('models/rescue-hook.glb'), rescueHookMount);
    loadGlbPropInto(loader, resolvePublicAssetUrl('models/co2-extinguisher.glb'), co2Mount);
    loadGlbPropInto(loader, resolvePublicAssetUrl('models/workbench-tools.glb'), wbToolsMount);
  }

  // Click proxies & painted floor decals for all stations
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const stationProxySpecs = [
    { id: 'station:ppe', pos: [-4.80, 1.15, 2.95], size: [0.85, 2.3, 1.55], decal: 'PPE', accent: '#d4a024' },
    { id: 'station:vcb-bench', pos: [-4.80, 1.15, -0.35], size: [0.85, 2.2, 1.60], decal: 'WORKBENCH', accent: '#22c55e' },
    { id: 'station:keys', pos: [-2.78, 1.15, 6.15], size: [1.65, 2.3, 0.85], decal: 'KEYS', accent: '#1f6f78' },
    { id: 'station:test', pos: [2.78, 1.15, 6.15], size: [1.65, 2.3, 0.85], decal: 'TEST', accent: '#d4a024' },
    { id: 'station:permit', pos: [4.80, 1.15, 2.95], size: [0.85, 2.3, 1.55], decal: 'PTW', accent: '#1f6f78' },
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
    const bayProxy = new THREE.Mesh(new THREE.BoxGeometry(0.80, 2.20, 0.65), proxyMat);
    bayProxy.position.set(st.anchor.x, 1.10, 0.25);
    bayProxy.userData.stationId = st.id;
    root.add(bayProxy);
    clickProxies.push(bayProxy);
  }

  for (const st of STATIONS.filter((s) => s.kind === 'rear-bay')) {
    const rearProxy = new THREE.Mesh(new THREE.BoxGeometry(0.80, 2.20, 0.55), proxyMat);
    rearProxy.position.set(st.anchor.x, 1.10, -0.45);
    rearProxy.userData.stationId = st.id;
    root.add(rearProxy);
    clickProxies.push(rearProxy);

    const rearDecal = makeFloorDecal(st.code, '#55669a', 0.68);
    rearDecal.position.set(st.anchor.x, 0.008, st.anchor.z);
    root.add(rearDecal);
  }

  // Dedicated Trolley Park Bay (Starboard-Forward) & VCB Maintenance Bay (Port-Forward)
  const trolleyParkDecal = makeFloorDecal('TROLLEY', '#d4a024');
  trolleyParkDecal.scale.set(1.25, 1.25, 1);
  trolleyParkDecal.position.set(TROLLEY_PARK_POS.x, 0.008, TROLLEY_PARK_POS.z);
  root.add(trolleyParkDecal);

  const maintBayDecal = makeFloorDecal('VCB MAINT', '#22c55e');
  maintBayDecal.scale.set(1.35, 1.35, 1);
  maintBayDecal.position.set(MAINTENANCE_ZONE_POS.x, 0.008, MAINTENANCE_ZONE_POS.z);
  root.add(maintBayDecal);

  const wheelStopGeo = new THREE.BoxGeometry(0.78, 0.036, 0.065);
  const wheelStopMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.85, metalness: 0.08 });
  const parkStop = new THREE.Mesh(wheelStopGeo, wheelStopMat);
  parkStop.position.set(TROLLEY_PARK_POS.x, 0.018, TROLLEY_PARK_POS.z - 0.50);
  const maintStop = new THREE.Mesh(wheelStopGeo, wheelStopMat);
  maintStop.position.set(MAINTENANCE_ZONE_POS.x, 0.018, MAINTENANCE_ZONE_POS.z - 0.50);
  root.add(parkStop, maintStop);

  const maintSign = makeSignMesh(1.48, 0.30, 'VCB MAINTENANCE BAY', 'WITHDRAWN 6.6 kV BREAKER INSPECTION ZONE', '#22c55e');
  maintSign.position.set(MAINTENANCE_ZONE_POS.x, 2.34, -2.71);
  root.add(maintSign);

  // Dynamic green floor guide rail box shown when pushing trolley near an open HV bay
  const alignGuideGroup = new THREE.Group();
  const alignMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const alignFrameL = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.76), alignMat);
  alignFrameL.rotation.x = -Math.PI / 2;
  alignFrameL.position.set(-0.34, 0.016, 0);
  const alignFrameR = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.76), alignMat);
  alignFrameR.rotation.x = -Math.PI / 2;
  alignFrameR.position.set(0.34, 0.016, 0);
  const alignFrameF = new THREE.Mesh(new THREE.PlaneGeometry(0.73, 0.05), alignMat);
  alignFrameF.rotation.x = -Math.PI / 2;
  alignFrameF.position.set(0, 0.016, -0.36);
  alignGuideGroup.add(alignFrameL, alignFrameR, alignFrameF);
  alignGuideGroup.visible = false;
  root.add(alignGuideGroup);

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
      let targetAnchor = null;
      if (recommendedStationId === 'station:trolley' && sim.trolley) {
        targetAnchor = { x: sim.trolley.x, z: sim.trolley.z };
      } else {
        const targetSt = STATIONS.find((s) => s.id === recommendedStationId);
        if (targetSt) targetAnchor = targetSt.anchor;
      }
      if (targetAnchor) {
        waypointGroup.position.x += (targetAnchor.x - waypointGroup.position.x) * Math.min(1, dt * 8);
        waypointGroup.position.z += (targetAnchor.z - waypointGroup.position.z) * Math.min(1, dt * 8);
        const s = 1 + Math.sin(elapsed * 3.5) * 0.08;
        wpOuter.scale.setScalar(s);
      }
    }

    const alignCandidate = sim.trolley?.state === 'PUSHING' ? findAlignableBay(sim.trolley, sim) : null;
    alignGuideGroup.visible = Boolean(alignCandidate);
    if (alignCandidate) {
      alignGuideGroup.position.set(alignCandidate.bayX, 0, TROLLEY_ALIGN_Z);
      alignMat.opacity = 0.55 + Math.sin(elapsed * 6) * 0.25;
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
