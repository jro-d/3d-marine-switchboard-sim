import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createAudioEngine } from './sim/audio.js';
import { createSimState, getTopology } from './sim/state.js';
import { createSimActions } from './sim/interlocks.js';
import { getLotoSteps, initMission } from './sim/missions.js';
import { buildSwitchboard } from './switchboard/switchboard.js';
import { initSwitchroomGame } from './game/controller.js';
import { initHud } from './ui/hud.js';

function bootstrap() {
  const stageWrap = document.getElementById('stage3DWrap');
  const canvasHost = document.getElementById('threeCanvasHost');
  if (!stageWrap || !canvasHost) {
    throw new Error('Missing #stage3DWrap or #threeCanvasHost in DOM');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a1019');

  const initW = Math.max(1, stageWrap.clientWidth || window.innerWidth);
  const initH = Math.max(1, stageWrap.clientHeight || window.innerHeight);

  const camera = new THREE.PerspectiveCamera(62, initW / initH, 0.08, 120);
  camera.position.set(0, 1.65, 3.6);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initW, initH);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  canvasHost.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.65;

  const hemiLight = new THREE.HemisphereLight(0xd9e8ff, 0x1c2533, 0.72);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.55);
  keyLight.position.set(4.5, 6.2, 5.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -7.5;
  keyLight.shadow.camera.right = 7.5;
  keyLight.shadow.camera.top = 7.5;
  keyLight.shadow.camera.bottom = -5.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x98b9ea, 0.55);
  fillLight.position.set(-5.0, 3.2, 3.0);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.62);
  rimLight.position.set(0.5, 3.6, -4.8);
  scene.add(rimLight);

  const audio = createAudioEngine();
  const sim = createSimState();
  const switchboard = buildSwitchboard(scene, renderer);

  let hud = null;
  let gameController = null;

  const actions = createSimActions(sim, {
    audio,
    onRender: () => {
      hud?.render();
      gameController?.refreshHud(true);
    },
    onLog: (cat, msg, isErr) => hud?.logEvent(cat, msg, isErr),
    onViolation: (title, reason, pts, modalTitle, modalHtml, cubId) => {
      switchboard.triggerArcFlash(cubId || sim.selectedCubicle);
      hud?.handleViolation(title, reason, pts, modalTitle, modalHtml);
    },
    onFocusCubicle: () => {
      // Walkable 3D camera determines view framing
    },
  });

  function applyMission(id, isReset = false) {
    initMission(sim, id, {
      onLog: (cat, msg, isErr) => hud?.logEvent(cat, msg, isErr),
      onRender: () => hud?.render(),
      onReset: () => gameController?.onMissionReset?.(),
    });
    hud?.render();
    if (isReset) gameController?.refreshHud(true);
  }

  hud = initHud({
    sim,
    actions,
    audio,
    onSwitchMission: (id) => applyMission(id, false),
    onResetMission: () => applyMission(sim.mission, true),
  });

  gameController = initSwitchroomGame({
    scene,
    camera,
    renderer,
    stageWrap,
    switchboardMeshes: switchboard.allRegisteredMeshes,
    interactiveMeshes: switchboard.interactiveMeshes,
    trolleyHitMesh: switchboard.trolleyHitMesh,
    getControlSocket: switchboard.getControlSocket,
    getSim: () => sim,
    getTopology: () => getTopology(sim),
    getLotoSteps: () => getLotoSteps(sim),
    actions,
    audio,
    logEvent: (cat, msg, isErr) => hud.logEvent(cat, msg, isErr),
    renderAll: () => hud.render(),
    openPtwModal: () => hud.openPtwModal(),
  });

  applyMission(1, false);

  function syncViewportSize() {
    const w = Math.max(1, stageWrap.clientWidth || window.innerWidth);
    const h = Math.max(1, stageWrap.clientHeight || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(syncViewportSize).observe(stageWrap);
  }
  window.addEventListener('resize', syncViewportSize);

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    const topo = getTopology(sim);
    switchboard.syncSwitchboard(sim, topo, dt);
    gameController.tick(dt);

    const shake = switchboard.getShakeOffset(dt);
    const hasShake = Boolean(shake && (shake.x !== 0 || shake.y !== 0 || shake.z !== 0));
    if (hasShake) camera.position.add(shake);
    renderer.render(scene, camera);
    if (hasShake) camera.position.sub(shake);
  }
  requestAnimationFrame(animate);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
