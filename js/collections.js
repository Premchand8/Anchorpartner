/* Collections → categories → product gallery browse flow */
const PMJ_COLLECTIONS = [
  {
    id: 'sweet-16',
    title: 'Sweet 16',
    subtitle: 'Sparkling Forever — diamond jewellery curated for the Sweet 16 celebration.',
    kicker: 'Sparkling Forever',
    layout: 'wide-left',
    align: 'right',
    theme: { bg: 'linear-gradient(135deg, #1a0f24 0%, #4a2a6a 48%, #120a1a 100%)', glow: 'rgba(210, 160, 255, 0.32)' },
    coverImage: 'sweet16_cover',
  },
  {
    id: 'royal-heritage',
    title: 'Royal Heritage',
    subtitle: 'Regal polki, uncut diamonds, and heirloom gold craftsmanship.',
    kicker: 'Heirloom Craft',
    layout: 'narrow-right',
    align: 'left',
    theme: { bg: 'linear-gradient(135deg, #3a0a12 0%, #6b1525 45%, #2a0810 100%)', glow: 'rgba(220, 60, 80, 0.35)' },
    coverImage: 'royal_heritage_cover',
  },
  {
    id: 'bridal-elegance',
    title: 'Bridal Elegance',
    subtitle: 'Statement pieces curated for wedding and celebration moments.',
    kicker: 'Celebrate Forever',
    layout: 'third',
    align: 'right',
    theme: { bg: 'linear-gradient(135deg, #3d2a10 0%, #8a6528 50%, #2a1e0c 100%)', glow: 'rgba(255, 200, 100, 0.4)' },
    coverImage: 'bridal_elegance_cover',
  },
  {
    id: 'temple-jewellery',
    title: 'Temple Jewellery',
    subtitle: 'Sacred Lakshmi motifs, peacocks, and temple artistry in gold.',
    kicker: 'Sacred Motifs',
    layout: 'third',
    align: 'left',
    theme: { bg: 'linear-gradient(160deg, #1a1510 0%, #3d3428 55%, #0f0d0a 100%)', glow: 'rgba(199, 162, 82, 0.25)' },
    coverImage: 'temple_jewellery_cover',
  },
  {
    id: 'diamond-collection',
    title: 'Diamond Collection',
    subtitle: 'Brilliant cuts, polki, and diamond-accented fine jewellery.',
    kicker: 'Dreamy Diamonds',
    layout: 'third',
    align: 'right',
    theme: { bg: 'linear-gradient(135deg, #0f1824 0%, #1e3348 50%, #0a1018 100%)', glow: 'rgba(140, 180, 220, 0.3)' },
    coverImage: 'diamond_collection_cover',
  },
  {
    id: 'everyday-luxury',
    title: 'Everyday Luxury',
    subtitle: 'Refined staples for daily wear with a quiet luxury finish.',
    kicker: 'Quiet Luxury',
    layout: 'narrow-left',
    align: 'left',
    theme: { bg: 'linear-gradient(135deg, #1c1814 0%, #3a3228 50%, #12100e 100%)', glow: 'rgba(199, 162, 82, 0.2)' },
    coverImage: 'everyday_luxury_cover',
  },
  {
    id: 'antique-collection',
    title: 'Antique Collection',
    subtitle: 'Vintage finishes and time-worn textures with modern refinement.',
    kicker: 'Timeless Forms',
    layout: 'wide-right',
    align: 'right',
    theme: { bg: 'linear-gradient(145deg, #141210 0%, #2a2620 60%, #0a0908 100%)', glow: 'rgba(180, 150, 100, 0.22)' },
    coverImage: 'antique_collection_cover',
  },
  {
    id: 'kids-collection',
    title: 'Kids Collection',
    subtitle: 'Delicate, playful designs crafted for young patrons.',
    kicker: 'Little Treasures',
    layout: 'wide-left',
    align: 'right',
    theme: { bg: 'linear-gradient(135deg, #2a1420 0%, #5a2840 50%, #1a0c14 100%)', glow: 'rgba(255, 160, 180, 0.28)' },
    coverImage: 'signature_collection_cover',
  },
];

/** Standard category tiles shown on each collection landing page */
const COLLECTION_CATEGORY_ORDER = [
  'necklace',
  'earring',
  'bangle',
  'ring',
  'pendant',
  'bracelet',
  'mangalsutra',
  'vaddanam',
  'nosepin',
];

const COLLECTION_FALLBACK_PRODUCT_ID = 'SPND998476';

let browseStage = 'collections';
let activeCollectionId = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getProductImageSrc(product) {
  if (!product?.images?.length || typeof IMAGES === 'undefined') return '';
  return IMAGES[product.images[0]] || IMAGES[product.images.find((k) => IMAGES[k])] || '';
}

function getFallbackCoverImage() {
  const fallback = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find((p) => p.id === COLLECTION_FALLBACK_PRODUCT_ID);
  return getProductImageSrc(fallback);
}

function getCollectionCoverImage(collectionId) {
  const col = getCollectionById(collectionId);
  if (col?.coverImage && typeof IMAGES !== 'undefined' && IMAGES[col.coverImage]) {
    return IMAGES[col.coverImage];
  }
  const products = getProductsInCollection(collectionId);
  if (!products.length) return getFallbackCoverImage();
  const featured =
    products.find((p) => p.images?.some((k) => String(k).includes('_hero'))) ||
    products.find((p) => p.cat === 'necklace') ||
    products[0];
  return getProductImageSrc(featured) || getFallbackCoverImage();
}

function getCategoryPreviewImage(collectionId, categoryId) {
  const products = getProductsInCollection(collectionId).filter((p) => p.cat === categoryId);
  if (products.length) return getProductImageSrc(products[0]);
  return getCollectionCoverImage(collectionId);
}

function getCollectionTileClass(col) {
  const layout = col?.layout || 'third';
  const align = col?.align || 'right';
  return `collection-banner collection-tile collection-banner--${layout} collection-banner--align-${align}`;
}

function getCollectionById(id) {
  return PMJ_COLLECTIONS.find((c) => c.id === id) || null;
}

function getProductCollections(product) {
  if (!product) return [];
  if (typeof getProductData === 'function' && product.id) {
    const merged = getProductData(product.id);
    if (merged?.collections?.length) return merged.collections;
  }
  const raw = product.collections ?? [];
  return Array.isArray(raw) ? raw : [raw].filter(Boolean);
}

function productBelongsToCollection(product, collectionId) {
  if (!collectionId) return true;
  return getProductCollections(product).includes(collectionId);
}

function getProductsInCollection(collectionId) {
  const products = typeof getCatalogueProducts === 'function' ? getCatalogueProducts() : PRODUCTS;
  if (!collectionId) return products.slice();
  return products.filter((p) => productBelongsToCollection(p, collectionId));
}

function getCollectionProductCount(collectionId) {
  return getProductsInCollection(collectionId).length;
}

function getCategoriesForCollection(collectionId) {
  const products = getProductsInCollection(collectionId);
  const counts = new Map();
  products.forEach((p) => {
    if (!p?.cat) return;
    counts.set(p.cat, (counts.get(p.cat) || 0) + 1);
  });

  return COLLECTION_CATEGORY_ORDER.map((catId) => ({
    id: catId,
    label: typeof getCategoryLabel === 'function' ? getCategoryLabel(catId) : catId,
    count: counts.get(catId) || 0,
  }));
}

function renderCollectionsHub() {
  const grid = document.getElementById('collectionsGrid');
  if (!grid) return;

  grid.innerHTML = PMJ_COLLECTIONS.map((col) => {
    const count = getCollectionProductCount(col.id);
    const cover = getCollectionCoverImage(col.id);
    const empty = count === 0;
    const tileClass = getCollectionTileClass(col);
    const themeBg = col.theme?.bg || 'linear-gradient(135deg, #1a1510, #0a0908)';
    const themeGlow = col.theme?.glow || 'rgba(199, 162, 82, 0.25)';
    const ctaLabel = empty ? 'Coming Soon' : 'Discover More';

    return (
      `<button type="button" class="${tileClass}${empty ? ' is-empty' : ''}"` +
      ` data-collection-id="${col.id}"` +
      ` style="--banner-bg:${themeBg};--banner-glow:${themeGlow}">` +
      `<span class="collection-banner-bg" aria-hidden="true"></span>` +
      `<span class="collection-banner-bokeh" aria-hidden="true"></span>` +
      `<span class="collection-banner-visual">` +
      (cover ? `<img src="${cover}" alt="" loading="lazy" decoding="async">` : '') +
      `</span>` +
      `<span class="collection-banner-copy">` +
      `<span class="collection-banner-kicker">${escapeHtml(col.kicker || 'Collection')}</span>` +
      `<span class="collection-banner-title">${escapeHtml(col.title)}</span>` +
      `<span class="collection-banner-sub">${escapeHtml(col.subtitle)}</span>` +
      `<span class="collection-banner-cta">${ctaLabel}</span>` +
      `</span>` +
      `</button>`
    );
  }).join('');
}

function renderCollectionLanding(collectionId) {
  const col = getCollectionById(collectionId);
  const grid = document.getElementById('collectionCategoriesGrid');
  const crumbCol = document.getElementById('collectionCrumbName');
  const heroImg = document.getElementById('collectionLandingHeroImg');
  const heroTitle = document.getElementById('collectionLandingHeroTitle');
  const heroDesc = document.getElementById('collectionLandingHeroDesc');
  if (!col || !grid) return;

  const cover = getCollectionCoverImage(collectionId);
  if (heroImg) {
    heroImg.src = cover || '';
    heroImg.alt = col.title;
  }
  if (heroTitle) heroTitle.textContent = col.title;
  if (heroDesc) heroDesc.textContent = col.subtitle;
  if (crumbCol) crumbCol.textContent = col.title;

  const categories = getCategoriesForCollection(collectionId);
  grid.innerHTML = categories.map((cat) => {
    const empty = cat.count === 0;
    const preview = getCategoryPreviewImage(collectionId, cat.id);
    const countLabel = empty ? 'Coming soon' : `${cat.count} piece${cat.count === 1 ? '' : 's'}`;

    return (
      `<button type="button" class="collection-category-tile${empty ? ' is-empty' : ''}"` +
      ` data-collection-id="${collectionId}" data-category-id="${cat.id}"` +
      `${empty ? ' aria-disabled="true"' : ''}>` +
      `<span class="collection-category-media">` +
      (preview ? `<img src="${preview}" alt="" loading="lazy" decoding="async">` : '') +
      `<span class="collection-category-veil"></span>` +
      `</span>` +
      `<span class="collection-category-copy">` +
      `<span class="collection-category-label">${escapeHtml(cat.label)}</span>` +
      `<span class="collection-category-rule"></span>` +
      `<span class="collection-category-count">${countLabel}</span>` +
      `</span>` +
      `</button>`
    );
  }).join('');
}

function setBrowseVisibility() {
  const hub = document.getElementById('collectionsHub');
  const landing = document.getElementById('collectionLanding');
  const catalogue = document.getElementById('catalogue');
  const filterAnchor = document.getElementById('filterBarAnchor');
  const galleryCrumb = document.getElementById('plpMobileCrumb');
  const inGallery = browseStage === 'gallery';

  hub?.classList.toggle('hidden', browseStage !== 'collections');
  landing?.classList.toggle('hidden', browseStage !== 'categories');
  catalogue?.classList.toggle('collection-gallery-hidden', !inGallery);
  filterAnchor?.classList.toggle('collection-gallery-hidden', !inGallery);
  galleryCrumb?.classList.toggle('collection-gallery-hidden', !inGallery);

  // Hide homepage hero and promo banner when not on the collections list homepage
  const heroSection = document.querySelector('.hero');
  const promoSection = document.getElementById('promoBanner');
  const showHomeElements = browseStage === 'collections';

  if (heroSection) {
    heroSection.classList.toggle('hidden', !showHomeElements);
  }
  if (promoSection) {
    if (!showHomeElements) {
      promoSection.classList.add('hidden');
    } else {
      if (window.PromoBanner && typeof window.PromoBanner.render === 'function') {
        window.PromoBanner.render();
      }
    }
  }

  document.body.dataset.pmjBrowse = browseStage;
  document.body.dataset.pmjCollection = activeCollectionId || '';
}

function renderCollectionGalleryHero(collectionId, categoryId) {
  const hero = document.getElementById('collectionGalleryHero');
  const img = document.getElementById('collectionGalleryHeroImg');
  const title = document.getElementById('collectionGalleryHeroTitle');
  const meta = document.getElementById('collectionGalleryHeroMeta');
  const eyebrow = document.getElementById('collectionGalleryHeroEyebrow');
  const catalogue = document.getElementById('catalogue');
  if (!hero) return;

  const col = getCollectionById(collectionId);
  if (!col || browseStage !== 'gallery') {
    hero.classList.add('hidden');
    hero.setAttribute('aria-hidden', 'true');
    catalogue?.classList.remove('collection-gallery-active');
    return;
  }

  const products = getProductsInCollection(collectionId);
  const filtered = categoryId && categoryId !== 'all'
    ? products.filter((p) => p.cat === categoryId)
    : products;
  const count = filtered.length;
  const cover = getCollectionCoverImage(collectionId);

  if (img) {
    img.src = cover || '';
    img.alt = col.title;
  }
  if (title) title.textContent = col.title;
  if (eyebrow) {
    eyebrow.textContent = categoryId && categoryId !== 'all'
      ? (typeof getCategoryLabel === 'function' ? getCategoryLabel(categoryId) : categoryId)
      : 'Collection';
  }
  if (meta) {
    meta.textContent = count === 1 ? '1 piece' : `${count} pieces`;
  }

  hero.classList.remove('hidden');
  hero.setAttribute('aria-hidden', 'false');
  catalogue?.classList.add('collection-gallery-active');
}

function updateGalleryBreadcrumb(categoryId) {
  const col = getCollectionById(activeCollectionId);
  const colLink = document.getElementById('plpCrumbCollectionLink');
  const catCrumb = document.getElementById('plpCrumbCategory');
  const colSep = document.getElementById('plpCrumbColSep');
  const catSep = document.getElementById('plpCrumbCatSep');
  const sectionEyebrow = document.getElementById('catalogueSectionEyebrow');
  const sectionTitle = document.getElementById('catalogueSectionTitle');
  const crumbCol = document.getElementById('collectionCrumbName');

  if (colLink) {
    colLink.textContent = col?.title || 'Collection';
  }

  const filtered = categoryId && categoryId !== 'all';
  if (filtered) {
    colLink?.classList.remove('hidden');
    colSep?.classList.remove('hidden');
    catSep?.classList.remove('hidden');
    if (catCrumb) {
      catCrumb.textContent = typeof getCategoryLabel === 'function'
        ? getCategoryLabel(categoryId)
        : categoryId;
    }
  } else {
    colLink?.classList.add('hidden');
    colSep?.classList.add('hidden');
    catSep?.classList.add('hidden');
    if (catCrumb) catCrumb.textContent = col?.title || 'Collection';
  }

  if (crumbCol) crumbCol.textContent = col?.title || '';
  if (sectionEyebrow) {
    sectionEyebrow.textContent = filtered ? (col?.title || 'Curated For You') : 'Private Collection';
  }
  if (sectionTitle) {
    sectionTitle.textContent = filtered
      ? (typeof getCategoryLabel === 'function' ? getCategoryLabel(categoryId) : categoryId)
      : (col?.title || 'All Pieces');
  }
  renderCollectionGalleryHero(activeCollectionId, categoryId || 'all');
  window.updateMobileResultsBar?.();
}

function resetGalleryBreadcrumb() {
  document.getElementById('plpCrumbCollectionLink')?.classList.add('hidden');
  document.getElementById('plpCrumbColSep')?.classList.add('hidden');
  document.getElementById('plpCrumbCatSep')?.classList.add('hidden');
}

function scrollToSection(el) {
  if (!el) return;
  const headerH = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--site-header-height') || '68',
    10
  );
  const top = el.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function openCollectionsHub({ scroll = true, animate = true } = {}) {
  const wasCollections = browseStage === 'collections';

  const apply = () => {
    browseStage = 'collections';
    activeCollectionId = null;
    window.currentCollectionFilter = null;
    setBrowseVisibility();
    renderCollectionsHub();
    resetGalleryBreadcrumb();
    renderCollectionGalleryHero(null, 'all');
    window.buildCategoryFilters?.('all');
    if (animate) window.PMJCollectionsAnim?.playStageEntrance('collections');
  };

  const finishScroll = () => {
    if (scroll) scrollToSection(document.getElementById('collectionsHub'));
  };

  if (animate && !wasCollections && window.PMJCollectionsAnim) {
    window.PMJCollectionsAnim.flashTransition(apply).then(finishScroll);
  } else {
    apply();
    finishScroll();
  }
}

function openCollectionLanding(collectionId, { scroll = true, animate = true } = {}) {
  const col = getCollectionById(collectionId);
  if (!col) return;

  const wasCategories = browseStage === 'categories' && activeCollectionId === collectionId;

  const apply = () => {
    browseStage = 'categories';
    activeCollectionId = collectionId;
    window.currentCollectionFilter = collectionId;
    setBrowseVisibility();
    renderCollectionLanding(collectionId);
    window.buildCategoryFilters?.('all');
    if (animate) window.PMJCollectionsAnim?.playStageEntrance('categories');
  };

  const finishScroll = () => {
    if (scroll) scrollToSection(document.getElementById('collectionLanding'));
  };

  if (animate && !wasCategories && window.PMJCollectionsAnim) {
    window.PMJCollectionsAnim.flashTransition(apply).then(finishScroll);
  } else {
    apply();
    finishScroll();
  }
}

function openCollectionGallery(collectionId, categoryId, { scroll = true, animate = true } = {}) {
  const col = getCollectionById(collectionId);
  if (!col) return;

  const apply = () => {
    browseStage = 'gallery';
    activeCollectionId = collectionId;
    window.currentCollectionFilter = collectionId;
    setBrowseVisibility();
    updateGalleryBreadcrumb(categoryId || 'all');

    if (typeof window.setCategoryFilter === 'function') {
      window.setCategoryFilter(categoryId || 'all');
    } else {
      window.buildCategoryFilters?.(categoryId || 'all');
      window.renderCatalogueGrid?.();
      if (scroll) scrollToSection(document.getElementById('catalogue'));
    }

    if (animate) window.PMJCollectionsAnim?.playStageEntrance('gallery');
  };

  if (animate && browseStage !== 'gallery' && window.PMJCollectionsAnim) {
    window.PMJCollectionsAnim.flashTransition(apply).then(() => {
      if (scroll) scrollToSection(document.getElementById('catalogue'));
    });
  } else {
    apply();
    if (scroll) scrollToSection(document.getElementById('catalogue'));
  }
}

function initCollectionsBrowse() {
  renderCollectionsHub();
  setBrowseVisibility();

  document.getElementById('collectionsGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.collection-banner[data-collection-id]');
    if (!card || card.classList.contains('is-empty')) return;
    window.PMJCollectionsAnim?.pulseCategoryTile(card);
    const delay = window.PMJCollectionsAnim?.prefersReducedMotion?.() ? 0 : 460;
    window.setTimeout(() => openCollectionGallery(card.dataset.collectionId, 'all'), delay);
  });

  document.getElementById('collectionCategoriesGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.collection-category-tile:not(.is-empty)');
    if (!card) return;
    const { collectionId, categoryId } = card.dataset;
    window.PMJCollectionsAnim?.pulseCategoryTile(card);
    const delay = window.PMJCollectionsAnim?.prefersReducedMotion?.() ? 0 : 480;
    window.setTimeout(() => openCollectionGallery(collectionId, categoryId), delay);
  });

  document.getElementById('collectionBackBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCollectionsHub();
  });

  document.getElementById('plpCrumbHome')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCollectionsHub();
  });

  document.getElementById('plpCrumbCollectionLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (activeCollectionId) openCollectionGallery(activeCollectionId, 'all');
    else openCollectionsHub();
  });

  document.getElementById('headerBrandLink')?.addEventListener('click', (e) => {
    if (browseStage === 'collections') return;
    e.preventDefault();
    openCollectionsHub();
  });

  document.querySelector('a.nav-link[href="#collectionsHub"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCollectionsHub();
  });

  document.getElementById('heroCta')?.addEventListener('click', (e) => {
    if (document.getElementById('collectionsHub')) {
      e.preventDefault();
      openCollectionsHub();
    }
  });

  window.addEventListener('pmj:catalogue-updated', () => {
    if (browseStage === 'collections') {
      renderCollectionsHub();
      window.PMJCollectionsAnim?.playStageEntrance('collections');
    }
    if (browseStage === 'categories' && activeCollectionId) {
      renderCollectionLanding(activeCollectionId);
      window.PMJCollectionsAnim?.playStageEntrance('categories');
    }
  });

  window.addEventListener('pmj:intro-complete', () => {
    setBrowseVisibility();
    window.setTimeout(() => window.PMJCollectionsAnim?.playStageEntrance('collections'), 160);
  });

  if (document.body.classList.contains('catalogue-ready')) {
    window.setTimeout(() => window.PMJCollectionsAnim?.playStageEntrance('collections'), 200);
  }
}

window.getCollectionById = getCollectionById;
window.PMJ_COLLECTIONS = PMJ_COLLECTIONS;
window.getProductCollections = getProductCollections;
window.productBelongsToCollection = productBelongsToCollection;
window.getProductsInCollection = getProductsInCollection;
window.getCategoriesForCollection = getCategoriesForCollection;
window.openCollectionsHub = openCollectionsHub;
window.openCollectionLanding = openCollectionLanding;
window.openCollectionGallery = openCollectionGallery;
window.updateGalleryBreadcrumb = updateGalleryBreadcrumb;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCollectionsBrowse);
} else {
  initCollectionsBrowse();
}
