/* Reconcile header / filter / wishlist layout when viewport changes */
const PMJViewport = (() => {
  let tier = '';
  let timer = null;

  function getTier(w = window.innerWidth) {
    if (w <= 360) return 'fold';
    if (w <= 479) return 'mobile';
    if (w <= 767) return 'phone';
    if (w <= 1024) return 'tablet';
    if (w <= 1279) return 'laptop';
    if (w <= 1919) return 'desktop';
    if (w <= 2559) return 'qhd';
    return '4k';
  }

  function auditLayout() {
    const doc = document.documentElement;
    const issues = [];
    const clientW = doc.clientWidth;
    const scrollW = doc.scrollWidth;

    if (scrollW > clientW + 2) {
      issues.push(`overflow ${scrollW - clientW}px`);
    }

    const header = document.getElementById('siteHeader');
    const headerH = header?.offsetHeight || 0;
    const cssH = parseFloat(getComputedStyle(doc).getPropertyValue('--site-header-height')) || 0;
    if (Math.abs(headerH - cssH) > 6) {
      issues.push(`header ${headerH}px vs var ${cssH}px`);
    }

    const filter = document.getElementById('filterBar');
    const filterTop = filter?.getBoundingClientRect().top ?? 0;
    const inHeader = filter?.classList.contains('filter-bar--in-header');
    const atHome = document.body.classList.contains('plp-at-home');

    if (filter && !inHeader && filterTop < headerH - 4) {
      issues.push(`filter under header (${Math.round(filterTop)}<${headerH})`);
    }

    const wishlist = document.getElementById('openDrawer');
    if (wishlist) {
      const inNav = !!wishlist.closest('.header-main-row nav');
      const inSlot = !!wishlist.closest('#filterWishlistSlot');
      if (atHome && !inNav) issues.push('wishlist not in nav');
      if (!atHome && !inSlot) issues.push('wishlist not in filter bar');
    }

    return issues;
  }

  function closeFloatingUi() {
    if (typeof window.closeCategoryPanel === 'function') {
      window.closeCategoryPanel();
    } else {
      document.getElementById('categoryPanel')?.classList.add('hidden');
      document.getElementById('categoryBrowseBtn')?.setAttribute('aria-expanded', 'false');
    }
    window.closeSortPanel?.();
  }

  function refresh() {
    const next = getTier();
    const changed = next !== tier;
    tier = next;

    document.documentElement.dataset.pmjViewport = tier;
    document.documentElement.style.setProperty('--pmj-viewport-tier', `"${tier}"`);

    if (typeof window.PMJHeaderScroll?.reconcileLayout === 'function') {
      window.PMJHeaderScroll.reconcileLayout();
    } else {
      window.PMJHeaderScroll?.syncHeaderHeight?.();
    }

    closeFloatingUi();
    window.PMJTheme?.updateToggleVisibility?.();

    window.applyFeaturedVisualNow?.();
    window.Viewer360?.resize?.();

    const issues = auditLayout();
    const detail = {
      tier,
      changed,
      width: window.innerWidth,
      height: window.innerHeight,
      issues,
      atHome: document.body.classList.contains('plp-at-home'),
      stuck: document.body.classList.contains('filter-bar-stuck'),
    };

    window.dispatchEvent(new CustomEvent('pmj:viewport-changed', { detail }));

    if (issues.length) {
      console.warn('[PMJ viewport]', tier, issues.join('; '));
    }
  }

  function scheduleRefresh() {
    clearTimeout(timer);
    timer = window.setTimeout(refresh, 140);
  }

  function init() {
    tier = getTier();
    document.documentElement.dataset.pmjViewport = tier;

    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('orientationchange', () => {
      window.setTimeout(refresh, 300);
    }, { passive: true });

    const boot = () => refresh();
    if (document.body.classList.contains('catalogue-ready')) {
      boot();
    } else {
      window.addEventListener('pmj:intro-complete', boot, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { getTier, refresh, auditLayout, scheduleRefresh };
})();

window.PMJViewport = PMJViewport;
