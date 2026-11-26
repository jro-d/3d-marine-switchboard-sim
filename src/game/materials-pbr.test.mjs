import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  createNormalMapFromHeightData,
  createRoughnessMapFromData,
  createPbrMaterialLibrary,
  pbrMapProps,
} from './materials-pbr.js';
import { createDracoGltfLoader, resolvePublicAssetUrl } from './gltf-loader.js';
import {
  GRAPHICS_QUALITY_HIGH,
  GRAPHICS_QUALITY_STANDARD,
  normalizeGraphicsQuality,
} from './postprocessing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../../public');

test('createNormalMapFromHeightData encodes flat and sloped tangent-space normals in linear color space', () => {
  const flat = new Float32Array(16).fill(0.5);
  const flatTex = createNormalMapFromHeightData(flat, 4, 4, { strength: 2.0 });
  assert.equal(flatTex.colorSpace, THREE.NoColorSpace);
  assert.equal(flatTex.wrapS, THREE.RepeatWrapping);
  assert.equal(flatTex.wrapT, THREE.RepeatWrapping);
  const fd = flatTex.image.data;
  assert.equal(fd[0], 128);
  assert.equal(fd[1], 128);
  assert.equal(fd[2], 255);
  assert.equal(fd[3], 255);

  // Sloped ramp along +X should tilt normal toward -X (R < 128) while keeping unit length
  const ramp = new Float32Array(16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ramp[y * 4 + x] = x / 3;
    }
  }
  const rampTex = createNormalMapFromHeightData(ramp, 4, 4, { strength: 1.5 });
  const rd = rampTex.image.data;
  const centerIdx = (1 * 4 + 1) * 4;
  assert.ok(rd[centerIdx] < 120, `Expected tilted -X normal R < 120, got ${rd[centerIdx]}`);
  const nx = (rd[centerIdx] / 255) * 2 - 1;
  const ny = (rd[centerIdx + 1] / 255) * 2 - 1;
  const nz = (rd[centerIdx + 2] / 255) * 2 - 1;
  assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 0.04, 'Encoded tangent-space normal should be near unit length');
  flatTex.dispose();
  rampTex.dispose();
});

test('createRoughnessMapFromData maps [0..1] roughness to linear grayscale RGBA', () => {
  const data = new Float32Array([0.0, 0.5, 1.0, 0.25]);
  const tex = createRoughnessMapFromData(data, 2, 2);
  assert.equal(tex.colorSpace, THREE.NoColorSpace);
  const buf = tex.image.data;
  assert.equal(buf[0], 0);
  assert.equal(buf[4], 128);
  assert.equal(buf[8], 255);
  assert.equal(buf[12], 64);
  tex.dispose();
});

test('createPbrMaterialLibrary generates all 8 marine industrial PBR surface sets with varied normals and roughness', () => {
  const lib = createPbrMaterialLibrary({ size: 32, maxAnisotropy: 4 });
  const expectedKeys = [
    'powderCoat',
    'brushedSteel',
    'checkerplate',
    'bulkheadWall',
    'laminatedWood',
    'rubberEsd',
    'castResin',
    'copperBus',
  ];

  for (const key of expectedKeys) {
    const entry = lib[key];
    assert.ok(entry?.normalMap?.isDataTexture, `${key}.normalMap should be a DataTexture`);
    assert.ok(entry?.roughnessMap?.isDataTexture, `${key}.roughnessMap should be a DataTexture`);
    assert.equal(entry.normalMap.colorSpace, THREE.NoColorSpace);
    assert.equal(entry.roughnessMap.colorSpace, THREE.NoColorSpace);

    // Ensure non-flat texture variance
    const nBuf = entry.normalMap.image.data;
    const rBuf = entry.roughnessMap.image.data;
    let minR = 255;
    let maxR = 0;
    let variedNormal = false;
    for (let i = 0; i < rBuf.length; i += 4) {
      if (rBuf[i] < minR) minR = rBuf[i];
      if (rBuf[i] > maxR) maxR = rBuf[i];
      if (Math.abs(nBuf[i] - 128) > 3 || Math.abs(nBuf[i + 1] - 128) > 3) {
        variedNormal = true;
      }
    }
    assert.ok(variedNormal, `${key}.normalMap should contain tangent-space surface detail`);
    assert.ok(maxR - minR >= 8, `${key}.roughnessMap should have spatial roughness variation (got ${maxR - minR})`);

    const props = pbrMapProps(entry);
    assert.equal(props.normalMap, entry.normalMap);
    assert.equal(props.roughnessMap, entry.roughnessMap);
    assert.ok(props.normalScale instanceof THREE.Vector2);
  }

  lib.dispose();
});

test('gltf-loader helper, graphics quality normalizer, and bundled Draco + HDR assets are valid', () => {
  assert.equal(resolvePublicAssetUrl('draco/'), './draco/');
  assert.equal(resolvePublicAssetUrl('/env/switchroom_studio.hdr'), './env/switchroom_studio.hdr');

  const loader = createDracoGltfLoader({ enableDraco: false });
  assert.ok(typeof loader.parse === 'function');

  assert.equal(normalizeGraphicsQuality('high'), GRAPHICS_QUALITY_HIGH);
  assert.equal(normalizeGraphicsQuality('standard'), GRAPHICS_QUALITY_STANDARD);
  assert.equal(normalizeGraphicsQuality('unknown'), GRAPHICS_QUALITY_HIGH);

  for (const name of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
    const p = path.join(PUBLIC_DIR, 'draco', name);
    assert.equal(fs.existsSync(p), true, `Missing bundled Draco decoder file: ${name}`);
    assert.ok(fs.statSync(p).size > 10_000, `Unexpectedly small Draco file: ${name}`);
  }

  const hdrPath = path.join(PUBLIC_DIR, 'env', 'switchroom_studio.hdr');
  assert.equal(fs.existsSync(hdrPath), true, 'Missing Blender-rendered switchroom_studio.hdr');
  const hdrHeader = fs.readFileSync(hdrPath).subarray(0, 10).toString('ascii');
  assert.equal(hdrHeader, '#?RADIANCE');
});
