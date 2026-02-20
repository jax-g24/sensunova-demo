import { createModelElement, supportsModelElement } from '../components/model-loader.js';
import { createQuickLookLink } from '../components/ar-quicklook.js';
import { createWebXRButton } from '../components/webxr-viewer.js';
import { isSplatArtwork, createSplatEmbed } from '../components/splat-viewer.js';

function createDetailPlaceholder(artwork) {
  const div = document.createElement('div');
  div.className = 'poster-placeholder';
  div.style.background = `linear-gradient(135deg, ${artwork.color}, ${artwork.color}dd)`;
  div.textContent = artwork.title.charAt(0);
  return div;
}

function createMetadataPanel(artwork, state) {
  const info = document.createElement('div');
  info.className = 'detail-info';

  const h1 = document.createElement('h1');
  h1.textContent = artwork.title;

  const artist = document.createElement('p');
  artist.className = 'artist';
  artist.textContent = artwork.artist;

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${artwork.medium} \u00b7 ${artwork.dimensions} \u00b7 ${artwork.year}`;

  const desc = document.createElement('p');
  desc.className = 'description';
  desc.textContent = artwork.description;

  info.appendChild(h1);
  info.appendChild(artist);
  info.appendChild(meta);
  info.appendChild(desc);

  return info;
}

export function renderDetailView(container, state, navigate) {
  const artwork = state.selectedArtwork;

  container.classList.add('view-exiting');

  setTimeout(async () => {
    container.textContent = '';
    container.classList.remove('view-exiting');
    container.classList.add('view-entering');

    const detail = document.createElement('div');
    detail.className = 'artwork-detail';

    // Back button
    const back = document.createElement('button');
    back.className = 'back-button';
    back.textContent = '\u2190 Back to Gallery';
    back.addEventListener('click', () => {
      window.location.hash = '#/';
    });

    // Model container
    const modelContainer = document.createElement('div');
    modelContainer.className = 'detail-model';

    if (isSplatArtwork(artwork)) {
      // --- Gaussian Splat artwork: iframe embed + AR Quick Look ---
      const embed = createSplatEmbed(artwork);
      if (embed) modelContainer.appendChild(embed);

      // AR buttons if USDZ is available
      if (artwork.usdz) {
        const buttonRow = document.createElement('div');
        buttonRow.className = 'detail-model-actions';
        buttonRow.appendChild(createAROverlayButton(artwork));

        const xrBtn = await createWebXRButton(artwork);
        if (xrBtn) buttonRow.appendChild(xrBtn);

        modelContainer.appendChild(buttonRow);
      }

      detail.appendChild(back);
      detail.appendChild(modelContainer);

      const hint = document.createElement('p');
      hint.className = 'detail-hint';
      hint.textContent = artwork.usdz
        ? 'Orbit the splat capture, or tap "View in AR" to place it in your room'
        : 'Orbit and zoom the Gaussian splat capture';
      detail.appendChild(hint);

    } else {
      // --- Standard USDZ/GLB artwork ---
      const modelEl = await createModelElement(artwork, state);

      if (modelEl) {
        modelContainer.appendChild(modelEl);
      } else {
        let placeholder;
        if (artwork.poster) {
          placeholder = document.createElement('img');
          placeholder.src = artwork.poster;
          placeholder.alt = artwork.title;
        } else {
          placeholder = createDetailPlaceholder(artwork);
        }

        if (artwork.usdz) {
          const arContent = document.createElement('div');
          arContent.className = 'detail-model-ar-wrap';
          arContent.appendChild(placeholder);

          const prompt = document.createElement('div');
          prompt.className = 'ar-tap-prompt';
          prompt.textContent = 'Tap to view in AR';
          arContent.appendChild(prompt);

          const arLink = createQuickLookLink(artwork, arContent);
          modelContainer.appendChild(arLink);
        } else {
          modelContainer.appendChild(placeholder);
        }
      }

      // Action buttons overlay
      const buttonRow = document.createElement('div');
      buttonRow.className = 'detail-model-actions';

      if (artwork.usdz) {
        buttonRow.appendChild(createAROverlayButton(artwork));
      }

      const xrBtn = await createWebXRButton(artwork);
      if (xrBtn) buttonRow.appendChild(xrBtn);

      if (buttonRow.children.length > 0) {
        modelContainer.appendChild(buttonRow);
      }

      detail.appendChild(back);
      detail.appendChild(modelContainer);

      const hint = document.createElement('p');
      hint.className = 'detail-hint';
      if (state.isVisionOS) {
        hint.textContent = 'Interact with the model, or tap "Enter Gallery" to place it in the gallery space';
      } else if (artwork.glb) {
        hint.textContent = 'Tap "Enter Gallery" to view this artwork in the immersive gallery';
      } else if (artwork.usdz) {
        hint.textContent = 'Tap "View in AR" to see this artwork in your room';
      }
      if (hint.textContent) detail.appendChild(hint);
    }

    detail.appendChild(createMetadataPanel(artwork, state));
    container.appendChild(detail);

    requestAnimationFrame(() => container.classList.remove('view-entering'));
  }, 200);
}

function createAROverlayButton(artwork) {
  const link = document.createElement('a');
  link.href = artwork.usdz;
  link.rel = 'ar';
  link.className = 'ar-overlay-button';

  const triggerImg = document.createElement('img');
  triggerImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  triggerImg.alt = '';
  triggerImg.className = 'ar-trigger-img';
  link.appendChild(triggerImg);

  const label = document.createElement('span');
  label.textContent = 'View in AR';
  link.appendChild(label);

  return link;
}
