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
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = generateAllModels();
  for (const r of results) {
    console.log(`Generated ${r.filename} (${r.bytes} bytes) -> ${r.outPath}`);
  }
}
