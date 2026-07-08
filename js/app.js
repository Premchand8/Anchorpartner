/* Admin mode, display settings, promo banner admin */
const adminModal = document.getElementById('adminModal');
const adminBackdrop = document.getElementById('adminBackdrop');
const displaySettingsModal = document.getElementById('displaySettingsModal');
const displaySettingsBackdrop = document.getElementById('displaySettingsBackdrop');

/** Pending banner uploads (applied on save) */
let pendingBannerDesktop = null;
let pendingBannerMobile = null;
let clearBannerDesktop = false;
let clearBannerMobile = false;

/** Pending featured hero uploads */
let pendingFeaturedDesktop = null;
let pendingFeaturedMobile = null;
let clearFeaturedDesktop = false;
let clearFeaturedMobile = false;

function loadSettings() {
  return typeof window.loadDisplaySettings === 'function' ? window.loadDisplaySettings() : {};
}

function saveSettings(data) {
  if (typeof window.saveDisplaySettings !== 'function') {
    throw new Error('Display settings module failed to load. Please refresh the page.');
  }
  window.saveDisplaySettings(data);
}

function bannerDefaults() {
  return window.BANNER_SETTINGS_DEFAULTS || {
    enabled: false,
    mode: 'static',
    desktopImage: '',
    mobileImage: '',
    headline: '',
    subtext: '',
    ctaLabel: 'View Piece',
    productId: '',
    bannerRotateSpeed: 1,
  };
}

function featuredDefaults() {
  const copy = window.HERO_COPY_DEFAULTS || {
    heroEyebrow: 'The Private Viewing',
    heroHeadlineMain: 'Pieces worth',
    heroHeadlineEm: 'a second look.',
    heroDescription: '',
    heroCtaLabel: 'View the Collection →',
    heroCtaTarget: '#catalogue',
    heroCtaProductId: '',
  };
  return {
    ...copy,
    desktopImage: '',
    mobileImage: '',
    imageCaption: '',
    useInIntro: true,
    rotate3d: false,
    productId: '',
    ...(window.FEATURED_SETTINGS_DEFAULTS || {}),
  };
}

function toggleHeroCtaProductRow() {
  const target = getVal('setHeroCtaTarget', '#catalogue');
  getEl('heroCtaProductRow')?.classList.toggle('hidden', target !== 'product');
}

function populateUploadSpecCardsFallback() {
  if (typeof window.populateUploadSpecCards === 'function') {
    window.populateUploadSpecCards();
    return;
  }
  const specs = window.IMAGE_UPLOAD_SPECS || {};
  Object.entries({
    heroDesktopSpec: 'heroDesktop',
    heroMobileSpec: 'heroMobile',
    bannerDesktopSpec: 'bannerDesktop',
    bannerMobileSpec: 'bannerMobile',
  }).forEach(([id, key]) => {
    const el = document.getElementById(id);
    const s = specs[key];
    if (!el || !s) return;
    el.innerHTML =
      `<div class="upload-spec-dims">${s.width} × ${s.height} px</div>` +
      `<div class="upload-spec-meta"><span>Ratio ${s.ratio}</span><span>${s.formats}</span></div>` +
      `<div class="upload-spec-note">${s.note}</div>`;
  });
}

function resizeUpload(file, w, h, opts = {}) {
  const fn = window.resizeImageFile || window.PromoBanner?.resizeImageFile;
  return fn ? fn(file, w, h, opts) : Promise.reject(new Error('No resize helper'));
}

function populateProductSelect(selectEl, selectedId) {
  if (!selectEl || typeof PRODUCTS === 'undefined') return;
  selectEl.innerHTML = '<option value="">— Select a product —</option>' +
    PRODUCTS.map((p) => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${p.name} (${p.id})</option>`).join('');
}

function setThumbnailPreview(imgEl, src, callback) {
  const img = new Image();
  const isHero = imgEl?.classList.contains('hero-preview');
  const keepPng = isHero && window.isPngDataUrl?.(src);
  img.onload = () => {
    const max = 220;
    const c = document.createElement('canvas');
    const ratio = Math.min(max / img.width, max / img.height, 1);
    c.width = Math.round(img.width * ratio);
    c.height = Math.round(img.height * ratio);
    const ctx = c.getContext('2d', { alpha: true });
    if (keepPng) ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    imgEl.src = keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.78);
    callback?.();
  };
  img.onerror = () => callback?.();
  img.src = src;
}

function setBannerPreview(imgEl, clearBtn, src, opts = {}) {
  if (!imgEl) return;
  const row = imgEl.closest('.banner-upload-row');
  const hint = row?.querySelector('.preview-saved-hint');

  if (src) {
    const show = () => {
      imgEl.classList.remove('hidden');
      clearBtn?.classList.remove('hidden');
      if (hint) hint.classList.remove('hidden');
    };
    if (opts.fullPreview || src.length < 500000) {
      imgEl.src = src;
      show();
    } else {
      setThumbnailPreview(imgEl, src, show);
    }
  } else {
    imgEl.src = '';
    imgEl.classList.add('hidden');
    clearBtn?.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
  }
}

function getEl(id) {
  return document.getElementById(id);
}

function getVal(id, fallback = '') {
  const el = getEl(id);
  return el ? (el.value ?? fallback).toString().trim() : fallback;
}

function getCheck(id, fallback = false) {
  const el = getEl(id);
  return el ? !!el.checked : fallback;
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function switchDisplayTab(key) {
  const modal = getEl('displaySettingsModal');
  if (!modal || !key) return;
  modal.querySelectorAll('.admin-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === key);
  });
  getEl('tabMotion')?.classList.toggle('hidden', key !== 'motion');
  getEl('tabHero')?.classList.toggle('hidden', key !== 'hero');
  getEl('tabBanner')?.classList.toggle('hidden', key !== 'banner');
}

function resetDisplaySettingsTabs() {
  switchDisplayTab('motion');
}

function handleSaveDisplaySettings() {
  const current = loadSettings();
  const prevBanner = current.banner || { ...bannerDefaults() };
  const prevFeatured = current.featured || { ...featuredDefaults() };

  let desktopImage = prevBanner.desktopImage;
  let mobileImage = prevBanner.mobileImage;
  if (pendingBannerDesktop !== null) desktopImage = pendingBannerDesktop;
  else if (clearBannerDesktop) desktopImage = '';
  if (pendingBannerMobile !== null) mobileImage = pendingBannerMobile;
  else if (clearBannerMobile) mobileImage = '';

  let featuredDesktop = prevFeatured.desktopImage;
  let featuredMobile = prevFeatured.mobileImage;
  if (pendingFeaturedDesktop !== null) featuredDesktop = pendingFeaturedDesktop;
  else if (clearFeaturedDesktop) featuredDesktop = '';
  if (pendingFeaturedMobile !== null) featuredMobile = pendingFeaturedMobile;
  else if (clearFeaturedMobile) featuredMobile = '';

  const featured = {
    desktopImage: featuredDesktop,
    mobileImage: featuredMobile,
    heroEyebrow: getVal('setHeroEyebrow'),
    heroHeadlineMain: getVal('setHeroHeadlineMain'),
    heroHeadlineEm: getVal('setHeroHeadlineEm'),
    heroDescription: getVal('setHeroDescription'),
    heroCtaLabel: getVal('setHeroCtaLabel'),
    heroCtaTarget: getVal('setHeroCtaTarget', '#catalogue'),
    heroCtaProductId: getVal('setHeroCtaProduct'),
    imageCaption: getVal('setImageCaption'),
    useInIntro: getCheck('setUseInIntro', true),
    rotate3d: getCheck('setFeaturedRotate3d', false),
    productId: getVal('setFeaturedProduct'),
  };

  try {
    saveSettings({
      ...current,
      globalAutoRotate: getCheck('setGlobalAutoRotate', true),
      heroAutoRotate: getCheck('setHeroAutoRotate', true),
      viewerAutoRotate: getCheck('setViewerAutoRotate', true),
      customerThemeToggle: getCheck('setCustomerThemeToggle', true),
      globalRotateSpeed: parseFloat(getVal('setGlobalSpeed', '1')) || 1,
      heroRotateSpeed: parseFloat(getVal('setHeroSpeed', '1')) || 1,
      featured,
      banner: {
        enabled: getCheck('setBannerEnabled'),
        mode: getVal('setBannerMode', 'static'),
        desktopImage,
        mobileImage,
        headline: getVal('setBannerHeadline'),
        subtext: getVal('setBannerSubtext'),
        ctaLabel: getVal('setBannerCta', 'View Piece') || 'View Piece',
        productId: getVal('setBannerProduct'),
        bannerRotateSpeed: parseFloat(getVal('setBannerRotateSpeed', '1')) || 1,
      },
    });
  } catch (err) {
    alert(err.message || 'Could not save — images may be too large. Try smaller JPG files (under 400 KB each).');
    return;
  }

  closeDisplaySettingsModal();
  window.dispatchEvent(new CustomEvent('pmj:display-settings-changed'));
  window.applyFeaturedContent?.();
  window.applyFeaturedVisualNow?.();
  if (typeof activeProductId !== 'undefined' && activeProductId && typeof renderModal === 'function') renderModal();

  window.PMJSiteSync?.schedulePublish?.();
}

function initDisplaySettingsPanel() {
  const modal = getEl('displaySettingsModal');
  if (!modal || modal.dataset.bound === '1') return;
  modal.dataset.bound = '1';

  modal.addEventListener('click', (e) => {
    const tab = e.target.closest('.admin-tab');
    if (tab?.dataset.tab) {
      e.preventDefault();
      e.stopPropagation();
      switchDisplayTab(tab.dataset.tab);
      return;
    }
    if (e.target.closest('#saveDisplaySettings')) {
      e.preventDefault();
      e.stopPropagation();
      handleSaveDisplaySettings();
      return;
    }
    if (e.target.closest('#closeDisplaySettings')) {
      e.preventDefault();
      closeDisplaySettingsModal();
    }
  });

  getEl('setBannerMode')?.addEventListener('change', toggleBannerRotateRow);
  getEl('setHeroCtaTarget')?.addEventListener('change', toggleHeroCtaProductRow);

  getEl('bannerDesktopUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const specs = window.IMAGE_UPLOAD_SPECS?.bannerDesktop || { width: 1440, height: 480 };
      pendingBannerDesktop = await resizeUpload(file, specs.width, specs.height);
      setBannerPreview(getEl('bannerDesktopPreview'), getEl('clearBannerDesktop'), pendingBannerDesktop, { fullPreview: true });
      clearBannerDesktop = false;
      if (file.type === 'image/png' || window.isPngDataUrl?.(pendingBannerDesktop)) {
        setInputValue('setBannerMode', 'rotate3d');
        toggleBannerRotateRow();
      }
    } catch (err) {
      alert('Could not process desktop banner image.');
      e.target.value = '';
    }
  });

  getEl('bannerMobileUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const specs = window.IMAGE_UPLOAD_SPECS?.bannerMobile || { width: 750, height: 940 };
      pendingBannerMobile = await resizeUpload(file, specs.width, specs.height);
      setBannerPreview(getEl('bannerMobilePreview'), getEl('clearBannerMobile'), pendingBannerMobile, { fullPreview: true });
      clearBannerMobile = false;
      if (file.type === 'image/png' || window.isPngDataUrl?.(pendingBannerMobile)) {
        setInputValue('setBannerMode', 'rotate3d');
        toggleBannerRotateRow();
      }
    } catch (err) {
      alert('Could not process mobile banner image.');
      e.target.value = '';
    }
  });

  getEl('featuredDesktopUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const specs = window.IMAGE_UPLOAD_SPECS?.heroDesktop || { width: 960, height: 960 };
      pendingFeaturedDesktop = await resizeUpload(file, specs.width, specs.height, { mode: 'hero' });
      setBannerPreview(getEl('featuredDesktopPreview'), getEl('clearFeaturedDesktop'), pendingFeaturedDesktop, { fullPreview: true });
      clearFeaturedDesktop = false;
      if (file.type === 'image/png' || window.isPngDataUrl?.(pendingFeaturedDesktop)) {
        setChecked('setFeaturedRotate3d', false);
      }
    } catch (err) {
      alert('Could not process desktop hero image. Try a smaller JPG or PNG.');
      e.target.value = '';
    }
  });

  getEl('featuredMobileUpload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const specs = window.IMAGE_UPLOAD_SPECS?.heroMobile || { width: 750, height: 750 };
      pendingFeaturedMobile = await resizeUpload(file, specs.width, specs.height, { mode: 'hero' });
      setBannerPreview(getEl('featuredMobilePreview'), getEl('clearFeaturedMobile'), pendingFeaturedMobile, { fullPreview: true });
      clearFeaturedMobile = false;
      if (file.type === 'image/png' || window.isPngDataUrl?.(pendingFeaturedMobile)) {
        setChecked('setFeaturedRotate3d', false);
      }
    } catch (err) {
      alert('Could not process mobile hero image. Try a smaller JPG or PNG.');
      e.target.value = '';
    }
  });

  getEl('clearFeaturedDesktop')?.addEventListener('click', () => {
    pendingFeaturedDesktop = '';
    clearFeaturedDesktop = true;
    setBannerPreview(getEl('featuredDesktopPreview'), getEl('clearFeaturedDesktop'), null);
    getEl('featuredDesktopUpload').value = '';
  });

  getEl('clearFeaturedMobile')?.addEventListener('click', () => {
    pendingFeaturedMobile = '';
    clearFeaturedMobile = true;
    setBannerPreview(getEl('featuredMobilePreview'), getEl('clearFeaturedMobile'), null);
    getEl('featuredMobileUpload').value = '';
  });

  getEl('clearBannerDesktop')?.addEventListener('click', () => {
    pendingBannerDesktop = '';
    clearBannerDesktop = true;
    setBannerPreview(getEl('bannerDesktopPreview'), getEl('clearBannerDesktop'), null);
    getEl('bannerDesktopUpload').value = '';
  });

  getEl('clearBannerMobile')?.addEventListener('click', () => {
    pendingBannerMobile = '';
    clearBannerMobile = true;
    setBannerPreview(getEl('bannerMobilePreview'), getEl('clearBannerMobile'), null);
    getEl('bannerMobileUpload').value = '';
  });

  getEl('saveDisplaySettings')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSaveDisplaySettings();
  });

  getEl('closeDisplaySettings')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeDisplaySettingsModal();
  });

  ['setGlobalSpeed', 'setHeroSpeed', 'setBannerRotateSpeed'].forEach((id) => {
    getEl(id)?.addEventListener('input', (e) => {
      const valEl = getEl(id + 'Val');
      if (valEl) valEl.textContent = e.target.value + '×';
    });
  });
}

function fillFeaturedForm() {
  const featured = typeof window.getFeaturedSettings === 'function'
    ? window.getFeaturedSettings()
    : featuredDefaults();
  const copy = window.HERO_COPY_DEFAULTS || {};

  setInputValue('setHeroEyebrow', featured.heroEyebrow || copy.heroEyebrow || '');
  setInputValue('setHeroHeadlineMain', featured.heroHeadlineMain || copy.heroHeadlineMain || '');
  setInputValue('setHeroHeadlineEm', featured.heroHeadlineEm || copy.heroHeadlineEm || '');
  setInputValue('setHeroDescription', featured.heroDescription || '');
  setInputValue('setHeroCtaLabel', featured.heroCtaLabel || copy.heroCtaLabel || '');
  setInputValue('setHeroCtaTarget', featured.heroCtaTarget || '#catalogue');
  populateProductSelect(document.getElementById('setHeroCtaProduct'), featured.heroCtaProductId || '');
  toggleHeroCtaProductRow();
  setInputValue('setImageCaption', featured.imageCaption || '');
  setChecked('setUseInIntro', featured.useInIntro !== false);
  setChecked('setFeaturedRotate3d', featured.rotate3d !== false);
  populateProductSelect(document.getElementById('setFeaturedProduct'), featured.productId || '');
  setBannerPreview(document.getElementById('featuredDesktopPreview'), document.getElementById('clearFeaturedDesktop'), featured.desktopImage);
  setBannerPreview(document.getElementById('featuredMobilePreview'), document.getElementById('clearFeaturedMobile'), featured.mobileImage);
  pendingFeaturedDesktop = null;
  pendingFeaturedMobile = null;
  clearFeaturedDesktop = false;
  clearFeaturedMobile = false;
}

function fillBannerForm(b) {
  const banner = b || bannerDefaults();
  setChecked('setBannerEnabled', !!banner.enabled);
  setInputValue('setBannerMode', banner.mode || 'static');
  setInputValue('setBannerHeadline', banner.headline || '');
  setInputValue('setBannerSubtext', banner.subtext || '');
  setInputValue('setBannerCta', banner.ctaLabel || 'View Piece');
  setInputValue('setBannerRotateSpeed', banner.bannerRotateSpeed ?? 1);
  const speedVal = document.getElementById('setBannerRotateSpeedVal');
  if (speedVal) speedVal.textContent = (banner.bannerRotateSpeed ?? 1) + '×';
  populateProductSelect(document.getElementById('setBannerProduct'), banner.productId || '');
  setBannerPreview(document.getElementById('bannerDesktopPreview'), document.getElementById('clearBannerDesktop'), banner.desktopImage);
  setBannerPreview(document.getElementById('bannerMobilePreview'), document.getElementById('clearBannerMobile'), banner.mobileImage);
  toggleBannerRotateRow();
  pendingBannerDesktop = null;
  pendingBannerMobile = null;
  clearBannerDesktop = false;
  clearBannerMobile = false;
}

function toggleBannerRotateRow() {
  const mode = document.getElementById('setBannerMode')?.value;
  document.getElementById('bannerRotateRow')?.classList.toggle('hidden', mode !== 'rotate3d');
}

function enableAdminMode() {
  adminMode = true;
  document.getElementById('adminPill')?.classList.remove('hidden');
  if (typeof activeProductId !== 'undefined' && activeProductId && typeof renderModal === 'function') {
    renderModal();
  }
}

function tryAdminFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('admin')?.trim();
  if (!code) return;
  if (code === window.ADMIN_ACCESS_CODE || code === 'PMJADMIN26') {
    enableAdminMode();
    params.delete('admin');
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', next);
  }
}

function openAdminModal() {
  adminModal.classList.add('open');
  adminBackdrop.classList.add('open');
  document.getElementById('adminCode').focus();
}

function closeAdminModal() {
  adminModal.classList.remove('open');
  adminBackdrop.classList.remove('open');
  document.getElementById('adminCode').value = '';
  document.getElementById('adminError').textContent = '';
}

function openDisplaySettingsModal() {
  if (!displaySettingsModal || !displaySettingsBackdrop) {
    alert('Display Settings panel is missing. Please refresh the page.');
    return;
  }

  initDisplaySettingsPanel();
  resetDisplaySettingsTabs();
  displaySettingsModal.classList.add('open');
  displaySettingsBackdrop.classList.add('open');
  displaySettingsModal.setAttribute('aria-hidden', 'false');

  try {
    populateUploadSpecCardsFallback();
    const s = loadSettings();
    setChecked('setGlobalAutoRotate', s.globalAutoRotate !== false);
    setChecked('setHeroAutoRotate', s.heroAutoRotate !== false);
    setChecked('setViewerAutoRotate', s.viewerAutoRotate !== false);
    setChecked('setCustomerThemeToggle', s.customerThemeToggle !== false);
    setInputValue('setGlobalSpeed', s.globalRotateSpeed ?? 1);
    setInputValue('setHeroSpeed', s.heroRotateSpeed ?? 1);
    const globalSpeedVal = document.getElementById('setGlobalSpeedVal');
    const heroSpeedVal = document.getElementById('setHeroSpeedVal');
    if (globalSpeedVal) globalSpeedVal.textContent = (s.globalRotateSpeed ?? 1) + '×';
    if (heroSpeedVal) heroSpeedVal.textContent = (s.heroRotateSpeed ?? 1) + '×';
    fillFeaturedForm();
    fillBannerForm(s.banner);
  } catch (err) {
    console.error('Display settings load error:', err);
  }
}

function closeDisplaySettingsModal() {
  displaySettingsModal?.classList.remove('open');
  displaySettingsBackdrop?.classList.remove('open');
  displaySettingsModal?.setAttribute('aria-hidden', 'true');
}

document.getElementById('openAdmin')?.addEventListener('click', () => {
  if (adminMode) {
    adminMode = false;
    document.getElementById('adminPill').classList.add('hidden');
    if (activeProductId) renderModal();
    return;
  }
  openAdminModal();
});

document.getElementById('adminSubmit')?.addEventListener('click', () => {
  const val = document.getElementById('adminCode').value.trim();
  if (val === window.ADMIN_ACCESS_CODE || val === 'PMJADMIN26') {
    enableAdminMode();
    closeAdminModal();
  } else {
    document.getElementById('adminError').textContent = 'Incorrect admin code.';
  }
});

document.getElementById('publishSiteConfig')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.PMJSiteSync?.publishConfig?.();
});

tryAdminFromUrl();

adminBackdrop?.addEventListener('click', closeAdminModal);

document.getElementById('adminCode')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('adminSubmit').click();
});

document.addEventListener('click', (e) => {
  const displayBtn = e.target.closest('#openDisplaySettings');
  if (!displayBtn) return;
  e.preventDefault();
  e.stopPropagation();
  openDisplaySettingsModal();
});

displaySettingsBackdrop?.addEventListener('click', (e) => {
  if (e.target === displaySettingsBackdrop) closeDisplaySettingsModal();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDisplaySettingsPanel);
} else {
  initDisplaySettingsPanel();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('catalogue-ready')) PromoBanner?.init();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (productModal?.classList.contains('open')) closeProductModal();
  else if (drawer?.classList.contains('open')) closeDrawer();
  else if (displaySettingsModal?.classList.contains('open')) closeDisplaySettingsModal();
  else if (adminModal?.classList.contains('open')) closeAdminModal();
});

function preloadHeroImage() {
  const p = PRODUCTS.find((x) => x.id === 'SPND998476');
  if (!p || !IMAGES[p.images[0]]) return;
  const img = new Image();
  img.src = IMAGES[p.images[0]];
}

if (document.body.classList.contains('catalogue-ready')) {
  preloadHeroImage();
  PromoBanner?.init();
}

window.addEventListener('pmj:intro-complete', () => {
  preloadHeroImage();
  PromoBanner?.init();
  PromoBanner?.render();
  window.applyFeaturedVisual?.();
});

window.addEventListener('pmj:display-settings-changed', () => {
  PromoBanner?.render();
  if (document.body.classList.contains('catalogue-ready')) {
    window.applyFeaturedVisual?.();
  }
});
