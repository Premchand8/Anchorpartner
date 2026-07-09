/* Product detail modal — full-view photo + hover zoom, 3D for multi-angle JPEG */
const pmOverlay = document.getElementById('pmOverlay');
const productModal = document.getElementById('productModal');
let pmImageIndex = 0;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getModalImageSrc(product, index) {
  return IMAGES[product.images[index]];
}

function isPngImage(url) {
  return window.isPngSource?.(url) || window.isPngDataUrl?.(url);
}

function isMobileView() {
  return window.matchMedia('(max-width: 860px)').matches;
}

function shouldUseFlatPhotoViewer(product, index) {
  if (isMobileView()) return true;
  const src = getModalImageSrc(product, index);
  if (isPngImage(src)) return true;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  return false;
}

function pmStepImage(delta) {
  const p = getProductData(activeProductId);
  if (!p?.images?.length) return;
  pmImageIndex = (pmImageIndex + delta + p.images.length) % p.images.length;
  renderModal();
  if (document.getElementById('pmGalleryLightbox')?.classList.contains('is-open')) {
    syncLightboxView(p);
  }
}

window.pmStepImage = pmStepImage;
window.pmImageIndex = 0;

function updateMobileViewerHint(wrap, isPng) {
  const hint = wrap?.querySelector('.viewer360-hint');
  if (!hint) return;
  if (!isMobileView()) return;
  hint.style.display = 'block';
  hint.textContent = isPng
    ? 'Swipe for more views · Pinch or double-tap to zoom'
    : 'Swipe for more views · Pinch or double-tap to zoom';
}

function resetViewerWrap(wrap) {
  if (!wrap) return;
  wrap.classList.remove('viewer-png-mode', 'viewer-photo-mode', 'viewer-3d-mode');
  window.ViewerZoom?.reset(wrap);
}

function applyProductViewer(p) {
  const wrap = document.getElementById('viewer360Wrap');
  const stage = document.getElementById('viewer360Stage');
  const hint = wrap?.querySelector('.viewer360-hint');
  if (!wrap || !stage) return;

  resetViewerWrap(wrap);

  // Check if we have both model and product images for Sweet 16 collection
  const hasSplitGallery = p.images && p.images.length === 2 && p.images[0].includes('_model') && p.images[1].includes('_product');

  if (hasSplitGallery) {
    wrap.classList.add('has-split-gallery');
    stage.innerHTML = `
      <div class="pdp-gallery-split">
        <div class="pdp-gallery-item pdp-gallery-item--model">
          <img src="${IMAGES[p.images[0]]}" alt="${p.name} - Model View" class="pdp-img">
          <span class="pdp-img-label">Model View</span>
        </div>
        <div class="pdp-gallery-item pdp-gallery-item--product">
          <img src="${IMAGES[p.images[1]]}" alt="${p.name} - Product View" class="pdp-img">
          <span class="pdp-img-label">Product View</span>
        </div>
      </div>
    `;

    if (window.Viewer360) Viewer360.hide();
    
    // Hide single-image navigation elements
    document.getElementById('pmGalleryPrev')?.classList.add('hidden');
    document.getElementById('pmGalleryNext')?.classList.add('hidden');
    document.getElementById('pmCarouselDots')?.classList.add('hidden');
    document.getElementById('pmThumbs')?.classList.add('hidden');
    if (hint) hint.style.display = 'none';
    return;
  }

  // Restore defaults for single-image or 3D cases
  wrap.classList.remove('has-split-gallery');
  stage.innerHTML = `
    <canvas id="viewer360Canvas"></canvas>
    <img id="pmMainImg" src="" alt="">
  `;
  const mainImg = document.getElementById('pmMainImg');

  // Show navigation and thumbnails if there are multiple images
  const showNav = p.images && p.images.length > 1;
  document.getElementById('pmGalleryPrev')?.classList.toggle('hidden', !showNav);
  document.getElementById('pmGalleryNext')?.classList.toggle('hidden', !showNav);
  document.getElementById('pmCarouselDots')?.classList.toggle('hidden', !showNav);
  document.getElementById('pmThumbs')?.classList.toggle('hidden', !showNav);

  if (!isMobileView()) {
    window.ViewerZoom?.rebind(wrap);
  }

  const src = getModalImageSrc(p, pmImageIndex);
  const isPng = isPngImage(src);
  wrap.classList.toggle('viewer-png-mode', isPng);
  wrap.classList.toggle('viewer-photo-mode', !isPng);

  const useFlat = shouldUseFlatPhotoViewer(p, pmImageIndex);

  if (useFlat) {
    if (window.Viewer360) Viewer360.hide();
    if (mainImg) {
      mainImg.src = src;
      mainImg.alt = p.name;
      mainImg.classList.remove('hidden');
    }
    updateMobileViewerHint(wrap, isPng);
    if (!isMobileView() && hint) {
      hint.style.display = 'block';
      hint.textContent = isPng
        ? 'Hover to magnify · Original product cut-out'
        : 'Hover to magnify · Full view';
    }
    return;
  }

  if (window.Viewer360 && typeof THREE !== 'undefined') {
    wrap.classList.add('viewer-3d-mode');
    Viewer360.show(p, pmImageIndex);
    if (hint) {
      hint.style.display = 'block';
      hint.textContent = 'Hover to magnify · Drag to rotate · Pinch to zoom';
    }
    return;
  }

  if (window.Viewer360) Viewer360.hide();
  if (mainImg) {
    mainImg.src = src;
    mainImg.alt = p.name;
    mainImg.classList.remove('hidden');
  }
  if (hint) {
    hint.style.display = 'block';
    hint.textContent = 'Hover to magnify';
  }
}

function openProductModal(id) {
  if (!id || typeof getProductData !== 'function') return;
  const product = getProductData(id);
  if (!product) return;

  window.closeCategoryPanel?.();
  window.closeSortPanel?.();
  document.body.classList.remove('plp-sheet-open');
  document.querySelectorAll('.category-panel-backdrop, #sortPanelBackdrop').forEach((el) => {
    el?.classList.remove('is-visible');
    el?.classList.add('hidden');
  });

  activeProductId = id;
  pmImageIndex = 0;
  window.pmImageIndex = 0;
  closeGalleryLightbox();
  document.getElementById('pmDetailsMobile')?.classList.remove('is-visible');
  document.getElementById('pmDiscoverRow')?.classList.remove('is-open');
  renderModal();
  pmOverlay.classList.add('open');
  productModal.classList.add('open');
  document.body.classList.add('pdp-open');
  window.PMJMobilePdp?.resetPinch?.();
  requestAnimationFrame(() => {
    window.Viewer360?.resize();
    window.PMJMobilePdp?.syncMobileThumbStrip?.();
    document.getElementById('pmGrid')?.scrollTo?.(0, 0);
  });
}

function closeProductModal() {
  closeGalleryLightbox();
  pmOverlay.classList.remove('open');
  productModal.classList.remove('open');
  document.body.classList.remove('pdp-open');
  document.getElementById('pmEditFields').classList.remove('show');
  document.getElementById('pmDetailsMobile')?.classList.remove('is-visible');
  document.getElementById('pmDiscoverRow')?.classList.remove('is-open');
  resetViewerWrap(document.getElementById('viewer360Wrap'));
  window.PMJMobilePdp?.resetPinch?.();
  if (window.Viewer360) Viewer360.hide();
  activeProductId = null;
}

window.openProductModal = openProductModal;

window.closeProductModal = closeProductModal;

document.getElementById('pmClose')?.addEventListener('click', closeProductModal);
pmOverlay?.addEventListener('click', closeProductModal);

function formatModalPrice(price) {
  const raw = String(price || '').trim();
  if (!raw || raw === SPEC_DEFAULTS.price) return 'Price on request';
  if (/^₹|^price/i.test(raw)) return raw.replace(/^price on request/i, 'Price on request');
  if (/^\d/.test(raw)) return `₹ ${raw}`;
  return raw;
}

function buildMaterialLine(p) {
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

function renderPmBreadcrumb(p, catLabel) {
  const el = document.getElementById('pmBreadcrumb');
  if (!el) return;

  const inGallery = document.body.dataset.pmjBrowse === 'gallery';
  const collectionId = document.body.dataset.pmjCollection || window.currentCollectionFilter;
  const col = collectionId && typeof getCollectionById === 'function' ? getCollectionById(collectionId) : null;

  if (inGallery && col) {
    const catName = catLabel || (typeof getCategoryLabel === 'function' ? getCategoryLabel(p.cat) : p.cat);
    el.innerHTML =
      `<button type="button" class="pm-crumb-link" data-crumb="hub">All Collections</button>` +
      `<span class="pm-crumb-sep" aria-hidden="true">◆</span>` +
      `<button type="button" class="pm-crumb-link" data-crumb="collection">${escapeHtml(col.title)}</button>` +
      `<span class="pm-crumb-sep" aria-hidden="true">◆</span>` +
      `<button type="button" class="pm-crumb-link" data-crumb="category">${escapeHtml(catName)}</button>` +
      `<span class="pm-crumb-sep" aria-hidden="true">◆</span>` +
      `<span class="pm-crumb-current">${escapeHtml(p.name)}</span>`;
    bindPmBreadcrumbNav(el);
    return;
  }

  const short = typeof getCategoryShortLabel === 'function' ? getCategoryShortLabel(p.cat) : catLabel;
  const left = short ? short.toUpperCase() : 'COLLECTION';
  const right = catLabel ? catLabel.toUpperCase() : 'PIECES';
  el.textContent = left === right ? left : `${left} | ${right}`;
}

function bindPmBreadcrumbNav(container) {
  if (!container || container.dataset.bound === '1') return;
  container.dataset.bound = '1';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-crumb]');
    if (!btn) return;
    e.preventDefault();

    const collectionId = document.body.dataset.pmjCollection || window.currentCollectionFilter;
    const product = typeof getProductData === 'function' && activeProductId ? getProductData(activeProductId) : null;
    const categoryId = window.getCurrentCategoryFilter?.() || product?.cat || 'all';
    const crumb = btn.dataset.crumb;

    closeProductModal();

    if (crumb === 'hub') window.openCollectionsHub?.();
    else if (crumb === 'collection' && collectionId) window.openCollectionGallery?.(collectionId, 'all');
    else if (crumb === 'category' && collectionId) window.openCollectionGallery?.(collectionId, categoryId);
  });
}

function updateGalleryCounter(images, elId = 'pmGalleryCounter') {
  const el = document.getElementById(elId);
  if (!el) return;
  const total = images?.length || 0;
  el.textContent = total <= 1 ? '' : `${pmImageIndex + 1}/${total}`;
}

function renderThumbStrip(p, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = p.images.map((key, i) => `
    <div class="pm-thumb ${i === pmImageIndex ? 'active' : ''}" data-i="${i}">
      <img src="${IMAGES[key]}" alt="View ${i + 1}">
    </div>
  `).join('');
}

function syncLightboxView(p) {
  const img = document.getElementById('pmLightboxImg');
  if (!img || !p) return;
  img.src = getModalImageSrc(p, pmImageIndex);
  img.alt = p.name;
  updateGalleryCounter(p.images, 'pmLightboxCounter');
  document.querySelectorAll('#pmLightboxThumbs .pm-thumb').forEach((thumb) => {
    thumb.classList.toggle('active', parseInt(thumb.dataset.i, 10) === pmImageIndex);
  });
  document.getElementById('pmLightboxThumbs')?.querySelector('.pm-thumb.active')?.scrollIntoView({
    inline: 'center',
    block: 'nearest',
    behavior: 'smooth',
  });
}

function openGalleryLightbox() {
  if (!isMobileView() || !activeProductId) return;
  const p = getProductData(activeProductId);
  if (!p) return;
  const lightbox = document.getElementById('pmGalleryLightbox');
  if (!lightbox) return;
  renderThumbStrip(p, 'pmLightboxThumbs');
  syncLightboxView(p);
  lightbox.classList.remove('hidden');
  requestAnimationFrame(() => lightbox.classList.add('is-open'));
  document.body.classList.add('pm-lightbox-open');
  window.PMJMobilePdp?.rebindLightbox?.();
}

function closeGalleryLightbox() {
  const lightbox = document.getElementById('pmGalleryLightbox');
  if (!lightbox) return;
  lightbox.classList.remove('is-open');
  document.body.classList.remove('pm-lightbox-open');
  window.PMJMobilePdp?.resetLightboxPinch?.();
  window.setTimeout(() => {
    if (!lightbox.classList.contains('is-open')) lightbox.classList.add('hidden');
  }, 280);
}

window.openGalleryLightbox = openGalleryLightbox;
window.closeGalleryLightbox = closeGalleryLightbox;

function renderCarouselDots(images) {
  const el = document.getElementById('pmCarouselDots');
  if (!el) return;
  const count = images?.length || 0;
  if (count <= 1) {
    el.innerHTML = '';
    el.setAttribute('aria-hidden', 'true');
    return;
  }
  el.setAttribute('aria-hidden', 'false');
  el.innerHTML = images.map((_, i) =>
    `<button type="button" class="pm-carousel-dot${i === pmImageIndex ? ' active' : ''}" data-i="${i}" aria-label="View image ${i + 1}"></button>`
  ).join('');
}

function renderSpecPill(p) {
  const el = document.getElementById('pmSpecPill');
  if (!el) return;
  const parts = [];
  if (p.purity && p.purity !== SPEC_DEFAULTS.purity) parts.push(p.purity);
  if (p.gross && p.gross !== SPEC_DEFAULTS.gross) parts.push(p.gross);
  if (!parts.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = parts.map((part, i) =>
    `${i > 0 ? '<span class="pm-spec-pill-sep">•</span>' : ''}<span class="pm-spec-pill-item">${part}</span>`
  ).join('');
}

function renderMobileAccordions(p, avail) {
  const el = document.getElementById('pmAccordions');
  if (!el) return;

  const metalRows = [
    ['Purity', p.purity],
    ['Gross Weight', p.gross],
    ['Net Gold Weight', p.netGold],
    ['Metal', 'Gold'],
  ].filter(([, v]) => v && !Object.values(SPEC_DEFAULTS).includes(v));

  const generalRows = [
    ['Availability', avail.label],
    ['Stone Details', p.stones],
    ['Diamond / Stone Wt.', p.diamond],
  ].filter(([, v]) => v && !Object.values(SPEC_DEFAULTS).includes(v));

  const priceRows = [
    ['Price', formatModalPrice(p.price)],
    ['Availability', avail.label],
  ];

  el.innerHTML = `
    <div class="pm-accordion is-open" data-panel="details">
      <button type="button" class="pm-accordion-head">
        <span class="pm-accordion-icon">◈</span>
        <span>Metal Details</span>
        <span class="pm-accordion-caret">▾</span>
      </button>
      <div class="pm-accordion-body">
        <div class="pm-spec-grid">${(metalRows.length ? metalRows : [['Purity', p.purity], ['Gross Weight', p.gross]]).map(([k, v]) =>
          `<div class="pm-spec-cell"><span class="v">${v}</span><span class="k">${k}</span></div>`
        ).join('')}</div>
      </div>
    </div>
    <div class="pm-accordion" data-panel="details">
      <button type="button" class="pm-accordion-head">
        <span class="pm-accordion-icon">○</span>
        <span>General Details</span>
        <span class="pm-accordion-caret">▾</span>
      </button>
      <div class="pm-accordion-body">
        <div class="pm-spec-grid">${(generalRows.length ? generalRows : [['Availability', avail.label]]).map(([k, v]) =>
          `<div class="pm-spec-cell"><span class="v">${v}</span><span class="k">${k}</span></div>`
        ).join('')}</div>
      </div>
    </div>
    <div class="pm-accordion" data-panel="details">
      <button type="button" class="pm-accordion-head">
        <span class="pm-accordion-icon">▤</span>
        <span>Description</span>
        <span class="pm-accordion-caret">▾</span>
      </button>
      <div class="pm-accordion-body"><p>${p.description || '—'}</p></div>
    </div>
    <div class="pm-accordion is-open pm-accordion--price hidden" data-panel="price">
      <button type="button" class="pm-accordion-head">
        <span class="pm-accordion-icon">₹</span>
        <span>Price Breakup</span>
        <span class="pm-accordion-caret">▾</span>
      </button>
      <div class="pm-accordion-body">
        <div class="pm-spec-grid">${priceRows.map(([k, v]) =>
          `<div class="pm-spec-cell"><span class="v">${v}</span><span class="k">${k}</span></div>`
        ).join('')}</div>
      </div>
    </div>`;
}

function setMobileDetailsTab(tab) {
  document.querySelectorAll('.pm-details-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.pm-accordion').forEach((acc) => {
    const panel = acc.dataset.panel;
    const show = panel === tab;
    acc.classList.toggle('hidden', !show);
  });
}

function renderModal() {
  const p = getProductData(activeProductId);
  if (!p) return;
  window.pmImageIndex = pmImageIndex;
  const avail = getAvailabilityMeta(p.availability);
  const catLabel = typeof getCategoryLabel === 'function' ? getCategoryLabel(p.cat) : p.catLabel;
  renderPmBreadcrumb(p, catLabel);
  document.getElementById('pmCat').textContent = catLabel;
  document.getElementById('pmName').textContent = p.name;

  const materialEl = document.getElementById('pmMaterial');
  if (materialEl) {
    const material = buildMaterialLine(p);
    materialEl.textContent = material;
    materialEl.classList.toggle('hidden', !material);
  }

  const skuEl = document.getElementById('pmSku');
  if (skuEl) {
    skuEl.innerHTML = `<span class="pm-sku-ref">${p.id}</span> — <button type="button" class="pm-details-link">Product details</button>`;
  }

  const priceEl = document.getElementById('pmPrice');
  if (priceEl) priceEl.textContent = formatModalPrice(p.price);

  renderSpecPill(p);
  renderMobileAccordions(p, avail);
  setMobileDetailsTab('details');

  const availEl = document.getElementById('pmAvailability');
  if (availEl) {
    availEl.className = `pm-availability ${avail.badgeClass}`;
    availEl.innerHTML = `<span class="pm-availability-label">${avail.label}</span><span class="pm-availability-hint">${avail.hint}</span>`;
  }

  document.getElementById('pmDesc').textContent = p.description;

  const mainImg = document.getElementById('pmMainImg');
  if (mainImg) {
    mainImg.src = getModalImageSrc(p, pmImageIndex);
    mainImg.alt = p.name;
  }

  document.getElementById('pmThumbs').innerHTML = p.images.map((key, i) => `
    <div class="pm-thumb ${i === pmImageIndex ? 'active' : ''}" data-i="${i}">
      <img src="${IMAGES[key]}" alt="View ${i + 1}">
    </div>
  `).join('');

  renderCarouselDots(p.images);
  updateGalleryCounter(p.images, 'pmGalleryCounter');
  if (document.getElementById('pmGalleryLightbox')?.classList.contains('is-open')) {
    renderThumbStrip(p, 'pmLightboxThumbs');
    syncLightboxView(p);
  }

  document.getElementById('pmSpecs').innerHTML = `
    <div class="spec-row spec-row--availability"><span class="k">Availability</span><span class="v">${avail.label}</span></div>
    <div class="spec-row"><span class="k">Purity</span><span class="v">${p.purity}</span></div>
    <div class="spec-row"><span class="k">Gross Weight</span><span class="v">${p.gross}</span></div>
    <div class="spec-row"><span class="k">Net Gold Weight</span><span class="v">${p.netGold}</span></div>
    <div class="spec-row"><span class="k">Diamond / Stone Weight</span><span class="v">${p.diamond}</span></div>
    <div class="spec-row"><span class="k">Stone Details</span><span class="v">${p.stones}</span></div>
    <div class="spec-row"><span class="k">Price</span><span class="v">${p.price}</span></div>
  `;

  refreshModalHeart();
  document.getElementById('editName').value = p.name;
  document.getElementById('editDesc').value = p.description;
  document.getElementById('editPurity').value = p.purity === SPEC_DEFAULTS.purity ? '' : p.purity;
  document.getElementById('editGross').value = p.gross === SPEC_DEFAULTS.gross ? '' : p.gross;
  document.getElementById('editNetGold').value = p.netGold === SPEC_DEFAULTS.netGold ? '' : p.netGold;
  document.getElementById('editDiamond').value = p.diamond === SPEC_DEFAULTS.diamond ? '' : p.diamond;
  document.getElementById('editStones').value = p.stones === SPEC_DEFAULTS.stones ? '' : p.stones;
  document.getElementById('editPrice').value = p.price === SPEC_DEFAULTS.price ? '' : p.price;
  document.getElementById('editAvailability').value = p.availability;

  const globalRot = typeof loadDisplaySettings === 'function' ? loadDisplaySettings().viewerAutoRotate : true;
  const autoRotate = p.autoRotate !== undefined ? p.autoRotate : globalRot;
  document.getElementById('editAutoRotate').checked = autoRotate !== false;
  const rotSpeed = parseFloat(p.rotateSpeed) || 1;
  document.getElementById('editRotateSpeed').value = rotSpeed;
  document.getElementById('editRotateSpeedVal').textContent = rotSpeed + '×';

  document.getElementById('pmEditToggle').style.display = adminMode ? 'inline-block' : 'none';

  applyProductViewer(p);
  window.PMJMobilePdp?.syncMobileThumbStrip?.();
  window.PMJMobilePdp?.rebind?.();
}

function refreshModalHeart() {
  const active = wishlist.includes(activeProductId);
  const btn = document.getElementById('pmHeart');
  btn.classList.toggle('active', active);
  document.getElementById('pmHeartLabel').textContent = active ? 'Added to Wishlist' : 'Add to Wishlist';
  document.getElementById('pmGalleryHeart')?.classList.toggle('active', active);
}

document.getElementById('pmHeart').addEventListener('click', () =>
  toggleWishlist(activeProductId, document.getElementById('pmHeart'))
);

document.getElementById('pmGalleryHeart')?.addEventListener('click', () =>
  toggleWishlist(activeProductId, document.getElementById('pmGalleryHeart'))
);

function toggleProductDetails() {
  const panel = document.getElementById('pmDetailsMobile');
  if (!panel) return;
  const open = panel.classList.toggle('is-visible');
  document.getElementById('pmDiscoverRow')?.classList.toggle('is-open', open);
  if (open) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('pmGalleryExpand')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openGalleryLightbox();
});

document.getElementById('viewer360Wrap')?.addEventListener('click', (e) => {
  if (!isMobileView()) return;
  if (e.target.closest('.pm-gallery-heart, .pm-gallery-nav, .pm-gallery-expand, canvas')) return;
  openGalleryLightbox();
});

document.getElementById('pmLightboxClose')?.addEventListener('click', closeGalleryLightbox);
document.getElementById('pmLightboxPrev')?.addEventListener('click', () => pmStepImage(-1));
document.getElementById('pmLightboxNext')?.addEventListener('click', () => pmStepImage(1));
document.getElementById('pmLightboxReset')?.addEventListener('click', () => window.PMJMobilePdp?.resetLightboxPinch?.());

document.getElementById('pmLightboxThumbs')?.addEventListener('click', (e) => {
  const t = e.target.closest('.pm-thumb');
  if (!t) return;
  pmImageIndex = parseInt(t.dataset.i, 10);
  renderModal();
});

document.getElementById('pmSku')?.addEventListener('click', (e) => {
  if (e.target.closest('.pm-details-link')) toggleProductDetails();
});

document.getElementById('pmDiscoverRow')?.addEventListener('click', toggleProductDetails);

document.getElementById('pmEnquireLink')?.addEventListener('click', () => {
  closeProductModal();
  document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('pmGalleryPrev')?.addEventListener('click', (e) => {
  e.stopPropagation();
  pmStepImage(-1);
});
document.getElementById('pmGalleryNext')?.addEventListener('click', (e) => {
  e.stopPropagation();
  pmStepImage(1);
});

document.getElementById('pmCarouselDots')?.addEventListener('click', (e) => {
  const dot = e.target.closest('.pm-carousel-dot');
  if (!dot) return;
  pmImageIndex = parseInt(dot.dataset.i, 10);
  renderModal();
});

document.getElementById('pmAccordions')?.addEventListener('click', (e) => {
  const head = e.target.closest('.pm-accordion-head');
  if (!head) return;
  head.closest('.pm-accordion')?.classList.toggle('is-open');
});

document.querySelectorAll('.pm-details-tab').forEach((tab) => {
  tab.addEventListener('click', () => setMobileDetailsTab(tab.dataset.tab));
});

document.getElementById('pmEnquireBtn')?.addEventListener('click', () => {
  closeProductModal();
  document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('pmShareBtn')?.addEventListener('click', async () => {
  const p = getProductData(activeProductId);
  if (!p) return;
  const text = `${p.name} — PMJ Jewels`;
  try {
    if (navigator.share) {
      await navigator.share({ title: p.name, text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${text}\n${p.id}`);
    }
  } catch (_) { /* user cancelled */ }
});

document.getElementById('pmThumbs')?.addEventListener('click', (e) => {
  const t = e.target.closest('.pm-thumb');
  if (!t) return;
  pmImageIndex = parseInt(t.dataset.i, 10);
  renderModal();
});

document.getElementById('pmEditToggle').addEventListener('click', () => {
  document.getElementById('pmEditFields').classList.toggle('show');
});

document.getElementById('pmEditSave').addEventListener('click', () => {
  const overrides = loadOverrides();
  overrides[activeProductId] = {
    name: document.getElementById('editName').value.trim(),
    description: document.getElementById('editDesc').value.trim(),
    purity: document.getElementById('editPurity').value.trim(),
    gross: document.getElementById('editGross').value.trim(),
    netGold: document.getElementById('editNetGold').value.trim(),
    diamond: document.getElementById('editDiamond').value.trim(),
    stones: document.getElementById('editStones').value.trim(),
    price: document.getElementById('editPrice').value.trim(),
    availability: document.getElementById('editAvailability').value,
    autoRotate: document.getElementById('editAutoRotate').checked,
    rotateSpeed: parseFloat(document.getElementById('editRotateSpeed').value) || 1,
  };
  saveOverrides(overrides);
  renderModal();
  renderGrid();
  document.getElementById('pmEditFields').classList.remove('show');
  window.dispatchEvent(new CustomEvent('pmj:display-settings-changed'));
  window.PMJSiteSync?.schedulePublish?.();
});

document.getElementById('editRotateSpeed')?.addEventListener('input', (e) => {
  document.getElementById('editRotateSpeedVal').textContent = e.target.value + '×';
});

productModal?.addEventListener('transitionend', () => {
  if (productModal.classList.contains('open') && window.Viewer360) {
    Viewer360.resize();
  }
});

window.addEventListener('pmj:theme-changed', () => {
  if (!activeProductId) return;
  const wrap = document.getElementById('viewer360Wrap');
  if (!wrap || !productModal?.classList.contains('open')) return;
  resetViewerWrap(wrap);
  applyProductViewer(getProductData(activeProductId));
  requestAnimationFrame(() => window.Viewer360?.resize());
});
