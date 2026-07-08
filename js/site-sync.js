/* Shared site config — load on visit, publish when admin saves (Netlify Blobs) */
(function () {
  const STATIC_CONFIG_URL = '/data/site-config.json';
  const API_URLS = ['/api/site-config', '/.netlify/functions/site-config'];

  let publishTimer = null;

  function parseTime(cfg) {
    if (!cfg?.updatedAt) return 0;
    const t = Date.parse(cfg.updatedAt);
    return Number.isNaN(t) ? 0 : t;
  }

  function pickNewer(a, b) {
    const ta = parseTime(a);
    const tb = parseTime(b);
    if (ta && tb) return ta >= tb ? a : b;
    if (ta) return a;
    if (tb) return b;
    return a || b || null;
  }

  function collectSiteConfig() {
    try {
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        adminOverrides: JSON.parse(localStorage.getItem('pmj_admin_overrides') || '{}'),
        displaySettings: JSON.parse(localStorage.getItem('pmj_display_settings') || '{}'),
        bannerDesktop: localStorage.getItem('pmj_banner_desktop') || '',
        bannerMobile: localStorage.getItem('pmj_banner_mobile') || '',
        featuredDesktop: localStorage.getItem('pmj_featured_desktop') || '',
        featuredMobile: localStorage.getItem('pmj_featured_mobile') || '',
      };
    } catch (e) {
      console.warn('PMJ collectSiteConfig failed', e);
      return null;
    }
  }

  function applySiteConfig(data) {
    if (!data || typeof data !== 'object') return false;
    try {
      if (data.adminOverrides && typeof data.adminOverrides === 'object') {
        localStorage.setItem('pmj_admin_overrides', JSON.stringify(data.adminOverrides));
      }
      if (data.displaySettings && typeof data.displaySettings === 'object') {
        localStorage.setItem('pmj_display_settings', JSON.stringify(data.displaySettings));
      }
      if ('bannerDesktop' in data) {
        if (data.bannerDesktop) localStorage.setItem('pmj_banner_desktop', data.bannerDesktop);
        else localStorage.removeItem('pmj_banner_desktop');
      }
      if ('bannerMobile' in data) {
        if (data.bannerMobile) localStorage.setItem('pmj_banner_mobile', data.bannerMobile);
        else localStorage.removeItem('pmj_banner_mobile');
      }
      if ('featuredDesktop' in data) {
        if (data.featuredDesktop) localStorage.setItem('pmj_featured_desktop', data.featuredDesktop);
        else localStorage.removeItem('pmj_featured_desktop');
      }
      if ('featuredMobile' in data) {
        if (data.featuredMobile) localStorage.setItem('pmj_featured_mobile', data.featuredMobile);
        else localStorage.removeItem('pmj_featured_mobile');
      }
      return true;
    } catch (e) {
      console.warn('PMJ applySiteConfig failed', e);
      return false;
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return data?.config !== undefined ? data.config : data;
  }

  async function loadFromApi() {
    for (const url of API_URLS) {
      try {
        const config = await fetchJson(url);
        if (config) return config;
      } catch (e) {
        /* try next */
      }
    }
    return null;
  }

  async function loadPublishedConfig() {
    let chosen = null;
    try {
      const [remote, fallback] = await Promise.all([
        loadFromApi(),
        fetchJson(STATIC_CONFIG_URL).catch(() => null),
      ]);
      chosen = pickNewer(remote, fallback);
      if (chosen && parseTime(chosen) > 0) applySiteConfig(chosen);
    } catch (e) {
      console.warn('PMJ loadPublishedConfig failed', e);
    }
    return chosen;
  }

  function setPublishStatus(text, ok) {
    const el = document.getElementById('publishStatus');
    const pill = document.getElementById('adminPill');
    if (el) {
      el.textContent = text ? ` · ${text}` : '';
      el.dataset.state = ok ? 'ok' : text ? 'err' : '';
    }
    if (pill && ok) {
      pill.dataset.saved = '1';
      setTimeout(() => delete pill.dataset.saved, 2500);
    }
  }

  async function publishConfig(options = {}) {
    if (!adminMode) return { ok: false, reason: 'not-admin' };

    const config = collectSiteConfig();
    if (!config) return { ok: false, reason: 'collect-failed' };

    const adminCode = window.ADMIN_ACCESS_CODE || 'PMJADMIN26';
    if (!options.silent) setPublishStatus('Publishing…', false);

    for (const url of API_URLS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-PMJ-Admin': adminCode,
          },
          body: JSON.stringify({ adminCode, config }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText || 'Publish failed');
        setPublishStatus('Live', true);
        return { ok: true, updatedAt: data.updatedAt };
      } catch (e) {
        if (url === API_URLS[API_URLS.length - 1]) {
          console.warn('PMJ publish failed', e);
          if (!options.silent) {
            setPublishStatus('Offline — saved in this browser only', false);
          }
          return { ok: false, reason: 'offline' };
        }
      }
    }
    return { ok: false, reason: 'unknown' };
  }

  function schedulePublish() {
    if (!adminMode) return;
    clearTimeout(publishTimer);
    setPublishStatus('Saving…', false);
    publishTimer = setTimeout(() => publishConfig({ silent: true }), 1800);
  }

  window.PMJSiteSync = {
    collectSiteConfig,
    applySiteConfig,
    loadPublishedConfig,
    publishConfig,
    schedulePublish,
  };

  window.PMJSiteSync.ready = loadPublishedConfig();
})();
