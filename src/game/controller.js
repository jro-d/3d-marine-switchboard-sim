import * as THREE from 'three';
import {
  getStationById,
  normalizeAngle,
  stepPlayerMovement,
  findNearestInteractable,
  getRecommendedTarget,
  getStationActions,
  isFullPpeState,
} from './navigation.js';
import { createSwitchroom } from './room.js';
import { createEngineerCharacter } from './character.js';
import { createInteractionManager } from './interaction.js';

const TOOL_LABELS = {
  none: 'Hands free',
  racking_handle: 'Racking Crank',
  castell_key: 'Castell Key',
  padlock: 'LOTO Padlock',
  proving_wand: '6.6 kV Proving Wand',
  megger_leads: '5 kV Megger Leads',
  cme_stick: 'CME Earth Hot-Stick',
  ptw_clipboard: 'PTW Clipboard',
};

const HOTKEY_TOOLS = {
  1: 'HAND',
  2: 'CRANK',
  3: 'EARTH_LEVER',
  4: 'PADLOCK',
  5: 'TAG_DANGER',
  6: 'TAG_EARTH',
  7: 'HV_TESTER',
  8: 'PORTABLE_EARTH',
  9: 'MEGGER',
  0: 'TAG_SFT',
};

const SIM_TO_GAME_TOOL = {
  HAND: 'none',
  CRANK: 'racking_handle',
  EARTH_LEVER: 'castell_key',
  PADLOCK: 'padlock',
  TAG_DANGER: 'ptw_clipboard',
  TAG_EARTH: 'ptw_clipboard',
  HV_TESTER: 'proving_wand',
  VOLTAGE_TESTER: 'proving_wand',
  PORTABLE_EARTH: 'cme_stick',
  MEGGER: 'megger_leads',
  TAG_SFT: 'ptw_clipboard',
};

const _camGoalPos = new THREE.Vector3();
const _camGoalLook = new THREE.Vector3();
const _camCurLook = new THREE.Vector3(0, 1.25, 0);
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

/**
 * Initializes the Playable 3D Engineer Switchroom Game.
 */
export function initSwitchroomGame(bridge) {
  const {
    scene,
    camera,
    renderer,
    stageWrap,
    switchboardMeshes = [],
    interactiveMeshes = [],
    getControlSocket = null,
    getSim,
    getTopology,
    getLotoSteps,
    actions: simActions,
    audio,
    logEvent,
    renderAll,
    openPtwModal,
  } = bridge;

  const room = createSwitchroom(renderer);
  const character = createEngineerCharacter();

  scene.add(room.root);
  scene.add(character.root);
  camera.add(character.fpGroup);
  if (!camera.parent) scene.add(camera);

  const game = {
    cameraMode: 'third',
    camYaw: Math.PI,
    camPitch: 0.24,
    camDist: 2.85,
    heldTool: 'none',
    dockCollapsed: false,
    nearbyStation: null,
    player: {
      x: 0.0,
      z: 3.10,
      yaw: Math.PI,
      speed: 0,
      walkCycle: 0,
      targetPoint: null,
      pendingStationId: null,
      isBusy: false,
    },
    activeAnim: null,
    input: {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
    },
    drag: {
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
    },
    elapsed: 0,
    lastHudKey: '',
    pointer: {
      x: 0,
      y: 0,
      ndcX: 0,
      ndcY: 0,
      inside: false,
    },
  };

  character.root.position.set(game.player.x, 0, game.player.z);
  character.root.rotation.y = game.player.yaw;

  const hud = document.createElement('div');
  hud.id = 'hvGameHud';
  hud.setAttribute('data-testid', 'game-hud');
  hud.innerHTML = `
    <div class="game-objective-card" role="region" aria-label="Mission objective">
      <div class="game-obj-head">
        <span class="game-obj-kicker" id="gameObjStep">Mission 01 · Step 0 / 6</span>
        <span class="game-obj-meta" id="gameObjMode">Training Mode</span>
      </div>
      <p class="game-obj-text" id="gameObjHint">Walk to the Port PPE Locker to don 40 cal/cm² PPE.</p>
      <div class="game-obj-row">
        <span class="game-ppe-readout" id="gamePpeStatus">PPE: 0/3 · Tool: Hands free</span>
        <button type="button" class="game-dock-btn" id="btnWalkToNext">Walk to Target</button>
      </div>
    </div>

    <div class="game-busy-bar" id="gameBusyBar" hidden aria-live="polite">
      <div class="game-busy-label">
        <span id="gameBusyText">Performing action...</span>
        <span id="gameBusyPct">0%</span>
      </div>
      <div class="game-busy-track"><div class="game-busy-fill" id="gameBusyFill"></div></div>
    </div>

    <div class="game-fp-reticle" id="gameFpReticle" hidden aria-hidden="true"></div>

    <div class="game-action-panel" id="gameActionPanel" hidden role="region" aria-label="Nearby station actions">
      <div class="game-station-head">
        <span class="game-station-title" id="gameStationTitle">Station</span>
        <span class="game-station-state" id="gameStationState"></span>
      </div>
      <div class="game-action-list" id="gameActionList"></div>
    </div>

    <div class="game-dock-wrap" id="gameDockWrap">
      <button type="button" class="game-dock-toggle" id="btnToggleGameDock" aria-expanded="true">▾ Hide Controls [H]</button>
      <div class="game-bottom-dock" role="toolbar" aria-label="Switchroom game controls">
        <div class="game-dock-group">
          <button type="button" class="game-dock-btn active" id="btnCamThird" aria-pressed="true">3rd Person</button>
          <button type="button" class="game-dock-btn" id="btnCamFirst" aria-pressed="false">1st Person [V]</button>
        </div>
        <span class="game-dock-sep" aria-hidden="true"></span>
        <div class="game-dock-group" aria-label="Walk to room station">
          <button type="button" class="game-dock-btn" data-walk-station="station:ppe">PPE Locker</button>
          <button type="button" class="game-dock-btn" data-walk-station="station:keys">Key Board</button>
          <button type="button" class="game-dock-btn" data-walk-station="station:test">Test Bench</button>
          <button type="button" class="game-dock-btn" data-walk-station="station:permit">Permit Desk</button>
        </div>
        <span class="game-dock-sep" aria-hidden="true"></span>
        <div class="game-dock-group" aria-label="Walk to switchboard bay">
          <button type="button" class="game-dock-btn" data-walk-station="bay:DG1">C1</button>
          <button type="button" class="game-dock-btn" data-walk-station="bay:BT1">C2</button>
          <button type="button" class="game-dock-btn" data-walk-station="bay:BT-M1">C3</button>
          <button type="button" class="game-dock-btn" data-walk-station="bay:TR1-HV">C4</button>
          <button type="button" class="game-dock-btn" data-walk-station="bay:ACB-TR1-LV">C5</button>
        </div>
        <span class="game-dock-sep" aria-hidden="true"></span>
        <span class="game-dock-meta">WASD · Click · Drag · E</span>
      </div>
    </div>
  `;
  stageWrap.appendChild(hud);

  const elObjStep = hud.querySelector('#gameObjStep');
  const elObjMode = hud.querySelector('#gameObjMode');
  const elObjHint = hud.querySelector('#gameObjHint');
  const elPpeStatus = hud.querySelector('#gamePpeStatus');
  const btnWalkToNext = hud.querySelector('#btnWalkToNext');
  const elBusyBar = hud.querySelector('#gameBusyBar');
  const elBusyText = hud.querySelector('#gameBusyText');
  const elBusyPct = hud.querySelector('#gameBusyPct');
  const elBusyFill = hud.querySelector('#gameBusyFill');
  const elFpReticle = hud.querySelector('#gameFpReticle');
  const elActionPanel = hud.querySelector('#gameActionPanel');
  const elStationTitle = hud.querySelector('#gameStationTitle');
  const elStationState = hud.querySelector('#gameStationState');
  const elActionList = hud.querySelector('#gameActionList');
  const elDockWrap = hud.querySelector('#gameDockWrap');
  const btnToggleDock = hud.querySelector('#btnToggleGameDock');
  const btnCamThird = hud.querySelector('#btnCamThird');
  const btnCamFirst = hud.querySelector('#btnCamFirst');

  const interaction = createInteractionManager({
    camera,
    domEl: renderer.domElement,
    hudRoot: hud,
    interactiveMeshes,
    getSim,
    getTopology,
    getCameraMode: () => game.cameraMode,
    getPlayerPos: () => game.player,
    isBusy: () => Boolean(game.activeAnim) || game.drag.moved,
  });

  function setCameraMode(mode) {
    game.cameraMode = mode === 'first' ? 'first' : 'third';
    const isFirst = game.cameraMode === 'first';
    character.setFirstPersonMode(isFirst);
    elFpReticle.hidden = !isFirst;
    btnCamThird.classList.toggle('active', !isFirst);
    btnCamThird.setAttribute('aria-pressed', String(!isFirst));
    btnCamFirst.classList.toggle('active', isFirst);
    btnCamFirst.setAttribute('aria-pressed', String(isFirst));
    document.body.dataset.cameraMode = game.cameraMode;
    if (isFirst) {
      game.camYaw = game.player.yaw;
      game.camPitch = 0.28;
    } else {
      game.camPitch = 0.24;
    }
  }

  function snapCameraImmediate() {
    if (game.cameraMode === 'first') {
      camera.position.set(game.player.x, 1.62, game.player.z);
      _camCurLook.set(
        game.player.x + Math.sin(game.camYaw) * 2.0,
        1.62 - Math.sin(game.camPitch) * 2.0,
        game.player.z + Math.cos(game.camYaw) * 2.0
      );
      camera.lookAt(_camCurLook);
    } else {
      const dist = game.camDist;
      camera.position.set(
        game.player.x - Math.sin(game.camYaw) * dist * Math.cos(game.camPitch),
        1.48 + Math.sin(game.camPitch) * dist,
        game.player.z - Math.cos(game.camYaw) * dist * Math.cos(game.camPitch)
      );
      _camCurLook.set(game.player.x, 1.32, game.player.z);
      camera.lookAt(_camCurLook);
    }
  }

  function walkToStation(stationId) {
    const st = getStationById(stationId);
    if (!st || game.activeAnim) return;
    game.player.targetPoint = { x: st.anchor.x, z: st.anchor.z, faceYaw: st.faceYaw };
    game.player.pendingStationId = st.id;
    room.showWalkMarker(st.anchor.x, st.anchor.z);
    if (st.kind === 'bay' && st.cubId) {
      simActions.selectCubicle(st.cubId);
    }
  }

  function executeBridgeAction(action) {
    const sim = getSim();
    const prevScore = sim.score;

    switch (action.exec) {
      case 'donAllPpe':
        sim.ppe = { suit: true, glovesAirTested: true, gloves: true, bootsMat: true };
        audio.playPiezo(false);
        logEvent('ETO donned full 40 cal/cm² PPE, air-tested Class 2 gloves & deployed 15 kV mat.', 'safe');
        renderAll();
        break;
      case 'rollTestGloves':
        sim.ppe.glovesAirTested = true;
        audio.playPiezo(false);
        logEvent('Class 2 HV gloves pneumatic roll air-test passed at PPE Locker.', 'safe');
        renderAll();
        break;
      case 'toggleSuit':
        sim.ppe.suit = !sim.ppe.suit;
        audio.playRatchet();
        renderAll();
        break;
      case 'toggleGloves':
        if (!sim.ppe.glovesAirTested && !sim.ppe.gloves) {
          simActions.triggerViolation(5, 'Donned Gloves Without Air-Test', 'Perform pneumatic roll air-test first.');
        } else {
          sim.ppe.gloves = !sim.ppe.gloves;
          audio.playRatchet();
          renderAll();
        }
        break;
      case 'toggleBootsMat':
        sim.ppe.bootsMat = !sim.ppe.bootsMat;
        audio.playClunk(90);
        renderAll();
        break;
      case 'toggleKeyBox':
        simActions.toggleSafetyKeyBox();
        break;
      case 'equipTool':
        game.heldTool = action.arg || 'none';
        character.setHeldTool(game.heldTool);
        audio.playRatchet();
        break;
      case 'equipSimTool':
        sim.activeTool = action.arg || 'HAND';
        game.heldTool = action.tool || 'cme_stick';
        character.setHeldTool(game.heldTool);
        audio.playRatchet();
        renderAll();
        break;
      case 'proveUnit':
        sim.activeTool = 'HV_TESTER';
        simActions.proveTesterOnUnit();
        break;
      case 'connectMegger':
        simActions.connectMegger();
        break;
      case 'runMegger':
        simActions.runMegger();
        break;
      case 'dischargeMegger':
        simActions.dischargeMegger();
        break;
      case 'issuePTW':
        simActions.issuePTW();
        break;
      case 'cancelPTW':
        simActions.cancelPTW();
        break;
      case 'issueSFT':
        simActions.issueSFT();
        break;
      case 'cancelSFT':
        simActions.cancelSFT();
        break;
      case 'openPtwModal':
        openPtwModal();
        break;
      case 'tripVcb':
        simActions.pressTripVCB(action.arg);
        break;
      case 'closeVcb':
        simActions.pressCloseVCB(action.arg);
        break;
      case 'rackOut':
        simActions.rackVCB(action.arg, -10);
        break;
      case 'rackIn':
        simActions.rackVCB(action.arg, 10);
        break;
      case 'toggleRackingPadlock':
        simActions.toggleRackingPadlock(action.arg);
        break;
      case 'toggleCastellVcb':
        simActions.toggleCastellVCBLock(action.arg);
        break;
      case 'toggleEarthKey':
        simActions.toggleEarthSwitchKey(action.arg.cubId, action.arg.keyId);
        break;
      case 'toggleEarthSwitch':
        simActions.toggleIntegralEarthSwitch(action.arg);
        break;
      case 'toggleEarthPadlock':
        simActions.toggleEarthPadlock(action.arg);
        break;
      case 'toggleDoor':
        simActions.toggleDoor3D(action.arg);
        break;
      case 'toggleShutterPadlock':
        simActions.toggleShutterPadlock(action.arg);
        break;
      case 'probePhase':
        sim.activeTool = 'HV_TESTER';
        simActions.interactTerminal(action.arg.cubId, action.arg.phase);
        break;
      case 'cmeTerminal':
        sim.activeTool = 'PORTABLE_EARTH';
        simActions.interactTerminal(action.arg.cubId, action.arg.phase);
        break;
      case 'applyCme':
        sim.activeTool = 'PORTABLE_EARTH';
        simActions.interactTerminal(action.arg, 'PE');
        simActions.interactTerminal(action.arg, 'L1');
        simActions.interactTerminal(action.arg, 'L2');
        simActions.interactTerminal(action.arg, 'L3');
        break;
      case 'removeCme':
        sim.activeTool = 'PORTABLE_EARTH';
        simActions.interactTerminal(action.arg, 'L1');
        simActions.interactTerminal(action.arg, 'L2');
        simActions.interactTerminal(action.arg, 'L3');
        simActions.interactTerminal(action.arg, 'PE');
        break;
    }

    if (sim.score < prevScore) {
      game.activeAnim = {
        type: 'recoil',
        label: 'Interlock Blocked — Step Back',
        tool: 'none',
        elapsed: 0,
        duration: 0.72,
        commitAt: 2,
        committed: true,
        onCommit: null,
      };
      character.setHeldTool('none');
    }
  }

  function startAnimatedAction(action, station) {
    if (!action || game.activeAnim) return;
    if (station) {
      game.player.yaw = station.faceYaw;
      if (station.kind === 'bay' && station.cubId) {
        simActions.selectCubicle(station.cubId);
      }
    }

    game.player.targetPoint = null;
    game.player.isBusy = true;
    game.heldTool = action.tool || 'none';
    character.setHeldTool(game.heldTool);

    game.activeAnim = {
      type: action.anim || 'push_button',
      label: action.label,
      tool: game.heldTool,
      elapsed: 0,
      duration: action.duration || 0.95,
      commitAt: (action.duration || 0.95) * 0.56,
      committed: false,
      onCommit: () => executeBridgeAction(action),
    };

    elBusyBar.hidden = false;
    elBusyText.textContent = action.label;
    elBusyPct.textContent = '0%';
    elBusyFill.style.width = '0%';
  }

  function getStationStatusSummary(st, sim) {
    if (!st) return '';
    if (st.id === 'station:ppe') {
      const n = (sim.ppe.suit ? 1 : 0) + (sim.ppe.gloves ? 1 : 0) + (sim.ppe.bootsMat ? 1 : 0);
      return `PPE ${n}/3 · Gloves ${sim.ppe.glovesAirTested ? 'Air-Tested' : 'Untested'}`;
    }
    if (st.id === 'station:keys') {
      return `Key Box: ${sim.keyBoxLocked ? 'LOCKED' : 'OPEN'}`;
    }
    if (st.id === 'station:test') {
      const ptpText = sim.ptp.state === 1 ? 'Wand Proved (1/3)' : sim.ptp.state === 2 ? 'Re-Prove Needed' : 'Ready';
      return sim.megger.tested ? `PI ${sim.megger.piRatio} · ${sim.megger.windingChargeVolts} V` : `Proving Unit: ${ptpText}`;
    }
    if (st.id === 'station:permit') {
      return sim.ptw.active ? 'PTW ACTIVE' : sim.sft.active ? 'SFT ACTIVE' : sim.ptw.cancelled ? 'PTW CANCELLED' : 'NO PERMIT ISSUED';
    }
    const cub = sim.cubicles[st.cubId];
    if (!cub) return '';
    const vcb = cub.vcbClosed ? 'CLOSED' : 'OPEN';
    const truck = cub.isHV ? ` · Truck ${cub.rackingTurns}/20` : '';
    const earth = cub.earthSwitchClosed ? ' · EARTHED' : '';
    return `${vcb}${truck}${earth}`;
  }

  let currentStationActions = [];

  function refreshHud(force = false) {
    const sim = getSim();
    const topo = getTopology();
    const steps = getLotoSteps();
    const doneCount = steps.filter((s) => s.done).length;
    const rec = getRecommendedTarget(sim);
    const st = game.nearbyStation;
    const ppeCount = (sim.ppe.suit ? 1 : 0) + (sim.ppe.gloves ? 1 : 0) + (sim.ppe.bootsMat ? 1 : 0);
    const cub = st?.cubId ? sim.cubicles[st.cubId] : null;

    const hudKey = JSON.stringify([
      sim.missionId,
      sim.mode,
      doneCount,
      steps.length,
      ppeCount,
      sim.ppe.glovesAirTested,
      sim.keyBoxLocked,
      sim.ptp.state,
      sim.ptp.phasesTested.L1,
      sim.ptp.phasesTested.L2,
      sim.ptp.phasesTested.L3,
      sim.ptw.active,
      sim.ptw.cancelled,
      sim.sft.active,
      sim.sft.cancelledAfterTest,
      sim.megger.connectedCubicle,
      sim.megger.tested,
      sim.megger.windingChargeVolts,
      sim.activeTool,
      game.heldTool,
      st?.id || null,
      rec.stationId,
      cub ? [cub.vcbClosed, cub.rackingTurns, cub.rackingPadlocked, cub.castellLockedOut, cub.earthSwitchClosed, cub.earthPadlocked, cub.earthKeysInserted.join(','), cub.doorOpen, cub.topShutterPadlocked, cub.cme.pe, cub.cme.L1, cub.cme.L2, cub.cme.L3] : null,
    ]);

    if (!force && hudKey === game.lastHudKey) return;
    game.lastHudKey = hudKey;

    elObjStep.textContent = `Mission 0${sim.missionId} · Step ${doneCount} / ${steps.length}`;
    elObjMode.textContent = sim.mode === 'EXAM' ? 'Exam Mode' : 'Training Mode';
    elObjHint.textContent = sim.mode === 'EXAM'
      ? 'Execute STCW switching & LOTO procedure across the switchroom unassisted.'
      : rec.hint;
    btnWalkToNext.hidden = sim.mode === 'EXAM';
    btnWalkToNext.dataset.targetStation = rec.stationId;

    if (!game.activeAnim) {
      game.heldTool = SIM_TO_GAME_TOOL[sim.activeTool] || 'none';
    }
    elPpeStatus.textContent = `PPE: ${ppeCount}/3 · Tool: ${TOOL_LABELS[game.heldTool] || sim.activeTool || 'Hands free'}`;
    elPpeStatus.classList.toggle('ok', isFullPpeState(sim.ppe));

    hud.querySelectorAll('[data-walk-station]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.walkStation === st?.id);
    });

    if (!st) {
      elActionPanel.hidden = true;
      currentStationActions = [];
      return;
    }

    elActionPanel.hidden = false;
    elStationTitle.textContent = st.label;
    elStationState.textContent = getStationStatusSummary(st, sim, topo);

    currentStationActions = getStationActions(st.id, sim, topo);
    elActionList.innerHTML = '';

    currentStationActions.forEach((act, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `game-act-btn${act.primary ? ' primary' : ''}${act.done ? ' done' : ''}`;
      const keyLabel = idx === 0 ? 'E' : String(idx + 1);
      btn.innerHTML = `<span class="game-act-key">${keyLabel}</span><span>${act.label}</span>`;
      btn.addEventListener('click', () => startAnimatedAction(act, st));
      elActionList.appendChild(btn);
    });
  }

  btnWalkToNext.addEventListener('click', () => {
    const targetId = btnWalkToNext.dataset.targetStation;
    if (targetId) walkToStation(targetId);
  });

  btnCamThird.addEventListener('click', () => setCameraMode('third'));
  btnCamFirst.addEventListener('click', () => setCameraMode('first'));

  btnToggleDock.addEventListener('click', () => {
    game.dockCollapsed = !game.dockCollapsed;
    elDockWrap.classList.toggle('collapsed', game.dockCollapsed);
    btnToggleDock.setAttribute('aria-expanded', String(!game.dockCollapsed));
    btnToggleDock.textContent = game.dockCollapsed ? '▴ Show Controls [H]' : '▾ Hide Controls [H]';
  });

  hud.querySelectorAll('[data-walk-station]').forEach((btn) => {
    btn.addEventListener('click', () => walkToStation(btn.dataset.walkStation));
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (document.querySelector('dialog[open]')) return;

    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') { game.input.forward = true; e.preventDefault(); }
    else if (k === 's' || e.key === 'ArrowDown') { game.input.backward = true; e.preventDefault(); }
    else if (k === 'a' || e.key === 'ArrowLeft') { game.input.left = true; e.preventDefault(); }
    else if (k === 'd' || e.key === 'ArrowRight') { game.input.right = true; e.preventDefault(); }
    else if (e.key === 'Shift') { game.input.sprint = true; }
    else if (k === 'v') {
      e.preventDefault();
      setCameraMode(game.cameraMode === 'third' ? 'first' : 'third');
    } else if (k === 'h') {
      e.preventDefault();
      btnToggleDock.click();
    } else if (k === 'e') {
      const aimed = game.cameraMode === 'first' ? interaction.getHoveredInteraction() : null;
      if (aimed?.resolution?.action) {
        e.preventDefault();
        const baySt = getStationById(`bay:${aimed.meta.cubId}`) || game.nearbyStation;
        startAnimatedAction(aimed.resolution.action, baySt);
      } else if (game.nearbyStation && currentStationActions.length > 0) {
        e.preventDefault();
        const primary = currentStationActions.find((a) => a.primary) || currentStationActions[0];
        startAnimatedAction(primary, game.nearbyStation);
      }
    } else if (k >= '0' && k <= '9') {
      const n = Number(k);
      const idx = n - 1;
      if (!e.shiftKey && n >= 1 && game.nearbyStation && currentStationActions[idx]) {
        e.preventDefault();
        startAnimatedAction(currentStationActions[idx], game.nearbyStation);
      } else if (HOTKEY_TOOLS[n]) {
        e.preventDefault();
        const sim = getSim();
        sim.activeTool = HOTKEY_TOOLS[n];
        game.heldTool = SIM_TO_GAME_TOOL[sim.activeTool] || 'none';
        renderAll();
        refreshHud(true);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') game.input.forward = false;
    else if (k === 's' || e.key === 'ArrowDown') game.input.backward = false;
    else if (k === 'a' || e.key === 'ArrowLeft') game.input.left = false;
    else if (k === 'd' || e.key === 'ArrowRight') game.input.right = false;
    else if (e.key === 'Shift') game.input.sprint = false;
  });

  window.addEventListener('blur', () => {
    game.input.forward = game.input.backward = game.input.left = game.input.right = game.input.sprint = false;
    game.drag.active = false;
  });

  const domEl = renderer.domElement;

  domEl.addEventListener('pointermove', (e) => {
    const rect = domEl.getBoundingClientRect();
    game.pointer.x = e.clientX;
    game.pointer.y = e.clientY;
    game.pointer.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    game.pointer.ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    game.pointer.inside = true;
  });

  domEl.addEventListener('pointerleave', () => {
    game.pointer.inside = false;
    interaction.clearHover();
  });

  domEl.addEventListener('pointerdown', (e) => {
    game.drag.active = true;
    game.drag.moved = false;
    game.drag.startX = e.clientX;
    game.drag.startY = e.clientY;
    game.drag.lastX = e.clientX;
    game.drag.lastY = e.clientY;
  });

  window.addEventListener('pointermove', (e) => {
    if (!game.drag.active) return;
    const dx = e.clientX - game.drag.lastX;
    const dy = e.clientY - game.drag.lastY;
    game.drag.lastX = e.clientX;
    game.drag.lastY = e.clientY;

    if (Math.hypot(e.clientX - game.drag.startX, e.clientY - game.drag.startY) > 6) {
      game.drag.moved = true;
    }

    if (game.drag.moved) {
      game.camYaw = normalizeAngle(game.camYaw - dx * 0.0065);
      const minPitch = game.cameraMode === 'first' ? -0.75 : 0.05;
      const maxPitch = game.cameraMode === 'first' ? 1.15 : 0.78;
      game.camPitch = THREE.MathUtils.clamp(game.camPitch + dy * 0.005, minPitch, maxPitch);
      if (game.cameraMode === 'first') {
        game.player.yaw = game.camYaw;
      }
    }
  });

  domEl.addEventListener('pointerup', (e) => {
    const wasMoved = game.drag.moved;
    game.drag.active = false;
    if (wasMoved) return;

    const rect = domEl.getBoundingClientRect();
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const picked =
      interaction.pickAtNdc(_ndc.x, _ndc.y, 2.8) ||
      (game.cameraMode === 'first' ? interaction.pickAtNdc(0, 0, 2.8) : null);
    if (picked?.resolution?.action) {
      const baySt = getStationById(`bay:${picked.meta.cubId}`) || game.nearbyStation;
      startAnimatedAction(picked.resolution.action, baySt);
      return;
    }

    _raycaster.setFromCamera(_ndc, camera);

    const hits = _raycaster.intersectObjects(room.clickProxies, false);
    if (hits.length === 0) return;

    const stationHit = hits.find((h) => h.object.userData.stationId);
    if (stationHit) {
      walkToStation(stationHit.object.userData.stationId);
      return;
    }

    const floorHit = hits.find((h) => h.object.userData.walkFloor);
    if (floorHit && !game.activeAnim) {
      const pt = floorHit.point;
      game.player.targetPoint = { x: pt.x, z: pt.z };
      game.player.pendingStationId = null;
      room.showWalkMarker(pt.x, pt.z);
    }
  });

  domEl.addEventListener('wheel', (e) => {
    if (game.cameraMode !== 'third') return;
    e.preventDefault();
    game.camDist = THREE.MathUtils.clamp(game.camDist + Math.sign(e.deltaY) * 0.25, 1.75, 4.8);
  }, { passive: false });

  function tick(dt) {
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.14);
    game.elapsed += clampedDt;

    const sim = getSim();

    if (game.activeAnim) {
      const anim = game.activeAnim;
      anim.elapsed += clampedDt;
      const pct = Math.min(100, Math.round((anim.elapsed / anim.duration) * 100));
      elBusyPct.textContent = `${pct}%`;
      elBusyFill.style.width = `${pct}%`;

      if (!anim.committed && anim.elapsed >= anim.commitAt) {
        anim.committed = true;
        if (typeof anim.onCommit === 'function') anim.onCommit();
      }

      if (anim.elapsed >= anim.duration) {
        game.activeAnim = null;
        game.player.isBusy = false;
        elBusyBar.hidden = true;
        refreshHud(true);
      }
    }

    game.player = stepPlayerMovement(game.player, { ...game.input, cameraYaw: game.camYaw }, clampedDt);

    const near = findNearestInteractable(game.player.x, game.player.z);
    if (near?.id !== game.nearbyStation?.id) {
      game.nearbyStation = near;
      if (near?.kind === 'bay' && near.cubId && sim.selectedCubicle !== near.cubId) {
        simActions.selectCubicle(near.cubId);
      }
      refreshHud(true);
    }

    if (game.player.arrived && game.player.pendingStationId) {
      const st = getStationById(game.player.pendingStationId);
      if (st) {
        game.player.yaw = st.faceYaw;
        if (game.cameraMode === 'first') game.camYaw = st.faceYaw;
      }
      game.player.pendingStationId = null;
    }

    character.root.position.set(game.player.x, 0, game.player.z);
    character.root.rotation.y = game.player.yaw;
    character.setPpeVisuals(sim.ppe);
    character.updatePose({
      speed: game.player.speed,
      walkCycle: game.player.walkCycle,
      elapsed: game.elapsed,
      anim: game.activeAnim,
    });

    const rec = getRecommendedTarget(sim);
    room.syncRoomState(sim, rec.stationId, clampedDt, game.elapsed);

    if (game.cameraMode === 'first') {
      _camGoalPos.set(game.player.x, 1.62, game.player.z);
      camera.position.lerp(_camGoalPos, 1 - Math.exp(-16 * clampedDt));
      _camGoalLook.set(
        game.player.x + Math.sin(game.camYaw) * 2.4,
        1.62 - Math.sin(game.camPitch) * 2.0,
        game.player.z + Math.cos(game.camYaw) * 2.4
      );
      _camCurLook.lerp(_camGoalLook, 1 - Math.exp(-16 * clampedDt));
      camera.lookAt(_camCurLook);
    } else {
      const dist = game.camDist;
      const rawX = game.player.x - Math.sin(game.camYaw) * dist * Math.cos(game.camPitch);
      const rawZ = game.player.z - Math.cos(game.camYaw) * dist * Math.cos(game.camPitch);
      const rawY = 1.48 + Math.sin(game.camPitch) * dist;

      _camGoalPos.set(
        THREE.MathUtils.clamp(rawX, -3.95, 3.95),
        THREE.MathUtils.clamp(rawY, 1.05, 3.05),
        THREE.MathUtils.clamp(rawZ, 0.55, 5.45)
      );
      camera.position.lerp(_camGoalPos, 1 - Math.exp(-10 * clampedDt));

      _camGoalLook.set(
        game.player.x + Math.sin(game.camYaw) * 0.45,
        1.32,
        game.player.z + Math.cos(game.camYaw) * 0.45
      );
      _camCurLook.lerp(_camGoalLook, 1 - Math.exp(-12 * clampedDt));
      camera.lookAt(_camCurLook);
    }

    interaction.updateHover(game.pointer);
    refreshHud(false);
  }

  function onMissionReset() {
    game.activeAnim = null;
    game.player.isBusy = false;
    elBusyBar.hidden = true;
    game.lastHudKey = '';
    refreshHud(true);
  }

  const params = new URLSearchParams(window.location.search);
  setCameraMode(params.get('cam') === 'first' ? 'first' : 'third');
  snapCameraImmediate();
  refreshHud(true);

  window.__HV_GAME__ = {
    setCameraMode,
    walkToStation,
    getControlSocket: (cubId, id) => {
      const sock = getControlSocket ? getControlSocket(cubId, id) : null;
      if (!sock) return null;
      const wp = sock.getWorldPosition();
      return {
        id: sock.id,
        cubId: sock.cubId,
        worldPosition: { x: Number(wp.x.toFixed(3)), y: Number(wp.y.toFixed(3)), z: Number(wp.z.toFixed(3)) },
        approachOffset: sock.approachOffset,
      };
    },
    getHoveredInteraction: () => {
      const h = interaction.getHoveredInteraction();
      return h ? { meta: h.meta, title: h.resolution.title, actionLabel: h.resolution.actionLabel } : null;
    },
    getState: () => ({
      cameraMode: game.cameraMode,
      player: { x: Number(game.player.x.toFixed(2)), z: Number(game.player.z.toFixed(2)), yaw: Number(game.player.yaw.toFixed(2)) },
      nearbyStation: game.nearbyStation?.id || null,
      heldTool: game.heldTool,
      isBusy: game.player.isBusy,
    }),
  };

  return { tick, setCameraMode, onMissionReset, refreshHud };
}
