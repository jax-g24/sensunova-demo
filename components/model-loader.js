// Feature detection for native <model> element (visionOS Safari)
export function supportsModelElement() {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('model');
  return 'ready' in el;
}

const isVisionOS = supportsModelElement();

// Cache loaded model elements
const modelCache = new Map();

export function createModelElement(artwork, state) {
  // Return cached if available
  if (modelCache.has(artwork.id)) {
    return modelCache.get(artwork.id).cloneNode(true);
  }

  let element;

  if (isVisionOS && artwork.usdz) {
    // Native <model> element on visionOS
    element = document.createElement('model');
    element.setAttribute('interactive', '');
    element.style.width = '100%';
    element.style.height = '100%';

    const sourceUsdz = document.createElement('source');
    sourceUsdz.src = artwork.usdz;
    sourceUsdz.type = 'model/vnd.usdz+zip';

    element.appendChild(sourceUsdz);

    // Add GLB as fallback source if available
    if (artwork.glb) {
      const sourceGlb = document.createElement('source');
      sourceGlb.src = artwork.glb;
      sourceGlb.type = 'model/gltf-binary';
      element.appendChild(sourceGlb);
    }

    // Poster image as final fallback inside <model>
    if (artwork.poster) {
      const fallback = document.createElement('img');
      fallback.src = artwork.poster;
      fallback.alt = artwork.title;
      element.appendChild(fallback);
    }

    element.ready
      .then(() => element.classList.add('loaded'))
      .catch(() => console.error(`Failed to load model: ${artwork.id}`));

  } else if (artwork.glb) {
    // <model-viewer> fallback for desktop/mobile
    element = document.createElement('model-viewer');
    element.setAttribute('src', artwork.glb);
    if (artwork.usdz) element.setAttribute('ios-src', artwork.usdz);
    if (artwork.poster) element.setAttribute('poster', artwork.poster);
    element.setAttribute('alt', artwork.title);
    element.setAttribute('camera-controls', '');
    element.setAttribute('ar', '');
    element.setAttribute('shadow-intensity', '1');
    element.setAttribute('auto-rotate', '');
    element.style.width = '100%';
    element.style.height = '100%';

  } else {
    // No GLB available and not visionOS — can't show interactive 3D
    return null;
  }

  modelCache.set(artwork.id, element);
  return element;
}
