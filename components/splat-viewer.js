// Gaussian Splat viewer component
// Option 1: Iframe embed (SuperSplat viewer)
// Option 2: Three.js splat renderer (@mkkellogg/gaussian-splats-3d)

let threeJsSplatLoaded = false;

// Option 1: Embed the hosted splat viewer in an iframe
export function createSplatEmbed(artwork) {
  if (!artwork.splat || !artwork.splat.embedUrl) return null;

  const container = document.createElement('div');
  container.className = 'splat-embed-container';

  const iframe = document.createElement('iframe');
  iframe.src = artwork.splat.embedUrl;
  iframe.className = 'splat-iframe';
  iframe.setAttribute('allow', 'fullscreen; xr-spatial-tracking');
  iframe.setAttribute('allowfullscreen', '');
  iframe.title = artwork.title;

  container.appendChild(iframe);
  return container;
}

// Option 2: Three.js Gaussian splat renderer
// Uses @mkkellogg/gaussian-splats-3d for native Three.js rendering
export async function createSplatThreeJS(artwork, containerEl) {
  if (!artwork.splat || !artwork.splat.splatUrl) return null;

  const container = document.createElement('div');
  container.className = 'splat-threejs-container';

  const canvas = document.createElement('canvas');
  canvas.className = 'splat-canvas';
  container.appendChild(canvas);

  // Loading indicator
  const loading = document.createElement('div');
  loading.className = 'splat-loading';
  loading.textContent = 'Loading splat\u2026';
  container.appendChild(loading);

  // Load Three.js and the splat renderer on demand
  initSplatRenderer(artwork, canvas, container, loading);

  return container;
}

async function initSplatRenderer(artwork, canvas, container, loading) {
  try {
    const THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js');
    const { OrbitControls } = await import('https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js');

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 1, 3);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);

    // Try to load the GaussianSplats3D library
    try {
      const GaussianSplats3DModule = await import('https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.6/build/gaussian-splats-3d.module.min.js');
      const GaussianSplats3D = GaussianSplats3DModule.default || GaussianSplats3DModule;

      const viewer = new GaussianSplats3D.Viewer({
        selfDrivenMode: false,
        renderer: renderer,
        camera: camera,
        threeScene: scene,
      });

      await viewer.addSplatScene(artwork.splat.splatUrl, {
        showLoadingUI: false,
      });

      loading.style.display = 'none';

      function animate() {
        requestAnimationFrame(animate);
        controls.update();
        viewer.update();
        viewer.render();
      }
      animate();

    } catch (splatErr) {
      console.warn('Gaussian splat library failed, falling back to iframe:', splatErr);
      // Fall back to iframe embed
      loading.textContent = 'Splat renderer unavailable \u2014 using embedded viewer';
      setTimeout(() => {
        const embed = createSplatEmbed(artwork);
        if (embed) {
          container.textContent = '';
          container.appendChild(embed);
        }
      }, 1500);
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

  } catch (err) {
    console.error('Failed to initialize splat renderer:', err);
    loading.textContent = 'Failed to load 3D viewer';
  }
}

// Detect if artwork is a splat type
export function isSplatArtwork(artwork) {
  return artwork.splat != null;
}
