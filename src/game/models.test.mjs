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
