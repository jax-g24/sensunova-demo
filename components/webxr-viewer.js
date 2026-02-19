// WebXR immersive gallery viewer
// Loads the gallery environment as a 3D scene and lets users bring artwork into it

import { gallery } from '../data.js';

let xrSession = null;
let xrMode = null;
let renderer = null;
let scene = null;
let camera = null;
let reticle = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let hitTestAvailable = false;
let placedModels = [];
let overlay = null;
let THREE = null;
let GLTFLoader = null;
let galleryModel = null;

// Check which WebXR modes are available
async function detectWebXRSupport() {
  if (!navigator.xr) return { supported: false, mode: null };

  try {
    const arSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (arSupported) return { supported: true, mode: 'immersive-ar' };
  } catch (e) { /* not supported */ }

  try {
    const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (vrSupported) return { supported: true, mode: 'immersive-vr' };
  } catch (e) { /* not supported */ }

  return { supported: false, mode: null };
}

function createReticle() {
  const geometry = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

function createOverlay(onExit, artworkTitle, mode) {
  const div = document.createElement('div');
  div.className = 'webxr-overlay';

  const hint = document.createElement('p');
  hint.className = 'webxr-hint';
  if (artworkTitle) {
    hint.textContent = mode === 'immersive-ar'
      ? `Look at a surface, then tap to place "${artworkTitle}"`
      : `Tap to place "${artworkTitle}" in the gallery`;
  } else {
    hint.textContent = 'Entering gallery environment';
  }

  const exitBtn = document.createElement('button');
  exitBtn.className = 'webxr-exit-button';
  exitBtn.textContent = 'Exit Gallery';
  exitBtn.addEventListener('click', onExit);

  div.appendChild(hint);
  div.appendChild(exitBtn);
  return div;
}

async function loadGLBModel(url, targetScale) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      if (targetScale) {
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = targetScale / maxDim;
          model.scale.setScalar(scale);
        }
      }
      resolve(model);
    }, undefined, reject);
  });
}

async function loadGalleryEnvironment() {
  const envUrl = gallery.environmentGlb;
  if (!envUrl) return null;

  try {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(envUrl, (gltf) => {
        const model = gltf.scene;

        // The gallery model is in centimeter-scale (bounds ~1200 units wide)
        // Scale down to meters: divide by 100
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        // Target: gallery should be ~12m wide (room-scale)
        const targetSize = 12;
        const scale = targetSize / maxDim;
        model.scale.setScalar(scale);

        // Center the gallery around the user (origin)
        model.position.set(
          -center.x * scale,
          -center.y * scale + 0.5, // lift slightly so floor is near user feet
          -center.z * scale
        );

        resolve(model);
      }, undefined, reject);
    });
  } catch (err) {
    console.error('Failed to load gallery environment:', err);
    return null;
  }
}

function createPlaceholderModel() {
  const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4A90D9,
    metalness: 0.3,
    roughness: 0.7
  });
  return new THREE.Mesh(geometry, material);
}

function placeModel(glbUrl, position, quaternion) {
  const place = (model) => {
    if (position) {
      model.position.copy(position);
    }
    if (quaternion) {
      model.quaternion.copy(quaternion);
    }
    scene.add(model);
    placedModels.push(model);
  };

  if (glbUrl) {
    loadGLBModel(glbUrl, 0.3).then(place).catch(err => {
      console.error('Failed to load model:', err);
      place(createPlaceholderModel());
    });
  } else {
    place(createPlaceholderModel());
  }
}

function onSelect(glbUrl) {
  if (hitTestAvailable && reticle && reticle.visible) {
    const position = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(reticle.matrix);
    placeModel(glbUrl, position, quaternion);
  } else {
    // Place 1.5m in front of the camera
    const direction = new THREE.Vector3(0, 0, -1.5);
    direction.applyQuaternion(camera.quaternion);
    const position = camera.position.clone().add(direction);
    position.y -= 0.3;
    placeModel(glbUrl, position, null);
  }
}

function onXRFrame(t, frame) {
  const session = renderer.xr.getSession();
  if (!session) return;

  // Try to set up hit-testing if available
  if (xrMode === 'immersive-ar' && !hitTestSourceRequested) {
    hitTestSourceRequested = true;
    session.requestReferenceSpace('viewer').then(viewerSpace => {
      if (session.requestHitTestSource) {
        session.requestHitTestSource({ space: viewerSpace }).then(source => {
          hitTestSource = source;
          hitTestAvailable = true;
        }).catch(() => {
          hitTestAvailable = false;
        });
      }
    }).catch(() => {
      hitTestAvailable = false;
    });
  }

  // Update reticle from hit-test results
  if (hitTestSource && frame.getHitTestResults) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    try {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const pose = results[0].getPose(referenceSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
    } catch {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
}

async function startSession(mode, glbUrl, artworkTitle) {
  cleanup();

  xrMode = mode;
  overlay = createOverlay(endSession, artworkTitle, mode);
  document.body.appendChild(overlay);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 200);

  // Lighting for the gallery
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(2, 4, 2);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-2, 3, -1);
  scene.add(fillLight);

  reticle = createReticle();
  scene.add(reticle);

  // Request WebXR session FIRST — must happen synchronously from user gesture
  // Loading the gallery GLB afterwards is fine since the session is already active
  const sessionOptions = {
    optionalFeatures: ['dom-overlay', 'hit-test', 'local-floor'],
    domOverlay: { root: overlay }
  };

  try {
    const session = await navigator.xr.requestSession(mode, sessionOptions);
    renderer.xr.setSession(session);
    xrSession = session;

    session.addEventListener('end', cleanup);

    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => onSelect(glbUrl));
    scene.add(controller);

    renderer.setAnimationLoop(onXRFrame);

    // Load gallery environment in the background after session starts
    loadGalleryEnvironment().then(galleryScene => {
      if (galleryScene && scene) {
        galleryModel = galleryScene;
        scene.add(galleryScene);
      }
    }).catch(err => console.error('Gallery env load failed:', err));

  } catch (err) {
    console.error('Failed to start WebXR session:', err);
    cleanup();
    throw err;
  }
}

function endSession() {
  if (xrSession) xrSession.end();
}

function cleanup() {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  overlay = null;
  hitTestSource = null;
  hitTestSourceRequested = false;
  hitTestAvailable = false;
  placedModels = [];
  reticle = null;
  galleryModel = null;
  scene = null;
  camera = null;
  xrMode = null;
  if (renderer) {
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer = null;
  }
  xrSession = null;
}

async function ensureThreeLoaded() {
  if (!THREE) {
    THREE = await import('three');
  }
  if (!GLTFLoader) {
    const module = await import('three/addons/loaders/GLTFLoader.js');
    GLTFLoader = module.GLTFLoader;
  }
}

export async function createWebXRButton(artwork) {
  const { supported, mode } = await detectWebXRSupport();

  if (!supported) return null;

  // Preload Three.js so it's cached before the user clicks
  ensureThreeLoaded().catch(() => {});

  const button = document.createElement('a');
  button.href = '#';
  button.className = 'ar-overlay-button ar-overlay-button-xr';

  const label = document.createElement('span');
  label.textContent = 'Enter Gallery';
  button.appendChild(label);

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    label.textContent = 'Loading\u2026';
    try {
      await ensureThreeLoaded();
      await startSession(mode, artwork.glb, artwork.title);
      label.textContent = 'Enter Gallery';
    } catch (err) {
      console.error('WebXR error:', err);
      label.textContent = 'Enter Gallery';
    }
  });

  return button;
}
