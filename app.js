import { artworks } from './data.js';
import { renderGalleryView } from './views/gallery.js';
import { renderDetailView } from './views/detail.js';
import { supportsModelElement } from './components/model-loader.js';

const app = document.getElementById('app');

// App state
const state = {
  currentView: 'gallery',
  selectedArtwork: null,
  loadedModels: new Map(),
  isVisionOS: supportsModelElement()
};

// Router — hash-based, no page loads
function navigate(path) {
  if (path === '/' || path === '') {
    state.currentView = 'gallery';
    state.selectedArtwork = null;
    renderGalleryView(app, state, navigate);
  } else if (path.startsWith('/artwork/')) {
    const id = path.replace('/artwork/', '');
    const artwork = artworks.find(a => a.id === id);
    if (artwork) {
      state.currentView = 'detail';
      state.selectedArtwork = artwork;
      renderDetailView(app, state, navigate);
    }
  }
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
  const path = window.location.hash.replace('#', '') || '/';
  navigate(path);
});

// Initial render
const initialPath = window.location.hash.replace('#', '') || '/';
navigate(initialPath);
