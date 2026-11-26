import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const GRAPHICS_QUALITY_HIGH = 'high';
export const GRAPHICS_QUALITY_STANDARD = 'standard';

export function normalizeGraphicsQuality(value) {
  return value === GRAPHICS_QUALITY_STANDARD ? GRAPHICS_QUALITY_STANDARD : GRAPHICS_QUALITY_HIGH;
}

/**
 * Set immediate RoomEnvironment IBL and asynchronously upgrade to a custom
 * Blender-rendered equirectangular Radiance `.hdr` switchroom environment map.
 */
export function loadSwitchroomEnvironment({ renderer, scene, hdrUrl, envIntensity = 0.85 }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  let activeEnvRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = activeEnvRT.texture;
  scene.environmentIntensity = 0.68;

  let disposed = false;

  if (hdrUrl && typeof window !== 'undefined') {
    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      hdrUrl,
      (hdrTexture) => {
        if (disposed) {
          hdrTexture.dispose();
          return;
        }
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        const nextRT = pmrem.fromEquirectangular(hdrTexture);
        hdrTexture.dispose();

        const prevRT = activeEnvRT;
        activeEnvRT = nextRT;
        scene.environment = activeEnvRT.texture;
        scene.environmentIntensity = envIntensity;
        prevRT?.dispose?.();
      },
      undefined,
      () => {
        // Keep RoomEnvironment fallback seamlessly if offline or headless
      }
    );
  }

  return {
    dispose() {
      disposed = true;
      activeEnvRT?.dispose?.();
      pmrem.dispose();
    },
  };
}

/**
 * Temporarily hide meshes whose material is explicitly invisible (`material.visible === false`)
 * so depth/normal override passes like SSAOPass never render invisible click-proxy hitboxes.
 */
function hideInvisibleProxyMeshes(scene) {
  const hidden = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return;
    const mat = obj.material;
    if (mat && !Array.isArray(mat) && mat.visible === false) {
      obj.visible = false;
      hidden.push(obj);
    }
  });
  return hidden;
}

function restoreHiddenMeshes(hidden) {
  for (let i = 0; i < hidden.length; i++) {
    hidden[i].visible = true;
  }
}

/**
 * Adaptive post-processing pipeline:
 * - `'high'`: Multisampled HalfFloat RenderTarget -> RenderPass -> tuned SSAOPass ->
 *             high-threshold UnrealBloomPass -> OutputPass (ACES Filmic + sRGB).
 * - `'standard'`: Direct `renderer.render(scene, camera)` zero-overhead fallback.
 */
export function createPostProcessingPipeline({
  renderer,
  scene,
  camera,
  width,
  height,
  initialQuality = GRAPHICS_QUALITY_HIGH,
  onQualityFallback = null,
}) {
  let quality = normalizeGraphicsQuality(initialQuality);
  let composer = null;
  let ssaoPass = null;
  let bloomPass = null;
  let renderTarget = null;
  let composerBroken = false;

  const initComposer = (w, h) => {
    try {
      const pixelRatio = renderer.getPixelRatio();
      const rtW = Math.max(1, Math.floor(w * pixelRatio));
      const rtH = Math.max(1, Math.floor(h * pixelRatio));
      const isWebGL2 = Boolean(renderer.capabilities?.isWebGL2);

      renderTarget = new THREE.WebGLRenderTarget(rtW, rtH, {
        type: THREE.HalfFloatType,
        samples: isWebGL2 ? 4 : 0,
      });

      composer = new EffectComposer(renderer, renderTarget);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      // Meter-scale tuned SSAO for crisp cabinet/deck contact shadows without halos
      ssaoPass = new SSAOPass(scene, camera, w, h, 24);
      ssaoPass.kernelRadius = 0.36;
      ssaoPass.minDistance = 0.0005;
      ssaoPass.maxDistance = 0.028;
      composer.addPass(ssaoPass);

      // High-threshold bloom: affects only bright emissive lamps, arc-flash, and HDR highlights
      bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.20, 0.28, 1.52);
      composer.addPass(bloomPass);

      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch {
      composerBroken = true;
      composer = null;
      quality = GRAPHICS_QUALITY_STANDARD;
      onQualityFallback?.(GRAPHICS_QUALITY_STANDARD);
    }
  };

  initComposer(width, height);

  function setSize(w, h) {
    const safeW = Math.max(1, Math.floor(w));
    const safeH = Math.max(1, Math.floor(h));
    if (composer && !composerBroken) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(safeW, safeH);
      ssaoPass?.setSize?.(safeW, safeH);
      bloomPass?.setSize?.(safeW, safeH);
    }
  }

  function setQuality(next) {
    const normalized = normalizeGraphicsQuality(next);
    if (normalized === GRAPHICS_QUALITY_HIGH && composerBroken) {
      quality = GRAPHICS_QUALITY_STANDARD;
      return quality;
    }
    quality = normalized;
    return quality;
  }

  function getQuality() {
    return quality;
  }

  function render() {
    if (quality === GRAPHICS_QUALITY_HIGH && composer && !composerBroken) {
      const hidden = hideInvisibleProxyMeshes(scene);
      try {
        composer.render();
        return;
      } catch {
        composerBroken = true;
        quality = GRAPHICS_QUALITY_STANDARD;
        onQualityFallback?.(GRAPHICS_QUALITY_STANDARD);
      } finally {
        restoreHiddenMeshes(hidden);
      }
    }
    renderer.render(scene, camera);
  }

  function dispose() {
    ssaoPass?.dispose?.();
    bloomPass?.dispose?.();
    composer?.dispose?.();
    renderTarget?.dispose?.();
  }

  return {
    render,
    setSize,
    setQuality,
    getQuality,
    dispose,
  };
}
