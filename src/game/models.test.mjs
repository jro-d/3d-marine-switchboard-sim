import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '../../public/models');

const EXPECTED_GLBS = [
  'watertight-door.glb',
  'rescue-hook.glb',
  'co2-extinguisher.glb',
  'workbench-tools.glb',
];

const EXPECTED_DRACO_ROOM_GLBS = [
  { file: 'ppe-locker.glb', requiredNodes: ['PpeLockerSuit', 'PpeLockerGloves', 'PpeLockerBoots'] },
  { file: 'permit-desk.glb', requiredNodes: ['PermitDeskAssembly'] },
  { file: 'test-bench.glb', requiredNodes: ['TestBenchAssembly'] },
  { file: 'key-board.glb', requiredNodes: ['KeyBoardAssembly'] },
  { file: 'vcb-workbench.glb', requiredNodes: ['VcbWorkbenchAssembly'] },
  { file: 'room-architecture.glb', requiredNodes: ['RoomArchitectureDetails'] },
];

function readGlbJson(buf) {
  assert.equal(buf.readUInt32LE(0), 0x46546c67, 'Expected glTF magic header');
  assert.equal(buf.readUInt32LE(4), 2, 'Expected glTF 2.0');
  const jsonLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  assert.equal(chunkType, 0x4e4f534a, 'First GLB chunk must be JSON');
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

function parseGlbAsync(loader, arrayBuffer) {
  if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
  if (typeof globalThis.createImageBitmap === 'undefined') {
    globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
  }
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });
}

test('all binary .glb switchroom props exist and parse cleanly via Three.js GLTFLoader', async () => {
  const loader = new GLTFLoader();

  for (const file of EXPECTED_GLBS) {
    const fullPath = path.join(MODELS_DIR, file);
    assert.equal(fs.existsSync(fullPath), true, `Expected ${file} in public/models/`);

    const buf = fs.readFileSync(fullPath);
    assert.ok(buf.length > 512, `${file} should be non-trivial binary GLB`);
    assert.equal(buf.readUInt32LE(0), 0x46546c67, `${file} should have 'glTF' magic header`);
    assert.equal(buf.readUInt32LE(4), 2, `${file} should target glTF 2.0`);

    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const gltf = await parseGlbAsync(loader, ab);
    assert.ok(gltf?.scene, `${file} should parse into a Three.js Scene/Group`);

    let meshCount = 0;
    gltf.scene.traverse((child) => {
      if (child.isMesh) meshCount++;
    });
    assert.ok(meshCount >= 3, `${file} should contain multiple 3D mesh primitives (got ${meshCount})`);
  }
});

test('rigged engineer.glb parses into high-poly multi-bone SkinnedMesh with humanoid skeleton, embedded PPE, and 4 AnimationClips', async () => {
  const loader = new GLTFLoader();
  const fullPath = path.join(MODELS_DIR, 'engineer.glb');
  assert.equal(fs.existsSync(fullPath), true, 'Expected engineer.glb in public/models/');

  const buf = fs.readFileSync(fullPath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await parseGlbAsync(loader, ab);

  const skinned = gltf.scene.getObjectByProperty('isSkinnedMesh', true);
  assert.ok(skinned, 'engineer.glb must contain a SkinnedMesh');

  let totalTris = 0;
  let multiBoneVerts = 0;
  gltf.scene.traverse((child) => {
    if (!child.isSkinnedMesh) return;
    const g = child.geometry;
    totalTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const sw = g.attributes.skinWeight;
    if (sw) {
      for (let i = 0; i < sw.count; i++) {
        let nonZero = 0;
        if (sw.getX(i) > 0.01) nonZero++;
        if (sw.getY(i) > 0.01) nonZero++;
        if (sw.getZ(i) > 0.01) nonZero++;
        if (sw.getW(i) > 0.01) nonZero++;
        if (nonZero >= 2) multiBoneVerts++;
      }
    }
  });
  assert.ok(totalTris >= 15000, `Expected high-poly Blender engineer >= 15,000 tris (got ${totalTris})`);
  assert.ok(multiBoneVerts >= 500, `Expected smooth multi-bone linear-blend skinning at joints (got ${multiBoneVerts} blended verts)`);

  for (const ppeNode of [
    'EngineerBodyMesh',
    'EngineerHardHat',
    'EngineerArcHood',
    'EngineerArcSuitCoat',
    'EngineerLeftBareHand',
    'EngineerRightBareHand',
    'EngineerLeftHvGlove',
    'EngineerRightHvGlove',
    'EngineerLeftHvSole',
    'EngineerRightHvSole',
  ]) {
    assert.ok(gltf.scene.getObjectByName(ppeNode), `Expected embedded high-poly node ${ppeNode} in engineer.glb`);
  }

  const boneNames = skinned.skeleton.bones.map((b) => b.name);
  for (const reqBone of [
    'Hips',
    'Spine',
    'Chest',
    'Neck',
    'Head',
    'LeftUpperArm',
    'LeftForeArm',
    'LeftHand',
    'RightUpperArm',
    'RightForeArm',
    'RightHand',
    'LeftThigh',
    'LeftShin',
    'RightThigh',
    'RightShin',
    'RightHandIKTarget',
  ]) {
    assert.equal(boneNames.includes(reqBone), true, `Expected bone ${reqBone} in engineer.glb skeleton`);
  }

  const clipNames = (gltf.animations || []).map((a) => a.name);
  assert.deepEqual(clipNames, ['Idle', 'Walk', 'Sprint', 'PushTrolley']);
});

test('all 6 high-poly Blender Draco room station and architecture GLBs are valid glTF 2.0 with PBR materials and >= 40k tris total', () => {
  let grandTris = 0;

  for (const spec of EXPECTED_DRACO_ROOM_GLBS) {
    const fullPath = path.join(MODELS_DIR, spec.file);
    assert.equal(fs.existsSync(fullPath), true, `Missing ${spec.file} in public/models/`);
    const buf = fs.readFileSync(fullPath);
    assert.ok(buf.length > 20_000, `${spec.file} should be a non-trivial Draco GLB (got ${buf.length} bytes)`);

    const json = readGlbJson(buf);
    assert.equal(
      (json.extensionsUsed || []).includes('KHR_draco_mesh_compression'),
      true,
      `${spec.file} should use KHR_draco_mesh_compression`
    );
    assert.ok((json.materials || []).length >= 5, `${spec.file} should contain multiple PBR materials`);

    const nodeNames = (json.nodes || []).map((n) => n.name);
    for (const reqNode of spec.requiredNodes) {
      assert.equal(nodeNames.includes(reqNode), true, `Expected node ${reqNode} in ${spec.file}`);
    }

    let assetTris = 0;
    for (const mesh of json.meshes || []) {
      for (const prim of mesh.primitives || []) {
        if (typeof prim.indices === 'number') {
          assetTris += (json.accessors[prim.indices]?.count || 0) / 3;
        }
      }
    }
    assert.ok(assetTris >= 3000, `Expected high-poly mesh >= 3,000 tris in ${spec.file} (got ${assetTris})`);
    grandTris += assetTris;
  }

  assert.ok(grandTris >= 40000, `Expected >= 40,000 total room station + architecture tris (got ${grandTris})`);
});
