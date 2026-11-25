import * as THREE from 'three';
import { createSwitchboardMaterials, createMeshHelpers } from './materials.js';
import { createSharedTextures, MIMIC_KINDS } from './textures.js';
import { buildHVBay } from './hv-bay.js';
import { buildLVBay } from './lv-bay.js';
import { bayMetering, rackPos } from '../sim/state.js';

export const BAY_X = {
  'DG1': -1.68,
  'BT1': -0.84,
  'BT-M1': 0.00,
  'TR1-HV': 0.84,
  'ACB-TR1-LV': 1.68,
};

export const BAY_ORDER = ['DG1', 'BT1', 'BT-M1', 'TR1-HV', 'ACB-TR1-LV'];

const RACK_STROKE = 0.10;
const SHUTTER_CLEAR_Z = 0.075;

export function buildSwitchboard(scene, renderer) {
  const MAT = createSwitchboardMaterials(renderer);
  const SHARED_TEX = createSharedTextures();
  const allRegisteredMeshes = [];
  const helpers = createMeshHelpers(MAT, allRegisteredMeshes);
  const { setMeshColor, needleRot, setLamp } = helpers;

  const root = new THREE.Group();
  root.name = 'SwitchboardLineup';
  scene.add(root);

  // Active bay floor selection ring
  const baySelectRing = new THREE.Mesh(
    new THREE.RingGeometry(0.39, 0.43, 40),
    new THREE.MeshBasicMaterial({ color: 0x1f6f78, side: THREE.DoubleSide })
  );
  baySelectRing.rotation.x = -Math.PI / 2;
  baySelectRing.position.set(0.0, 0.005, 0.0);
  root.add(baySelectRing);

  // 15 kV Dielectric Mat in front of lineup
  const dielectricMatGroup = new THREE.Group();
  const matSlab = new THREE.Mesh(
    new THREE.BoxGeometry(4.36, 0.012, 0.86),
    new THREE.MeshStandardMaterial({ color: 0x2f3840, roughness: 0.78, metalness: 0.05 })
  );
  matSlab.position.set(0.0, 0.007, 1.06);
  matSlab.receiveShadow = true;
  const matBorder = new THREE.Mesh(
    new THREE.BoxGeometry(4.42, 0.008, 0.92),
    new THREE.MeshStandardMaterial({ color: 0xdba328, roughness: 0.45 })
  );
  matBorder.position.set(0.0, 0.005, 1.06);
  dielectricMatGroup.add(matBorder, matSlab);
  dielectricMatGroup.visible = false;
  root.add(dielectricMatGroup);

  const bayModels = {};
  const hvSpecs = [
    ['DG1', 'C1 · DG1', '6.6 kV GEN 1', 0x3d7a89],
    ['BT1', 'C2 · BT1', '6.6 kV BUS-TIE', 0x55669a],
    ['BT-M1', 'C3 · BT-M1', 'BOW THRUSTER', 0xa46a28],
    ['TR1-HV', 'C4 · TR1-HV', '6.6 / 0.44 kV', 0x84567e],
  ];
  for (const [cubId, titleText, subText, bayAccentHex] of hvSpecs) {
    const bm = buildHVBay({
      cubId,
      bayX: BAY_X[cubId],
      titleText,
      subText,
      bayAccentHex,
      MAT,
      SHARED_TEX,
      helpers,
    });
    root.add(bm.root);
    bayModels[cubId] = bm;
  }

  const lvBm = buildLVBay({
    bayX: BAY_X['ACB-TR1-LV'],
    MAT,
    SHARED_TEX,
    helpers,
  });
  root.add(lvBm.root);
  bayModels['ACB-TR1-LV'] = lvBm;

  const interactiveMeshes = allRegisteredMeshes.filter(
    (m) => m.userData && (m.userData.controlId || m.userData.terminalId)
  );

  function getControlSocket(cubId, socketId) {
    const bm = bayModels[cubId];
    return bm?.sockets?.[socketId] || null;
  }

  // 3D Telescopic 6.6 kV Proving Wand
  const wand3D = new THREE.Group();
  const wandGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.28, 14), MAT.darkConsole);
  wandGrip.rotation.x = Math.PI / 2;
  wandGrip.position.z = 0.34;
  const wandGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.010, 16), MAT.shutterRed);
  wandGuard.rotation.x = Math.PI / 2;
  wandGuard.position.z = 0.20;
  const wandBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.44, 14), MAT.wandOrange);
  wandBody.rotation.x = Math.PI / 2;
  wandBody.position.z = 0.02;
  const wandCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.032, 16),
    new THREE.MeshStandardMaterial({ color: 0x2f7450, emissive: 0x2f7450, emissiveIntensity: 0.65, roughness: 0.2 })
  );
  wandCollar.rotation.x = Math.PI / 2;
  wandCollar.position.z = -0.14;
  const wandTip = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.055, 12), MAT.silverContact);
  wandTip.rotation.x = -Math.PI / 2;
  wandTip.position.z = -0.22;
  wand3D.add(wandGrip, wandGuard, wandBody, wandCollar, wandTip);
  wand3D.visible = false;
  scene.add(wand3D);

  // Arc-Flash VFX System
  const arcFlashVfxGroup = new THREE.Group();
  arcFlashVfxGroup.visible = false;
  scene.add(arcFlashVfxGroup);

  const arcLightCore = new THREE.PointLight(0xd8f0ff, 0, 7.5, 1.4);
  arcLightCore.position.set(0, 1.12, 0.22);
  const arcLightFire = new THREE.PointLight(0xff6d00, 0, 9.0, 1.3);
  arcLightFire.position.set(0, 1.55, 0.25);
  arcFlashVfxGroup.add(arcLightCore, arcLightFire);

  const plasmaCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false });
  const plasmaCoreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), plasmaCoreMat);
  plasmaCoreMesh.position.set(0, 1.05, 0.16);
  const plasmaHaloMat = new THREE.MeshBasicMaterial({ color: 0xff7700, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const plasmaHaloMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), plasmaHaloMat);
  plasmaHaloMesh.position.set(0, 1.08, 0.18);
  arcFlashVfxGroup.add(plasmaCoreMesh, plasmaHaloMesh);

  const shockwaveMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const shockwaveRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 10, 32), shockwaveMat);
  shockwaveRing.position.set(0, 1.05, 0.24);
  arcFlashVfxGroup.add(shockwaveRing);

  const BOLT_SEGMENTS = 10;
  const lightningBolts = [];
  const boltColors = [0xffffff, 0x80d8ff, 0xffd54f, 0x82b1ff, 0xffffff, 0xff9100];
  for (let b = 0; b < 6; b++) {
    const positions = new Float32Array(BOLT_SEGMENTS * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: boltColors[b % boltColors.length], transparent: true, opacity: 0.95 });
    const segs = new THREE.LineSegments(geo, mat);
    arcFlashVfxGroup.add(segs);
    lightningBolts.push(segs);
  }

  const sparkParticles = [];
  const sparkGeo = new THREE.BoxGeometry(0.016, 0.016, 0.045);
  for (let i = 0; i < 36; i++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? 0xffffff : i % 2 === 0 ? 0xffc400 : 0xff5500,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
    });
    const sMesh = new THREE.Mesh(sparkGeo, sMat);
    arcFlashVfxGroup.add(sMesh);
    sparkParticles.push({ mesh: sMesh, vel: new THREE.Vector3(), orig: new THREE.Vector3() });
  }

  const smokeParticles = [];
  const smokeGeo = new THREE.DodecahedronGeometry(0.09, 1);
  for (let i = 0; i < 16; i++) {
    const smMat = new THREE.MeshBasicMaterial({
      color: i < 6 ? 0x3b3f46 : 0x22252a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const smMesh = new THREE.Mesh(smokeGeo, smMat);
    arcFlashVfxGroup.add(smMesh);
    smokeParticles.push({ mesh: smMesh, vel: new THREE.Vector3() });
  }

  const arcFlashState = {
    active: false,
    cubId: 'BT-M1',
    timer: 0,
    duration: 1.45,
    shakeTimer: 0,
    interlockPulseTimer: 0,
  };

  function randomizeLightningBolts(intensityFrac) {
    const anchors = [
      [new THREE.Vector3(-0.19, 1.20, -0.05), new THREE.Vector3(0.00, 1.20, 0.18)],
      [new THREE.Vector3(0.00, 1.20, -0.05), new THREE.Vector3(0.19, 1.20, 0.18)],
      [new THREE.Vector3(-0.19, 0.82, -0.05), new THREE.Vector3(0.19, 1.20, 0.22)],
      [new THREE.Vector3(-0.19, 1.80, -0.32), new THREE.Vector3(0.19, 1.64, -0.25)],
      [new THREE.Vector3(0.00, 1.05, 0.12), new THREE.Vector3(-0.22, 1.45, 0.45)],
      [new THREE.Vector3(0.00, 1.05, 0.12), new THREE.Vector3(0.22, 2.25, 0.15)],
    ];
    lightningBolts.forEach((bolt, idx) => {
      const [pStart, pEnd] = anchors[idx % anchors.length];
      const attr = bolt.geometry.attributes.position;
      let prevX = pStart.x;
      let prevY = pStart.y;
      let prevZ = pStart.z;
      for (let s = 1; s <= BOLT_SEGMENTS; s++) {
        const frac = s / BOLT_SEGMENTS;
        const jitter = s === BOLT_SEGMENTS ? 0 : 0.085 + 0.06 * intensityFrac;
        const nx = THREE.MathUtils.lerp(pStart.x, pEnd.x, frac) + (Math.random() - 0.5) * jitter;
        const ny = THREE.MathUtils.lerp(pStart.y, pEnd.y, frac) + (Math.random() - 0.5) * jitter;
        const nz = THREE.MathUtils.lerp(pStart.z, pEnd.z, frac) + (Math.random() - 0.5) * jitter;
        const baseIdx = (s - 1) * 2;
        attr.setXYZ(baseIdx, prevX, prevY, prevZ);
        attr.setXYZ(baseIdx + 1, nx, ny, nz);
        prevX = nx;
        prevY = ny;
        prevZ = nz;
      }
      attr.needsUpdate = true;
      bolt.material.opacity = Math.min(1, intensityFrac * 1.35);
    });
  }

  function triggerArcFlash(cubId = 'BT-M1') {
    const targetId = bayModels[cubId] ? cubId : 'BT-M1';
    const bm = bayModels[targetId];
    arcFlashState.active = true;
    arcFlashState.cubId = targetId;
    arcFlashState.timer = arcFlashState.duration;
    arcFlashState.shakeTimer = 0.60;

    arcFlashVfxGroup.position.set(bm ? bm.root.position.x : 0, 0, 0.04);
    arcFlashVfxGroup.visible = true;

    sparkParticles.forEach((sp, idx) => {
      const fromRoof = idx < 12;
      sp.orig.set(
        (Math.random() - 0.5) * 0.34,
        fromRoof ? 2.22 : 0.85 + Math.random() * 0.45,
        fromRoof ? (Math.random() - 0.5) * 0.25 : 0.15 + Math.random() * 0.25
      );
      sp.mesh.position.copy(sp.orig);
      sp.vel.set(
        (Math.random() - 0.5) * 3.2,
        fromRoof ? 1.8 + Math.random() * 2.6 : 0.6 + Math.random() * 2.4,
        fromRoof ? (Math.random() - 0.5) * 1.8 : 1.2 + Math.random() * 2.8
      );
      sp.mesh.lookAt(sp.mesh.position.clone().add(sp.vel));
      sp.mesh.material.opacity = 1.0;
    });

    smokeParticles.forEach((sm, idx) => {
      const fromRoof = idx < 10;
      sm.mesh.position.set(
        (Math.random() - 0.5) * 0.38,
        fromRoof ? 2.24 : 1.15 + Math.random() * 0.35,
        fromRoof ? 0.18 - (idx % 2) * 0.48 : 0.38
      );
      sm.mesh.scale.setScalar(0.45 + Math.random() * 0.4);
      sm.vel.set((Math.random() - 0.5) * 0.45, 0.85 + Math.random() * 0.95, (Math.random() - 0.5) * 0.45);
      sm.mesh.material.opacity = 0.62;
    });

    randomizeLightningBolts(1.0);
  }

  function triggerInterlockPulse() {
    arcFlashState.interlockPulseTimer = 0.65;
  }

  function updateArcFlashVFX(dt) {
    if (arcFlashState.interlockPulseTimer > 0) {
      arcFlashState.interlockPulseTimer = Math.max(0, arcFlashState.interlockPulseTimer - dt);
      const pulse = Math.sin(arcFlashState.interlockPulseTimer * 28) * 0.5 + 0.5;
      baySelectRing.material.color.setHex(pulse > 0.4 ? 0xd93829 : 0x1f6f78);
    } else if (baySelectRing.material.color.getHex() !== 0x1f6f78) {
      baySelectRing.material.color.setHex(0x1f6f78);
    }

    if (!arcFlashState.active || arcFlashState.timer <= 0) {
      arcFlashState.active = false;
      arcFlashVfxGroup.visible = false;
      arcLightCore.intensity = 0;
      arcLightFire.intensity = 0;
      ['DG1', 'BT1', 'BT-M1', 'TR1-HV'].forEach((id) => {
        const bm = bayModels[id];
        if (bm && bm.arFlaps) {
          bm.arFlaps.forEach((f) => {
            f.mesh.rotation.x += (f.baseRotX - f.mesh.rotation.x) * 0.22;
            f.mesh.position.y += (f.baseY - f.mesh.position.y) * 0.22;
          });
        }
      });
      return;
    }

    arcFlashState.timer = Math.max(0, arcFlashState.timer - dt);
    const progress = 1.0 - arcFlashState.timer / arcFlashState.duration;
    const decay = Math.pow(Math.max(0, 1.0 - progress), 1.55);

    const bm = bayModels[arcFlashState.cubId];
    if (bm) {
      arcFlashVfxGroup.position.x = bm.root.position.x;
      if (bm.arFlaps) {
        const flapOpen = Math.sin(Math.min(1, progress * 4.5) * Math.PI * 0.5) * decay;
        bm.arFlaps.forEach((f) => {
          f.mesh.rotation.x = f.baseRotX - flapOpen * 1.12;
          f.mesh.position.y = f.baseY + flapOpen * 0.065;
        });
      }
    }

    const flicker = 0.72 + 0.28 * Math.sin(progress * 90.0);
    arcLightCore.intensity = 25.0 * decay * flicker;
    arcLightFire.intensity = 16.0 * decay;

    const coreScale = (0.65 + Math.sin(progress * Math.PI) * 1.65) * flicker;
    plasmaCoreMesh.scale.setScalar(Math.max(0.05, coreScale));
    plasmaCoreMat.opacity = Math.min(1, decay * 1.35);
    plasmaHaloMesh.scale.setScalar(Math.max(0.1, coreScale * 1.45));
    plasmaHaloMat.opacity = decay * 0.65;

    const ringScale = 0.5 + progress * 5.2;
    shockwaveRing.scale.setScalar(ringScale);
    shockwaveRing.rotation.x = Math.PI * 0.18 * progress;
    shockwaveMat.opacity = Math.max(0, (1.0 - progress * 1.35) * 0.85);

    if (progress < 0.78) {
      randomizeLightningBolts(decay);
      lightningBolts.forEach((b) => { b.visible = true; });
    } else {
      lightningBolts.forEach((b) => { b.visible = false; });
    }

    sparkParticles.forEach((sp) => {
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.vel.y -= 5.8 * dt;
      sp.mesh.material.opacity = Math.max(0, decay);
    });

    smokeParticles.forEach((sm) => {
      sm.mesh.position.addScaledVector(sm.vel, dt);
      sm.mesh.scale.multiplyScalar(1.012);
      sm.mesh.material.opacity = Math.max(0, (1.0 - progress) * 0.58);
    });
  }

  function syncSwitchboard(sim, topo, dt = 0.016) {
    const activeId = sim.selectedCubicle;
    const selBm = bayModels[activeId];

    dielectricMatGroup.visible = Boolean(sim.ppe.bootsMat);

    if (selBm) {
      baySelectRing.position.x += (selBm.root.position.x - baySelectRing.position.x) * 0.20;
    }

    ['DG1', 'BT1', 'BT-M1', 'TR1-HV'].forEach((id) => {
      const cub = sim.cubicles[id];
      const bm = bayModels[id];
      if (!cub || !bm) return;

      const targetRackZ = ((20 - cub.rackingTurns) / 20) * RACK_STROKE;
      bm.anim.racking += (targetRackZ - bm.anim.racking) * 0.15;

      const targetDoor = cub.doorOpen ? -1.85 : 0.0;
      bm.anim.doorAngle += (targetDoor - bm.anim.doorAngle) * 0.14;
      bm.doorHingeGroup.rotation.y = bm.anim.doorAngle;
      if (bm.lowerDoorHingeGroup) {
        bm.lowerDoorHingeGroup.rotation.y = bm.anim.doorAngle * 0.94;
      }

      const targetStroke = cub.vcbClosed ? 1.0 : 0.0;
      bm.anim.contactStroke += (targetStroke - bm.anim.contactStroke) * 0.22;
      const strokeOff = (1.0 - bm.anim.contactStroke) * 0.014;
      bm.movingVacuumStems.forEach((st) => { st.position.y = 1.021 - strokeOff; });
      bm.movingBellows.forEach((bel) => { bel.scale.y = 1.0 - (1.0 - bm.anim.contactStroke) * 0.24; });

      bm.subGroups.TC.position.z = bm.anim.racking;

      const wRot = bm.anim.racking / 0.030;
      bm.wheelGroups.forEach((wg) => { wg.rotation.x = wRot; });
      bm.leadScrew.rotation.z = (bm.anim.racking / RACK_STROKE) * 20 * Math.PI * 2;

      const openRatio = THREE.MathUtils.clamp((RACK_STROKE - bm.anim.racking) / (RACK_STROKE - SHUTTER_CLEAR_Z), 0.0, 1.0);
      bm.shutterUpper.position.y = 1.20 + openRatio * 0.125;
      bm.shutterLower.position.y = 0.82 - openRatio * 0.125;
      bm.redShutterPadlock3D.visible = Boolean(cub.topShutterPadlocked);

      const targetEarthRot = cub.earthSwitchClosed ? 0.0 : 0.78;
      bm.anim.earthAngle += (targetEarthRot - bm.anim.earthAngle) * 0.20;
      bm.earthBladePivot.rotation.x = bm.anim.earthAngle;

      setMeshColor(bm.flagOpenClose, cub.vcbClosed ? 0xad4337 : 0x2f7450);
      setMeshColor(bm.flagSpring, cub.springCharged !== false ? 0xdba328 : 0x64748b);

      const rPos = rackPos(cub.rackingTurns);
      const posHex = rPos === 20 ? 0x1f6f78 : rPos === 10 ? 0xdba328 : 0x2f7450;
      setMeshColor(bm.flagTruckPos, posHex);

      if (bm.rackShutterFlap) {
        bm.rackShutterFlap.position.x = cub.vcbClosed ? 0.0 : -0.028;
      }

      const m = bayMetering(id, sim, topo);
      bm.anim.needleKV += (m.kV - bm.anim.needleKV) * 0.18;
      bm.anim.needleA += (m.amps - bm.anim.needleA) * 0.18;
      bm.needleKV.rotation.z = needleRot(bm.anim.needleKV / 7.2);
      bm.needleA.rotation.z = needleRot(bm.anim.needleA / 300);

      setLamp(bm.lampBank[0], cub.vcbClosed && m.bus);
      setLamp(bm.lampBank[1], !cub.vcbClosed);
      setLamp(bm.lampBank[2], m.earthed);
      setLamp(bm.lampBank[3], rPos === 20 && m.bus);

      bm.mimicPanel.update({
        ...MIMIC_KINDS[id],
        bus: m.bus,
        load: m.load,
        closed: cub.vcbClosed,
        rack: rPos,
        earthed: m.earthed,
        backfed: m.backfed,
      });
      bm.hmiPanel.update({
        tag: id === 'TR1-HV' ? 'TR1' : id,
        amps: m.amps,
        kV: m.kV,
        closed: cub.vcbClosed,
        rack: rPos,
        earthed: m.earthed,
        backfed: m.backfed,
      });

      const bayLive =
        (id === 'DG1' && topo.portLive) ||
        (id === 'BT1' && topo.stbdLive) ||
        (id === 'BT-M1' && topo.btVolts > 0) ||
        (id === 'TR1-HV' && topo.trVolts > 0);
      bm.cviLedMeshes.forEach((led) => {
        setMeshColor(led, bayLive ? 0xd9483b : 0x4b5663, bayLive ? 0xd9483b : 0x000000, bayLive ? 0.80 : 0.0);
      });

      bm.rackingPadlock3D.visible = Boolean(cub.rackingPadlocked);
      bm.earthPadlock3D.visible = Boolean(cub.earthPadlocked);

      bm.vcbCastellKey3D.userData.keyBow.visible = Boolean(cub.castellKeyId && !cub.castellLockedOut);
      const reqKeys = cub.requiredEarthKeys || [];
      bm.earthKey1.userData.keyBow.visible = Boolean(reqKeys[0] && cub.earthKeysInserted.includes(reqKeys[0]));
      if (bm.earthKey2) {
        bm.earthKey2.userData.keyBow.visible = Boolean(reqKeys[1] && cub.earthKeysInserted.includes(reqKeys[1]));
      }

      bm.tagDangerMesh.visible = Boolean(cub.tags && cub.tags.danger);
      bm.tagEarthMesh.visible = Boolean(cub.tags && cub.tags.earth);
      bm.tagSftMesh.visible = Boolean(cub.tags && cub.tags.sft);

      bm.cmeMeshes.pe.visible = Boolean(cub.cme && cub.cme.pe);
      ['L1', 'L2', 'L3'].forEach((p) => {
        bm.cmeMeshes[p].visible = Boolean(cub.cme && cub.cme[p]);
        const ring = bm.terminalStatusRings?.[p];
        if (ring) {
          const testedDead = Boolean(
            sim.ptp.completedCubicles[id] || (sim.selectedCubicle === id && sim.ptp.phasesTested[p])
          );
          const cmeClamped = Boolean(cub.cme && cub.cme[p]);
          if (cmeClamped) {
            setMeshColor(ring, 0xdba328, 0xdba328, 0.75);
          } else if (testedDead) {
            setMeshColor(ring, 0x2f7450, 0x2f7450, 0.85);
          } else {
            setMeshColor(ring, 0x3b4550, 0x000000, 0.0);
          }
        }
      });

      if (bm.meggerLeadsGroup) {
        bm.meggerLeadsGroup.visible = sim.megger.connectedCubicle === 'BT-M1';
      }
    });

    // Sync C5 · ACB-TR1-LV
    const lvCub = sim.cubicles['ACB-TR1-LV'];
    if (lvCub && lvBm) {
      setMeshColor(lvBm.acbFlag, lvCub.vcbClosed ? 0xad4337 : 0x2f7450);
      lvBm.acbPadlock.visible = Boolean(lvCub.rackingPadlocked);
      lvBm.acbKey.userData.keyBow.visible = !lvCub.castellLockedOut;

      const lvLive = topo.trVolts > 0 || lvCub.vcbClosed;
      const lvVolts = lvLive ? 440 : 0;
      const lvAmps = topo.trVolts >= 6000 && lvCub.vcbClosed ? 540 : 0;
      lvBm.anim.needleV += (lvVolts - lvBm.anim.needleV) * 0.18;
      lvBm.anim.needleA += (lvAmps - lvBm.anim.needleA) * 0.18;
      lvBm.needleV.rotation.z = needleRot(lvBm.anim.needleV / 500);
      lvBm.needleA.rotation.z = needleRot(lvBm.anim.needleA / 1000);

      setLamp(lvBm.lampBank[0], lvCub.vcbClosed);
      setLamp(lvBm.lampBank[1], !lvCub.vcbClosed);
      setLamp(lvBm.lampBank[2], lvLive);
      setLamp(lvBm.lampBank[3], Boolean(topo.trBackfed));

      lvBm.mimicPanel.update({
        ...MIMIC_KINDS['ACB-TR1-LV'],
        bus: topo.trVolts > 0,
        load: true,
        closed: lvCub.vcbClosed,
        rack: 20,
        earthed: topo.trEarthed,
        backfed: Boolean(topo.trBackfed),
      });
    }

    // Sync 3D Proving Wand visual
    const selCubObj = sim.cubicles[activeId];
    if ((sim.activeTool === 'HV_TESTER' || sim.activeTool === 'VOLTAGE_TESTER') && selCubObj && selCubObj.isHV && selCubObj.doorOpen && selBm) {
      wand3D.visible = true;
      let targetTerm = selBm.termCoords.L2;
      if (sim.lastProbedTerminal && sim.lastProbedTerminal.startsWith(`${activeId}:`)) {
        const tKey = sim.lastProbedTerminal.split(':')[1];
        if (selBm.termCoords[tKey]) targetTerm = selBm.termCoords[tKey];
      }
      wand3D.position.set(selBm.root.position.x + targetTerm.x, targetTerm.y, targetTerm.z + 0.24);
    } else {
      wand3D.visible = false;
    }

    updateArcFlashVFX(dt);
  }

  function getShakeOffset(dt) {
    if (arcFlashState.shakeTimer <= 0) return null;
    arcFlashState.shakeTimer = Math.max(0, arcFlashState.shakeTimer - dt);
    const sNorm = arcFlashState.shakeTimer / 0.60;
    const amp = 0.055 * sNorm * sNorm;
    const tNow = arcFlashState.shakeTimer * 55.0;
    return new THREE.Vector3(
      Math.sin(tNow * 1.7) * amp,
      Math.cos(tNow * 2.3) * amp * 0.85,
      Math.sin(tNow * 1.3) * amp * 0.55
    );
  }

  return {
    root,
    bayModels,
    allRegisteredMeshes,
    interactiveMeshes,
    getControlSocket,
    syncSwitchboard,
    triggerArcFlash,
    triggerInterlockPulse,
    getShakeOffset,
  };
}
