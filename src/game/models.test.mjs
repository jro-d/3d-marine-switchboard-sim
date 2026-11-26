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
