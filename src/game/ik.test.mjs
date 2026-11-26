import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createEngineerCharacter } from './character.js';
import {
  computeChoreographedTipTarget,
  computeMicroStepPose,
  resolveActionSocketMeta,
} from './ik.js';
import { PLAYER_RADIUS, resolveCollision } from './navigation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINEER_GLB = path.resolve(__dirname, '../../public/models/engineer.glb');

function parseGlbAsync(loader, arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });
}

const REPRESENTATIVE_SOCKETS = [
  { id: 'tripBtn', pos: new THREE.Vector3(-0.02, 0.96, 0.418), anim: 'push_button', tool: 'none' },
  { id: 'closeBtn', pos: new THREE.Vector3(-0.12, 0.96, 0.418), anim: 'push_button', tool: 'none' },
  { id: 'rackPort', pos: new THREE.Vector3(0.0, 0.68, 0.420), anim: 'rack_crank', tool: 'racking_handle' },
  { id: 'castellVcb', pos: new THREE.Vector3(-0.14, 0.70, 0.428), anim: 'turn_key', tool: 'castell_key' },
  { id: 'ek6Socket', pos: new THREE.Vector3(-0.22, 0.432, 0.592), anim: 'pull_lever', tool: 'none' },
  { id: 'doorHandle', pos: new THREE.Vector3(0.32, 0.99, 0.606), anim: 'open_door', tool: 'none' },
  { id: 'rearDoorHandle', pos: new THREE.Vector3(-0.50, 0.64, -0.673), anim: 'open_door', tool: 'none' },
  { id: 'shutterPadlock', pos: new THREE.Vector3(0.24, 1.20, 0.34), anim: 'turn_key', tool: 'padlock' },
  { id: 'L1', pos: new THREE.Vector3(-0.19, 0.36, 0.48), anim: 'probe_wand', tool: 'proving_wand' },
  { id: 'L2', pos: new THREE.Vector3(0.0, 0.36, 0.48), anim: 'probe_wand', tool: 'proving_wand' },
  { id: 'L3', pos: new THREE.Vector3(0.19, 0.36, 0.48), anim: 'probe_wand', tool: 'proving_wand' },
  { id: 'PE', pos: new THREE.Vector3(-0.24, 0.25, 0.47), anim: 'probe_wand', tool: 'cme_stick' },
];

test('resolveActionSocketMeta maps every switchboard action to its exact bay socketId', () => {
  const sim = {
    cubicles: {
      'TR1-HV': { requiredEarthKeys: ['K-HV', 'K-LV'] },
    },
  };
  assert.deepEqual(resolveActionSocketMeta({ exec: 'tripVcb', arg: 'BT-M1' }, sim), { cubId: 'BT-M1', socketId: 'tripBtn' });
  assert.deepEqual(resolveActionSocketMeta({ exec: 'rackOut', arg: 'BT-M1' }, sim), { cubId: 'BT-M1', socketId: 'rackPort' });
  assert.deepEqual(
    resolveActionSocketMeta({ exec: 'toggleEarthKey', arg: { cubId: 'TR1-HV', keyId: 'K-LV' } }, sim),
    { cubId: 'TR1-HV', socketId: 'earthKey2' }
  );
  assert.deepEqual(
    resolveActionSocketMeta({ exec: 'probePhase', arg: { cubId: 'BT-M1', phase: 'L3' } }, sim),
    { cubId: 'BT-M1', socketId: 'L3' }
  );
  assert.deepEqual(resolveActionSocketMeta({ exec: 'toggleRearDoor', arg: 'BT1' }, sim), {
    cubId: 'BT1',
    socketId: 'rearDoorHandle',
  });
  assert.deepEqual(resolveActionSocketMeta({ exec: 'torqueRearBolt', arg: 'BT1' }, sim), {
    cubId: 'BT1',
    socketId: 'rearBusTieBolt',
  });
});

test('rigged engineer.glb + CCDIKSolver aligns finger and tool tips within < 2.5 cm of all 3D sockets', async () => {
  const buf = fs.readFileSync(ENGINEER_GLB);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await parseGlbAsync(new GLTFLoader(), ab);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.08, 120);
  const character = createEngineerCharacter({ autoLoadGlb: false });
  scene.add(character.root);
  scene.add(camera);
  camera.add(character.fpGroup);

  assert.equal(character.attachLoadedEngineerGltf(gltf), true);
  assert.equal(character.isRiggedGlbActive(), true);

  for (const spec of REPRESENTATIVE_SOCKETS) {
    const isRear = spec.id === 'rearDoorHandle';
    const micro = computeMicroStepPose({
      socketWorldPos: spec.pos,
      socketId: spec.id,
      toolId: spec.tool,
    });
    const stand = resolveCollision(micro.x, micro.z, PLAYER_RADIUS);

    character.root.position.set(stand.x, 0, stand.z);
    character.root.rotation.y = micro.faceYaw;
    character.setHeldTool(spec.tool);

    camera.position.set(stand.x, 1.62, stand.z);
    camera.lookAt(spec.pos);
    camera.updateMatrixWorld(true);

    const anim = {
      type: spec.anim,
      tool: spec.tool,
      elapsed: 0.50,
      duration: 1.0,
      socketWorldPos: spec.pos.clone(),
      isRear,
    };

    character.updatePose({
      speed: 0,
      walkCycle: 0,
      elapsed: 1.0,
      dt: 0.016,
      anim,
      pushingTrolley: false,
      camera,
      characterYaw: micro.faceYaw,
    });

    const { tipWorldPos: expectedTip } = computeChoreographedTipTarget({
      socketWorldPos: spec.pos,
      isRear,
      animType: spec.anim,
      progress: 0.50,
    });

    const rigTip = character.getActiveTipWorldPosition(false);
    const rigErr = rigTip.distanceTo(expectedTip);
    assert.ok(
      rigErr < 0.025,
      `Rigged 3rd-person tip for ${spec.id} (${spec.tool}) should be within 2.5 cm of choreographed socket target (got ${(rigErr * 100).toFixed(2)} cm)`
    );

    const fpTip = character.getActiveTipWorldPosition(true);
    const fpErr = fpTip.distanceTo(expectedTip);
    assert.ok(
      fpErr < 0.015,
      `1st-person tip for ${spec.id} (${spec.tool}) should be within 1.5 cm of choreographed socket target (got ${(fpErr * 100).toFixed(2)} cm)`
    );
  }
});

test('procedural fallback character rig also aligns finger and tool tips within < 2.0 cm of all sockets', () => {
  const scene = new THREE.Scene();
  const character = createEngineerCharacter({ autoLoadGlb: false });
  scene.add(character.root);
  assert.equal(character.isRiggedGlbActive(), false);

  for (const spec of REPRESENTATIVE_SOCKETS) {
    const isRear = spec.id === 'rearDoorHandle';
    const micro = computeMicroStepPose({
      socketWorldPos: spec.pos,
      socketId: spec.id,
      toolId: spec.tool,
    });
    const stand = resolveCollision(micro.x, micro.z, PLAYER_RADIUS);

    character.root.position.set(stand.x, 0, stand.z);
    character.root.rotation.y = micro.faceYaw;
    character.setHeldTool(spec.tool);

    character.updatePose({
      speed: 0,
      walkCycle: 0,
      elapsed: 1.0,
      dt: 0.016,
      anim: {
        type: spec.anim,
        tool: spec.tool,
        elapsed: 0.50,
        duration: 1.0,
        socketWorldPos: spec.pos.clone(),
        isRear,
      },
      characterYaw: micro.faceYaw,
    });

    const { tipWorldPos: expectedTip } = computeChoreographedTipTarget({
      socketWorldPos: spec.pos,
      isRear,
      animType: spec.anim,
      progress: 0.50,
    });

    const procTip = character.getActiveTipWorldPosition(false);
    const err = procTip.distanceTo(expectedTip);
    assert.ok(
      err < 0.02,
      `Procedural fallback tip for ${spec.id} (${spec.tool}) should be within 2.0 cm (got ${(err * 100).toFixed(2)} cm)`
    );
  }
});
