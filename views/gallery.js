import { artworks } from '../data.js';
import { createQuickLookBadge } from '../components/ar-quicklook.js';

function createPosterPlaceholder(artwork) {
  const div = document.createElement('div');
  div.className = 'poster-placeholder';
  div.style.background = `linear-gradient(135deg, ${artwork.color}, ${artwork.color}dd)`;
  div.textContent = artwork.title.charAt(0);
  return div;
}

function createArtworkInfo(artwork) {
  const info = document.createElement('div');
  info.className = 'artwork-info';

  const h2 = document.createElement('h2');
  h2.textContent = artwork.title;

  const artist = document.createElement('p');
  artist.className = 'artist';
  artist.textContent = artwork.artist;

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${artwork.medium} \u00b7 ${artwork.year}`;

  info.appendChild(h2);
  info.appendChild(artist);
  info.appendChild(meta);
  return info;
}

export function renderGalleryView(container, state, navigate) {
  container.classList.add('view-exiting');

  setTimeout(() => {
    container.textContent = '';
    container.classList.remove('view-exiting');
    container.classList.add('view-entering');

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    artworks.forEach(artwork => {
      const card = document.createElement('article');
      card.className = 'artwork-card';

      const posterWrap = document.createElement('div');
      posterWrap.className = 'artwork-poster';

      if (artwork.poster) {
        const img = document.createElement('img');
        img.src = artwork.poster;
        img.alt = artwork.title;
        img.loading = 'lazy';
        posterWrap.appendChild(img);
      } else {
        posterWrap.appendChild(createPosterPlaceholder(artwork));
      }

      // Type badge + AR Quick Look
      if (artwork.splat) {
        const badge = document.createElement('span');
        badge.className = 'badge-3d';
        badge.textContent = 'SPLAT';
        posterWrap.appendChild(badge);
      } else {
        const arBadge = createQuickLookBadge(artwork);
        if (arBadge) {
          posterWrap.appendChild(arBadge);
        }
      }

      card.appendChild(posterWrap);
      card.appendChild(createArtworkInfo(artwork));

      // Card click → detail view (AR badge has stopPropagation)
      card.addEventListener('click', () => {
        window.location.hash = `#/artwork/${artwork.id}`;
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);

    requestAnimationFrame(() => container.classList.remove('view-entering'));
  }, 200);
}
