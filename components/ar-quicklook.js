// AR Quick Look — opens USDZ in Apple's native AR viewer
// Works on iOS Safari and visionOS Safari
//
// Apple's pattern: <a rel="ar"> wrapping a child <img>.
// Safari detects this and intercepts the tap to open AR Quick Look
// instead of downloading the file.

export function createQuickLookLink(artwork, childElement) {
  if (!artwork.usdz) return childElement;

  const link = document.createElement('a');
  link.href = artwork.usdz;
  link.rel = 'ar';
  link.className = 'ar-quicklook-link';

  // Safari requires a child <img> to recognize the AR link.
  // We add a hidden one if the child element isn't an <img>.
  const triggerImg = document.createElement('img');
  triggerImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  triggerImg.alt = '';
  triggerImg.className = 'ar-trigger-img';
  link.appendChild(triggerImg);

  link.appendChild(childElement);
  return link;
}

export function createQuickLookBadge(artwork) {
  if (!artwork.usdz) return null;

  const link = document.createElement('a');
  link.href = '#';
  link.rel = 'ar';
  link.className = 'ar-badge-link';
  link.dataset.usdzSrc = artwork.usdz;

  // Hidden img required by Safari for AR link detection
  const triggerImg = document.createElement('img');
  triggerImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  triggerImg.alt = '';
  triggerImg.className = 'ar-trigger-img';
  link.appendChild(triggerImg);

  const label = document.createElement('span');
  label.className = 'ar-badge-label';
  label.textContent = 'View in AR';
  link.appendChild(label);

  // Swap in real USDZ href on interaction (before Safari's click AR interception)
  function swapHref() {
    link.href = link.dataset.usdzSrc;
  }
  link.addEventListener('mousedown', swapHref);
  link.addEventListener('touchstart', swapHref);

  // Prevent the card click from also firing
  link.addEventListener('click', (e) => e.stopPropagation());

  return link;
}
