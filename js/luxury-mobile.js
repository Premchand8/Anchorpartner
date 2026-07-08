/* Luxury mobile — filter accordions, PLP FABs, availability radios */
const PMJLuxuryMobile = (() => {
  const VIEW_KEY = 'pmj_plp_view';

  function isLuxuryMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function bindFilterAccordions() {
    document.querySelectorAll('.lux-filter-acc-head').forEach((head) => {
      if (head.dataset.accBound === '1') return;
      head.dataset.accBound = '1';
      head.addEventListener('click', () => {
        const acc = head.closest('.lux-filter-acc');
        const open = acc?.classList.toggle('is-open');
        const toggle = head.querySelector('.lux-acc-toggle');
        if (toggle) toggle.textContent = open ? '−' : '+';
      });
    });
  }

  function bindAvailabilityRadios() {
    const root = document.getElementById('sheetAvailabilityChips');
    if (!root || root.dataset.radioBound === '1') return;
    root.dataset.radioBound = '1';

    root.addEventListener('change', (e) => {
      const input = e.target.closest('input[name="availFilter"]');
      if (!input) return;
      if (typeof window.applyAvailabilityFilter === 'function') {
        window.applyAvailabilityFilter(input.value);
      }
    });
  }

  function syncAvailabilityRadios(value) {
    document.querySelectorAll('input[name="availFilter"]').forEach((input) => {
      input.checked = input.value === value;
    });
  }

  function updateAvailabilityCounts() {
    const products = typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : [];
    const counts = { all: products.length, ready: 0, mto: 0 };
    products.forEach((p) => {
      const a = typeof getProductAvailability === 'function' ? getProductAvailability(p.id) : p.availability;
      if (a === 'ready') counts.ready += 1;
      else counts.mto += 1;
    });
    document.querySelectorAll('[data-avail-count]').forEach((el) => {
      const key = el.dataset.availCount;
      if (counts[key] !== undefined) el.textContent = `(${counts[key]})`;
    });
    window.updateSheetResultsLabel?.();
  }

  function applyPlpView(mode) {
    const catalogue = document.getElementById('catalogue');
    const toggleBtn = document.getElementById('plpViewToggle');
    if (!catalogue || !toggleBtn) return;

    const isList = mode === 'list';
    catalogue.classList.toggle('catalogue--list-view', isList);
    toggleBtn.setAttribute('aria-pressed', isList ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      isList ? 'Switch to grid view' : 'Switch to list view'
    );
  }

  function bindViewToggle() {
    const btn = document.getElementById('plpViewToggle');
    const catalogue = document.getElementById('catalogue');
    if (!btn || !catalogue || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.classList.remove('hidden');

    const saved = sessionStorage.getItem(VIEW_KEY);
    applyPlpView(saved === 'list' ? 'list' : 'grid');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = catalogue.classList.contains('catalogue--list-view') ? 'grid' : 'list';
      applyPlpView(next);
      sessionStorage.setItem(VIEW_KEY, next);
    });
  }

  function bindBackToTop() {
    const btn = document.getElementById('plpBackToTop');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.classList.remove('hidden');

    const onScroll = () => {
      if (!isLuxuryMobile()) {
        btn.classList.remove('is-visible');
        return;
      }
      btn.classList.toggle('is-visible', window.scrollY > 320);
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function init() {
    bindFilterAccordions();
    bindAvailabilityRadios();
    bindViewToggle();
    bindBackToTop();
    updateAvailabilityCounts();
    window.addEventListener('pmj:catalogue-updated', updateAvailabilityCounts);
    window.syncAvailabilityRadios = syncAvailabilityRadios;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { updateAvailabilityCounts, syncAvailabilityRadios, applyPlpView };
})();

window.PMJLuxuryMobile = PMJLuxuryMobile;
