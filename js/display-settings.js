/* Global & per-product 3D display / rotation settings */
const DISPLAY_DEFAULTS = {
  globalAutoRotate: true,
  globalRotateSpeed: 1,
  heroAutoRotate: true,
  viewerAutoRotate: true,
  heroRotateSpeed: 1,
  customerThemeToggle: true,
  banner: null,
  featured: null,
};

const BANNER_SETTINGS_DEFAULTS = {
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

const FEATURED_SETTINGS_DEFAULTS = {
  desktopImage: '',
  mobileImage: '',
  heroEyebrow: '',
  heroHeadlineMain: '',
  heroHeadlineEm: '',
  heroDescription: '',
  heroCtaLabel: '',
  heroCtaTarget: '#catalogue',
  heroCtaProductId: '',
  imageCaption: '',
  useInIntro: true,
  rotate3d: false,
  productId: '',
};

function loadBannerImages() {
  try {
    return {
      desktopImage: localStorage.getItem('pmj_banner_desktop') || '',
      mobileImage: localStorage.getItem('pmj_banner_mobile') || '',
    };
  } catch (e) {
    return { desktopImage: '', mobileImage: '' };
  }
}

function loadFeaturedImages() {
  try {
    return {
      desktopImage: localStorage.getItem('pmj_featured_desktop') || '',
      mobileImage: localStorage.getItem('pmj_featured_mobile') || '',
    };
  } catch (e) {
    return { desktopImage: '', mobileImage: '' };
  }
}

function saveFeaturedImages(desktop, mobile) {
  try {
    if (desktop) localStorage.setItem('pmj_featured_desktop', desktop);
    else localStorage.removeItem('pmj_featured_desktop');
    if (mobile) localStorage.setItem('pmj_featured_mobile', mobile);
    else localStorage.removeItem('pmj_featured_mobile');
  } catch (e) {
    throw new Error('Featured image too large for browser storage. Try a smaller JPG (under 400 KB).');
  }
}

function loadDisplaySettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('pmj_display_settings') || '{}');
    const storedImages = loadFeaturedImages();
    const bannerStored = loadBannerImages();
    const featured = raw.featured
      ? {
          ...FEATURED_SETTINGS_DEFAULTS,
          ...raw.featured,
          desktopImage:
            storedImages.desktopImage ||
            (raw.featured.desktopImage && raw.featured.desktopImage !== '__stored__'
              ? raw.featured.desktopImage
              : ''),
          mobileImage:
            storedImages.mobileImage ||
            (raw.featured.mobileImage && raw.featured.mobileImage !== '__stored__'
              ? raw.featured.mobileImage
              : ''),
        }
      : storedImages.desktopImage || storedImages.mobileImage
        ? { ...FEATURED_SETTINGS_DEFAULTS, ...storedImages }
        : null;
    const banner = raw.banner
      ? {
          ...BANNER_SETTINGS_DEFAULTS,
          ...raw.banner,
          desktopImage:
            bannerStored.desktopImage ||
            (raw.banner.desktopImage && raw.banner.desktopImage !== '__stored__'
              ? raw.banner.desktopImage
              : ''),
          mobileImage:
            bannerStored.mobileImage ||
            (raw.banner.mobileImage && raw.banner.mobileImage !== '__stored__'
              ? raw.banner.mobileImage
              : ''),
        }
      : bannerStored.desktopImage || bannerStored.mobileImage
        ? { ...BANNER_SETTINGS_DEFAULTS, ...bannerStored }
        : null;
    return { ...DISPLAY_DEFAULTS, ...raw, banner, featured };
  } catch (e) {
    return { ...DISPLAY_DEFAULTS };
  }
}

function saveDisplaySettings(settings) {
  const featured = settings.featured || null;
  const banner = settings.banner || null;

  if (featured) {
    saveFeaturedImages(featured.desktopImage, featured.mobileImage);
  }

  const lean = {
    ...settings,
    featured: featured
      ? {
          ...featured,
          desktopImage: featured.desktopImage ? '__stored__' : '',
          mobileImage: featured.mobileImage ? '__stored__' : '',
        }
      : null,
    banner: banner
      ? {
          ...banner,
          desktopImage: banner.desktopImage ? '__stored__' : '',
          mobileImage: banner.mobileImage ? '__stored__' : '',
        }
      : null,
  };

  try {
    localStorage.setItem('pmj_display_settings', JSON.stringify(lean));
  } catch (e) {
    throw new Error('Could not save display settings.');
  }

  if (banner) {
    try {
      if (banner.desktopImage) localStorage.setItem('pmj_banner_desktop', banner.desktopImage);
      else localStorage.removeItem('pmj_banner_desktop');
      if (banner.mobileImage) localStorage.setItem('pmj_banner_mobile', banner.mobileImage);
      else localStorage.removeItem('pmj_banner_mobile');
    } catch (e) {
      throw new Error('Banner image too large. Try smaller JPG files.');
    }
  }
}

/** Rotation config for hero, viewer, cinematic — merges global + per-product admin overrides */
function getRotationConfig(productId) {
  const global = loadDisplaySettings();
  const po = loadOverrides()[productId] || {};

  if (global.globalAutoRotate === false) {
    return { autoRotate: false, speed: 0, heroSpeed: 0, heroAutoRotate: false, float: 0 };
  }

  const autoRotate =
    po.autoRotate !== undefined && po.autoRotate !== ''
      ? po.autoRotate === true || po.autoRotate === 'true'
      : global.viewerAutoRotate !== false;

  const speedMult =
    (parseFloat(po.rotateSpeed) || 1) *
    (parseFloat(global.globalRotateSpeed) || 1);

  return {
    autoRotate,
    speed: 0.004 * speedMult,
    heroSpeed: 0.004 * (parseFloat(global.heroRotateSpeed) || 1) * (parseFloat(global.globalRotateSpeed) || 1),
    heroAutoRotate: global.heroAutoRotate !== false,
    float: parseFloat(po.floatAmount) || 0.035,
  };
}

function getHeroRotationConfig() {
  const global = loadDisplaySettings();
  if (global.globalAutoRotate === false || global.heroAutoRotate === false) {
    return { autoRotate: false, speed: 0, float: 0 };
  }
  const mult = (parseFloat(global.heroRotateSpeed) || 1) * (parseFloat(global.globalRotateSpeed) || 1);
  return {
    autoRotate: true,
    speed: 0.004 * mult,
    float: 0.05,
  };
}

window.loadDisplaySettings = loadDisplaySettings;
window.saveDisplaySettings = saveDisplaySettings;
window.loadFeaturedImages = loadFeaturedImages;
window.saveFeaturedImages = saveFeaturedImages;
window.getRotationConfig = getRotationConfig;
window.getHeroRotationConfig = getHeroRotationConfig;
window.BANNER_SETTINGS_DEFAULTS = BANNER_SETTINGS_DEFAULTS;
window.FEATURED_SETTINGS_DEFAULTS = FEATURED_SETTINGS_DEFAULTS;
