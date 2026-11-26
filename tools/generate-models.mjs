/**
 * Reproducible zero-DOM glTF 2.0 binary (.glb) asset generator for the
 * 3D Marine 6.6 kV Switchroom Game.
 *
 * Generates self-contained binary .glb props in public/models/:
 *   - watertight-door.glb
 *   - rescue-hook.glb
 *   - co2-extinguisher.glb
 *   - workbench-tools.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/models');

/**
 * Serialize a Three.js Object3D hierarchy (Meshes + Groups) into a valid
 * glTF 2.0 binary (.glb) Buffer with zero browser/DOM APIs required.
 */
export function serializeObject3DToGlb(rootObject) {
  rootObject.updateMatrixWorld(true);

  const bufferParts = [];
  let byteOffset = 0;

  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const materialIndexMap = new Map();
  const meshes = [];
  const nodes = [];

  function appendAlignedBuffer(typedArray, target) {
    const raw = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const pad = (4 - (raw.length % 4)) % 4;
    const viewIndex = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: raw.length,
      ...(target ? { target } : {}),
    });
    bufferParts.push(raw);
    byteOffset += raw.length;
    if (pad > 0) {
      bufferParts.push(Buffer.alloc(pad));
      byteOffset += pad;
    }
    return viewIndex;
  }

  function getOrAddMaterial(mat) {
    const key = `${mat.color?.getHexString?.() || 'ffffff'}_${(mat.metalness ?? 0.2).toFixed(3)}_${(mat.roughness ?? 0.6).toFixed(3)}_${(mat.opacity ?? 1).toFixed(3)}_${Boolean(mat.transparent)}`;
    if (materialIndexMap.has(key)) return materialIndexMap.get(key);
    const c = mat.color || new THREE.Color(0xffffff);
    // Three.js Color stores linear RGB components in modern ColorManagement
    const def = {
      name: mat.name || `mat_${materials.length}`,
      pbrMetallicRoughness: {
        baseColorFactor: [
          Number(c.r.toFixed(5)),
          Number(c.g.toFixed(5)),
          Number(c.b.toFixed(5)),
          Number((mat.opacity ?? 1).toFixed(5)),
        ],
        metallicFactor: Number((mat.metalness ?? 0.2).toFixed(4)),
        roughnessFactor: Number((mat.roughness ?? 0.6).toFixed(4)),
      },
    };
    if (mat.transparent && (mat.opacity ?? 1) < 1) {
      def.alphaMode = 'BLEND';
    }
    if (mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0)) {
      const intensity = mat.emissiveIntensity ?? 1;
      def.emissiveFactor = [
        Number(Math.min(1, mat.emissive.r * intensity).toFixed(5)),
        Number(Math.min(1, mat.emissive.g * intensity).toFixed(5)),
        Number(Math.min(1, mat.emissive.b * intensity).toFixed(5)),
      ];
    }
    const idx = materials.length;
    materials.push(def);
    materialIndexMap.set(key, idx);
    return idx;
  }

  function addGeometryPrimitive(geometry, material) {
    const geo = geometry.index ? geometry : geometry;
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');

    const posArr = new Float32Array(posAttr.count * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = z;
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
    }
    const posView = appendAlignedBuffer(posArr, 34962);
    const posAcc = accessors.length;
    accessors.push({
      bufferView: posView,
      componentType: 5126,
      count: posAttr.count,
      type: 'VEC3',
      min: min.map((v) => Number(v.toFixed(6))),
      max: max.map((v) => Number(v.toFixed(6))),
    });

    const attributes = { POSITION: posAcc };

    if (normAttr) {
      const normArr = new Float32Array(normAttr.count * 3);
      for (let i = 0; i < normAttr.count; i++) {
        normArr[i * 3] = normAttr.getX(i);
        normArr[i * 3 + 1] = normAttr.getY(i);
        normArr[i * 3 + 2] = normAttr.getZ(i);
      }
      const normView = appendAlignedBuffer(normArr, 34962);
      const normAcc = accessors.length;
      accessors.push({
        bufferView: normView,
        componentType: 5126,
        count: normAttr.count,
        type: 'VEC3',
      });
      attributes.NORMAL = normAcc;
    }

    const prim = {
      attributes,
      material: getOrAddMaterial(material || new THREE.MeshStandardMaterial()),
    };

    if (geo.index) {
      const idxAttr = geo.index;
      const useU32 = posAttr.count > 65535;
      const idxArr = useU32 ? new Uint32Array(idxAttr.count) : new Uint16Array(idxAttr.count);
      for (let i = 0; i < idxAttr.count; i++) {
        idxArr[i] = idxAttr.getX(i);
      }
      const idxView = appendAlignedBuffer(idxArr, 34963);
      const idxAcc = accessors.length;
      accessors.push({
        bufferView: idxView,
        componentType: useU32 ? 5125 : 5123,
        count: idxAttr.count,
        type: 'SCALAR',
      });
      prim.indices = idxAcc;
    }

    return prim;
  }

  function visitNode(obj) {
    const nodeIdx = nodes.length;
    const nodeDef = { name: obj.name || `node_${nodeIdx}` };

    if (obj.position.x !== 0 || obj.position.y !== 0 || obj.position.z !== 0) {
      nodeDef.translation = [
        Number(obj.position.x.toFixed(6)),
        Number(obj.position.y.toFixed(6)),
        Number(obj.position.z.toFixed(6)),
      ];
    }
    const q = obj.quaternion;
    if (q.x !== 0 || q.y !== 0 || q.z !== 0 || q.w !== 1) {
      nodeDef.rotation = [
        Number(q.x.toFixed(6)),
        Number(q.y.toFixed(6)),
        Number(q.z.toFixed(6)),
        Number(q.w.toFixed(6)),
      ];
    }
    if (obj.scale.x !== 1 || obj.scale.y !== 1 || obj.scale.z !== 1) {
      nodeDef.scale = [
        Number(obj.scale.x.toFixed(6)),
        Number(obj.scale.y.toFixed(6)),
        Number(obj.scale.z.toFixed(6)),
      ];
    }

    if (obj.isMesh && obj.geometry) {
      const meshIdx = meshes.length;
      meshes.push({
        name: obj.name || `mesh_${meshIdx}`,
        primitives: [addGeometryPrimitive(obj.geometry, obj.material)],
      });
      nodeDef.mesh = meshIdx;
    }

    nodes.push(nodeDef);

    if (obj.children && obj.children.length > 0) {
      const childIndices = [];
      for (const child of obj.children) {
        childIndices.push(visitNode(child));
      }
      nodeDef.children = childIndices;
    }

    return nodeIdx;
  }

  const rootNodeIdx = visitNode(rootObject);
  const binChunkData = Buffer.concat(bufferParts);

  const gltfJson = {
    asset: { version: '2.0', generator: 'marine-hv-switchboard-sim/generate-models' },
    scene: 0,
    scenes: [{ name: rootObject.name || 'Scene', nodes: [rootNodeIdx] }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binChunkData.length }],
  };

  const jsonStr = JSON.stringify(gltfJson);
  const jsonRaw = Buffer.from(jsonStr, 'utf8');
  const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
  const jsonChunkData = jsonPad > 0 ? Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]) : jsonRaw;

  const totalLength = 12 + 8 + jsonChunkData.length + 8 + binChunkData.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunkData.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunkData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, jsonChunkData, binChunkHeader, binChunkData]);
}

function buildWatertightDoorModel() {
  const root = new THREE.Group();
  root.name = 'WatertightBulkheadDoor';

  const frameMat = new THREE.MeshStandardMaterial({ name: 'CoamingSteel', color: 0x46525e, roughness: 0.48, metalness: 0.62 });
  const leafMat = new THREE.MeshStandardMaterial({ name: 'DoorLeafGrey', color: 0xbac4ce, roughness: 0.42, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ name: 'GasketSteel', color: 0x222a32, roughness: 0.65, metalness: 0.45 });
  const brassMat = new THREE.MeshStandardMaterial({ name: 'MarineBrass', color: 0xc89b2b, roughness: 0.28, metalness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ name: 'HazardRed', color: 0xb9372c, roughness: 0.40, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({ name: 'PortholeGlass', color: 0x3b6978, roughness: 0.12, metalness: 0.10, transparent: true, opacity: 0.65 });

  // Raised shipboard sill coaming + perimeter frame (1.12m wide x 2.08m high)
  const coamingBot = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.12), frameMat);
  coamingBot.name = 'SillCoaming';
  coamingBot.position.set(0, 0.07, 0);
  const coamingTop = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.10, 0.12), frameMat);
  coamingTop.position.set(0, 2.13, 0);
  const coamingL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.04, 0.12), frameMat);
  coamingL.position.set(-0.54, 1.08, 0);
  const coamingR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.04, 0.12), frameMat);
  coamingR.position.set(0.54, 1.08, 0);
  root.add(coamingBot, coamingTop, coamingL, coamingR);

  // Heavy watertight door leaf + perimeter compression gasket
  const gasket = new THREE.Mesh(new THREE.BoxGeometry(1.00, 1.94, 0.04), darkMat);
  gasket.position.set(0, 1.09, 0.045);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.96, 1.90, 0.055), leafMat);
  leaf.name = 'DoorLeaf';
  leaf.position.set(0, 1.09, 0.075);
  const hazardStripe = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.09, 0.012), redMat);
  hazardStripe.position.set(0, 1.32, 0.106);
  root.add(gasket, leaf, hazardStripe);

  // Armored inspection porthole
  const portBezel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 12, 24), brassMat);
  portBezel.position.set(0, 1.62, 0.108);
  const portGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.015, 20), glassMat);
  portGlass.rotation.x = Math.PI / 2;
  portGlass.position.set(0, 1.62, 0.104);
  root.add(portBezel, portGlass);

  // Heavy hinges on port (-X) edge
  [0.48, 1.09, 1.70].forEach((hy, idx) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12), darkMat);
    barrel.name = `Hinge_${idx}`;
    barrel.position.set(-0.49, hy, 0.08);
    root.add(barrel);
  });

  // 6 quick-acting watertight dog handles around perimeter + central wheel/lever
  [
    [0.45, 0.44, 0.45],
    [0.45, 1.09, 0.45],
    [0.45, 1.74, 0.45],
    [-0.42, 0.44, -0.45],
    [-0.42, 1.74, -0.45],
  ].forEach(([dx, dy, rotZ], idx) => {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.036, 10), darkMat);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(dx, dy, 0.11);
    const dogArm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.15, 0.018), brassMat);
    dogArm.name = `DogHandle_${idx}`;
    dogArm.position.set(dx, dy - 0.05, 0.128);
    dogArm.rotation.z = rotZ * 0.35;
    root.add(boss, dogArm);
  });

  // Center quick-acting wheel
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 10, 20), darkMat);
  wheelRim.position.set(0.24, 1.04, 0.135);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.05, 12), brassMat);
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.position.set(0.24, 1.04, 0.12);
  for (let s = 0; s < 3; s++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.014, 0.012), darkMat);
    spoke.position.set(0.24, 1.04, 0.135);
    spoke.rotation.z = (s * Math.PI) / 3;
    root.add(spoke);
  }
  root.add(wheelRim, wheelHub);

  return root;
}

function buildRescueHookModel() {
  const root = new THREE.Group();
  root.name = 'HVRescueHook';

  const boardMat = new THREE.MeshStandardMaterial({ name: 'ShadowBoardYellow', color: 0xd9a426, roughness: 0.48, metalness: 0.12 });
  const poleMat = new THREE.MeshStandardMaterial({ name: 'FiberglassPole', color: 0xfacc15, roughness: 0.28, metalness: 0.08 });
  const hookMat = new THREE.MeshStandardMaterial({ name: 'InsulatedHook', color: 0x1e293b, roughness: 0.42, metalness: 0.35 });
  const guardMat = new THREE.MeshStandardMaterial({ name: 'HandGuardRed', color: 0xc8372d, roughness: 0.38, metalness: 0.18 });
  const clipMat = new THREE.MeshStandardMaterial({ name: 'SteelBracket', color: 0x64748b, roughness: 0.40, metalness: 0.72 });

  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.78, 0.022), boardMat);
  backBoard.position.set(0, 0, 0);
  root.add(backBoard);

  [-0.52, 0.38].forEach((by) => {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.065), clipMat);
    clip.position.set(0, by, 0.036);
    root.add(clip);
  });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 1.48, 14), poleMat);
  shaft.position.set(0, -0.06, 0.058);
  const handGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.32, 14), hookMat);
  handGrip.position.set(0, -0.58, 0.058);
  const guardDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.014, 16), guardMat);
  guardDisc.position.set(0, -0.40, 0.058);

  // Shepherd's rescue crook at top
  const crookArc = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.017, 12, 24, Math.PI * 1.35), hookMat);
  crookArc.position.set(-0.115, 0.68, 0.058);
  crookArc.rotation.z = -0.35;
  const crookTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), guardMat);
  crookTip.position.set(-0.205, 0.605, 0.058);

  root.add(shaft, handGrip, guardDisc, crookArc, crookTip);
  return root;
}

function buildCo2ExtinguisherModel() {
  const root = new THREE.Group();
  root.name = 'CO2Extinguisher';

  const redMat = new THREE.MeshStandardMaterial({ name: 'CylinderRed', color: 0xb92b27, roughness: 0.32, metalness: 0.38 });
  const blackMat = new THREE.MeshStandardMaterial({ name: 'DischargeHorn', color: 0x1b222a, roughness: 0.68, metalness: 0.12 });
  const brassMat = new THREE.MeshStandardMaterial({ name: 'ValveBrass', color: 0xd4a024, roughness: 0.28, metalness: 0.86 });
  const bandMat = new THREE.MeshStandardMaterial({ name: 'CO2BlackBand', color: 0x111827, roughness: 0.45, metalness: 0.20 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.54, 18), redMat);
  body.position.set(0, 0, 0.09);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), redMat);
  dome.position.set(0, 0.27, 0.09);
  // CO2 black identification band
  const co2Band = new THREE.Mesh(new THREE.CylinderGeometry(0.0835, 0.0835, 0.11, 18), bandMat);
  co2Band.position.set(0, 0.13, 0.09);

  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.08, 12), brassMat);
  valve.position.set(0, 0.38, 0.09);
  const squeezeLever = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.12), brassMat);
  squeezeLever.position.set(0, 0.42, 0.05);
  squeezeLever.rotation.x = 0.25;

  // Flared CO2 frost-free discharge horn
  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.24, 10), blackMat);
  hose.position.set(0.085, 0.26, 0.09);
  hose.rotation.z = -0.32;
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.016, 0.24, 14), blackMat);
  horn.position.set(0.125, 0.06, 0.09);
  horn.rotation.z = 0.12;

  const wallBracket = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.016), redMat);
  wallBracket.position.set(0, 0.04, 0);

  root.add(wallBracket, body, dome, co2Band, valve, squeezeLever, hose, horn);
  return root;
}

function buildWorkbenchToolsModel() {
  const root = new THREE.Group();
  root.name = 'WorkbenchTools';

  const yellowCaseMat = new THREE.MeshStandardMaterial({ name: 'PelicanYellow', color: 0xeab308, roughness: 0.38, metalness: 0.16 });
  const darkMat = new THREE.MeshStandardMaterial({ name: 'ChassisDark', color: 0x1e293b, roughness: 0.55, metalness: 0.35 });
  const screenMat = new THREE.MeshStandardMaterial({ name: 'MeterLcd', color: 0x14532d, emissive: new THREE.Color(0x22c55e), emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.08 });
  const chromeMat = new THREE.MeshStandardMaterial({ name: 'ChromeVanadium', color: 0xcbd5e1, roughness: 0.24, metalness: 0.88 });
  const insulRedMat = new THREE.MeshStandardMaterial({ name: 'VdeRed', color: 0xdc2626, roughness: 0.45, metalness: 0.12 });
  const copperMat = new THREE.MeshStandardMaterial({ name: 'CopperClamp', color: 0xc87533, roughness: 0.32, metalness: 0.82 });

  // 1. DLRO 100A Micro-Ohmmeter (VCB Contact Resistance Tester)
  const dlroGroup = new THREE.Group();
  dlroGroup.name = 'MicroOhmmeter';
  dlroGroup.position.set(-0.28, 0, 0);
  const dlroBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.26), yellowCaseMat);
  dlroBody.position.set(0, 0.08, 0);
  const dlroPanel = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.22), darkMat);
  dlroPanel.position.set(0, 0.162, 0);
  const dlroLcd = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.075), screenMat);
  dlroLcd.position.set(-0.05, 0.169, -0.03);
  [-0.10, -0.04, 0.04, 0.10].forEach((tx) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.026, 10), copperMat);
    post.position.set(tx, 0.176, 0.065);
    dlroGroup.add(post);
  });
  dlroGroup.add(dlroBody, dlroPanel, dlroLcd);
  root.add(dlroGroup);

  // 2. Calibrated 1000V VDE Insulated Torque Wrench (for BT1 bus-tie M16 bolts)
  const wrenchGroup = new THREE.Group();
  wrenchGroup.name = 'InsulatedTorqueWrench';
  wrenchGroup.position.set(0.18, 0.022, 0.05);
  wrenchGroup.rotation.y = 0.22;
  const wrenchShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 12), chromeMat);
  wrenchShaft.rotation.z = Math.PI / 2;
  const wrenchGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.18, 12), insulRedMat);
  wrenchGrip.rotation.z = Math.PI / 2;
  wrenchGrip.position.set(0.15, 0, 0);
  const ratchetHead = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.024, 14), chromeMat);
  ratchetHead.position.set(-0.22, 0, 0);
  const socketDrive = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.036, 6), darkMat);
  socketDrive.position.set(-0.22, 0.024, 0);
  wrenchGroup.add(wrenchShaft, wrenchGrip, ratchetHead, socketDrive);
  root.add(wrenchGroup);

  // 3. Spare Vacuum Tulip Contact Cluster & Multimeter on ESD pad
  const multimeter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.042, 0.18), yellowCaseMat);
  multimeter.name = 'DigitalMultimeter';
  multimeter.position.set(0.22, 0.021, -0.13);
  multimeter.rotation.y = -0.18;
  const mmScreen = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.008, 0.055), screenMat);
  mmScreen.position.set(0.22, 0.044, -0.16);
  mmScreen.rotation.y = -0.18;

  const spareTulip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.068, 14), copperMat);
  spareTulip.name = 'SpareTulipCluster';
  spareTulip.position.set(0.04, 0.034, -0.12);

  root.add(multimeter, mmScreen, spareTulip);
  return root;
}

/**
 * Build and serialize a rigged humanoid Marine ETO character (.glb) with:
 * - Standard humanoid skeleton (Hips, Spine, Chest, Neck, Head, Left/Right UpperArm/ForeArm/Hand,
 *   Left/Right Thigh/Shin/Foot, plus LeftHandIKTarget & RightHandIKTarget for CCDIKSolver)
 * - SkinnedMesh with JOINTS_0, WEIGHTS_0, COLOR_0 vertex colors
 * - 4 looping glTF AnimationClips: Idle, Walk, Sprint, PushTrolley
 */
export function buildRiggedEngineerGlbBuffer() {
  // Bone definitions: [name, parentIndex, [tx, ty, tz]]
  // Character faces local +Z: anatomical Left is +X, anatomical Right is -X.
  const boneSpecs = [
    ['Hips', -1, [0, 0.90, 0]],
    ['Spine', 0, [0, 0.08, 0]],
    ['Chest', 1, [0, 0.18, 0]],
    ['Neck', 2, [0, 0.25, 0]],
    ['Head', 3, [0, 0.06, 0]],
    ['LeftUpperArm', 2, [0.235, 0.19, 0]],
    ['LeftForeArm', 5, [0, -0.30, 0]],
    ['LeftHand', 6, [0, -0.28, 0]],
    ['RightUpperArm', 2, [-0.235, 0.19, 0]],
    ['RightForeArm', 8, [0, -0.30, 0]],
    ['RightHand', 9, [0, -0.28, 0]],
    ['LeftThigh', 0, [0.10, -0.05, 0]],
    ['LeftShin', 11, [0, -0.40, 0]],
    ['LeftFoot', 12, [0, -0.38, 0.04]],
    ['RightThigh', 0, [-0.10, -0.05, 0]],
    ['RightShin', 14, [0, -0.40, 0]],
    ['RightFoot', 15, [0, -0.38, 0.04]],
    ['RightHandIKTarget', -1, [-0.235, 1.02, 0.36]],
    ['LeftHandIKTarget', -1, [0.235, 1.02, 0.36]],
  ];

  const armature = new THREE.Group();
  armature.name = 'Armature';
  const bones = boneSpecs.map(([name, , pos]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(pos[0], pos[1], pos[2]);
    return b;
  });
  boneSpecs.forEach(([, parentIdx], idx) => {
    if (parentIdx === -1) armature.add(bones[idx]);
    else bones[parentIdx].add(bones[idx]);
  });
  armature.updateMatrixWorld(true);

  const boneIdxByName = Object.fromEntries(boneSpecs.map(([name], i) => [name, i]));

  // Build skinned body sub-parts bound to individual skeleton joints
  const posList = [];
  const normList = [];
  const colorList = [];
  const jointList = [];
  const weightList = [];
  const indexList = [];
  let vertOffset = 0;

  function addSkinnedPart(geometry, boneName, localOffset, hexColor, localScale = [1, 1, 1]) {
    const jIdx = boneIdxByName[boneName];
    const bone = bones[jIdx];
    const geo = geometry.clone();
    geo.scale(localScale[0], localScale[1], localScale[2]);
    geo.translate(localOffset[0], localOffset[1], localOffset[2]);
    geo.applyMatrix4(bone.matrixWorld);

    const pAttr = geo.getAttribute('position');
    const nAttr = geo.getAttribute('normal');
    const c = new THREE.Color(hexColor);

    for (let i = 0; i < pAttr.count; i++) {
      posList.push(pAttr.getX(i), pAttr.getY(i), pAttr.getZ(i));
      normList.push(nAttr.getX(i), nAttr.getY(i), nAttr.getZ(i));
      colorList.push(c.r, c.g, c.b);
      jointList.push(jIdx, 0, 0, 0);
      weightList.push(1, 0, 0, 0);
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indexList.push(vertOffset + geo.index.getX(i));
      }
    } else {
      for (let i = 0; i < pAttr.count; i++) {
        indexList.push(vertOffset + i);
      }
    }
    vertOffset += pAttr.count;
  }

  const NAVY = 0x20354b;
  const HIVIS = 0xe6b830;
  const SKIN = 0xdcb393;
  const BOOT = 0x252b32;
  const VISOR = 0x22303c;

  // Pelvis & Belt
  addSkinnedPart(new THREE.BoxGeometry(0.32, 0.14, 0.20), 'Hips', [0, 0, 0], NAVY);
  addSkinnedPart(new THREE.BoxGeometry(0.35, 0.05, 0.22), 'Spine', [0, 0.02, 0], BOOT);

  // Spine & Chest with FR reflective stripes
  addSkinnedPart(new THREE.BoxGeometry(0.34, 0.18, 0.21), 'Spine', [0, 0.09, 0], NAVY);
  addSkinnedPart(new THREE.BoxGeometry(0.38, 0.28, 0.22), 'Chest', [0, 0.11, 0], NAVY);
  addSkinnedPart(new THREE.BoxGeometry(0.39, 0.042, 0.23), 'Chest', [0, 0.02, 0], HIVIS);
  addSkinnedPart(new THREE.BoxGeometry(0.39, 0.042, 0.23), 'Chest', [0, 0.18, 0], HIVIS);

  // Neck, Head & Safety Glasses
  addSkinnedPart(new THREE.CylinderGeometry(0.055, 0.062, 0.08, 10), 'Neck', [0, 0.02, 0], SKIN);
  addSkinnedPart(new THREE.CylinderGeometry(0.092, 0.086, 0.20, 14), 'Head', [0, 0.10, 0], SKIN);
  addSkinnedPart(new THREE.BoxGeometry(0.16, 0.04, 0.035), 'Head', [0, 0.12, 0.082], VISOR);

  // Left & Right Arms (UpperArm + Reflective Cuff + ForeArm)
  for (const side of ['Left', 'Right']) {
    addSkinnedPart(new THREE.CylinderGeometry(0.056, 0.050, 0.30, 10), `${side}UpperArm`, [0, -0.15, 0], NAVY);
    addSkinnedPart(new THREE.CylinderGeometry(0.053, 0.052, 0.035, 10), `${side}UpperArm`, [0, -0.23, 0], HIVIS);
    addSkinnedPart(new THREE.CylinderGeometry(0.048, 0.042, 0.27, 10), `${side}ForeArm`, [0, -0.135, 0], NAVY);
  }

  // Left & Right Legs + Boots
  for (const side of ['Left', 'Right']) {
    addSkinnedPart(new THREE.CylinderGeometry(0.070, 0.060, 0.40, 10), `${side}Thigh`, [0, -0.20, 0], NAVY);
    addSkinnedPart(new THREE.CylinderGeometry(0.058, 0.050, 0.36, 10), `${side}Shin`, [0, -0.18, 0], NAVY);
    addSkinnedPart(new THREE.CylinderGeometry(0.056, 0.054, 0.035, 10), `${side}Shin`, [0, -0.24, 0], HIVIS);
    addSkinnedPart(new THREE.BoxGeometry(0.125, 0.105, 0.24), `${side}Foot`, [0, -0.01, 0.01], BOOT);
  }

  // Binary buffer packing
  const bufferParts = [];
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];

  function pushBuffer(typedArray, target) {
    const raw = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const pad = (4 - (raw.length % 4)) % 4;
    const viewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: raw.length,
      ...(target ? { target } : {}),
    });
    bufferParts.push(raw);
    byteOffset += raw.length;
    if (pad > 0) {
      bufferParts.push(Buffer.alloc(pad));
      byteOffset += pad;
    }
    return viewIdx;
  }

  const posArr = new Float32Array(posList);
  const minP = [Infinity, Infinity, Infinity];
  const maxP = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertOffset; i++) {
    for (let k = 0; k < 3; k++) {
      const v = posArr[i * 3 + k];
      if (v < minP[k]) minP[k] = v;
      if (v > maxP[k]) maxP[k] = v;
    }
  }
  const posAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(posArr, 34962),
    componentType: 5126,
    count: vertOffset,
    type: 'VEC3',
    min: minP.map((v) => Number(v.toFixed(5))),
    max: maxP.map((v) => Number(v.toFixed(5))),
  });

  const normAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(new Float32Array(normList), 34962),
    componentType: 5126,
    count: vertOffset,
    type: 'VEC3',
  });

  const colAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(new Float32Array(colorList), 34962),
    componentType: 5126,
    count: vertOffset,
    type: 'VEC3',
  });

  const jointsAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(new Uint16Array(jointList)),
    componentType: 5123,
    count: vertOffset,
    type: 'VEC4',
  });

  const weightsAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(new Float32Array(weightList), 34962),
    componentType: 5126,
    count: vertOffset,
    type: 'VEC4',
  });

  const idxAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(new Uint16Array(indexList), 34963),
    componentType: 5123,
    count: indexList.length,
    type: 'SCALAR',
  });

  // Inverse Bind Matrices for all 19 bones
  const ibmArr = new Float32Array(bones.length * 16);
  bones.forEach((b, i) => {
    const inv = b.matrixWorld.clone().invert();
    inv.toArray(ibmArr, i * 16);
  });
  const ibmAcc = accessors.length;
  accessors.push({
    bufferView: pushBuffer(ibmArr),
    componentType: 5126,
    count: bones.length,
    type: 'MAT4',
  });

  // Node layout:
  //   0: Armature (children: [1 (EngineerMesh), 2 (Hips), 19 (RightHandIKTarget), 20 (LeftHandIKTarget)])
  //   1: EngineerSkinnedMesh (mesh: 0, skin: 0)
  //   2..20: bones[0..18] -> bone node index = 2 + boneIdx
  const boneNodeOffset = 2;
  const nodes = [
    {
      name: 'Armature',
      children: [1, boneNodeOffset + 0, boneNodeOffset + 17, boneNodeOffset + 18],
    },
    {
      name: 'EngineerSkinnedMesh',
      mesh: 0,
      skin: 0,
    },
  ];

  boneSpecs.forEach(([name, , pos], bIdx) => {
    const childBoneNodeIds = [];
    boneSpecs.forEach(([, pIdx], cIdx) => {
      if (pIdx === bIdx) childBoneNodeIds.push(boneNodeOffset + cIdx);
    });
    const nodeDef = {
      name,
      translation: pos,
    };
    if (childBoneNodeIds.length > 0) nodeDef.children = childBoneNodeIds;
    nodes.push(nodeDef);
  });

  // Helper to build glTF AnimationClips
  function quatTrack(eulerFrames) {
    const out = new Float32Array(eulerFrames.length * 4);
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    eulerFrames.forEach(([rx, ry, rz], i) => {
      e.set(rx, ry, rz, 'XYZ');
      q.setFromEuler(e);
      out[i * 4] = q.x;
      out[i * 4 + 1] = q.y;
      out[i * 4 + 2] = q.z;
      out[i * 4 + 3] = q.w;
    });
    return out;
  }

  function makeClip(name, times, trackDefs) {
    const tArr = new Float32Array(times);
    const timeAcc = accessors.length;
    accessors.push({
      bufferView: pushBuffer(tArr),
      componentType: 5126,
      count: tArr.length,
      type: 'SCALAR',
      min: [Number(times[0].toFixed(4))],
      max: [Number(times[times.length - 1].toFixed(4))],
    });

    const samplers = [];
    const channels = [];
    for (const tr of trackDefs) {
      const nodeIdx = boneNodeOffset + boneIdxByName[tr.bone];
      const isRot = tr.path === 'rotation';
      const dataArr = isRot ? quatTrack(tr.values) : new Float32Array(tr.values.flat());
      const outAcc = accessors.length;
      accessors.push({
        bufferView: pushBuffer(dataArr),
        componentType: 5126,
        count: times.length,
        type: isRot ? 'VEC4' : 'VEC3',
      });
      const sIdx = samplers.length;
      samplers.push({ input: timeAcc, output: outAcc, interpolation: 'LINEAR' });
      channels.push({ sampler: sIdx, target: { node: nodeIdx, path: tr.path } });
    }
    return { name, samplers, channels };
  }

  // Note on bone Euler signs: character faces +Z, so negative X rotation swings limb forward (+Z)!
  const animations = [
    makeClip('Idle', [0, 1.2, 2.4], [
      { bone: 'Hips', path: 'translation', values: [[0, 0.90, 0], [0, 0.908, 0], [0, 0.90, 0]] },
      { bone: 'Chest', path: 'rotation', values: [[0, 0, 0], [-0.025, 0, 0], [0, 0, 0]] },
      { bone: 'Head', path: 'rotation', values: [[0, -0.04, 0], [0, 0.04, 0], [0, -0.04, 0]] },
      { bone: 'LeftUpperArm', path: 'rotation', values: [[0, 0, -0.08], [0.02, 0, -0.10], [0, 0, -0.08]] },
      { bone: 'RightUpperArm', path: 'rotation', values: [[0, 0, 0.08], [0.02, 0, 0.10], [0, 0, 0.08]] },
      { bone: 'LeftForeArm', path: 'rotation', values: [[-0.12, 0, 0], [-0.15, 0, 0], [-0.12, 0, 0]] },
      { bone: 'RightForeArm', path: 'rotation', values: [[-0.12, 0, 0], [-0.15, 0, 0], [-0.12, 0, 0]] },
    ]),
    makeClip('Walk', [0, 0.24, 0.48, 0.72, 0.96], [
      { bone: 'Hips', path: 'translation', values: [[0, 0.90, 0], [0, 0.928, 0], [0, 0.90, 0], [0, 0.928, 0], [0, 0.90, 0]] },
      { bone: 'Chest', path: 'rotation', values: [[0.05, -0.06, 0], [0.05, 0, 0], [0.05, 0.06, 0], [0.05, 0, 0], [0.05, -0.06, 0]] },
      { bone: 'LeftThigh', path: 'rotation', values: [[-0.46, 0, 0], [0, 0, 0], [0.44, 0, 0], [0, 0, 0], [-0.46, 0, 0]] },
      { bone: 'LeftShin', path: 'rotation', values: [[0.10, 0, 0], [0.15, 0, 0], [0.45, 0, 0], [0.52, 0, 0], [0.10, 0, 0]] },
      { bone: 'RightThigh', path: 'rotation', values: [[0.44, 0, 0], [0, 0, 0], [-0.46, 0, 0], [0, 0, 0], [0.44, 0, 0]] },
      { bone: 'RightShin', path: 'rotation', values: [[0.45, 0, 0], [0.52, 0, 0], [0.10, 0, 0], [0.15, 0, 0], [0.45, 0, 0]] },
      { bone: 'LeftUpperArm', path: 'rotation', values: [[0.36, 0, -0.07], [0, 0, -0.07], [-0.38, 0, -0.07], [0, 0, -0.07], [0.36, 0, -0.07]] },
      { bone: 'RightUpperArm', path: 'rotation', values: [[-0.38, 0, 0.07], [0, 0, 0.07], [0.36, 0, 0.07], [0, 0, 0.07], [-0.38, 0, 0.07]] },
      { bone: 'LeftForeArm', path: 'rotation', values: [[-0.18, 0, 0], [-0.26, 0, 0], [-0.36, 0, 0], [-0.24, 0, 0], [-0.18, 0, 0]] },
      { bone: 'RightForeArm', path: 'rotation', values: [[-0.36, 0, 0], [-0.24, 0, 0], [-0.18, 0, 0], [-0.26, 0, 0], [-0.36, 0, 0]] },
    ]),
    makeClip('Sprint', [0, 0.16, 0.32, 0.48, 0.64], [
      { bone: 'Hips', path: 'translation', values: [[0, 0.89, 0], [0, 0.935, 0], [0, 0.89, 0], [0, 0.935, 0], [0, 0.89, 0]] },
      { bone: 'Chest', path: 'rotation', values: [[0.12, -0.10, 0], [0.12, 0, 0], [0.12, 0.10, 0], [0.12, 0, 0], [0.12, -0.10, 0]] },
      { bone: 'LeftThigh', path: 'rotation', values: [[-0.68, 0, 0], [0, 0, 0], [0.62, 0, 0], [0, 0, 0], [-0.68, 0, 0]] },
      { bone: 'LeftShin', path: 'rotation', values: [[0.14, 0, 0], [0.22, 0, 0], [0.68, 0, 0], [0.78, 0, 0], [0.14, 0, 0]] },
      { bone: 'RightThigh', path: 'rotation', values: [[0.62, 0, 0], [0, 0, 0], [-0.68, 0, 0], [0, 0, 0], [0.62, 0, 0]] },
      { bone: 'RightShin', path: 'rotation', values: [[0.68, 0, 0], [0.78, 0, 0], [0.14, 0, 0], [0.22, 0, 0], [0.68, 0, 0]] },
      { bone: 'LeftUpperArm', path: 'rotation', values: [[0.56, 0, -0.08], [0, 0, -0.08], [-0.62, 0, -0.08], [0, 0, -0.08], [0.56, 0, -0.08]] },
      { bone: 'RightUpperArm', path: 'rotation', values: [[-0.62, 0, 0.08], [0, 0, 0.08], [0.56, 0, 0.08], [0, 0, 0.08], [-0.62, 0, 0.08]] },
      { bone: 'LeftForeArm', path: 'rotation', values: [[-0.45, 0, 0], [-0.55, 0, 0], [-0.72, 0, 0], [-0.55, 0, 0], [-0.45, 0, 0]] },
      { bone: 'RightForeArm', path: 'rotation', values: [[-0.72, 0, 0], [-0.55, 0, 0], [-0.45, 0, 0], [-0.55, 0, 0], [-0.72, 0, 0]] },
    ]),
    makeClip('PushTrolley', [0, 0.23, 0.46, 0.69, 0.92], [
      { bone: 'Hips', path: 'translation', values: [[0, 0.89, 0], [0, 0.912, 0], [0, 0.89, 0], [0, 0.912, 0], [0, 0.89, 0]] },
      { bone: 'Chest', path: 'rotation', values: [[0.15, 0, 0], [0.16, 0, 0], [0.15, 0, 0], [0.16, 0, 0], [0.15, 0, 0]] },
      { bone: 'LeftUpperArm', path: 'rotation', values: [[-1.12, -0.06, -0.05], [-1.12, -0.06, -0.05], [-1.12, -0.06, -0.05], [-1.12, -0.06, -0.05], [-1.12, -0.06, -0.05]] },
      { bone: 'RightUpperArm', path: 'rotation', values: [[-1.12, 0.06, 0.05], [-1.12, 0.06, 0.05], [-1.12, 0.06, 0.05], [-1.12, 0.06, 0.05], [-1.12, 0.06, 0.05]] },
      { bone: 'LeftForeArm', path: 'rotation', values: [[-0.32, 0, 0], [-0.34, 0, 0], [-0.32, 0, 0], [-0.34, 0, 0], [-0.32, 0, 0]] },
      { bone: 'RightForeArm', path: 'rotation', values: [[-0.32, 0, 0], [-0.34, 0, 0], [-0.32, 0, 0], [-0.34, 0, 0], [-0.32, 0, 0]] },
      { bone: 'LeftThigh', path: 'rotation', values: [[-0.40, 0, 0], [0, 0, 0], [0.38, 0, 0], [0, 0, 0], [-0.40, 0, 0]] },
      { bone: 'LeftShin', path: 'rotation', values: [[0.10, 0, 0], [0.15, 0, 0], [0.40, 0, 0], [0.46, 0, 0], [0.10, 0, 0]] },
      { bone: 'RightThigh', path: 'rotation', values: [[0.38, 0, 0], [0, 0, 0], [-0.40, 0, 0], [0, 0, 0], [0.38, 0, 0]] },
      { bone: 'RightShin', path: 'rotation', values: [[0.40, 0, 0], [0.46, 0, 0], [0.10, 0, 0], [0.15, 0, 0], [0.40, 0, 0]] },
    ]),
  ];

  const binChunkData = Buffer.concat(bufferParts);
  const gltfJson = {
    asset: { version: '2.0', generator: 'marine-hv-switchboard-sim/generate-models-rigged' },
    scene: 0,
    scenes: [{ name: 'MarineETORiggedScene', nodes: [0] }],
    nodes,
    meshes: [
      {
        name: 'EngineerBodyMesh',
        primitives: [
          {
            attributes: {
              POSITION: posAcc,
              NORMAL: normAcc,
              COLOR_0: colAcc,
              JOINTS_0: jointsAcc,
              WEIGHTS_0: weightsAcc,
            },
            indices: idxAcc,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'EngineerVertexColorMat',
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.08,
          roughnessFactor: 0.72,
        },
      },
    ],
    skins: [
      {
        name: 'EngineerArmatureSkin',
        inverseBindMatrices: ibmAcc,
        skeleton: boneNodeOffset + 0,
        joints: bones.map((_, i) => boneNodeOffset + i),
      },
    ],
    animations,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binChunkData.length }],
  };

  const jsonRaw = Buffer.from(JSON.stringify(gltfJson), 'utf8');
  const jsonPad = (4 - (jsonRaw.length % 4)) % 4;
  const jsonChunkData = jsonPad > 0 ? Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]) : jsonRaw;

  const totalLength = 12 + 8 + jsonChunkData.length + 8 + binChunkData.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunkData.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binChunkData.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonChunkHeader, jsonChunkData, binChunkHeader, binChunkData]);
}

export function generateAllModels(outDir = OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  const specs = [
    ['watertight-door.glb', buildWatertightDoorModel],
    ['rescue-hook.glb', buildRescueHookModel],
    ['co2-extinguisher.glb', buildCo2ExtinguisherModel],
    ['workbench-tools.glb', buildWorkbenchToolsModel],
  ];

  const written = [];
  for (const [filename, builder] of specs) {
    const model = builder();
    const glb = serializeObject3DToGlb(model);
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, glb);
    written.push({ filename, outPath, bytes: glb.length });
  }

  const engGlb = buildRiggedEngineerGlbBuffer();
  const engPath = path.join(outDir, 'engineer.glb');
  fs.writeFileSync(engPath, engGlb);
  written.push({ filename: 'engineer.glb', outPath: engPath, bytes: engGlb.length });

  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = generateAllModels();
  for (const r of results) {
    console.log(`Generated ${r.filename} (${r.bytes} bytes) -> ${r.outPath}`);
  }
}
