(() => {
  const query = window.matchMedia('(max-width: 620px)');
  const artwork = [...document.querySelectorAll('[data-cad-image]')];
  const sources = artwork.map((button) => ({
    src: button.dataset.cadImage,
    alt: button.querySelector('img')?.alt || ''
  }));
  let wallpaper;
  let resizeTimer;

  const removeWallpaper = () => {
    wallpaper?.remove();
    wallpaper = null;
  };

  const buildWallpaper = () => {
    removeWallpaper();
    if (!query.matches || !sources.length) return;

    wallpaper = document.createElement('div');
    wallpaper.className = 'cad-wallpaper';
    wallpaper.setAttribute('aria-hidden', 'true');

    const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const rowHeight = Math.max(230, Math.min(window.innerWidth * .68, 310));
    const imageCount = Math.max(18, Math.ceil(pageHeight / rowHeight) * 2 + 4);

    for (let index = 0; index < imageCount; index += 1) {
      const source = sources[index % sources.length];
      const image = document.createElement('img');
      image.src = source.src;
      image.alt = '';
      image.loading = index < 6 ? 'eager' : 'lazy';
      image.decoding = 'async';
      wallpaper.appendChild(image);
    }

    document.body.prepend(wallpaper);
  };

  const updateMode = () => {
    artwork.forEach((button) => {
      if (query.matches) {
        button.setAttribute('tabindex', '-1');
        button.setAttribute('aria-hidden', 'true');
      } else {
        button.removeAttribute('tabindex');
        button.removeAttribute('aria-hidden');
      }
    });
    buildWallpaper();
  };

  updateMode();
  window.addEventListener('load', buildWallpaper, { once: true });
  query.addEventListener?.('change', updateMode);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildWallpaper, 180);
  });
})();
