/* Promo banner — admin uploads, fixed dimensions, product link */
const BANNER_SPECS = {
  desktop: { width: 1440, height: 480, ratio: '3 / 1', label: '1440 × 480 px (desktop)' },
  mobile: { width: 750, height: 940, ratio: '375 / 470', label: '750 × 940 px (mobile)' },
};

const BANNER_DEFAULTS = {
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

const PromoBanner = (() => {
  let rafId = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let mesh = null;
  let canvas = null;

  function getBannerSettings() {
    const s = typeof loadDisplaySettings === 'function' ? loadDisplaySettings() : {};
    return { ...BANNER_DEFAULTS, ...(s.banner || {}) };
  }

  function resizeImageFile(file, targetW, targetH) {
    if (typeof window.resizeImageFile === 'function') {
      return window.resizeImageFile(file, targetW, targetH);
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = targetW;
          c.height = targetH;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#0b0b0d';
          ctx.fillRect(0, 0, targetW, targetH);
          const scale = Math.max(targetW / img.width, targetH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function dispose3D() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (mesh) {
      mesh.geometry?.dispose();
      mesh.material?.map?.dispose();
      mesh.material?.dispose();
      mesh = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    scene = null;
    camera = null;
  }

  function init3D(imageUrl, wrap) {
    if (!imageUrl || typeof THREE === 'undefined' || !wrap) return;
    dispose3D();

    canvas = document.getElementById('promoBannerCanvas');
    if (!canvas) return;

    const rect = wrap.getBoundingClientRect();
    const w = Math.max(rect.width, 320);
    const h = Math.max(rect.height, 200);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 50);
    camera.position.z = 2.8;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.1);
    key.position.set(2, 3, 4);
    scene.add(key);
    const gold = new THREE.PointLight(0xc7a252, 1.2, 12);
    gold.position.set(-2, 0, 3);
    scene.add(gold);

    new THREE.TextureLoader().load(imageUrl, (tex) => {
      if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.38, side: THREE.DoubleSide })
      );
      scene.add(mesh);

      const cfg = getBannerSettings();
      const speed = 0.004 * (parseFloat(cfg.bannerRotateSpeed) || 1);

      function tick() {
        rafId = requestAnimationFrame(tick);
        if (mesh) {
          mesh.rotation.y += speed;
          mesh.position.y = Math.sin(Date.now() * 0.0012) * 0.04;
        }
        renderer.render(scene, camera);
      }
      tick();
    });
  }

  function redirectToProduct(productId) {
    if (!productId) return;
    const card = document.querySelector(`.card[data-id="${productId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight');
      setTimeout(() => card.classList.remove('card-highlight'), 1600);
    }
    if (typeof openProductModal === 'function') {
      setTimeout(() => openProductModal(productId), 400);
    }
  }

  function render() {
    const cfg = getBannerSettings();
    const section = document.getElementById('promoBanner');
    if (!section) return;

    if (!cfg.enabled || (!cfg.desktopImage && !cfg.mobileImage && cfg.mode !== 'rotate3d')) {
      section.classList.add('hidden');
      dispose3D();
      return;
    }

    section.classList.remove('hidden');
    section.dataset.mode = cfg.mode;

    const headline = document.getElementById('promoHeadline');
    const subtext = document.getElementById('promoSubtext');
    const cta = document.getElementById('promoCta');
    const eyebrow = document.getElementById('promoEyebrow');
    const imgDesktop = document.getElementById('promoBannerDesktop');
    const imgMobile = document.getElementById('promoBannerMobile');
    const mediaWrap = document.getElementById('promoBannerMedia');
    const canvasEl = document.getElementById('promoBannerCanvas');

    if (headline) headline.textContent = cfg.headline || '';
    if (subtext) subtext.textContent = cfg.subtext || '';
    if (eyebrow) eyebrow.textContent = cfg.productId ? 'Featured Piece' : '';
    if (cta) {
      cta.textContent = cfg.ctaLabel || 'View Piece';
      cta.style.display = cfg.productId ? 'inline-flex' : 'none';
    }

    const hasCopy = cfg.headline || cfg.subtext;
    section.classList.toggle('promo-banner--minimal', !hasCopy);

    if (cfg.mode === 'rotate3d') {
      canvasEl?.classList.add('hidden');
      dispose3D();
      if (imgDesktop) {
        imgDesktop.src = cfg.desktopImage || cfg.mobileImage || '';
        imgDesktop.classList.toggle('hidden', !imgDesktop.src);
        imgDesktop.classList.toggle('promo-showcase-motion', !!imgDesktop.src);
      }
      if (imgMobile) {
        imgMobile.src = cfg.mobileImage || cfg.desktopImage || '';
        imgMobile.classList.toggle('hidden', !imgMobile.src);
        imgMobile.classList.toggle('promo-showcase-motion', !!imgMobile.src);
      }
    } else {
      dispose3D();
      canvasEl?.classList.add('hidden');
      imgDesktop?.classList.remove('promo-showcase-motion');
      imgMobile?.classList.remove('promo-showcase-motion');
      if (imgDesktop) {
        imgDesktop.src = cfg.desktopImage || cfg.mobileImage || '';
        imgDesktop.classList.toggle('hidden', !imgDesktop.src);
      }
      if (imgMobile) {
        imgMobile.src = cfg.mobileImage || cfg.desktopImage || '';
        imgMobile.classList.toggle('hidden', !imgMobile.src);
      }
    }

    section.dataset.productId = cfg.productId || '';
  }

  function bind() {
    const section = document.getElementById('promoBanner');
    const cta = document.getElementById('promoCta');

    cta?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      redirectToProduct(getBannerSettings().productId);
    });

    section?.addEventListener('click', (e) => {
      if (e.target.closest('#promoCta')) return;
      const id = getBannerSettings().productId;
      if (id) redirectToProduct(id);
    });

    window.addEventListener('pmj:display-settings-changed', render);
    window.addEventListener('pmj:intro-complete', render);
    window.addEventListener('resize', () => {
      if (getBannerSettings().enabled) render();
    });
  }

  function init() {
    bind();
    if (document.body.classList.contains('catalogue-ready')) render();
  }

  return {
    init,
    render,
    resizeImageFile,
    getBannerSettings,
    BANNER_SPECS,
    BANNER_DEFAULTS,
    redirectToProduct,
  };
})();

window.PromoBanner = PromoBanner;
