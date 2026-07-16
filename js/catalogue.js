/* Catalogue rendering, filters, lazy scroll & pagination */
if (!window.wishlist) window.wishlist = [];
let wishlist = window.wishlist;
try {
  const saved = JSON.parse(sessionStorage.getItem('pmj_active_wishlist') || '[]');
  wishlist.length = 0;
  wishlist.push(...saved);
} catch (e) {}
let currentFilter = 'all';
let availabilityFilter = 'all';
let searchQuery = '';
let sortOrder = 'featured';
let activeProductId = null;
let adminMode = false;
let visibleCount = 24;
let isLoadingMore = false;
let lazyObserver = null;
let catalogueBooted = false;

window.getCurrentCategoryFilter = () => currentFilter;

const PAGE_SIZE = 24;

function loadOverrides(){
  try { return JSON.parse(localStorage.getItem('pmj_admin_overrides') || '{}'); } catch(e){ return {}; }
}
function saveOverrides(obj){
  localStorage.setItem('pmj_admin_overrides', JSON.stringify(obj));
  window.PMJSiteSync?.schedulePublish?.();
}

function getProductAvailability(id) {
  const products = typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : PRODUCTS;
  const base = products.find((p) => p.id === id);
  const overrides = loadOverrides()[id] || {};
  const raw = overrides.availability ?? base?.availability ?? AVAILABILITY_DEFAULT;
  return normalizeAvailability(raw);
}

function getProductData(id){
  const products = typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : PRODUCTS;
  const base = products.find(p=>p.id===id);
  if (!base) return null;
  const overrides = loadOverrides()[id] || {};
  return {
    ...base,
    name: overrides.name || base.name || '',
    description: overrides.description || base.description || '',
    catLabel: overrides.catLabel || base.catLabel || '',
    purity: overrides.purity || base.purity || SPEC_DEFAULTS.purity,
    gross: overrides.gross || base.gross || SPEC_DEFAULTS.gross,
    netGold: overrides.netGold || base.netGold || SPEC_DEFAULTS.netGold,
    diamond: overrides.diamond || base.diamond || SPEC_DEFAULTS.diamond,
    stones: overrides.stones || base.stones || SPEC_DEFAULTS.stones,
    price: overrides.price || base.price || SPEC_DEFAULTS.price,
    availability: getProductAvailability(id),
    autoRotate: overrides.autoRotate,
    rotateSpeed: overrides.rotateSpeed,
    collections: overrides.collections || base.collections || [],
  };
}

function setHero(){
  const f = typeof getFeaturedSettings === 'function' ? getFeaturedSettings() : {};
  if ((f.desktopImage || f.mobileImage) && typeof applyFeaturedVisual === 'function') {
    applyFeaturedVisual();
    return;
  }
  const p = getProductData('SPND998476');
  const img = document.getElementById('heroImg');
  if (img) img.src = IMAGES[p.images[0]] || '';
  document.getElementById('heroCaption').textContent = p.name;
}

const grid = document.getElementById('productGrid');
const wishlistCountEl = document.getElementById('wishlistCount');
const wishlistTab = document.getElementById('openDrawer');
const plpLoadingEl = document.getElementById('plpLoading');

function getFilteredProducts(){
  const products = typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : PRODUCTS;
  let items = products.slice();

  if (window.showWishlistOnly) {
    items = items.filter((p) => wishlist.includes(p.id));
  }

  const collectionId = window.currentCollectionFilter || null;
  if (!window.showWishlistOnly && collectionId) {
    if (typeof productBelongsToCollection === 'function') {
      items = items.filter((p) => productBelongsToCollection(p, collectionId));
    } else {
      items = items.filter((p) => (p.collections || []).includes(collectionId));
    }
  }

  if (currentFilter !== 'all') {
    items = items.filter((p) => p.cat === currentFilter);
  }

  if (searchQuery) {
    items = items.filter((base) => productMatchesSearch(base, searchQuery));
  }

  if (availabilityFilter !== 'all') {
    items = items.filter((p) => getProductAvailability(p.id) === availabilityFilter);
  }

  return sortProducts(items);
}

function sortProducts(items) {
  const list = items.slice();
  switch (sortOrder) {
    case 'name-asc':
      return list.sort((a, b) => (getProductData(a.id)?.name || '').localeCompare(getProductData(b.id)?.name || ''));
    case 'name-desc':
      return list.sort((a, b) => (getProductData(b.id)?.name || '').localeCompare(getProductData(a.id)?.name || ''));
    case 'ready-first':
      return list.sort((a, b) => {
        const ar = getProductAvailability(a.id) === 'ready' ? 0 : 1;
        const br = getProductAvailability(b.id) === 'ready' ? 0 : 1;
        return ar - br || (getProductData(a.id)?.name || '').localeCompare(getProductData(b.id)?.name || '');
      });
    default:
      return list;
  }
}

function formatCardPrice(price) {
  const raw = String(price || '').trim();
  if (!raw || raw === SPEC_DEFAULTS.price) return 'Price on request';
  if (/^₹|^price/i.test(raw)) return raw;
  if (/^\d/.test(raw)) return `₹ ${raw}`;
  return raw;
}

function searchText(value) {
  return String(value ?? '').toLowerCase();
}

function productMatchesSearch(base, query) {
  const q = searchText(query).trim();
  if (!q) return true;
  const p = getProductData(base.id);
  if (!p?.id) return false;
  const avail = getAvailabilityMeta(p.availability);
  const catLabel = typeof getCategoryLabel === 'function' ? getCategoryLabel(p.cat) : p.catLabel;
  return (
    searchText(p.name).includes(q) ||
    searchText(p.description).includes(q) ||
    searchText(p.id).includes(q) ||
    searchText(catLabel).includes(q) ||
    searchText(p.catLabel).includes(q) ||
    searchText(p.cat).includes(q) ||
    searchText(avail.label).includes(q) ||
    searchText(avail.short).includes(q)
  );
}

function applySearch(rawValue, { scroll = true } = {}) {
  searchQuery = String(rawValue ?? '').trim();
  resetPagination();
  renderGrid(true);
  updateClearFiltersUi();
  if (searchQuery) {
    logFilterResult('search', searchQuery);
    if (scroll) scrollToCatalogueResults();
  }
}

let searchDebounceTimer;
function queueSearch(rawValue) {
  clearTimeout(searchDebounceTimer);
  const next = String(rawValue ?? '').trim();
  if (!next) {
    applySearch('');
    return;
  }
  searchDebounceTimer = setTimeout(() => applySearch(rawValue), 120);
}

function resetPagination() {
  visibleCount = PAGE_SIZE;
}

function dispatchUiAction(type, target, extra = '') {
  document.dispatchEvent(
    new CustomEvent('pmj:ui-action', { detail: { type, target, extra } })
  );
}

function filtersAreActive() {
  return currentFilter !== 'all' || availabilityFilter !== 'all' || searchQuery.length > 0;
}

function updateClearFiltersUi() {
  const btn = document.getElementById('clearAllFiltersBtn');
  if (!btn) return;
  const active = filtersAreActive();
  btn.classList.toggle('hidden', !active);
  document.body.dataset.filtersActive = active ? '1' : '';
  updateMobileResultsBar();
  updateSheetResultsLabel();
  window.updateMobileFilterCategoryLabel?.(currentFilter);
}

function syncAvailabilityChips(activeValue) {
  document.querySelectorAll('.filter-chip[data-availability]').forEach((c) => {
    c.classList.toggle('active', c.dataset.availability === activeValue);
  });
  document.querySelectorAll('input[name="availFilter"]').forEach((input) => {
    input.checked = input.value === activeValue;
  });
  window.syncAvailabilityRadios?.(activeValue);
}

function applyAvailabilityFilter(value) {
  availabilityFilter = value || 'all';
  syncAvailabilityChips(availabilityFilter);
  resetPagination();
  renderGrid(true);
  updateClearFiltersUi();
  scrollToCatalogueResults();
  logFilterResult('availability', availabilityFilter);
}

function syncSheetAvailabilityChips() {
  syncAvailabilityChips(availabilityFilter);
}

function updateMobileResultsBar() {
  const labelEl = document.getElementById('plpMobileResultsLabel');
  const countEl = document.getElementById('plpMobileResultsCount');
  const crumbCat = document.getElementById('plpCrumbCategory');
  const crumbColLink = document.getElementById('plpCrumbCollectionLink');
  const colSep = document.getElementById('plpCrumbColSep');
  const catSep = document.getElementById('plpCrumbCatSep');
  if (!labelEl || !countEl) return;

  const total = getFilteredProducts().length;
  const catLabel = typeof getCategoryLabel === 'function'
    ? getCategoryLabel(currentFilter)
    : 'All Pieces';
  const col = window.currentCollectionFilter && typeof getCollectionById === 'function'
    ? getCollectionById(window.currentCollectionFilter)
    : null;
  const inGallery = document.body.dataset.pmjBrowse === 'gallery';

  labelEl.textContent = col
    ? (currentFilter === 'all' ? col.title : `${col.title} · ${catLabel}`)
    : catLabel;
  countEl.textContent = total === 1 ? '(1 result)' : `(${total} results)`;
  if (crumbCat) crumbCat.textContent = catLabel;
  if (crumbColLink) {
    crumbColLink.textContent = col?.title || '';
    crumbColLink.classList.toggle('hidden', !col || !inGallery);
  }
  colSep?.classList.toggle('hidden', !col || !inGallery);
  catSep?.classList.toggle('hidden', !inGallery);
}

function updateSheetResultsLabel() {
  const countEl = document.getElementById('sheetResultCount');
  if (!countEl) return;
  countEl.textContent = String(getFilteredProducts().length);
}

function scrollToCatalogueResults() {
  const catalogue = document.getElementById('catalogue');
  if (!catalogue) return;
  const headerH = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--site-header-height') || '68',
    10
  );
  const top = catalogue.getBoundingClientRect().top + window.scrollY - headerH - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function logFilterResult(kind, value) {
  const total = getFilteredProducts().length;
  dispatchUiAction('filter', kind, `${value} · ${total} pieces`);
}

function setCategoryFilter(catId) {
  try {
    currentFilter = catId;
    window.currentCategoryFilter = catId;
    resetPagination();
    window.buildCategoryFilters?.(catId);
    renderGrid(true);
    updateClearFiltersUi();
    if (document.body.dataset.pmjBrowse === 'gallery') {
      window.updateGalleryBreadcrumb?.(catId);
    }
    scrollToCatalogueResults();
    logFilterResult('category', catId);
  } catch (err) {
    console.error('Error inside setCategoryFilter:', err);
  }
}

function updateCatalogueFooter(items, shown) {
  const countEl = document.getElementById('catalogueCount');
  const loadBtn = document.getElementById('loadMoreBtn');
  if (!countEl) return;

  const total = items.length;
  const readyCount = items.filter((p) => getProductAvailability(p.id) === 'ready').length;
  const mtoCount = total - readyCount;

  if (total === 0) {
    countEl.textContent = 'No pieces match your filters.';
    loadBtn?.classList.add('hidden');
    plpLoadingEl?.classList.add('hidden');
    return;
  }

  countEl.textContent = searchQuery
    ? `Showing ${shown} of ${total} pieces for “${searchQuery}” · ${readyCount} ready · ${mtoCount} made to order`
    : `Showing ${shown} of ${total} pieces · ${readyCount} ready · ${mtoCount} made to order`;
  loadBtn?.classList.toggle('hidden', true);
  plpLoadingEl?.classList.toggle('hidden', shown >= total || !isLoadingMore);
}

function buildCardMaterialLine(p) {
  const parts = [];
  if (p.purity && p.purity !== SPEC_DEFAULTS.purity) parts.push(p.purity);
  if (p.stones && p.stones !== SPEC_DEFAULTS.stones) {
    parts.push(...String(p.stones).split(/[,;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 2));
  } else if (p.diamond && p.diamond !== SPEC_DEFAULTS.diamond) {
    parts.push('Diamond');
  }
  if (!parts.length && p.description) {
    const snippet = String(p.description).split(/[.·]/)[0].trim();
    if (snippet) parts.push(snippet.length > 52 ? `${snippet.slice(0, 49)}…` : snippet);
  }
  return parts.slice(0, 3).join(', ');
}

function buildCardDots(imageCount, productId) {
  if (imageCount <= 1) return '';
  return `<div class="card-dots" data-card-id="${productId}">${Array.from({ length: imageCount }, (_, i) =>
    `<button type="button" class="card-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="View image ${i + 1} of ${imageCount}"></button>`
  ).join('')}</div>`;
}

function isCardImagePng(src) {
  return window.isPngSource?.(src) || window.isPngDataUrl?.(src);
}

function buildCardMediaInner(p) {
  const images = p.images || [];
  if (!images.length) return { html: '', carousel: false, png: false };

  const slides = images.map((key, i) => {
    const src = IMAGES[key] || '';
    const pngCls = isCardImagePng(src) ? ' card-img--png' : '';
    return (
      `<img class="card-carousel-img${pngCls}" src="${src}"` +
      ` alt="${p.name}${images.length > 1 ? ` — view ${i + 1}` : ''}"` +
      ` data-i="${i}" loading="lazy" decoding="async">`
    );
  }).join('');

  const hasPng = images.some((key) => isCardImagePng(IMAGES[key]));
  const carousel = images.length > 1;
  const trackHtml = carousel
    ? `<div class="card-carousel-viewport"><div class="card-carousel-track">${slides}</div></div>`
    : slides;

  return { html: trackHtml, carousel, png: hasPng, count: images.length };
}

function buildCardHtml(base) {
  const p = getProductData(base.id);
  if (!p) return '';
  const multi = (p.images || []).length > 1;
  const avail = getAvailabilityMeta(p.availability);
  const catLabel = typeof getCategoryLabel === 'function' ? getCategoryLabel(p.cat) : p.catLabel;
  const materialLine = buildCardMaterialLine(p);
  const mediaInner = buildCardMediaInner(p);
  const mediaClasses = [
    'card-media',
    mediaInner.carousel ? 'card-media--carousel' : '',
    mediaInner.png ? 'card-media--png' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="card" data-id="${p.id}">
      <div class="${mediaClasses}" data-id="${p.id}" data-slide="0" data-slides="${mediaInner.count || 1}">
        ${renderAvailabilityBadge(p.availability)}
        ${multi ? `<span class="gallery-badge">◈ ${p.images.length} views</span>` : ''}
        <button class="heart-btn ${wishlist.includes(p.id)?'active':''}" data-id="${p.id}" aria-label="Add to Selection">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.1 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.4C11.6 4.7 13.4 3.7 15.4 4c3.6.5 5.2 4.1 3.6 7.7C19.5 16.3 12 21 12 21z"/></svg>
        </button>
        ${mediaInner.html}
      </div>
      ${buildCardDots((p.images || []).length, p.id)}
      <div class="card-body">
        <div class="card-meta-row">
          <div class="card-cat">${catLabel}</div>
        </div>
        <h3 class="card-name">${p.name}</h3>
        ${materialLine ? `<p class="card-material">${materialLine}</p>` : ''}
        <div class="card-price">${formatCardPrice(p.price)}</div>
        <div class="card-desc">${p.description}</div>
        <div class="card-actions">
          <span class="add-link" data-id="${p.id}">${wishlist.includes(p.id) ? '✓ Selection' : '+ Selection'}</span>
          <span class="view-link" data-id="${p.id}">View details</span>
        </div>
      </div>
    </div>`;
}

function getGalleryColumnCount(container) {
  const style = getComputedStyle(container);
  const template = style.gridTemplateColumns;
  if (template && template !== 'none') {
    const cols = template.split(' ').filter((part) => part && part !== '0px').length;
    if (cols > 0) return cols;
  }
  if (window.matchMedia('(max-width: 767px)').matches) return 2;
  if (window.matchMedia('(max-width: 1024px)').matches) return 3;
  return 4;
}

function staggerNewCards(container) {
  const isGallery = document.body.dataset.pmjBrowse === 'gallery';
  const animClass = isGallery ? 'card-gallery-reveal' : 'card-enter';
  const cards = container.querySelectorAll(`.card:not(.${animClass})`);

  if (!isGallery) {
    const step = 0.04;
    const cap = 0.5;
    cards.forEach((card, i) => {
      card.classList.remove('card-enter', 'card-gallery-reveal', 'card-gallery-lux');
      card.classList.add(animClass);
      card.style.animationDelay = `${Math.min(i * step, cap)}s`;
    });
    return;
  }

  const cols = getGalleryColumnCount(container);
  cards.forEach((card, i) => {
    card.classList.remove('card-enter', 'card-gallery-reveal', 'card-gallery-lux');
    card.classList.add('card-gallery-reveal', 'card-gallery-lux');
    const col = i % cols;
    const row = Math.floor(i / cols);
    const wave = 0.12 + row * 0.05 + col * 0.03;
    card.style.setProperty('--wave-delay', `${Math.min(wave, 0.65)}s`);
    card.style.animationDelay = 'var(--wave-delay)';
  });
}

function attachTiltTo(container) {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (document.body.dataset.pmjBrowse === 'gallery') return;
  container.querySelectorAll('.card').forEach(card=>{
    if (card.dataset.tiltBound === '1') return;
    card.dataset.tiltBound = '1';
    card.addEventListener('mousemove', e=>{
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x*6}deg) rotateX(${-y*6}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', ()=>{ card.style.transform = 'rotateY(0) rotateX(0)'; });
  });
}

function ensureLazySentinel() {
  let sentinel = document.getElementById('plpSentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.id = 'plpSentinel';
    sentinel.className = 'plp-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    grid.appendChild(sentinel);
  } else if (sentinel.parentElement !== grid) {
    grid.appendChild(sentinel);
  }
  return sentinel;
}

function setupLazyObserver() {
  if (lazyObserver) lazyObserver.disconnect();

  const sentinel = ensureLazySentinel();
  const items = getFilteredProducts();

  if (visibleCount >= items.length) {
    sentinel.remove();
    return;
  }

  lazyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || isLoadingMore) return;
        loadMoreProducts();
      });
    },
    { root: null, rootMargin: '320px 0px', threshold: 0 }
  );

  lazyObserver.observe(sentinel);
}

function loadMoreProducts() {
  const items = getFilteredProducts();
  if (visibleCount >= items.length || isLoadingMore) return;

  isLoadingMore = true;
  plpLoadingEl?.classList.remove('hidden');

  requestAnimationFrame(() => {
    visibleCount = Math.min(visibleCount + PAGE_SIZE, items.length);
    renderGrid(false);
    plpLoadingEl?.classList.add('hidden');
    
    // Throttling the load state reset prevents infinite scroll rendering loops
    setTimeout(() => {
      isLoadingMore = false;
    }, 250);
  });
}

function renderGrid(reset = true) {
  const items = getFilteredProducts();

  if (reset) {
    visibleCount = Math.min(PAGE_SIZE, items.length) || PAGE_SIZE;
    grid.innerHTML = '';
    lazyObserver?.disconnect();
  }

  const existingIds = new Set([...grid.querySelectorAll('.card')].map((el) => el.dataset.id));
  const toRender = items.slice(0, visibleCount);
  const fragment = document.createDocumentFragment();

  toRender.forEach((base) => {
    if (existingIds.has(base.id)) return;
    const html = buildCardHtml(base);
    if (!html) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    if (wrap.firstElementChild) fragment.appendChild(wrap.firstElementChild);
  });

  const sentinel = document.getElementById('plpSentinel');
  if (sentinel) grid.insertBefore(fragment, sentinel);
  else grid.appendChild(fragment);

  document.getElementById('plpSentinel')?.remove();

  if (toRender.length === 0 && reset) {
    grid.innerHTML = `
      <div class="catalogue-empty">
        <p>No pieces match your search or filters.</p>
        <button type="button" class="btn-clear-filters" id="clearFiltersBtn">Clear filters</button>
      </div>`;
    document.getElementById('clearFiltersBtn')?.addEventListener('click', clearAllFilters);
    updateCatalogueFooter(items, 0);
    return;
  }

  attachTiltTo(grid);
  updateCatalogueFooter(items, toRender.length);
  setupLazyObserver();
  updateClearFiltersUi();
  window.PMJPlcardCarousel?.bindCarousels?.(grid);

  if (document.body.classList.contains('catalogue-ready')) {
    staggerNewCards(grid);
  }

  window.dispatchEvent(new CustomEvent('pmj:catalogue-updated'));
}

function clearAllFilters() {
  currentFilter = 'all';
  availabilityFilter = 'all';
  searchQuery = '';
  resetPagination();
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-chip[data-availability]').forEach((c) => {
    c.classList.toggle('active', c.dataset.availability === 'all');
  });
  syncAvailabilityChips('all');
  window.buildCategoryFilters?.('all');
  renderGrid(true);
  updateClearFiltersUi();
  scrollToCatalogueResults();
  logFilterResult('clear', 'all');
}

function stabilizeCardsAfterLayoutChange() {
  grid.querySelectorAll('.card').forEach((card) => {
    card.style.opacity = '1';
    card.style.transform = '';
    card.style.animation = 'none';
  });
}

function refreshCatalogueAfterTheme() {
  const items = getFilteredProducts();
  const cardCount = grid.querySelectorAll('.card').length;

  if (items.length > 0 && cardCount === 0) {
    renderGrid(true);
  } else if (cardCount > 0) {
    stabilizeCardsAfterLayoutChange();
    setupLazyObserver();
    updateCatalogueFooter(items, Math.min(visibleCount, items.length));
  }

  window.PMJHeaderScroll?.syncHeaderHeight?.();
}

function bootCatalogue() {
  if (catalogueBooted) return;
  catalogueBooted = true;
  setHero();
  renderGrid(true);
  updateClearFiltersUi();
  updateMobileResultsBar();
  updateSheetResultsLabel();
  if (document.body.classList.contains('catalogue-ready')) {
    requestAnimationFrame(() => staggerNewCards(grid));
  }
}

function queueCatalogueBoot() {
  if (document.body.classList.contains('catalogue-ready')) {
    bootCatalogue();
    return;
  }
  window.addEventListener('pmj:intro-complete', bootCatalogue, { once: true });
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('catalogue-ready')) {
      observer.disconnect();
      bootCatalogue();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

if (typeof initCategoryUi === 'function') {
  initCategoryUi(setCategoryFilter);
} else {
  window.buildCategoryFilters?.('all');
}

queueCatalogueBoot();

window.addEventListener('pmj:theme-changed', refreshCatalogueAfterTheme);

window.addEventListener('pmj:gallery-reveal', () => {
  if (!grid || document.body.dataset.pmjBrowse !== 'gallery') return;
  grid.querySelectorAll('.card').forEach((card) => {
    card.classList.remove('card-enter', 'card-gallery-reveal', 'card-gallery-lux');
    card.style.animationDelay = '';
    card.style.removeProperty('--wave-delay');
    card.style.removeProperty('--tilt-y');
  });
  requestAnimationFrame(() => staggerNewCards(grid));
});

function bindSearchInput() {
  if (document.body.dataset.searchUiBound === '1') return;
  document.body.dataset.searchUiBound = '1';

  document.addEventListener('input', (e) => {
    if (e.target.id !== 'searchInput') return;
    queueSearch(e.target.value);
  });

  document.addEventListener('search', (e) => {
    if (e.target.id !== 'searchInput') return;
    applySearch(e.target.value);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.id !== 'searchInput') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(searchDebounceTimer);
      applySearch(e.target.value);
    }
    if (e.key === 'Escape') {
      e.target.value = '';
      applySearch('');
    }
  });
}

bindSearchInput();

function bindFilterBarInteractions() {
  if (document.body.dataset.filterUiBound === '1') return;
  document.body.dataset.filterUiBound = '1';

  document.addEventListener('click', (e) => {
    const filterBar = document.getElementById('filterBar');
    const inFilterBar = filterBar?.contains(e.target);
    const inSheet = e.target.closest('#sheetAvailabilityChips');

    if (e.target.closest('#clearAllFiltersBtn')) {
      e.preventDefault();
      clearAllFilters();
      return;
    }

    const availChip = e.target.closest('.filter-chip[data-availability]');
    if (availChip && (inFilterBar || inSheet)) {
      e.preventDefault();
      applyAvailabilityFilter(availChip.dataset.availability);
      return;
    }

    if (!inFilterBar) return;

    const catChip = e.target.closest('.filter-chip[data-filter]');
    if (catChip) {
      e.preventDefault();
      setCategoryFilter(catChip.dataset.filter);
    }
  });
}

bindFilterBarInteractions();

function closeSortPanel() {
  const panel = document.getElementById('sortPanel');
  const backdrop = document.getElementById('sortPanelBackdrop');
  const btn = document.getElementById('mobileSortBtn');
  panel?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  btn?.setAttribute('aria-expanded', 'false');
  btn?.classList.remove('is-active');
  window.setTimeout(() => {
    if (!panel?.classList.contains('is-open')) {
      panel?.classList.add('hidden');
      backdrop?.classList.add('hidden');
    }
    if (!document.getElementById('categoryPanel')?.classList.contains('is-open')) {
      document.body.classList.remove('plp-sheet-open');
    }
  }, 380);
}

function openSortPanel() {
  window.closeCategoryPanel?.();
  const panel = document.getElementById('sortPanel');
  const backdrop = document.getElementById('sortPanelBackdrop');
  const btn = document.getElementById('mobileSortBtn');
  panel?.classList.remove('hidden');
  backdrop?.classList.remove('hidden');
  requestAnimationFrame(() => {
    panel?.classList.add('is-open');
    backdrop?.classList.add('is-visible');
  });
  document.body.classList.add('plp-sheet-open');
  btn?.setAttribute('aria-expanded', 'true');
  btn?.classList.add('is-active');
}

function bindSortPanel() {
  if (document.body.dataset.sortUiBound === '1') return;
  document.body.dataset.sortUiBound = '1';

  document.getElementById('mobileSortBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('sortPanel');
    if (panel?.classList.contains('is-open')) closeSortPanel();
    else openSortPanel();
  });

  document.getElementById('sortPanelClose')?.addEventListener('click', closeSortPanel);
  document.getElementById('sortPanelBackdrop')?.addEventListener('click', closeSortPanel);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('sortPanel')?.classList.contains('is-open')) closeSortPanel();
  });

  document.getElementById('sortPanelOptions')?.addEventListener('click', (e) => {
    const opt = e.target.closest('.sort-option[data-sort]');
    if (!opt) return;
    sortOrder = opt.dataset.sort;
    document.querySelectorAll('.sort-option').forEach((el) => {
      el.classList.toggle('active', el === opt);
    });
    resetPagination();
    renderGrid(true);
    updateMobileResultsBar();
    closeSortPanel();
  });
}

bindSortPanel();

document.getElementById('plpCrumbHome')?.addEventListener('click', (e) => {
  if (document.body.dataset.pmjBrowse === 'gallery') return;
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (filtersAreActive()) clearAllFilters();
});

document.querySelectorAll('a[href="#catalogue"], #heroCta').forEach((link) => {
  link.addEventListener('click', () => {
    if (filtersAreActive()) clearAllFilters();
  });
});

document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
  loadMoreProducts();
});

grid.addEventListener('click', (e)=>{
  if (e.target.closest('.plp-fab')) return;
  if (e.target.closest('.card-dot')) return;
  const heart = e.target.closest('.heart-btn');
  const view = e.target.closest('.view-link');
  const media = e.target.closest('.card-media');
  const addLink = e.target.closest('.add-link');
  const card = e.target.closest('.card');
  const isLuxuryMobile = window.matchMedia('(max-width: 900px)').matches;
  if (media?.dataset.swipped === '1') return;
  if(heart){ toggleWishlist(heart.dataset.id, heart); return; }
  if(addLink){ toggleWishlist(addLink.dataset.id, addLink); return; }
  if(view || media || (isLuxuryMobile && card?.dataset.id)) {
    window.openProductModal?.((view || media || card).dataset.id);
    return;
  }
  if(card?.dataset.id && e.target.closest('.card-body')) {
    window.openProductModal?.(card.dataset.id);
  }
});

function refreshWishlistUi() {
  grid.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    if (!id) return;
    card.querySelector('.heart-btn')?.classList.toggle('active', wishlist.includes(id));
    const addLink = card.querySelector('.add-link');
    if (addLink) {
      addLink.textContent = wishlist.includes(id) ? '✓ Selection' : '+ Selection';
    }
  });
}

function toggleWishlist(id, sourceEl){
  const idx = wishlist.indexOf(id);
  const adding = idx === -1;
  if (adding) {
    wishlist.push(id);
    window.__pmjLastWishlistAdd = id;
    wishlistCountEl.textContent = wishlist.length;
    if (sourceEl) flyToWishlist(sourceEl, id);
    else {
      catchWishlistTab();
      revealWishlistDrawer(id, getWishlistMotionProfile());
    }
  } else {
    wishlist.splice(idx, 1);
    window.__pmjLastWishlistAdd = null;
    updateWishlistTabFeedback(false);
  }
  refreshWishlistUi();
  if (!adding) wishlistCountEl.textContent = wishlist.length;
  window.refreshWishlistDrawer?.();
  if(activeProductId === id) refreshModalHeart();
}

function updateWishlistTabFeedback(landed){
  const tab = wishlistTab;
  if (!tab) return;
  tab.classList.remove('pulse', 'catching');
  wishlistCountEl?.classList.remove('bump');
  requestAnimationFrame(() => {
    if (landed) {
      tab.classList.add('catching');
      wishlistCountEl?.classList.add('bump');
    } else {
      tab.classList.add('pulse');
    }
  });
}

function catchWishlistTab(){
  updateWishlistTabFeedback(true);
}

function popWishlistSource(sourceEl){
  if (!sourceEl) return;
  sourceEl.classList.remove('wishlist-pop');
  void sourceEl.offsetWidth;
  sourceEl.classList.add('wishlist-pop');
  sourceEl.addEventListener('animationend', () => sourceEl.classList.remove('wishlist-pop'), { once: true });

  const card = sourceEl.closest('.card');
  if (!card) return;
  card.classList.remove('wishlist-sent');
  void card.offsetWidth;
  card.classList.add('wishlist-sent');
  card.addEventListener('animationend', () => card.classList.remove('wishlist-sent'), { once: true });
}

function getWishlistFlyImage(sourceEl, productId){
  const card = sourceEl.closest('.card');
  const cardImg = card?.querySelector('.card-media img');
  if (cardImg?.currentSrc || cardImg?.src) return cardImg.currentSrc || cardImg.src;

  const modalImg = document.getElementById('pmMainImg');
  if (modalImg && !modalImg.classList.contains('hidden') && (modalImg.currentSrc || modalImg.src)) {
    return modalImg.currentSrc || modalImg.src;
  }

  const product = getProductData(productId);
  if (product?.images?.[0] && IMAGES[product.images[0]]) return IMAGES[product.images[0]];
  return null;
}

function getWishlistTargetRect(){
  const count = document.getElementById('wishlistCount');
  const tab = document.getElementById('openDrawer');
  const rect = count?.getBoundingClientRect() || tab?.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  return rect;
}

function getWishlistFlyStartRect(sourceEl){
  const cardMedia = sourceEl.closest('.card')?.querySelector('.card-media');
  if (cardMedia) return cardMedia.getBoundingClientRect();

  const viewerWrap = document.getElementById('viewer360Wrap');
  if (viewerWrap && document.getElementById('productModal')?.classList.contains('open')) {
    return viewerWrap.getBoundingClientRect();
  }

  const modalImg = document.getElementById('pmMainImg');
  if (modalImg && !modalImg.classList.contains('hidden')) {
    return modalImg.getBoundingClientRect();
  }

  return sourceEl.getBoundingClientRect();
}

function setWishlistSourceDim(sourceEl, active){
  const cardMedia = sourceEl.closest('.card')?.querySelector('.card-media');
  if (!cardMedia) return;
  cardMedia.classList.toggle('wishlist-source-dim', active);
  if (!active) return;
  window.setTimeout(() => cardMedia.classList.remove('wishlist-source-dim'), 900);
}

function getWishlistViewportTier(){
  const w = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  if (w <= 600) return 'mobile';
  if (w <= 1024) return 'tablet';
  if (w >= 1920 || (w >= 1600 && dpr >= 1.5)) return 'hd';
  return 'desktop';
}

const WISHLIST_MOTION = {
  mobile: {
    flySize: 62,
    duration: 760,
    arcMin: 56,
    arcMax: 118,
    arcScale: 0.16,
    trailDelays: [120, 260],
    burstCount: 6,
    burstDist: 12,
    drawerDelay: 160,
    closeModalFirst: true,
  },
  tablet: {
    flySize: 74,
    duration: 880,
    arcMin: 68,
    arcMax: 142,
    arcScale: 0.18,
    trailDelays: [150, 320, 470],
    burstCount: 8,
    burstDist: 16,
    drawerDelay: 210,
    closeModalFirst: true,
  },
  desktop: {
    flySize: 86,
    duration: 980,
    arcMin: 76,
    arcMax: 168,
    arcScale: 0.2,
    trailDelays: [180, 360, 520],
    burstCount: 10,
    burstDist: 18,
    drawerDelay: 260,
    closeModalFirst: false,
  },
  hd: {
    flySize: 104,
    duration: 1080,
    arcMin: 88,
    arcMax: 196,
    arcScale: 0.22,
    trailDelays: [200, 400, 560, 720],
    burstCount: 12,
    burstDist: 22,
    drawerDelay: 300,
    closeModalFirst: false,
  },
};

function getWishlistMotionProfile(){
  return WISHLIST_MOTION[getWishlistViewportTier()] || WISHLIST_MOTION.desktop;
}

function computeWishlistArc(dx, dy, profile){
  return Math.min(
    profile.arcMax,
    Math.max(profile.arcMin, Math.abs(dx) * profile.arcScale + Math.abs(dy) * 0.1 + profile.arcMin * 0.85)
  );
}

function flashWishlistLanding(targetRect){
  const flash = document.createElement('div');
  flash.className = 'wishlist-landed-flash';
  flash.style.setProperty('--wl-flash-x', `${targetRect.left + targetRect.width / 2}px`);
  flash.style.setProperty('--wl-flash-y', `${targetRect.top + targetRect.height / 2}px`);
  flash.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });
  window.setTimeout(() => flash.remove(), 900);
}

function showWishlistTargetRing(targetRect, profile){
  const ring = document.createElement('div');
  ring.className = 'wishlist-target-ring';
  ring.style.left = `${targetRect.left + targetRect.width / 2}px`;
  ring.style.top = `${targetRect.top + targetRect.height / 2}px`;
  ring.style.setProperty('--wl-ring-size', `${Math.max(targetRect.width, targetRect.height) + profile.burstDist}px`);
  document.body.appendChild(ring);
  ring.animate([
    { transform: 'translate(-50%, -50%) scale(0.35)', opacity: 0.95 },
    { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 },
  ], { duration: 620, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' })
    .finished.then(() => ring.remove())
    .catch(() => ring.remove());
}

function revealWishlistDrawer(productId, profile){
  const modal = document.getElementById('productModal');
  if (profile.closeModalFirst && modal?.classList.contains('open')) {
    window.closeProductModal?.();
  }

  const drawerEl = document.getElementById('drawer');
  const drawerBodyEl = document.getElementById('drawerBody');
  if (drawerEl?.classList.contains('open')) {
    window.__pmjLastWishlistAdd = productId;
    window.__pmjWishlistDramaticEntry = true;
    window.refreshWishlistDrawer?.();
    window.__pmjWishlistDramaticEntry = false;
    window.__pmjLastWishlistAdd = null;
    window.requestAnimationFrame(() => {
      drawerBodyEl?.querySelector(`.wl-item[data-id="${CSS.escape(String(productId))}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return;
  }

  window.openWishlistDrawer?.({ dramatic: true, highlight: productId });
  window.__pmjLastWishlistAdd = null;
}

function burstWishlistTarget(targetRect, profile){
  const cx = targetRect.left + targetRect.width / 2;
  const cy = targetRect.top + targetRect.height / 2;
  const count = profile.burstCount;
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement('div');
    spark.className = 'wishlist-burst';
    spark.style.left = `${cx}px`;
    spark.style.top = `${cy}px`;
    document.body.appendChild(spark);
    const angle = (Math.PI * 2 * i) / count;
    const dist = profile.burstDist + (i % 3) * 6;
    spark.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
      {
        transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.15)`,
        opacity: 0,
      },
    ], { duration: 520, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' })
      .finished.then(() => spark.remove())
      .catch(() => spark.remove());
  }
}

function spawnWishlistTrail(startX, startY, dx, dy, arc, delayMs, profile){
  window.setTimeout(() => {
    const trail = document.createElement('div');
    trail.className = 'wishlist-fly-trail';
    trail.style.left = `${startX + dx * 0.55}px`;
    trail.style.top = `${startY + dy * 0.55 - arc * 0.72}px`;
    trail.style.setProperty('--wl-trail-size', `${Math.max(5, Math.round(profile.flySize * 0.09))}px`);
    document.body.appendChild(trail);
    trail.animate([
      { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.88 },
      { transform: `translate(calc(-50% + ${dx * 0.18}px), calc(-50% + ${dy * 0.18 - 12}px)) scale(0.15)`, opacity: 0 },
    ], { duration: 520, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => trail.remove())
      .catch(() => trail.remove());
  }, delayMs);
}

function runWishlistFlyMotion(fly, startX, startY, dx, dy, arc, profile, onDone){
  profile.trailDelays.forEach((delay) => spawnWishlistTrail(startX, startY, dx, dy, arc, delay, profile));

  const motion = fly.animate([
    {
      transform: 'translate(-50%, -50%) scale(0.62) rotate(0deg)',
      opacity: 0.1,
      offset: 0,
    },
    {
      transform: 'translate(-50%, -50%) scale(1.06) rotate(0deg)',
      opacity: 1,
      offset: 0.14,
    },
    {
      transform: `translate(calc(-50% + ${dx * 0.36}px), calc(-50% + ${dy * 0.36 - arc}px)) scale(0.98) rotate(-6deg)`,
      opacity: 1,
      offset: 0.5,
    },
    {
      transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8 - arc * 0.1}px)) scale(0.5) rotate(4deg)`,
      opacity: 0.94,
      offset: 0.84,
    },
    {
      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.14) rotate(0deg)`,
      opacity: 0,
      offset: 1,
    },
  ], {
    duration: profile.duration,
    easing: 'cubic-bezier(.22,.61,.36,1)',
    fill: 'forwards',
  });

  motion.finished.then(onDone).catch(onDone);
}

function flyToWishlist(sourceEl, productId){
  const profile = getWishlistMotionProfile();
  popWishlistSource(sourceEl);
  setWishlistSourceDim(sourceEl, true);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    catchWishlistTab();
    revealWishlistDrawer(productId, profile);
    return;
  }

  const target = getWishlistTargetRect();
  if (!target) {
    catchWishlistTab();
    revealWishlistDrawer(productId, profile);
    return;
  }

  const startRect = getWishlistFlyStartRect(sourceEl);
  const imgSrc = getWishlistFlyImage(sourceEl, productId);
  const fly = document.createElement('div');
  fly.className = 'wishlist-fly';
  fly.dataset.wlTier = getWishlistViewportTier();
  fly.style.setProperty('--wishlist-fly-size', `${profile.flySize}px`);
  fly.setAttribute('aria-hidden', 'true');

  const finishFly = () => {
    fly.remove();
    const freshTarget = getWishlistTargetRect() || target;
    burstWishlistTarget(freshTarget, profile);
    showWishlistTargetRing(freshTarget, profile);
    flashWishlistLanding(freshTarget);
    catchWishlistTab();
    window.setTimeout(() => revealWishlistDrawer(productId, profile), profile.drawerDelay);
  };

  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const endX = target.left + target.width / 2;
  const endY = target.top + target.height / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const arc = computeWishlistArc(dx, dy, profile);

  fly.style.left = `${startX}px`;
  fly.style.top = `${startY}px`;
  document.body.appendChild(fly);

  let started = false;
  const beginMotion = () => {
    if (started) return;
    started = true;
    if (!fly.querySelector('img')) fly.classList.add('wishlist-fly--dot');
    runWishlistFlyMotion(fly, startX, startY, dx, dy, arc, profile, finishFly);
  };

  if (!imgSrc) {
    beginMotion();
    return;
  }

  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = '';
  fly.appendChild(img);
  if (img.complete) beginMotion();
  else {
    img.onload = beginMotion;
    img.onerror = beginMotion;
  }
}

function updateCount(){
  wishlistCountEl.textContent = wishlist.length;
  updateWishlistTabFeedback(false);
}

window.setCategoryFilter = setCategoryFilter;
window.clearAllFilters = clearAllFilters;
window.renderCatalogueGrid = () => renderGrid(true);
window.scrollToCatalogueResults = scrollToCatalogueResults;
window.updateMobileResultsBar = updateMobileResultsBar;
window.syncSheetAvailabilityChips = syncSheetAvailabilityChips;
window.updateSheetResultsLabel = updateSheetResultsLabel;
window.syncAvailabilityChips = syncAvailabilityChips;
window.applyAvailabilityFilter = applyAvailabilityFilter;
window.closeSortPanel = closeSortPanel;
