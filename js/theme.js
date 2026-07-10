/* Customer light / dark theme toggle */
const PMJTheme = (() => {
  const STORAGE_KEY = 'pmj_customer_theme';
  const THEME_BTN_IDS = ['themeToggle', 'mobileThemeToggle', 'mobileThemeToolbar'];

  function loadSettings() {
    return typeof window.loadDisplaySettings === 'function'
      ? window.loadDisplaySettings()
      : { customerThemeToggle: true };
  }

  function isToggleEnabled() {
    return true;
  }

  function isMobileView() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function isCatalogueActive() {
    return (
      document.body.classList.contains('catalogue-ready') ||
      document.body.classList.contains('site-revealed')
    );
  }

  function getThemeButtons() {
    return THEME_BTN_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      next === 'light' ? '#f2f2f7' : '#0b0b0d'
    );
    document.querySelector('meta[name="color-scheme"]')?.setAttribute(
      'content',
      next === 'light' ? 'light dark' : 'dark'
    );
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) { /* ignore */ }
    updateToggleUi();
    document.body.classList.add('theme-switching');
    window.dispatchEvent(new CustomEvent('pmj:theme-changed', { detail: { theme: next } }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('theme-switching');
      });
    });
  }

  function syncToggleButton(btn) {
    if (!btn) return;
    const light = getTheme() === 'light';
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    btn.title = light ? 'Dark mode' : 'Light mode';
  }

  function updateToggleUi() {
    getThemeButtons().forEach(syncToggleButton);
  }

  function updateToggleVisibility() {
    const enabled = isToggleEnabled();
    const active = isCatalogueActive();

    const headerBtn = document.getElementById('themeToggle');
    const filterBtn = document.getElementById('mobileThemeToggle');
    const toolbarBtn = document.getElementById('mobileThemeToolbar');

    if (headerBtn) {
      headerBtn.classList.toggle('hidden', !(enabled && active));
    }
    if (filterBtn) {
      filterBtn.classList.toggle('hidden', !(enabled && active));
    }
    if (toolbarBtn) {
      toolbarBtn.classList.toggle('hidden', !(enabled && active));
    }
  }

  function toggle() {
    applyTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  function bindToggles() {
    getThemeButtons().forEach((btn) => {
      if (!btn || btn.dataset.themeBound === '1') return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggle();
      });
    });
  }

  function init() {
    let saved = 'dark';
    try {
      saved = localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch (e) { /* ignore */ }
    applyTheme(saved);
    bindToggles();

    window.addEventListener('pmj:display-settings-changed', updateToggleVisibility);
    window.addEventListener('pmj:viewport-changed', updateToggleVisibility);
    window.addEventListener('pmj:intro-complete', updateToggleVisibility);
    window.addEventListener('resize', () => {
      clearTimeout(window.__pmjThemeResizeTimer);
      window.__pmjThemeResizeTimer = setTimeout(updateToggleVisibility, 120);
    }, { passive: true });

    const observer = new MutationObserver(updateToggleVisibility);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    updateToggleVisibility();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { applyTheme, toggle, updateToggleVisibility, updateToggleUi, isToggleEnabled, getTheme };
})();

window.PMJTheme = PMJTheme;
