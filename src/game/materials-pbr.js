import * as THREE from 'three';

function fract(x) {
  return x - Math.floor(x);
}

function hash2DPeriodic(ix, iy, px, py, seed = 1) {
  const x = ((ix % px) + px) % px;
  const y = ((iy % py) + py) % py;
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return fract(n);
}

function valueNoisePeriodic(u, v, freqX, freqY, seed = 1) {
  const fx = u * freqX;
  const fy = v * freqY;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const c00 = hash2DPeriodic(ix, iy, freqX, freqY, seed);
  const c10 = hash2DPeriodic(ix + 1, iy, freqX, freqY, seed);
  const c01 = hash2DPeriodic(ix, iy + 1, freqX, freqY, seed);
  const c11 = hash2DPeriodic(ix + 1, iy + 1, freqX, freqY, seed);

  const nx0 = c00 + (c10 - c00) * sx;
  const nx1 = c01 + (c11 - c01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbmPeriodic(u, v, baseFreqX, baseFreqY, octaves = 3, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let fx = baseFreqX;
  let fy = baseFreqY;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoisePeriodic(u, v, fx, fy, seed + i * 19);
    norm += amp;
    amp *= 0.5;
    fx *= 2;
    fy *= 2;
  }
  return norm > 0 ? sum / norm : 0.5;
}

/**
 * Convert a tileable normalized heightfield (`Float32Array` of length `width * height`)
 * into a tangent-space normal map `THREE.DataTexture` using a wrap-around 3x3 Sobel filter.
 */
export function createNormalMapFromHeightData(
  heightData,
  width,
  height,
  { strength = 1.6, repeatX = 1, repeatY = 1, anisotropy = 4 } = {}
) {
  const rgba = new Uint8Array(width * height * 4);

  const sample = (x, y) => {
    const wx = ((x % width) + width) % width;
    const wy = ((y % height) + height) % height;
    return heightData[wy * width + wx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;

      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * width + x) * 4;
      rgba[idx] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
      rgba[idx + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
      rgba[idx + 2] = Math.max(0, Math.min(255, Math.round((nz * 0.5 + 0.5) * 255)));
      rgba[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.max(1, Math.min(anisotropy, 8));
  tex.needsUpdate = true;
  return tex;
}

/**
 * Convert a normalized linear roughness array (`[0..1]`) into a linear `THREE.DataTexture`.
 */
export function createRoughnessMapFromData(
  roughData,
  width,
  height,
  { repeatX = 1, repeatY = 1, anisotropy = 4 } = {}
) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = Math.max(0, Math.min(255, Math.round(roughData[i] * 255)));
    const idx = i * 4;
    rgba[idx] = v;
    rgba[idx + 1] = v;
    rgba[idx + 2] = v;
    rgba[idx + 3] = 255;
  }

  const tex = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.max(1, Math.min(anisotropy, 8));
  tex.needsUpdate = true;
  return tex;
}

function buildSurfaceBuffers(size, generator) {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const [h, r] = generator(u, v);
      height[idx] = h;
      rough[idx] = r;
    }
  }
  return { height, rough };
}

function makeDiamondTreadHeight(u, v) {
  // 8x8 alternating +/-45 deg raised steel checkerplate lugs aligned with switchroom deck tiles
  const gx = u * 8.0;
  const gy = v * 8.0;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  const lx = gx - cx - 0.5;
  const ly = gy - cy - 0.5;
  const rotSign = (cx + cy) % 2 === 1 ? 1 : -1;
  const a = (lx + rotSign * ly) * 0.70710678;
  const b = (-rotSign * lx + ly) * 0.70710678;

  // Elongated diamond/lozenge bead profile
  const d = Math.abs(a) / 0.34 + Math.abs(b) / 0.125;
  const lug = d < 1.0 ? Math.pow(1.0 - d, 0.55) : 0.0;

  // Panel plate seam near edges of tile
  const seam = u < 0.016 || u > 0.984 || v < 0.016 || v > 0.984 ? -0.24 : 0.0;
  const grit = (fbmPeriodic(u, v, 16, 16, 3, 11) - 0.5) * 0.08;
  const h = Math.max(0, Math.min(1, 0.28 + lug * 0.65 + seam + grit));
  // Raised lugs are polished by work boots (lower roughness); valleys are coated/dusty (higher roughness)
  const wear = fbmPeriodic(u, v, 8, 8, 2, 31);
  const r = Math.max(0.32, Math.min(0.92, 0.78 - lug * 0.30 + (wear - 0.5) * 0.14));
  return [h, r];
}

function makePowderCoatHeight(u, v) {
  // Marine switchgear electrostatic powder-coat orange-peel stipple
  const fine = fbmPeriodic(u, v, 32, 32, 3, 101);
  const micro = valueNoisePeriodic(u, v, 64, 64, 137);
  const h = 0.5 + (fine - 0.5) * 0.55 + (micro - 0.5) * 0.25;
  const macroSheen = fbmPeriodic(u, v, 6, 6, 2, 151);
  const r = 0.44 + (fine - 0.5) * 0.12 + (macroSheen - 0.5) * 0.10;
  return [h, r];
}

function makeBrushedSteelHeight(u, v) {
  // Anisotropic brushed stainless/galvanized grain along U axis
  const streaks = fbmPeriodic(u, v, 4, 64, 3, 211);
  const fineLines = valueNoisePeriodic(u, v, 8, 128, 229);
  const h = 0.5 + (streaks - 0.5) * 0.52 + (fineLines - 0.5) * 0.34;
  const r = 0.29 + (streaks - 0.5) * 0.14 + (fineLines - 0.5) * 0.08;
  return [h, r];
}

function makeBulkheadWallHeight(u, v) {
  // Modular marine steel bulkhead sheets with subtle vertical chamfer joints + matte enamel
  const jointDist = Math.min(u, 1.0 - u, Math.abs(u - 0.5));
  const seamDip = jointDist < 0.012 ? -(1.0 - jointDist / 0.012) * 0.36 : 0.0;
  const roller = fbmPeriodic(u, v, 24, 24, 3, 307);
  const h = Math.max(0, Math.min(1, 0.58 + seamDip + (roller - 0.5) * 0.18));
  const r = 0.64 + (roller - 0.5) * 0.14 + (seamDip < -0.05 ? 0.12 : 0.0);
  return [h, r];
}

function makeLaminatedWoodHeight(u, v) {
  // Laminated workbench hardwood grain
  const warp = fbmPeriodic(u, v, 4, 8, 3, 409) * 0.35;
  const rings = 0.5 + 0.5 * Math.sin((v * 14.0 + warp * 8.0) * Math.PI * 2.0);
  const pores = valueNoisePeriodic(u, v, 32, 96, 431);
  const h = 0.42 + rings * 0.24 + (pores - 0.5) * 0.18;
  const r = 0.56 - rings * 0.10 + (pores - 0.5) * 0.10;
  return [h, r];
}

function makeRubberEsdHeight(u, v) {
  // Anti-static phenolic / HV dielectric rubber mat micro-pebble stipple
  const pebble = valueNoisePeriodic(u, v, 48, 48, 503);
  const grain = fbmPeriodic(u, v, 16, 16, 2, 521);
  const h = 0.5 + (pebble - 0.5) * 0.50 + (grain - 0.5) * 0.25;
  const r = 0.78 + (grain - 0.5) * 0.14;
  return [h, r];
}

function makeCastResinHeight(u, v) {
  // Molded epoxy resin insulator / bushing with low-frequency glassy micro-mottle
  const mottle = fbmPeriodic(u, v, 8, 8, 3, 607);
  const h = 0.5 + (mottle - 0.5) * 0.18;
  const r = 0.26 + (mottle - 0.5) * 0.12;
  return [h, r];
}

function makeCopperBusHeight(u, v) {
  // Rolled electrolytic copper busbar with fine longitudinal milling marks
  const mill = fbmPeriodic(u, v, 6, 48, 3, 701);
  const h = 0.5 + (mill - 0.5) * 0.36;
  const r = 0.24 + (mill - 0.5) * 0.12;
  return [h, r];
}

/**
 * Build a deterministic library of tangent-space PBR normalMap + roughnessMap texture pairs
 * for shipboard switchboard steel, brushed trims, diamond checkerplate deck, bulkheads,
 * laminated bench wood, ESD rubber, cast epoxy resin, and copper busbars.
 */
export function createPbrMaterialLibrary({ size = 128, maxAnisotropy = 4 } = {}) {
  const specs = {
    powderCoat: { gen: makePowderCoatHeight, strength: 1.05, repeat: [3, 3], defaultNormalScale: 0.34 },
    brushedSteel: { gen: makeBrushedSteelHeight, strength: 1.35, repeat: [2, 2], defaultNormalScale: 0.42 },
    checkerplate: { gen: makeDiamondTreadHeight, strength: 2.35, repeat: [13, 12], defaultNormalScale: 0.92 },
    bulkheadWall: { gen: makeBulkheadWallHeight, strength: 1.25, repeat: [5, 1], defaultNormalScale: 0.46 },
    laminatedWood: { gen: makeLaminatedWoodHeight, strength: 1.15, repeat: [2, 2], defaultNormalScale: 0.38 },
    rubberEsd: { gen: makeRubberEsdHeight, strength: 1.30, repeat: [3, 3], defaultNormalScale: 0.48 },
    castResin: { gen: makeCastResinHeight, strength: 0.70, repeat: [2, 2], defaultNormalScale: 0.22 },
    copperBus: { gen: makeCopperBusHeight, strength: 1.05, repeat: [2, 2], defaultNormalScale: 0.30 },
  };

  const library = {};
  for (const [key, cfg] of Object.entries(specs)) {
    const { height, rough } = buildSurfaceBuffers(size, cfg.gen);
    const [repeatX, repeatY] = cfg.repeat;
    library[key] = {
      normalMap: createNormalMapFromHeightData(height, size, size, {
        strength: cfg.strength,
        repeatX,
        repeatY,
        anisotropy: maxAnisotropy,
      }),
      roughnessMap: createRoughnessMapFromData(rough, size, size, {
        repeatX,
        repeatY,
        anisotropy: maxAnisotropy,
      }),
      defaultNormalScale: cfg.defaultNormalScale,
    };
  }

  library.dispose = () => {
    for (const key of Object.keys(specs)) {
      library[key]?.normalMap?.dispose?.();
      library[key]?.roughnessMap?.dispose?.();
    }
  };

  return library;
}

/**
 * Return MeshStandardMaterial / MeshPhysicalMaterial PBR map props from a library surface entry.
 */
export function pbrMapProps(surfaceSet, { normalScale, roughnessMultiplier = 1.0 } = {}) {
  const ns = normalScale ?? surfaceSet.defaultNormalScale ?? 0.45;
  return {
    normalMap: surfaceSet.normalMap,
    normalScale: new THREE.Vector2(ns, ns),
    roughnessMap: surfaceSet.roughnessMap,
    roughness: roughnessMultiplier,
  };
}
