// Gaussian Splat viewer component
// Embeds the hosted splat viewer in an iframe

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

export function isSplatArtwork(artwork) {
  return artwork.splat != null;
}
