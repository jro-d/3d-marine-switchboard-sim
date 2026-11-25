import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function createSeededRand(seed = 37) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSurfaceTex(w, h, draw, repeatX = 1, repeatY = 1, maxAniso = 4) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = Math.min(maxAniso, 8);
  return t;
}

export function createSwitchboardMaterials(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
  const rand = createSeededRand(37);

  const brushedBump = makeSurfaceTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = '#aaa';
      c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) {
        const a = Math.floor(130 + rand() * 80);
        c.fillStyle = `rgb(${a},${a},${a})`;
        c.fillRect(0, y, w, 1);
      }
      for (let i = 0; i < 6000; i++) {
        c.fillStyle = `rgba(40,40,40,${rand() * 0.09})`;
        c.fillRect(rand() * w, rand() * h, rand() * 40, 1);
      }
    },
    3,
    3,
    maxAniso
  );

  const powderBump = makeSurfaceTex(
    256,
    256,
    (c, w, h) => {
      c.fillStyle = '#808080';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const v = Math.floor(95 + rand() * 70);
        c.fillStyle = `rgba(${v},${v},${v},0.55)`;
        c.beginPath();
        c.arc(rand() * w, rand() * h, 0.6 + rand() * 2.2, 0, Math.PI * 2);
        c.fill();
      }
    },
    6,
    6,
    maxAniso
  );

  const resinRough = makeSurfaceTex(
    128,
    128,
    (c, w, h) => {
      c.fillStyle = '#5a5a5a';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        const v = Math.floor(70 + rand() * 60);
        c.fillStyle = `rgba(${v},${v},${v},0.25)`;
        c.beginPath();
        c.arc(rand() * w, rand() * h, 3 + rand() * 9, 0, Math.PI * 2);
        c.fill();
      }
    },
    2,
    2,
    maxAniso
  );

  const std = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const phys = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshPhysicalMaterial({ color, metalness, roughness, ...extra });
  const powder = (color, roughness = 0.5, metalness = 0.22) =>
    std(color, metalness, roughness, { bumpMap: powderBump, bumpScale: 0.0035 });
  const brushedMetal = (color, metalness = 0.84, roughness = 0.32) =>
    std(color, metalness, roughness, { bumpMap: brushedBump, bumpScale: 0.004 });
  const castResin = (color, roughness = 0.28) =>
    phys(color, 0.05, roughness, { clearcoat: 0.65, clearcoatRoughness: 0.16, roughnessMap: resinRough });

  return {
    steelPanel: powder(0xb9bec1, 0.44, 0.34),
    steelLight: powder(0xc6cacc, 0.42, 0.32),
    steelTrim: brushedMetal(0x9aa3a8, 0.72, 0.34),
    galvSteel: brushedMetal(0xa9ada6, 0.86, 0.33),
    carriageSteel: brushedMetal(0x8e979b, 0.70, 0.38),
    skidSteel: powder(0x3d4850, 0.48, 0.42),
    rubberMount: std(0x1f2427, 0.04, 0.78),
    darkConsole: powder(0x22292d, 0.48, 0.30),
    iedCase: powder(0x3a444b, 0.40, 0.40),
    dinBlock: std(0xd9d6cc, 0.02, 0.58),
    epoxyPole: castResin(0x6a2216, 0.27),
    ctResin: castResin(0x5c2015, 0.30),
    arresterSilicone: phys(0x6e7a84, 0.02, 0.46, { clearcoat: 0.3, clearcoatRoughness: 0.3 }),
    aluminaCeramic: phys(0xebe7dc, 0.03, 0.22, { clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    copper: std(0xc77d47, 0.84, 0.31, { envMapIntensity: 1.35 }),
    silverContact: std(0xcfd5d8, 0.92, 0.2),
    brass: std(0xbe9342, 0.80, 0.28),
    bronzeMesh: brushedMetal(0x8f6f3a, 0.66, 0.42),
    springCloseGreen: std(0x2a6a48, 0.45, 0.34),
    springTripRed: std(0xa23a2e, 0.45, 0.34),
    phaseL1: std(0xb3271f, 0.06, 0.42),
    phaseL2: std(0xe0b31c, 0.06, 0.42),
    phaseL3: std(0x1f4f9c, 0.06, 0.42),
    shutterRed: std(0xb8281f, 0.12, 0.38),
    shutterYellow: std(0xe0a51f, 0.12, 0.38),
    padlockRed: std(0xb3241b, 0.2, 0.32),
    earthGreen: std(0x2b7a47, 0.24, 0.36),
    cmeCable: std(0x7cb518, 0.1, 0.42),
    xlpeCable: std(0x16191b, 0.04, 0.52),
    stressCone: castResin(0x55190f, 0.34),
    conduitFlex: std(0x262c30, 0.2, 0.5),
    wireBlue: std(0x2f5f93, 0.06, 0.5),
    windowGlass: phys(0xdfeefa, 0.0, 0.05, {
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
    wandOrange: std(0xd95d1e, 0.12, 0.32),
    navyBase: powder(0x1d3352, 0.46, 0.30),
    earthYG: std(0x3f9b3a, 0.05, 0.48),
    earthYGStripe: std(0xe6c21c, 0.05, 0.48),
    louverBlack: powder(0x1a1f22, 0.5, 0.25),
    gasket: std(0x15191b, 0.0, 0.8),
  };
}

export function createMeshHelpers(MAT, allRegisteredMeshes) {
  const refinedGeoCache = new Map();

  function refineGeometry(mesh) {
    const g = mesh.geometry;
    if (!g || !g.parameters || mesh.userData.noRefine) return;
    const p = g.parameters;
    let key = null;
    let make = null;
    if (g.type === 'BoxGeometry') {
      if (mesh.material && mesh.material.map) return;
      const m = Math.min(p.width, p.height, p.depth);
      if (m < 0.003) return;
      const r = Math.min(0.0045, m * 0.28);
      key = `rb:${p.width}:${p.height}:${p.depth}:${r}`;
      make = () => new RoundedBoxGeometry(p.width, p.height, p.depth, 2, r);
    } else if (g.type === 'CylinderGeometry') {
      const n = p.radialSegments;
      if (n === 6 || n < 8) return;
      const maxR = Math.max(p.radiusTop, p.radiusBottom);
      const target = maxR > 0.03 ? 56 : maxR > 0.012 ? 36 : 24;
      if (n >= target) return;
      key = `cy:${p.radiusTop}:${p.radiusBottom}:${p.height}:${target}:${p.heightSegments}:${p.openEnded}:${p.thetaStart}:${p.thetaLength}`;
      make = () =>
        new THREE.CylinderGeometry(
          p.radiusTop,
          p.radiusBottom,
          p.height,
          target,
          p.heightSegments,
          p.openEnded,
          p.thetaStart,
          p.thetaLength
        );
    } else if (g.type === 'ConeGeometry') {
      if (p.radialSegments >= 32) return;
      key = `co:${p.radius}:${p.height}:${p.heightSegments}:${p.openEnded}`;
      make = () =>
        new THREE.ConeGeometry(p.radius, p.height, 36, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
    } else if (g.type === 'TorusGeometry') {
      const tub = Math.max(p.tubularSegments, Math.ceil((56 * p.arc) / (Math.PI * 2)));
      const rad = Math.max(p.radialSegments, 12);
      if (tub === p.tubularSegments && rad === p.radialSegments) return;
      key = `to:${p.radius}:${p.tube}:${rad}:${tub}:${p.arc}`;
      make = () => new THREE.TorusGeometry(p.radius, p.tube, rad, tub, p.arc);
    } else if (g.type === 'SphereGeometry') {
      if (p.widthSegments >= 24) return;
      key = `sp:${p.radius}:${p.phiStart}:${p.phiLength}:${p.thetaStart}:${p.thetaLength}`;
      make = () => new THREE.SphereGeometry(p.radius, 24, 16, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    }
    if (!key) return;
    let ng = refinedGeoCache.get(key);
    if (!ng) {
      ng = make();
      refinedGeoCache.set(key, ng);
    }
    g.dispose();
    mesh.geometry = ng;
  }

  function regMesh(mesh, partKey, cubId, opts = {}) {
    refineGeometry(mesh);
    if (opts.cloneMaterial) {
      mesh.material = mesh.material.clone();
    }
    mesh.castShadow = opts.castShadow !== false;
    mesh.receiveShadow = opts.receiveShadow !== false;
    mesh.userData = {
      ...mesh.userData,
      partKey,
      cubId,
      terminalId: opts.terminalId || null,
      controlId: opts.controlId || null,
    };
    allRegisteredMeshes.push(mesh);
    return mesh;
  }

  function setMeshColor(mesh, hex, emissiveHex = 0x000000, emissiveIntensity = 0.0) {
    if (!mesh || !mesh.material) return;
    mesh.material.color.setHex(hex);
    if (mesh.material.emissive) {
      mesh.material.emissive.setHex(emissiveHex);
      mesh.material.emissiveIntensity = emissiveIntensity;
    }
  }

  function buildPadlock3D(partKey, cubId) {
    const g = new THREE.Group();
    const body = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.018), MAT.padlockRed), partKey, cubId);
    const collar = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.007, 0.020), MAT.brass), partKey, cubId);
    collar.position.y = -0.018;
    const shackle = regMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0032, 10, 18, Math.PI), MAT.silverContact),
      partKey,
      cubId
    );
    shackle.position.set(0, 0.021, 0);
    g.add(body, collar, shackle);
    return g;
  }

  function buildCastellKey3D(partKey, cubId) {
    const g = new THREE.Group();
    const esc = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 16), MAT.steelTrim), partKey, cubId);
    esc.rotation.x = Math.PI / 2;
    const cyl = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.018, 14), MAT.silverContact), partKey, cubId);
    cyl.rotation.x = Math.PI / 2;
    cyl.position.z = 0.005;

    const bowGroup = new THREE.Group();
    const stem = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 10), MAT.brass), partKey, cubId);
    stem.rotation.x = Math.PI / 2;
    stem.position.z = 0.018;
    const bit = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.003, 0.008), MAT.brass), partKey, cubId);
    bit.position.set(0.005, 0, 0.014);
    const bow = regMesh(new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0032, 10, 18), MAT.brass), partKey, cubId);
    bow.position.z = 0.032;
    bowGroup.add(stem, bit, bow);
    g.add(esc, cyl, bowGroup);
    g.userData.keyBow = bowGroup;
    return g;
  }

  function buildHelicalSpring(radius, height, turns, wireRadius, mat, partKey, cubId) {
    const pts = [];
    const steps = turns * 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = t * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(ang) * radius, (t - 0.5) * height, Math.sin(ang) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, steps, wireRadius, 7, false);
    return regMesh(new THREE.Mesh(geo, mat), partKey, cubId);
  }

  function buildSheddedInsulator(rBase, height, sheds, mat, partKey, cubId) {
    const g = new THREE.Group();
    const core = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(rBase * 0.78, rBase, height, 14), mat), partKey, cubId);
    g.add(core);
    for (let s = 0; s < sheds; s++) {
      const y = -height * 0.34 + (s / Math.max(1, sheds - 1)) * (height * 0.68);
      const fin = regMesh(
        new THREE.Mesh(new THREE.CylinderGeometry(rBase * 1.24, rBase * 1.30, 0.009, 14), mat),
        partKey,
        cubId
      );
      fin.position.y = y;
      g.add(fin);
    }
    return g;
  }

  const _AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  function fastenerGeometry(points, { axis = 'z', dir = 1, r = 0.0052, h = 0.0040, washer = true, hex = false } = {}) {
    const base = [];
    let off = 0;
    if (washer) {
      base.push({ g: new THREE.CylinderGeometry(r * 1.5, r * 1.5, h * 0.32, 20), off: h * 0.16 });
      off = h * 0.32;
    }
    base.push({
      g: hex ? new THREE.CylinderGeometry(r, r, h, 6) : new THREE.CylinderGeometry(r * 0.72, r, h, 20),
      off: off + h * 0.5,
    });
    if (hex) {
      base.push({ g: new THREE.CylinderGeometry(r * 0.42, r * 0.42, h * 0.9, 12), off: off + h * 1.2 });
    }
    const q = new THREE.Quaternion().setFromUnitVectors(_AX.y, _AX[axis].clone().multiplyScalar(dir));
    const parts = [];
    points.forEach(([x, y, z]) => {
      base.forEach(({ g, off: o }) => {
        const c = g.clone();
        c.translate(0, o, 0);
        c.applyQuaternion(q);
        c.translate(x, y, z);
        parts.push(c);
      });
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((c) => c.dispose());
    base.forEach((b) => b.g.dispose());
    return merged;
  }

  function addFasteners(parent, partKey, cubId, points, opts = {}) {
    if (!points.length) return null;
    const m = regMesh(new THREE.Mesh(fastenerGeometry(points, opts), opts.mat || MAT.galvSteel), partKey, cubId, {
      castShadow: false,
    });
    parent.add(m);
    return m;
  }

  function rectPoints(a0, a1, b0, b1, step, plane, c) {
    const pts = [];
    const na = Math.max(1, Math.round((a1 - a0) / step));
    const nb = Math.max(1, Math.round((b1 - b0) / step));
    const push = (a, b) => pts.push(plane === 'xy' ? [a, b, c] : plane === 'zy' ? [c, b, a] : [a, c, b]);
    for (let i = 0; i <= na; i++) {
      const a = a0 + ((a1 - a0) * i) / na;
      push(a, b0);
      push(a, b1);
    }
    for (let j = 1; j < nb; j++) {
      const b = b0 + ((b1 - b0) * j) / nb;
      push(a0, b);
      push(a1, b);
    }
    return pts;
  }

  function addBoxRun(parent, partKey, cubId, size, positions, mat, rotX = 0) {
    const parts = positions.map(([x, y, z]) => {
      const g = new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(0.002, Math.min(...size) * 0.3));
      if (rotX) g.rotateX(rotX);
      g.translate(x, y, z);
      return g;
    });
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    const m = regMesh(new THREE.Mesh(merged, mat), partKey, cubId);
    parent.add(m);
    return m;
  }

  const terminationProfile = [
    [0.0, -0.075], [0.027, -0.075], [0.029, -0.060], [0.034, -0.040], [0.038, -0.020], [0.036, 0.0],
    [0.046, 0.006], [0.030, 0.012], [0.030, 0.026], [0.044, 0.032], [0.028, 0.038], [0.026, 0.052],
    [0.040, 0.058], [0.024, 0.064], [0.020, 0.080], [0.0, 0.080],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const terminationGeo = new THREE.LatheGeometry(terminationProfile, 40);

  function addEarthLead(parent, partKey, cubId, pts, radius = 0.0045) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
    parent.add(regMesh(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, radius, 10, false), MAT.earthYG), partKey, cubId));
    const bands = [];
    const n = Math.max(4, Math.floor(curve.getLength() / 0.03));
    for (let i = 1; i < n; i += 2) {
      const t0 = i / n;
      const t1 = Math.min(1, (i + 0.55) / n);
      const seg = new THREE.CatmullRomCurve3([
        curve.getPoint(t0),
        curve.getPoint((t0 + t1) / 2),
        curve.getPoint(t1),
      ]);
      bands.push(new THREE.TubeGeometry(seg, 4, radius * 1.06, 10, false));
    }
    if (bands.length) {
      const merged = mergeGeometries(bands, false);
      bands.forEach((b) => b.dispose());
      parent.add(regMesh(new THREE.Mesh(merged, MAT.earthYGStripe), partKey, cubId, { castShadow: false }));
    }
  }

  const LAMP_SPECS = {
    red: { lit: 0xe0483b, dim: 0x7a2a24 },
    green: { lit: 0x35b36a, dim: 0x1f4d34 },
    amber: { lit: 0xffb62e, dim: 0x7a5a16 },
    white: { lit: 0xffffff, dim: 0x8a9099 },
  };

  function addLiveMeter(parent, cubId, mx, my, tex, face, z) {
    const bezel = regMesh(new THREE.Mesh(new THREE.BoxGeometry(face + 0.019, face + 0.019, 0.018), MAT.darkConsole), 'LD', cubId);
    bezel.position.set(mx, my, z - 0.010);
    const dial = regMesh(
      new THREE.Mesh(new THREE.PlaneGeometry(face, face), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 })),
      'LD',
      cubId,
      { castShadow: false }
    );
    dial.position.set(mx, my, z);
    parent.add(bezel, dial);

    const pivot = new THREE.Group();
    pivot.position.set(mx + 0.325 * face, my - 0.325 * face, z + 0.0018);
    const len = (90 / 160) * face;
    const needle = regMesh(new THREE.Mesh(new THREE.BoxGeometry(len, 0.0024, 0.0014), MAT.shutterRed), 'LD', cubId, {
      castShadow: false,
    });
    needle.position.set(len / 2 - 0.004, 0, 0);
    const hub = regMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.003, 14), MAT.darkConsole), 'LD', cubId, {
      castShadow: false,
    });
    hub.rotation.x = Math.PI / 2;
    pivot.add(needle, hub);
    pivot.rotation.z = Math.PI;
    parent.add(pivot);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(face, face), MAT.windowGlass);
    glass.position.set(mx, my, z + 0.0055);
    parent.add(glass);
    return pivot;
  }

  function needleRot(frac) {
    return Math.PI - THREE.MathUtils.clamp(frac, 0, 1.04) * (Math.PI * 0.5);
  }

  function buildLampBank(parent, cubId, cx, cy, z, pitch, colors) {
    return colors.map((c, i) => {
      const sp = LAMP_SPECS[c];
      const x = cx + (i - (colors.length - 1) / 2) * pitch;
      const ring = regMesh(
        new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 18), MAT.silverContact),
        'LD',
        cubId,
        { castShadow: false }
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, cy, z);
      const lens = regMesh(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.0108, 16, 10),
          new THREE.MeshStandardMaterial({ color: sp.dim, roughness: 0.25, metalness: 0.05 })
        ),
        'LD',
        cubId,
        { castShadow: false }
      );
      lens.scale.z = 0.55;
      lens.position.set(x, cy, z + 0.005);
      parent.add(ring, lens);
      return { mesh: lens, lit: sp.lit, dim: sp.dim };
    });
  }

  function setLamp(lamp, on) {
    setMeshColor(lamp.mesh, on ? lamp.lit : lamp.dim, on ? lamp.lit : 0x000000, on ? 0.95 : 0.0);
  }

  function addLegend(parent, cubId, tex, n, pitchPx, cx, cy, z, pitchM) {
    const width = pitchM * n;
    const height = (28 / pitchPx) * pitchM;
    const m = regMesh(
      new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })),
      'LD',
      cubId,
      { castShadow: false }
    );
    m.position.set(cx, cy, z);
    parent.add(m);
    return m;
  }

  function addStormHandrail(parent, partKey, cubId, width, y, z) {
    const bracketMat = MAT.navyBase;
    const bx = width * 0.5 - 0.026;
    [-bx, bx].forEach((x) => {
      const brk = regMesh(new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.022), bracketMat), partKey, cubId);
      brk.position.set(x, y, z + 0.008);
      parent.add(brk);
    });
    const bar = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, width - 0.04, 14), MAT.silverContact),
      partKey,
      cubId
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, z + 0.018);
    const grip = regMesh(
      new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, width - 0.16, 14), MAT.darkConsole),
      partKey,
      cubId
    );
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0, y, z + 0.018);
    parent.add(bar, grip);
  }

  return {
    regMesh,
    setMeshColor,
    buildPadlock3D,
    buildCastellKey3D,
    buildHelicalSpring,
    buildSheddedInsulator,
    addFasteners,
    rectPoints,
    addBoxRun,
    terminationGeo,
    addEarthLead,
    addLiveMeter,
    needleRot,
    buildLampBank,
    setLamp,
    addLegend,
    addStormHandrail,
  };
}
