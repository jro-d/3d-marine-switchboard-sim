import * as THREE from 'three';

const INTERIOR_CONTROLS = new Set(['shutterPadlock']);

function esc(str) {
  return String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function isControlAccessible(meta, sim) {
  if (!meta || !meta.cubId || !sim || !sim.cubicles) return false;
  const cub = sim.cubicles[meta.cubId];
  if (!cub) return false;
  if (meta.terminalId || INTERIOR_CONTROLS.has(meta.controlId)) {
    return Boolean(cub.doorOpen);
  }
  return true;
}

export function resolveControlInteraction(meta, sim, _topo = {}) {
  if (!isControlAccessible(meta, sim)) return null;
  const cub = sim.cubicles[meta.cubId];
  const cubId = cub.id;
  const bayLabel = `${cub.code} · ${cubId}`;

  if (meta.terminalId) {
    const phase = meta.terminalId;
    const isCmeMode = sim.activeTool === 'PORTABLE_EARTH' || phase === 'PE';
    if (isCmeMode) {
      const clamped = phase === 'PE' ? Boolean(cub.cme?.pe) : Boolean(cub.cme?.[phase]);
      return {
        title: `${bayLabel} · ${phase} Earth Stud`,
        subtitle: clamped ? 'CME ground clamp attached' : 'No CME clamp attached',
        actionLabel: clamped ? `Click to remove ${phase} CME clamp` : `Click to clamp ${phase} CME lead`,
        statusTone: clamped ? 'safe' : 'warn',
        socketId: phase,
        action: {
          id: `cme_${phase}`,
          label: `${clamped ? 'Remove' : 'Clamp'} ${phase} CME Lead`,
          anim: 'probe_wand',
          tool: 'cme_stick',
          duration: 0.85,
          exec: 'cmeTerminal',
          arg: { cubId, phase },
        },
      };
    }

    const tested = Boolean(
      sim.ptp?.completedCubicles?.[cubId] ||
      (sim.selectedCubicle === cubId && sim.ptp?.phasesTested?.[phase])
    );
    const provedReady = (sim.ptp?.state || 0) >= 1;
    return {
      title: `${bayLabel} · Phase ${phase}`,
      subtitle: tested
        ? 'Verified 0.0 V Dead (Proved)'
        : provedReady
          ? '6.6 kV Wand proved — ready to probe'
          : 'Prove 6.6 kV Wand at Test Bench first',
      actionLabel: tested ? `Re-probe ${phase} with 6.6 kV Wand` : `Click to probe ${phase} with 6.6 kV Wand`,
      statusTone: tested ? 'safe' : provedReady ? 'accent' : 'warn',
      socketId: phase,
      action: {
        id: `probe_${phase}`,
        label: `Probe ${phase} Terminal with HV Wand`,
        anim: 'probe_wand',
        tool: 'proving_wand',
        duration: 0.85,
        exec: 'probePhase',
        arg: { cubId, phase },
      },
    };
  }

  switch (meta.controlId) {
    case 'tripBtn':
      return {
        title: `${bayLabel} · Trip Pushbutton [O]`,
        subtitle: cub.vcbClosed ? 'Breaker CLOSED [I] — Energized' : 'Breaker already OPEN [O]',
        actionLabel: cub.vcbClosed ? 'Click to Trip Breaker [O]' : 'Press Trip [O]',
        statusTone: cub.vcbClosed ? 'warn' : 'safe',
        socketId: 'tripBtn',
        action: {
          id: 'trip_vcb',
          label: `Trip ${cub.isHV ? 'VCB' : '440 V ACB'} [O]`,
          anim: 'push_button',
          tool: 'none',
          duration: 0.8,
          exec: 'tripVcb',
          arg: cubId,
        },
      };

    case 'closeBtn':
      return {
        title: `${bayLabel} · Close Pushbutton [I]`,
        subtitle: cub.vcbClosed ? 'Breaker CLOSED [I]' : 'Breaker OPEN [O]',
        actionLabel: cub.vcbClosed ? 'Breaker already CLOSED' : 'Click to Close Breaker [I]',
        statusTone: cub.vcbClosed ? 'safe' : 'accent',
        socketId: 'closeBtn',
        action: {
          id: 'close_vcb',
          label: `Close ${cub.isHV ? 'VCB' : '440 V ACB'} [I]`,
          anim: 'push_button',
          tool: 'none',
          duration: 0.8,
          exec: 'closeVcb',
          arg: cubId,
        },
      };

    case 'rackPort': {
      if (sim.activeTool === 'PADLOCK') {
        const locked = Boolean(cub.rackingPadlocked);
        return {
          title: `${bayLabel} · Racking Port LOTO Hasp`,
          subtitle: locked ? 'LOTO padlock applied' : 'Unlocked',
          actionLabel: locked ? 'Click to remove LOTO padlock' : 'Click to apply LOTO padlock',
          statusTone: locked ? 'safe' : 'warn',
          socketId: 'rackingPadlock',
          action: {
            id: 'padlock_port',
            label: locked ? 'Remove Racking Port Padlock' : 'Apply LOTO Padlock to Racking Port',
            anim: 'turn_key',
            tool: 'padlock',
            duration: 0.9,
            exec: 'toggleRackingPadlock',
            arg: cubId,
          },
        };
      }
      const turns = cub.rackingTurns;
      const shouldRackIn =
        turns === 0 ||
        (turns === 10 && sim.missionId === 4 && !cub.earthSwitchClosed && !cub.cme?.pe);
      const nextTurns = shouldRackIn ? Math.min(20, turns + 10) : Math.max(0, turns - 10);
      return {
        title: `${bayLabel} · Racking Hex Port`,
        subtitle: `Truck at ${turns}/20 turns${cub.rackingPadlocked ? ' · PADLOCKED' : ''}`,
        actionLabel: shouldRackIn
          ? `Click to crank IN (${turns} -> ${nextTurns}/20)`
          : `Click to crank OUT (${turns} -> ${nextTurns}/20)`,
        statusTone: cub.rackingPadlocked ? 'warn' : 'accent',
        socketId: 'rackPort',
        action: {
          id: shouldRackIn ? 'rack_in' : 'rack_out',
          label: `Crank VCB Truck ${shouldRackIn ? 'In' : 'Out'} (${turns} -> ${nextTurns}/20)`,
          anim: 'rack_crank',
          tool: 'racking_handle',
          duration: 1.25,
          exec: shouldRackIn ? 'rackIn' : 'rackOut',
          arg: cubId,
        },
      };
    }

    case 'rackingPadlock': {
      const locked = Boolean(cub.rackingPadlocked);
      return {
        title: `${bayLabel} · Racking Port Padlock Hasp`,
        subtitle: locked ? 'Secured with LOTO Padlock' : 'Open hasp — unlocked',
        actionLabel: locked ? 'Click to remove LOTO padlock' : 'Click to apply LOTO padlock',
        statusTone: locked ? 'safe' : 'warn',
        socketId: 'rackingPadlock',
        action: {
          id: 'padlock_port',
          label: locked ? 'Remove Racking Port Padlock' : 'Apply LOTO Padlock to Racking Port',
          anim: 'turn_key',
          tool: 'padlock',
          duration: 0.9,
          exec: 'toggleRackingPadlock',
          arg: cubId,
        },
      };
    }

    case 'castellVcb': {
      const kId = cub.castellKeyId || 'K';
      const lockedOut = Boolean(cub.castellLockedOut);
      return {
        title: `${bayLabel} · Castell Key ${kId}`,
        subtitle: lockedOut ? `Key ${kId} extracted (Breaker locked out)` : `Key ${kId} trapped in breaker`,
        actionLabel: lockedOut ? `Click to insert ${kId} into breaker` : `Click to extract ${kId}`,
        statusTone: lockedOut ? 'safe' : 'accent',
        socketId: 'castellVcb',
        action: {
          id: 'castell_vcb',
          label: lockedOut ? `Return Castell Key ${kId} to Breaker` : `Lock Out & Extract Castell Key ${kId}`,
          anim: 'turn_key',
          tool: 'castell_key',
          duration: 0.95,
          exec: 'toggleCastellVcb',
          arg: cubId,
        },
      };
    }

    case 'doorHandle':
      return {
        title: `${bayLabel} · Compartment Door Handle`,
        subtitle: cub.doorOpen ? 'Door OPEN' : 'Door CLOSED & Interlocked',
        actionLabel: cub.doorOpen ? 'Click to Close & Bolt Door' : 'Click to Open Compartment Door',
        statusTone: cub.doorOpen ? 'accent' : 'safe',
        socketId: 'doorHandle',
        action: {
          id: 'toggle_door',
          label: cub.doorOpen ? 'Close & Bolt VCB Door' : 'Open VCB Compartment Door',
          anim: 'open_door',
          tool: 'none',
          duration: 0.95,
          exec: 'toggleDoor',
          arg: cubId,
        },
      };

    case 'ek6Socket':
      return {
        title: `${bayLabel} · EK6 Earth Switch Shaft`,
        subtitle: cub.earthSwitchClosed ? 'CLOSED — Circuit Earthed' : 'OPEN — Unearthed',
        actionLabel: cub.earthSwitchClosed ? 'Click to Open EK6 Earth Switch' : 'Click to Close EK6 Earth Switch',
        statusTone: cub.earthSwitchClosed ? 'safe' : 'warn',
        socketId: 'ek6Socket',
        action: {
          id: 'earth_switch',
          label: cub.earthSwitchClosed ? 'Open EK6 Integral Earth Switch' : 'Close EK6 Integral Earth Switch',
          anim: 'pull_lever',
          tool: 'none',
          duration: 1.05,
          exec: 'toggleEarthSwitch',
          arg: cubId,
        },
      };

    case 'ek6Padlock': {
      const locked = Boolean(cub.earthPadlocked);
      return {
        title: `${bayLabel} · EK6 Earth Padlock Hasp`,
        subtitle: locked ? 'EK6 Padlocked Closed' : 'Unlocked',
        actionLabel: locked ? 'Click to remove EK6 padlock' : 'Click to padlock EK6 Earth Switch',
        statusTone: locked ? 'safe' : 'warn',
        socketId: 'ek6Padlock',
        action: {
          id: 'earth_padlock',
          label: locked ? 'Remove EK6 Earth Padlock' : 'Padlock EK6 Earth Switch',
          anim: 'turn_key',
          tool: 'padlock',
          duration: 0.9,
          exec: 'toggleEarthPadlock',
          arg: cubId,
        },
      };
    }

    case 'earthKey1':
    case 'earthKey2': {
      const slotIdx = meta.controlId === 'earthKey2' ? 1 : 0;
      const keyId = cub.requiredEarthKeys?.[slotIdx];
      if (!keyId) return null;
      const inserted = Boolean(cub.earthKeysInserted?.includes(keyId));
      return {
        title: `${bayLabel} · EK6 Castell Cylinder (${keyId})`,
        subtitle: inserted ? `Key ${keyId} inserted` : `Awaiting key ${keyId}`,
        actionLabel: inserted ? `Click to remove ${keyId}` : `Click to insert ${keyId}`,
        statusTone: inserted ? 'safe' : 'accent',
        socketId: meta.controlId,
        action: {
          id: `earth_key_${keyId}`,
          label: inserted ? `Remove ${keyId} from EK6 Cylinder` : `Insert ${keyId} into EK6 Earth Cylinder`,
          anim: 'turn_key',
          tool: 'castell_key',
          duration: 0.9,
          exec: 'toggleEarthKey',
          arg: { cubId, keyId },
        },
      };
    }

    case 'shutterPadlock': {
      const locked = Boolean(cub.topShutterPadlocked);
      return {
        title: `${bayLabel} · Red Live-Bus Shutter`,
        subtitle: locked ? 'Shrouded & LOTO Padlocked' : 'Unpadlocked (Bus Side Live)',
        actionLabel: locked ? 'Click to remove shutter padlock' : 'Click to padlock Red Busbar Shutter',
        statusTone: locked ? 'safe' : 'warn',
        socketId: 'shutterPadlock',
        action: {
          id: 'shutter_padlock',
          label: locked ? 'Remove Red Busbar Shutter Padlock' : 'Padlock Red Upper Busbar Shutter',
          anim: 'turn_key',
          tool: 'padlock',
          duration: 0.9,
          exec: 'toggleShutterPadlock',
          arg: cubId,
        },
      };
    }

    default:
      return null;
  }
}

function isObjectVisibleInHierarchy(obj) {
  let cur = obj;
  while (cur) {
    if (!cur.visible) return false;
    cur = cur.parent;
  }
  return true;
}

export function createInteractionManager({
  camera,
  domEl,
  hudRoot,
  interactiveMeshes = [],
  getSim,
  getTopology,
  getCameraMode,
  getPlayerPos,
  isBusy,
}) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const tooltip = document.createElement('div');
  tooltip.className = 'game-hover-tooltip';
  tooltip.hidden = true;
  tooltip.setAttribute('role', 'status');
  hudRoot.appendChild(tooltip);

  const fpReticle = hudRoot.querySelector('#gameFpReticle');

  let hoveredHighlightMesh = null;
  let savedHighlightState = null;
  let hoveredHit = null;

  function findVisibleHighlightTarget(mesh) {
    if (!mesh) return null;
    if (!mesh.userData?.isHitProxy) return mesh;
    const { cubId, terminalId } = mesh.userData;
    return (
      interactiveMeshes.find(
        (m) =>
          !m.userData?.isHitProxy &&
          m.userData?.cubId === cubId &&
          m.userData?.terminalId === terminalId &&
          isObjectVisibleInHierarchy(m) &&
          m.material?.emissive
      ) || null
    );
  }

  function applyHighlight(mesh) {
    const target = findVisibleHighlightTarget(mesh);
    if (hoveredHighlightMesh === target) return;
    restoreHighlight();
    if (!target || !target.material || !target.material.emissive) return;

    if (!target.userData._hoverMatCloned) {
      target.material = target.material.clone();
      target.userData._hoverMatCloned = true;
    }
    savedHighlightState = {
      hex: target.material.emissive.getHex(),
      intensity: target.material.emissiveIntensity ?? 0,
    };
    hoveredHighlightMesh = target;
    target.material.emissive.setHex(0x1f6f78);
    target.material.emissiveIntensity = Math.max(0.55, savedHighlightState.intensity + 0.35);
  }

  function restoreHighlight() {
    if (hoveredHighlightMesh && savedHighlightState && hoveredHighlightMesh.material?.emissive) {
      hoveredHighlightMesh.material.emissive.setHex(savedHighlightState.hex);
      hoveredHighlightMesh.material.emissiveIntensity = savedHighlightState.intensity;
    }
    hoveredHighlightMesh = null;
    savedHighlightState = null;
  }

  function clearHover() {
    restoreHighlight();
    hoveredHit = null;
    tooltip.hidden = true;
    domEl.style.cursor = '';
    if (fpReticle) fpReticle.classList.remove('targeted');
  }

  function pickAtNdc(ndcX, ndcY, maxDist = 2.8) {
    if (!interactiveMeshes.length) return null;
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);
    const rawHits = raycaster.intersectObjects(interactiveMeshes, false);
    if (!rawHits.length) return null;

    const sim = getSim();
    const topo = getTopology();
    const pPos = getPlayerPos();

    for (const hit of rawHits) {
      if (!isObjectVisibleInHierarchy(hit.object)) continue;
      const horizDist = Math.hypot(hit.point.x - pPos.x, hit.point.z - pPos.z);
      if (horizDist > maxDist) continue;
      const meta = hit.object.userData;
      const resolution = resolveControlInteraction(meta, sim, topo);
      if (!resolution) continue;
      return {
        mesh: hit.object,
        point: hit.point,
        meta,
        resolution,
      };
    }
    return null;
  }

  function renderTooltip(resolution, screenPos, isFirstPerson) {
    tooltip.innerHTML = `
      <div class="tt-title">${esc(resolution.title)}</div>
      <div class="tt-sub tt-tone-${esc(resolution.statusTone)}">${esc(resolution.subtitle)}</div>
      <div class="tt-action">${esc(resolution.actionLabel)}</div>
    `;
    tooltip.hidden = false;

    const hudRect = hudRoot.getBoundingClientRect();
    if (isFirstPerson) {
      tooltip.style.left = `${Math.round(hudRect.width * 0.5)}px`;
      tooltip.style.top = `${Math.round(hudRect.height * 0.5 + 22)}px`;
      tooltip.classList.add('fp-centered');
    } else {
      tooltip.classList.remove('fp-centered');
      const relX = screenPos.x - hudRect.left;
      const relY = screenPos.y - hudRect.top;
      const clampedX = Math.max(16, Math.min(hudRect.width - 260, relX + 16));
      const clampedY = Math.max(16, Math.min(hudRect.height - 110, relY + 14));
      tooltip.style.left = `${Math.round(clampedX)}px`;
      tooltip.style.top = `${Math.round(clampedY)}px`;
    }
  }

  function updateHover(pointerState) {
    if (isBusy()) {
      clearHover();
      return null;
    }

    const isFirst = getCameraMode() === 'first';
    const cursorHit = pointerState?.inside ? pickAtNdc(pointerState.ndcX, pointerState.ndcY, 2.8) : null;
    const reticleHit = isFirst ? pickAtNdc(0, 0, 2.8) : null;
    const picked = cursorHit || reticleHit;

    if (!picked) {
      clearHover();
      return null;
    }

    hoveredHit = picked;
    applyHighlight(picked.mesh);
    if (fpReticle) fpReticle.classList.toggle('targeted', isFirst);
    domEl.style.cursor = cursorHit ? 'pointer' : '';
    renderTooltip(picked.resolution, pointerState, !cursorHit && isFirst);
    return picked;
  }

  function getHoveredInteraction() {
    return hoveredHit;
  }

  return {
    pickAtNdc,
    updateHover,
    getHoveredInteraction,
    clearHover,
  };
}
