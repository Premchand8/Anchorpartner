/* Categories derived from uploaded / catalogue products only */
const CATEGORY_LABELS = {
  necklace: 'Necklaces & Pendants',
  earring: 'Earrings',
  ring: 'Rings',
  bangle: 'Bangles',
  bracelet: 'Bracelets',
  pendant: 'Pendants',
  chain: 'Chains',
  jhumka: 'Jhumkas',
  stud: 'Studs',
  temple: 'Temple Jewellery',
  bridal: 'Bridal Sets',
  mangalsutra: 'Mangalsutras',
  vaddanam: 'Vaddanams',
  nosepin: 'Nose Pins',
};

const CATEGORY_ICONS = {
  all: '✦',
  necklace: '◇',
  earring: '◈',
  ring: '○',
  bangle: '◯',
  bracelet: '◉',
  pendant: '◆',
  chain: '⛓',
  jhumka: '❋',
  stud: '•',
  temple: '☸',
  bridal: '♛',
  mangalsutra: '∞',
  vaddanam: '▭',
  nosepin: '•',
};

function isMobilePlp() {
  return window.innerWidth <= 900;
}

const CATEGORY_SHORT_LABELS = {
  all: 'All',
  necklace: 'Necklace',
  earring: 'Earrings',
  ring: 'Rings',
  bangle: 'Bangles',
  bracelet: 'Bracelet',
  pendant: 'Pendant',
  chain: 'Chains',
  jhumka: 'Jhumka',
  stud: 'Studs',
  temple: 'Temple',
  bridal: 'Bridal',
  mangalsutra: 'Mangalsutra',
  vaddanam: 'Vaddanam',
  nosepin: 'Nose Pin',
};

function getCategoryShortLabel(catId) {
  if (CATEGORY_SHORT_LABELS[catId]) return CATEGORY_SHORT_LABELS[catId];
  const full = getCategoryLabel(catId);
  return full.split(/[\s&]/)[0] || full;
}

function updateMobileFilterCategoryLabel(activeId = 'all') {
  const el = document.getElementById('mobileFilterCategoryLabel');
  if (!el || !isMobilePlp()) return;
  if (activeId === 'all') {
    el.textContent = '';
    el.setAttribute('aria-hidden', 'true');
    return;
  }
  el.textContent = getCategoryShortLabel(activeId);
  el.removeAttribute('aria-hidden');
}

function getCategoryIcon(catId) {
  if (CATEGORY_ICONS[catId]) return CATEGORY_ICONS[catId];
  return '◆';
}

function getProductsForCategories() {
  return typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : (PRODUCTS || []);
}

function getCategoryCounts() {
  const counts = new Map();
  getProductsForCategories().forEach((p) => {
    if (!p?.cat) return;
    counts.set(p.cat, (counts.get(p.cat) || 0) + 1);
  });
  return counts;
}

function getCategoryLabel(catId) {
  if (catId === 'all') return 'All Pieces';
  if (CATEGORY_LABELS[catId]) return CATEGORY_LABELS[catId];
  const products = getProductsForCategories();
  const fromProduct = products.find((p) => p.cat === catId);
  if (fromProduct?.catLabel) return fromProduct.catLabel;
  return catId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Only categories that exist on current products (admin upload ready) */
function getCategoryListForUi() {
  const collectionId = window.currentCollectionFilter || null;
  let products = getProductsForCategories();
  if (collectionId && typeof getProductsInCollection === 'function') {
    products = getProductsInCollection(collectionId);
  } else if (collectionId) {
    products = products.filter((p) => (p.collections || []).includes(collectionId));
  }
  const map = new Map();

  products.forEach((p) => {
    if (!p?.cat) return;
    if (!map.has(p.cat)) {
      map.set(p.cat, { id: p.cat, label: getCategoryLabel(p.cat), count: 0 });
    }
    map.get(p.cat).count += 1;
  });

  const sorted = [...map.values()].sort((a, b) => a.label.localeCompare(b.label));

  return [
    { id: 'all', label: 'All Pieces', count: products.length },
    ...sorted,
  ];
}

function renderCategoryChip(cat, activeId) {
  const icon = getCategoryIcon(cat.id);
  const countHtml = cat.id === 'all' ? '' : `<span class="filter-chip-count">${cat.count ?? 0}</span>`;
  const label = isMobilePlp() ? getCategoryShortLabel(cat.id) : cat.label;
  const iconHtml = isMobilePlp()
    ? `<span class="filter-chip-icon" aria-hidden="true">${icon}</span>`
    : '';
  const ariaLabel = isMobilePlp() ? ` aria-label="${cat.label}"` : '';
  return (
    `<button type="button" class="filter-chip filter-chip--compact${cat.id === activeId ? ' active' : ''}"` +
    ` data-filter="${cat.id}" role="tab" aria-selected="${cat.id === activeId}"${ariaLabel}>` +
    `${iconHtml}<span class="filter-chip-text">${label}</span>${countHtml}</button>`
  );
}

function renderCategoryPanelItem(cat, activeId) {
  const checked = cat.id === activeId ? 'checked' : '';
  const selected = cat.id === activeId ? ' is-selected' : '';
  return (
    `<label class="lux-filter-row lux-filter-check category-panel-item${selected}" data-filter="${cat.id}">` +
    `<input type="radio" name="catFilter" value="${cat.id}" ${checked}>` +
    `<span class="lux-filter-label category-panel-item-label">${cat.label}</span>` +
    `<span class="lux-filter-count category-panel-item-count">(${cat.count ?? 0})</span>` +
    `</label>`
  );
}

function buildCategoryFilters(activeId = 'all') {
  const scroll = document.getElementById('categoryScroll');
  const panelGrid = document.getElementById('categoryPanelGrid');
  const browseBtn = document.getElementById('categoryBrowseBtn');
  const activeLabel = document.getElementById('categoryActiveLabel');
  const list = getCategoryListForUi();
  const categoriesOnly = list.filter((c) => c.id !== 'all');

  if (scroll) {
    scroll.innerHTML = list.map((c) => renderCategoryChip(c, activeId)).join('');
    requestAnimationFrame(() => {
      scroll.querySelector('.filter-chip.active')?.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: 'smooth',
      });
    });
  }

  if (panelGrid) {
    panelGrid.innerHTML = list.map((c) => renderCategoryPanelItem(c, activeId)).join('');
  }

  if (activeLabel) activeLabel.textContent = getCategoryLabel(activeId);
  if (browseBtn) {
    browseBtn.classList.add('hidden');
  }

  window.PMJHeaderScroll?.syncHeaderHeight?.();
  window.updateMobileResultsBar?.();
  updateMobileFilterCategoryLabel(activeId);
}

function closeCategoryPanel() {
  const panel = document.getElementById('categoryPanel');
  const backdrop = document.getElementById('categoryPanelBackdrop');
  const browseBtn = document.getElementById('categoryBrowseBtn');
  const filterBtn = document.getElementById('mobileFilterBtn');
  const searchInput = document.getElementById('categorySearch');

  panel?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  document.body.classList.remove('plp-sheet-open');
  browseBtn?.setAttribute('aria-expanded', 'false');
  filterBtn?.setAttribute('aria-expanded', 'false');
  filterBtn?.classList.remove('is-active');

  window.setTimeout(() => {
    if (!panel?.classList.contains('is-open')) {
      panel?.classList.add('hidden');
      backdrop?.classList.add('hidden');
    }
    if (!document.getElementById('sortPanel')?.classList.contains('is-open')) {
      document.body.classList.remove('plp-sheet-open');
    }
  }, 380);

  if (searchInput) searchInput.value = '';
  panel?.querySelectorAll('.category-panel-item').forEach((el) => el.classList.remove('hidden'));
}

function openCategoryPanel(source = 'filter') {
  window.closeSortPanel?.();
  const panel = document.getElementById('categoryPanel');
  const backdrop = document.getElementById('categoryPanelBackdrop');
  const browseBtn = document.getElementById('categoryBrowseBtn');
  const filterBtn = document.getElementById('mobileFilterBtn');

  panel?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  requestAnimationFrame(() => {
    panel?.classList.add('is-open');
    backdrop?.classList.add('is-visible');
  });
  document.body.classList.add('plp-sheet-open');
  filterBtn?.setAttribute('aria-expanded', 'true');
  filterBtn?.classList.add('is-active');
  if (source === 'browse') browseBtn?.setAttribute('aria-expanded', 'true');
  window.syncSheetAvailabilityChips?.();
  window.updateSheetResultsLabel?.();
}

function initCategoryUi(onSelect) {
  buildCategoryFilters('all');

  const panel = document.getElementById('categoryPanel');
  const browseBtn = document.getElementById('categoryBrowseBtn');
  const mobileBtn = document.getElementById('mobileFilterBtn');
  const backdrop = document.getElementById('categoryPanelBackdrop');
  const closeBtn = document.getElementById('categoryPanelClose');
  const sheetApply = document.getElementById('sheetShowResults');
  const sheetClear = document.getElementById('sheetClearFilters');
  const searchInput = document.getElementById('categorySearch');

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel?.classList.contains('is-open')) closeCategoryPanel();
    else openCategoryPanel('browse');
  });

  mobileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel?.classList.contains('is-open')) closeCategoryPanel();
    else openCategoryPanel('filter');
  });

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCategoryPanel();
  });

  backdrop?.addEventListener('click', () => closeCategoryPanel());

  sheetApply?.addEventListener('click', (e) => {
    e.preventDefault();
    closeCategoryPanel();
    window.scrollToCatalogueResults?.();
  });

  sheetClear?.addEventListener('click', (e) => {
    e.preventDefault();
    window.clearAllFilters?.();
    window.updateSheetResultsLabel?.();
  });

  document.addEventListener('click', (e) => {
    if (!panel?.classList.contains('is-open')) return;
    if (panel.contains(e.target) || browseBtn?.contains(e.target) || mobileBtn?.contains(e.target)) return;
    closeCategoryPanel();
  });

  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    panel?.querySelectorAll('.category-panel-item').forEach((btn) => {
      const label = btn.querySelector('.category-panel-item-label')?.textContent?.toLowerCase() || '';
      btn.classList.toggle('hidden', q.length > 0 && !label.includes(q));
    });
  });

  function handleCategoryPick(btn, closeAfter = true) {
    if (!btn || btn.disabled) return;
    const id = btn.dataset.filter;
    if (!id) return;
    panel?.querySelectorAll('input[name="catFilter"]').forEach((input) => {
      input.checked = input.value === id;
    });
    panel?.querySelectorAll('.category-panel-item[data-filter]').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.filter === id);
      el.classList.toggle('active', el.dataset.filter === id);
    });
    onSelect(id);
    window.updateSheetResultsLabel?.();
    if (closeAfter) closeCategoryPanel();
    if (searchInput) searchInput.value = '';
    panel?.querySelectorAll('.category-panel-item').forEach((el) => el.classList.remove('hidden'));
  }

  panel?.addEventListener('change', (e) => {
    const input = e.target.closest('input[name="catFilter"]');
    if (!input) return;
    const item = input.closest('.category-panel-item[data-filter]');
    if (item) handleCategoryPick(item, false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (panel?.classList.contains('hidden') && !panel?.classList.contains('is-open')) return;
    closeCategoryPanel();
  });

  window.addEventListener('pmj:catalogue-updated', () => {
    buildCategoryFilters(window.currentCategoryFilter || 'all');
    window.renderCatalogueGrid?.();
  });

  window.addEventListener('pmj:viewport-changed', () => {
    closeCategoryPanel();
    buildCategoryFilters(window.currentCategoryFilter || 'all');
  });
}

window.CATEGORY_LABELS = CATEGORY_LABELS;
window.getCategoryLabel = getCategoryLabel;
window.getCategoryListForUi = getCategoryListForUi;
window.buildCategoryFilters = buildCategoryFilters;
window.initCategoryUi = initCategoryUi;
window.refreshCategoryFilters = buildCategoryFilters;
window.closeCategoryPanel = closeCategoryPanel;
window.openCategoryPanel = openCategoryPanel;
window.getCategoryShortLabel = getCategoryShortLabel;
window.updateMobileFilterCategoryLabel = updateMobileFilterCategoryLabel;
