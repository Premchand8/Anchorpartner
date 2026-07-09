/* Home header at top · filter bar docks into header on scroll · stays until back at top */
const PMJHeaderScroll = (() => {
  const SCROLL_AWAY_MIN = 48;
  const SCROLL_HOME = 8;
  let initialized = false;
  let stuck = false;
  let atHome = true;
  let ticking = false;
  let leaveTimer = null;
  let wishlistHome = null;
  let headerObserver = null;

  function getScrollAwayThreshold() {
    const { header } = getEls();
    return Math.max(SCROLL_AWAY_MIN, Math.round((header?.offsetHeight || 68) * 0.82));
  }

  function getEls() {
    return {
      header: document.getElementById('siteHeader'),
      filterBar: document.getElementById('filterBar'),
      filterAnchor: document.getElementById('filterBarAnchor'),
      filterDock: document.getElementById('headerFilterDock'),
      wishlistBtn: document.getElementById('openDrawer'),
      wishlistSlot: document.getElementById('filterWishlistSlot'),
    };
  }

  function ensureWishlistHome() {
    if (!wishlistHome) {
      wishlistHome = document.querySelector('.header-main-row nav');
    }
    return wishlistHome;
  }

  function setWishlistDocked(docked) {
    const { wishlistBtn, wishlistSlot } = getEls();
    const home = ensureWishlistHome();
    if (!wishlistBtn || !wishlistSlot || !home) return;

    if (docked) {
      wishlistSlot.appendChild(wishlistBtn);
      wishlistSlot.setAttribute('aria-hidden', 'false');
    } else {
      home.appendChild(wishlistBtn);
      wishlistSlot.setAttribute('aria-hidden', 'true');
    }
  }

  function syncFilterAnchorHeight() {
    const { filterBar, filterAnchor } = getEls();
    if (!filterBar || !filterAnchor) return;

    if (stuck || filterBar.parentElement !== filterAnchor) {
      if (stuck) {
        filterAnchor.style.minHeight = '0';
        filterAnchor.style.height = '0';
      } else if (filterBar.parentElement !== filterAnchor) {
        filterAnchor.style.minHeight = '';
        filterAnchor.style.height = '';
      }
      return;
    }

    filterAnchor.style.minHeight = `${filterBar.offsetHeight}px`;
    filterAnchor.style.height = '';
  }

  function syncHeaderHeight() {
    const { header, filterBar, filterAnchor } = getEls();
    const h = header?.offsetHeight || 68;
    document.documentElement.style.setProperty('--site-header-height', `${h}px`);
    const stuckBarH = stuck && filterBar ? filterBar.offsetHeight : 0;
    document.documentElement.style.setProperty('--filter-bar-stuck-height', `${stuckBarH}px`);
    if (stuck && filterBar && filterAnchor) {
      filterAnchor.style.minHeight = '0';
    }
    syncFilterAnchorHeight();
  }

  function setHomeMode(nextAtHome) {
    atHome = nextAtHome;
    document.body.classList.toggle('plp-at-home', atHome);
    document.body.classList.toggle('plp-scrolled', !atHome);
    const { header } = getEls();
    header?.classList.toggle('header-at-home', atHome);
    header?.classList.toggle('header-scrolled', !atHome);
    header?.classList.toggle('scrolled', !atHome);
    window.PMJTheme?.updateToggleVisibility?.();
  }

  function setFilterStuck(next, immediate = false, force = false) {
    const { filterBar, filterAnchor, filterDock } = getEls();
    if (!filterBar || !filterAnchor || !filterDock) return;
    if (!force && stuck === next) return;
    stuck = next;

    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    if (next) {
      filterAnchor.style.minHeight = '0';
      filterDock.appendChild(filterBar);
      filterBar.classList.add('filter-bar--in-header');
      filterDock.setAttribute('aria-hidden', 'false');
      document.body.classList.add('filter-bar-stuck');
      setWishlistDocked(true);
      filterBar.classList.remove('filter-bar--leaving');
      filterBar.classList.add('filter-bar--entering');
      filterBar.addEventListener(
        'animationend',
        () => {
          filterBar.classList.remove('filter-bar--entering');
          syncHeaderHeight();
        },
        { once: true }
      );
    } else {
      const finish = () => {
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        filterBar.classList.remove('filter-bar--in-header', 'filter-bar--leaving', 'filter-bar--entering');
        filterAnchor.insertBefore(filterBar, filterAnchor.firstChild);
        filterAnchor.style.minHeight = '';
        filterDock.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('filter-bar-stuck');
        setWishlistDocked(false);
        syncHeaderHeight();
      };

      if (immediate) {
        finish();
      } else {
        filterBar.classList.add('filter-bar--leaving');
        filterBar.classList.remove('filter-bar--entering');
        let done = false;
        const finishOnce = () => {
          if (done) return;
          done = true;
          finish();
        };
        filterBar.addEventListener('animationend', finishOnce, { once: true });
        leaveTimer = setTimeout(finishOnce, 420);
      }
    }

    syncHeaderHeight();
  }

  function applyScrollState() {
    const y = window.scrollY || document.documentElement.scrollTop;
    const scrollAway = getScrollAwayThreshold();
    const isGallery = document.body.dataset.pmjBrowse === 'gallery';

    if (!isGallery) {
      const atTop = y < SCROLL_HOME;
      setHomeMode(atTop);
      setFilterStuck(false, true);
      syncHeaderHeight();
      return;
    }

    if (atHome && y > scrollAway) {
      setHomeMode(false);
      setFilterStuck(true);
    } else if (!atHome && y < SCROLL_HOME) {
      setHomeMode(true);
      setFilterStuck(false, true);
    }

    syncHeaderHeight();
  }

  function reconcileLayout() {
    const { filterBar, filterAnchor, filterDock } = getEls();
    if (!filterBar || !filterAnchor || !filterDock) return;

    const y = window.scrollY || document.documentElement.scrollTop;
    const isGallery = document.body.dataset.pmjBrowse === 'gallery';

    if (!isGallery) {
      const atTop = y < SCROLL_HOME;
      setHomeMode(atTop);
      setFilterStuck(false, true, true);
      syncHeaderHeight();
      return;
    }

    const wantStuck = y > getScrollAwayThreshold();
    const inDock = filterBar.parentElement === filterDock;
    const inAnchor = filterBar.parentElement === filterAnchor;
    const domStuck = document.body.classList.contains('filter-bar-stuck');

    if (wantStuck !== stuck || wantStuck !== domStuck || (wantStuck && !inDock) || (!wantStuck && !inAnchor)) {
      setHomeMode(!wantStuck);
      setFilterStuck(wantStuck, true, true);
    } else {
      setWishlistDocked(wantStuck);
      atHome = !wantStuck;
    }

    syncHeaderHeight();
    requestAnimationFrame(() => {
      syncHeaderHeight();
      window.PMJViewport?.auditLayout?.();
    });
  }

  function boot() {
    if (initialized) return;
    if (!document.body.classList.contains('catalogue-ready')) return;
    initialized = true;

    const y = window.scrollY || document.documentElement.scrollTop;
    atHome = y < getScrollAwayThreshold();
    stuck = false;
    setHomeMode(atHome);
    setFilterStuck(!atHome, true);

    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          applyScrollState();
          ticking = false;
        });
      },
      { passive: true }
    );

    window.addEventListener('resize', () => {
      reconcileLayout();
    });

    applyScrollState();

    document.getElementById('headerBrandLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function queueBoot() {
    if (document.body.classList.contains('catalogue-ready')) {
      boot();
      return;
    }
    window.addEventListener('pmj:intro-complete', boot, { once: true });
    const observer = new MutationObserver(() => {
      if (document.body.classList.contains('catalogue-ready')) {
        observer.disconnect();
        boot();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queueBoot);
  } else {
    queueBoot();
  }

  return { syncHeaderHeight, refresh: applyScrollState, reconcileLayout };
})();

window.PMJHeaderScroll = PMJHeaderScroll;
