/* Collections browse — stage transitions & stagger orchestration */
const PMJCollectionsAnim = (() => {
  let veilEl = null;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function ensureVeil() {
    if (veilEl) return veilEl;
    veilEl = document.getElementById('browseTransitionVeil');
    if (!veilEl) {
      veilEl = document.createElement('div');
      veilEl.id = 'browseTransitionVeil';
      veilEl.className = 'browse-transition-veil';
      veilEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(veilEl);
    }
    return veilEl;
  }

  function flashTransition(run) {
    if (prefersReducedMotion()) {
      run();
      return Promise.resolve();
    }

    const veil = ensureVeil();
    document.body.classList.add('browse-transitioning');

    return new Promise((resolve) => {
      veil.classList.add('is-active');
      window.setTimeout(() => {
        run();
        window.requestAnimationFrame(() => {
          veil.classList.remove('is-active');
          document.body.classList.remove('browse-transitioning');
          resolve();
        });
      }, 340);
    });
  }

  function clearRevealClasses(container, selector, stageClass) {
    container?.classList.remove(stageClass);
    container?.querySelectorAll(selector).forEach((el) => {
      el.classList.remove('is-revealing', 'is-activating');
      el.style.removeProperty('--stagger');
    });
  }

  function staggerElements(container, selector, step = 0.06, base = 0.08) {
    if (!container) return;
    container.querySelectorAll(selector).forEach((el, i) => {
      el.style.setProperty('--stagger', `${base + i * step}s`);
      el.classList.add('is-revealing');
    });
  }

  function playStageEntrance(stage) {
    if (prefersReducedMotion()) return;

    const hub = document.getElementById('collectionsHub');
    const landing = document.getElementById('collectionLanding');
    const catalogue = document.getElementById('catalogue');
    const filterAnchor = document.getElementById('filterBarAnchor');

    if (stage === 'collections') {
      clearRevealClasses(hub, '.collection-banner', 'browse-stage-enter');
      clearRevealClasses(landing, '.collection-category-tile', 'browse-stage-enter');
      filterAnchor?.classList.remove('browse-filter-enter');
      void hub?.offsetWidth;
      hub?.classList.add('browse-stage-enter');
      staggerElements(document.getElementById('collectionsGrid'), '.collection-banner', 0.07, 0.05);
      return;
    }

    if (stage === 'categories') {
      clearRevealClasses(landing, '.collection-category-tile', 'browse-stage-enter');
      void landing?.offsetWidth;
      landing?.classList.add('browse-stage-enter');
      staggerElements(document.getElementById('collectionCategoriesGrid'), '.collection-category-tile', 0.05, 0.22);
      return;
    }

    if (stage === 'gallery') {
      const galleryCrumb = document.getElementById('plpMobileCrumb');
      const hero = document.getElementById('collectionGalleryHero');
      const stageWrap = document.getElementById('collectionGalleryStage');
      filterAnchor?.classList.remove('browse-filter-enter');
      galleryCrumb?.classList.remove('browse-crumb-enter');
      hero?.classList.remove('gallery-hero-enter');
      stageWrap?.classList.remove('gallery-stage-unveil');
      catalogue?.classList.remove('browse-stage-enter');
      void catalogue?.offsetWidth;
      catalogue?.classList.add('browse-stage-enter');
      void filterAnchor?.offsetWidth;
      filterAnchor?.classList.add('browse-filter-enter');
      void galleryCrumb?.offsetWidth;
      galleryCrumb?.classList.add('browse-crumb-enter');
      void hero?.offsetWidth;
      hero?.classList.add('gallery-hero-enter');
      void stageWrap?.offsetWidth;
      stageWrap?.classList.add('gallery-stage-unveil');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('pmj:gallery-reveal'));
      }, 120);
    }
  }

  function pulseCategoryTile(tile) {
    if (!tile || prefersReducedMotion()) return;
    tile.classList.add('is-activating');
    tile.addEventListener(
      'animationend',
      () => tile.classList.remove('is-activating'),
      { once: true }
    );
  }

  return { flashTransition, playStageEntrance, pulseCategoryTile, prefersReducedMotion };
})();

window.PMJCollectionsAnim = PMJCollectionsAnim;
