/* Live UI click / interaction monitor — visible HUD + event log for debugging */
const PMJUiMonitor = (() => {
  const MAX = 30;
  const events = [];
  let hud = null;
  let listEl = null;

  const enabled =
    /[?&]monitor=1/i.test(location.search) ||
    localStorage.getItem('pmj_ui_monitor') === '1' ||
    /localhost|127\.0\.0\.1/.test(location.hostname);

  function describeTarget(el) {
    if (!el || el === document.body) return 'body';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList?.length
      ? `.${[...el.classList].slice(0, 2).join('.')}`
      : '';
    const label =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      (el.textContent || '').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${label ? ` "${label}"` : ''}`;
  }

  function push(type, detail) {
    const entry = {
      t: new Date().toISOString().slice(11, 23),
      type,
      ...detail,
    };
    events.unshift(entry);
    if (events.length > MAX) events.pop();
    window.__pmjUiLog = events;
    console.log('[PMJ UI]', type, detail);
    renderHud();
    navigator.sendBeacon?.(
      '/__pmj-ui-log',
      new Blob([JSON.stringify(entry)], { type: 'application/json' })
    );
  }

  function renderHud() {
    if (!listEl) return;
    listEl.innerHTML = events
      .slice(0, 12)
      .map(
        (e) =>
          `<li><span class="ui-mon-t">${e.t}</span> <strong>${e.type}</strong> ${e.target || ''}${e.extra ? ` · ${e.extra}` : ''}</li>`
      )
      .join('');
  }

  function buildHud() {
    hud = document.createElement('div');
    hud.id = 'pmjUiMonitor';
    hud.innerHTML = `
      <div class="ui-mon-head">
        <span>UI Monitor · <em id="pmjUiMonTier">—</em></span>
        <button type="button" id="pmjUiMonitorClose" aria-label="Hide monitor">×</button>
      </div>
      <ol class="ui-mon-list"></ol>`;
    document.body.appendChild(hud);
    listEl = hud.querySelector('.ui-mon-list');
    hud.querySelector('#pmjUiMonitorClose')?.addEventListener('click', () => {
      hud.classList.add('hidden');
      localStorage.setItem('pmj_ui_monitor', '0');
    });
  }

  function onClick(e) {
    const t =
      e.target.closest(
        'button, a, input, .card, .filter-chip, .category-panel-item, .card-media, .wishlist-tab, .theme-toggle'
      ) || e.target;
    push('click', { target: describeTarget(t) });
  }

  function onScroll() {
    push('scroll', {
      target: 'window',
      extra: `y=${Math.round(window.scrollY)} home=${document.body.classList.contains('plp-at-home')}`,
    });
  }

  function onInput(e) {
    if (e.target.id !== 'searchInput') return;
    push('input', {
      target: describeTarget(e.target),
      extra: String(e.target.value || '').slice(0, 40),
    });
  }

  function updateTierBadge(detail = {}) {
    const el = document.getElementById('pmjUiMonTier');
    if (!el) return;
    const tier = detail.tier || document.documentElement.dataset.pmjViewport || '?';
    const w = detail.width || window.innerWidth;
    el.textContent = `${tier} ${w}px`;
  }

  function init() {
    if (!enabled || hud) return;
    if (localStorage.getItem('pmj_ui_monitor') === '0') return;

    buildHud();
    updateTierBadge();
    push('monitor', { target: 'ready', extra: PMJTheme?.getTheme?.() || 'dark' });

    window.addEventListener('pmj:viewport-changed', (e) => {
      const d = e.detail || {};
      updateTierBadge(d);
      push('viewport', {
        target: d.tier || 'unknown',
        extra: `${d.width || '?'}×${d.height || '?'} home=${d.atHome} stuck=${d.stuck}${d.issues?.length ? ' ⚠ ' + d.issues.join(', ') : ''}`,
      });
    });

    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    let scrollTimer;
    window.addEventListener(
      'scroll',
      () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(onScroll, 120);
      },
      { passive: true }
    );

    window.addEventListener('pmj:theme-changed', (e) => {
      push('theme', { target: 'toggle', extra: e.detail?.theme || '' });
    });

    document.addEventListener('pmj:ui-action', (e) => {
      push(e.detail?.type || 'action', {
        target: e.detail?.target || '',
        extra: e.detail?.extra || '',
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { push, getLog: () => [...events] };
})();

window.PMJUiMonitor = PMJUiMonitor;
