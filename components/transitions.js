// View transition utilities
// CSS handles the core fade transitions via .view-exiting / .view-entering classes.
// This module provides optional JS-driven transition enhancements.

export function transitionView(container, renderFn, duration = 200) {
  return new Promise(resolve => {
    container.classList.add('view-exiting');

    setTimeout(() => {
      container.textContent = '';
      container.classList.remove('view-exiting');
      container.classList.add('view-entering');

      renderFn(container);

      requestAnimationFrame(() => {
        container.classList.remove('view-entering');
        resolve();
      });
    }, duration);
  });
}
