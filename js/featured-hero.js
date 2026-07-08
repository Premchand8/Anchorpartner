/* Featured hero image — attached section, intro cinematic, editable description */
const IMAGE_UPLOAD_SPECS = {
  heroDesktop: {
    width: 960,
    height: 960,
    ratio: '1 : 1',
    formats: 'PNG or JPG',
    note: 'Shows your product only — no frame or box. PNG cut-outs work best.',
    section: 'Hero attached image (desktop)',
  },
  heroMobile: {
    width: 750,
    height: 750,
    ratio: '1 : 1',
    formats: 'PNG or JPG',
    note: 'Mobile hero — product only, no box',
    section: 'Hero attached image (mobile)',
  },
  bannerDesktop: {
    width: 1440,
    height: 480,
    ratio: '3 : 1 wide',
    formats: 'PNG or JPG',
    note: 'Full-width strip above catalogue',
    section: 'Promo banner (desktop)',
  },
  bannerMobile: {
    width: 750,
    height: 940,
    ratio: 'Portrait',
    formats: 'PNG or JPG',
    note: 'Tall banner on mobile',
    section: 'Promo banner (mobile)',
  },
};

const HERO_COPY_DEFAULTS = {
  heroEyebrow: 'The Private Viewing',
  heroHeadlineMain: 'Pieces worth',
  heroHeadlineEm: 'a second look.',
  heroDescription:
    'A curated selection from the PMJ atelier, shown here for your consideration. Save what catches your eye — we\'ll follow up personally on every piece you shortlist.',
  heroCtaLabel: 'View the Collection →',
  heroCtaTarget: '#catalogue',
  heroCtaProductId: '',
};

function featuredDefaults() {
  return {
    ...HERO_COPY_DEFAULTS,
    ...(window.FEATURED_SETTINGS_DEFAULTS || {}),
    desktopImage: '',
    mobileImage: '',
    imageCaption: '',
    useInIntro: true,
    rotate3d: false,
    productId: '',
  };
}

function getFeaturedSettings() {
  const s = typeof window.loadDisplaySettings === 'function' ? window.loadDisplaySettings() : {};
  return { ...featuredDefaults(), ...(s.featured || {}) };
}

function getFeaturedImageForViewport() {
  const f = getFeaturedSettings();
  const mobile = window.innerWidth < 900;
  return mobile
    ? f.mobileImage || f.desktopImage
    : f.desktopImage || f.mobileImage;
}

function isPngDataUrl(url) {
  return typeof url === 'string' && url.startsWith('data:image/png');
}

function isPngSource(url) {
  return isPngDataUrl(url) || (typeof url === 'string' && /\.png(\?|#|$)/i.test(url));
}

function featuredShouldRotate3d() {
  const f = getFeaturedSettings();
  const img = getFeaturedImageForViewport();
  if (!img) return false;
  if (isPngSource(img)) return false;
  if (f.rotate3d === false) return false;
  return f.rotate3d === true;
}

function applyHeroProductMode(enabled) {
  const el = document.getElementById('heroVisual');
  if (!el) return;
  el.classList.toggle('hero-product-only', enabled);
  if (!enabled) el.classList.remove('hero-png-mode');
}

/** @deprecated use applyHeroProductMode */
function applyHeroPngMode(enabled) {
  applyHeroProductMode(enabled);
}

function bindHeroCta() {
  const btn = document.getElementById('heroCta');
  if (!btn || btn.dataset.heroCtaBound === '1') return;
  btn.dataset.heroCtaBound = '1';
  btn.addEventListener('click', (e) => {
    const f = getFeaturedSettings();
    if (f.heroCtaTarget === 'product' && f.heroCtaProductId) {
      e.preventDefault();
      if (typeof openProductModal === 'function') {
        openProductModal(f.heroCtaProductId);
      }
    }
  });
}

function applyFeaturedContent() {
  const f = getFeaturedSettings();
  const defaults = HERO_COPY_DEFAULTS;

  const eyebrow = document.getElementById('heroEyebrow');
  const headlineMain = document.getElementById('heroHeadlineMain');
  const headlineEm = document.getElementById('heroHeadlineEm');
  const descEl = document.getElementById('heroDescription');
  const ctaEl = document.getElementById('heroCta');
  const captionEl = document.getElementById('heroCaption');

  if (eyebrow) eyebrow.textContent = f.heroEyebrow || defaults.heroEyebrow;
  if (headlineMain) headlineMain.textContent = f.heroHeadlineMain || defaults.heroHeadlineMain;
  if (headlineEm) headlineEm.textContent = f.heroHeadlineEm || defaults.heroHeadlineEm;
  if (descEl) descEl.textContent = f.heroDescription || defaults.heroDescription;

  if (ctaEl) {
    ctaEl.textContent = f.heroCtaLabel || defaults.heroCtaLabel;
    const target = f.heroCtaTarget || defaults.heroCtaTarget;
    if (target === 'product' && f.heroCtaProductId) {
      ctaEl.href = '#catalogue';
      ctaEl.dataset.productLink = f.heroCtaProductId;
    } else {
      ctaEl.href = target.startsWith('#') ? target : `#${target}`;
      delete ctaEl.dataset.productLink;
    }
  }

  if (captionEl) {
    if (f.imageCaption) {
      captionEl.textContent = f.imageCaption;
    } else if (f.productId && typeof getProductData === 'function') {
      captionEl.textContent = getProductData(f.productId).name;
    } else if (!f.imageCaption && !f.productId) {
      const fallback = PRODUCTS?.find((x) => x.id === 'SPND998476');
      if (fallback) captionEl.textContent = fallback.name;
    }
  }
}

function isPngFile(file) {
  return (
    file?.type === 'image/png' ||
    /\.png(\?|#|$)/i.test(file?.name || '')
  );
}

function resizeImageFile(file, targetW, targetH, options = {}) {
  const heroMode = options.mode === 'hero' || options.hero === true;
  const maxLen = options.maxDataUrlLength ?? 700000;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const pngSource = isPngFile(file) || isPngDataUrl(String(reader.result || ''));
        const preserveAlpha = heroMode || pngSource;

        function drawContained(w, h) {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d', { alpha: true });
          if (preserveAlpha) {
            ctx.clearRect(0, 0, w, h);
          } else {
            ctx.fillStyle = '#f4efe4';
            ctx.fillRect(0, 0, w, h);
          }
          const scale = Math.min(w / img.width, h / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
          return c;
        }

        function encode(c) {
          if (preserveAlpha) return c.toDataURL('image/png');
          return c.toDataURL('image/jpeg', 0.78);
        }

        let w = targetW;
        let h = targetH;
        while (w >= 280) {
          const dataUrl = encode(drawContained(w, h));
          if (dataUrl.length <= maxLen) {
            resolve(dataUrl);
            return;
          }
          w = Math.floor(w * 0.82);
          h = Math.floor(h * 0.82);
        }
        resolve(encode(drawContained(w, h)));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function applyFeaturedVisualNow() {
  applyFeaturedContent();
  const img = getFeaturedImageForViewport();
  const heroVisual = document.getElementById('heroVisual');
  const heroImg = document.getElementById('heroImg');
  const heroCanvas = document.getElementById('heroCanvas');

  if (!img) {
    applyHeroProductMode(false);
    const p = typeof getProductData === 'function'
      ? getProductData('SPND998476')
      : PRODUCTS?.find((x) => x.id === 'SPND998476');
    if (p && window.PMJExperience) {
      PMJExperience.initHeroViewer(p);
    } else if (p && IMAGES?.[p.images?.[0]]) {
      if (heroCanvas) heroCanvas.style.display = 'none';
      if (heroImg) {
        heroImg.src = IMAGES[p.images[0]];
        heroImg.classList.remove('hidden');
      }
      const captionEl = document.getElementById('heroCaption');
      if (captionEl) captionEl.textContent = p.name;
    }
    return;
  }

  if (heroImg) {
    heroImg.src = img;
    heroImg.classList.remove('hidden');
    heroImg.style.background = 'transparent';
  }

  /* Custom upload — flat product only, no box, no 3D canvas */
  applyHeroProductMode(true);
  heroVisual?.classList.toggle('hero-png-mode', isPngSource(img));
  window.PMJExperience?.stopHeroViewer?.();
  if (heroCanvas) heroCanvas.style.display = 'none';
}

function applyFeaturedVisual() {
  requestAnimationFrame(() => {
    requestAnimationFrame(applyFeaturedVisualNow);
  });
}

window.IMAGE_UPLOAD_SPECS = IMAGE_UPLOAD_SPECS;
window.getFeaturedSettings = getFeaturedSettings;
window.getFeaturedImageForViewport = getFeaturedImageForViewport;
window.featuredShouldRotate3d = featuredShouldRotate3d;
window.isPngDataUrl = isPngDataUrl;
window.isPngSource = isPngSource;
window.isPngFile = isPngFile;
window.applyHeroProductMode = applyHeroProductMode;
window.resizeImageFile = resizeImageFile;
window.applyFeaturedContent = applyFeaturedContent;
window.applyFeaturedVisual = applyFeaturedVisual;
window.applyFeaturedVisualNow = applyFeaturedVisualNow;
window.HERO_COPY_DEFAULTS = HERO_COPY_DEFAULTS;
window.bindHeroCta = bindHeroCta;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindHeroCta);
} else {
  bindHeroCta();
}

function renderUploadSpecCard(containerId, specKey) {
  const el = document.getElementById(containerId);
  const s = IMAGE_UPLOAD_SPECS[specKey];
  if (!el || !s) return;
  el.innerHTML =
    `<div class="upload-spec-dims">${s.width} × ${s.height} px</div>` +
    `<div class="upload-spec-meta"><span>Ratio ${s.ratio}</span><span>${s.formats}</span></div>` +
    `<div class="upload-spec-note">${s.note}</div>`;
}

function populateUploadSpecCards() {
  renderUploadSpecCard('heroDesktopSpec', 'heroDesktop');
  renderUploadSpecCard('heroMobileSpec', 'heroMobile');
  renderUploadSpecCard('bannerDesktopSpec', 'bannerDesktop');
  renderUploadSpecCard('bannerMobileSpec', 'bannerMobile');
}

window.renderUploadSpecCard = renderUploadSpecCard;
window.populateUploadSpecCards = populateUploadSpecCards;
