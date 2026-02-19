// WebXR immersive viewer
// Supports both immersive-ar and immersive-vr modes
// hit-test is optional — works without it by placing in front of camera

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

// Check which WebXR modes are available
async function detectWebXRSupport() {
  if (!navigator.xr) return { supported: false, mode: null };

  // Try immersive-ar first (passthrough AR), then immersive-vr (full immersive)
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

function createOverlay(onExit, mode) {
  const div = document.createElement('div');
  div.className = 'webxr-overlay';

  const hint = document.createElement('p');
  hint.className = 'webxr-hint';
  hint.textContent = mode === 'immersive-ar'
    ? 'Look at a surface, then tap to place'
    : 'Tap to place the object in your space';

  const exitBtn = document.createElement('button');
  exitBtn.className = 'webxr-exit-button';
  exitBtn.textContent = 'Exit';
  exitBtn.addEventListener('click', onExit);

  div.appendChild(hint);
  div.appendChild(exitBtn);
  return div;
}

async function loadGLBModel(url) {
  const { GLTFLoader } = await import('https://unpkg.com/three@0.170.0/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 0.3 / maxDim;
        model.scale.setScalar(scale);
      }
      resolve(model);
    }, undefined, reject);
  });
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
    loadGLBModel(glbUrl).then(place).catch(err => {
      console.error('Failed to load model:', err);
      place(createPlaceholderModel());
    });
  } else {
    place(createPlaceholderModel());
  }
}

function onSelect(glbUrl) {
  if (hitTestAvailable && reticle && reticle.visible) {
    // Place at hit-test reticle position
    const position = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(reticle.matrix);
    placeModel(glbUrl, position, quaternion);
  } else {
    // No hit-test — place 1.5m in front of the camera
    const direction = new THREE.Vector3(0, 0, -1.5);
    direction.applyQuaternion(camera.quaternion);
    const position = camera.position.clone().add(direction);
    // Drop it down a bit to appear on a surface
    position.y -= 0.3;
    placeModel(glbUrl, position, null);
  }
}

function onXRFrame(t, frame) {
  const session = renderer.xr.getSession();
  if (!session) return;

  // Try to set up hit-testing if available (only for immersive-ar)
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

async function startSession(mode, glbUrl) {
  cleanup();

  xrMode = mode;
  overlay = createOverlay(endSession, mode);
  document.body.appendChild(overlay);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100);

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(0.5, 1, 0.5);
  scene.add(dirLight);

  reticle = createReticle();
  scene.add(reticle);

  // Build session options — only require what's available
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

export async function createWebXRButton(artwork) {
  const { supported, mode } = await detectWebXRSupport();

  if (!supported) return null; // Don't show button at all if no WebXR

  const button = document.createElement('a');
  button.href = '#';
  button.className = 'ar-overlay-button ar-overlay-button-xr';

  // Hidden img for visual consistency (not needed for WebXR, just styling)
  const label = document.createElement('span');
  label.textContent = 'Enter Immersive';
  button.appendChild(label);

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    label.textContent = 'Loading\u2026';
    try {
      THREE = await import('https://unpkg.com/three@0.170.0/build/three.module.js');
      await startSession(mode, artwork.glb);
      label.textContent = 'Enter Immersive';
    } catch (err) {
      console.error('WebXR error:', err);
      label.textContent = 'Enter Immersive';
    }
  });

  return button;
}
