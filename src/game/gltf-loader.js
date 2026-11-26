import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let sharedDracoLoader = null;
let sharedGltfLoader = null;

/**
 * Resolve a path under `public/` respecting Vite's BASE_URL (e.g. GitHub Pages subpath).
 */
export function resolvePublicAssetUrl(relativePath = '') {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
  const prefix = String(baseUrl).replace(/\/?$/, '/');
  const clean = String(relativePath).replace(/^\/+/, '');
  return `${prefix}${clean}`;
}

/**
 * Create a GLTFLoader pre-configured with local Draco WASM/JS decoders bundled in `public/draco/`.
 * In non-browser (headless Node) runtimes, Draco worker instantiation is skipped unless forced.
 */
export function createDracoGltfLoader({ enableDraco = typeof window !== 'undefined' } = {}) {
  const loader = new GLTFLoader();
  if (enableDraco) {
    if (!sharedDracoLoader) {
      sharedDracoLoader = new DRACOLoader();
      sharedDracoLoader.setDecoderPath(resolvePublicAssetUrl('draco/'));
    }
    loader.setDRACOLoader(sharedDracoLoader);
  }
  return loader;
}

/**
 * Return a singleton Draco-enabled GLTFLoader shared across room props and rigged characters.
 */
export function getSharedGltfLoader() {
  if (!sharedGltfLoader) {
    sharedGltfLoader = createDracoGltfLoader();
  }
  return sharedGltfLoader;
}
