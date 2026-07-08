/* ============================================================
   PMJ Luxury WebGL Experience — Three.js + GSAP + GLTF
   Loading → Logo Forge → Vault Doors → Camera Fly → Floating Jewel
   ============================================================ */
const PMJExperience = (() => {
  let renderer, scene, camera, vaultLeft, vaultRight, vaultCenterEmblem, jewelGroup, particleSystem;
  let canvas, heroCanvas, heroRenderer, heroScene, heroCamera, heroJewel;
  let rafMain = null, rafHero = null;
  let ready = false;
  let mouse = { x: 0, y: 0 };

  const isMobile = () => window.innerWidth < 900;
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function motionProfile(object) {
    const src = object?.userData?.source || object?.userData?.motion;
    if (src === 'gltf' || src === 'procedural') return 'rotate';
    return 'showcase';
  }

  /** Flat photos / billboards — gentle float + sway, no card-spin */
  function applyShowcaseMotion(group, opts = {}) {
    if (!group) return;
    const t = Date.now();
    const baseY = opts.baseY ?? -0.15;
    const float = opts.float ?? 0.045;
    const sway = opts.sway ?? 0.09;
    group.position.y = baseY + Math.sin(t * 0.001) * float;
    group.rotation.y = Math.sin(t * 0.00055) * sway;
    group.rotation.x = (opts.mouseY ?? 0) * 0.035 + Math.sin(t * 0.00038) * 0.022;
    group.rotation.z = (opts.mouseX ?? 0) * 0.016;
  }

  /** True 3D models — slow orbit */
  function applyRotateMotion(group, opts = {}) {
    if (!group) return;
    const t = Date.now();
    const baseY = opts.baseY ?? -0.15;
    const speed = opts.speed ?? 0.0035;
    const float = opts.float ?? 0.07;
    if (opts.autoRotate !== false) group.rotation.y += speed;
    group.position.y = baseY + Math.sin(t * 0.001) * float;
    group.rotation.x = (opts.mouseY ?? 0) * 0.06;
    group.rotation.z = (opts.mouseX ?? 0) * 0.03;
  }

  function applyJewelMotion(group, opts = {}) {
    if (!group?.visible) return;
    if (prefersReducedMotion()) {
      group.rotation.set(0, 0, 0);
      group.position.y = opts.baseY ?? -0.15;
      return;
    }
    if (motionProfile(group) === 'rotate') applyRotateMotion(group, opts);
    else applyShowcaseMotion(group, opts);
  }

  function letterTexture(letter) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    ctx.font = '600 340px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const grad = ctx.createLinearGradient(size * 0.2, size * 0.1, size * 0.8, size * 0.92);
    grad.addColorStop(0, '#faf0d4');
    grad.addColorStop(0.28, '#e8c878');
    grad.addColorStop(0.52, '#c7a252');
    grad.addColorStop(0.72, '#9a7830');
    grad.addColorStop(1, '#f0e0b8');
    ctx.fillStyle = grad;
    ctx.fillText(letter, size / 2, size / 2 + size * 0.04);

    const tex = new THREE.CanvasTexture(c);
    if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function createGoldLetterMaterial(letter, envMap) {
    const map = letterTexture(letter);
    const Mat = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
    return new Mat({
      map,
      color: 0xffffff,
      metalness: 1,
      roughness: 0.07,
      envMap,
      envMapIntensity: 1.65,
      transparent: true,
      alphaTest: 0.015,
      side: THREE.DoubleSide,
      ...(Mat === THREE.MeshPhysicalMaterial
        ? { clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 1 }
        : {}),
    });
  }

  function applyVaultEnv(object, envMap) {
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
          if (!m.envMap) {
            m.envMap = envMap;
            m.envMapIntensity = m.metalness > 0.9 ? 1.65 : 0.9;
          }
          m.needsUpdate = true;
        }
      });
    });
  }

  function buildVault() {
    const envMap = PMJModelLoader.initEnvMap(renderer);

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x14100c,
      metalness: 0.94,
      roughness: 0.22,
      envMap,
      envMapIntensity: 0.85,
    });

    const goldMatP = createGoldLetterMaterial('P', envMap);
    const goldMatJ = createGoldLetterMaterial('J', envMap);
    const goldMatM = createGoldLetterMaterial('M', envMap);

    vaultLeft = new THREE.Group();
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 5.2, 0.14), doorMat);
    leftDoor.position.x = 1.025;
    vaultLeft.add(leftDoor);
    const pEmblem = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), goldMatP);
    pEmblem.position.set(1.025, 0, 0.09);
    vaultLeft.add(pEmblem);
    vaultLeft.position.x = -2.05;
    scene.add(vaultLeft);

    vaultRight = new THREE.Group();
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(2.05, 5.2, 0.14), doorMat);
    rightDoor.position.x = -1.025;
    vaultRight.add(rightDoor);
    const jEmblem = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), goldMatJ);
    jEmblem.position.set(-1.025, 0, 0.09);
    vaultRight.add(jEmblem);
    vaultRight.position.x = 2.05;
    scene.add(vaultRight);

    vaultCenterEmblem = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), goldMatM);
    vaultCenterEmblem.position.set(0, 0, 0.14);
    scene.add(vaultCenterEmblem);

    applyVaultEnv(vaultLeft, envMap);
    applyVaultEnv(vaultRight, envMap);
    applyVaultEnv(vaultCenterEmblem, envMap);
  }

  function buildLights(target) {
    target.add(new THREE.AmbientLight(0x2a2018, 0.45));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.5);
    key.position.set(4, 6, 8);
    target.add(key);
    const gold = new THREE.PointLight(0xc7a252, 2.4, 30);
    gold.position.set(-3, 1, 5);
    target.add(gold);
    const rim = new THREE.PointLight(0x7c1f2e, 0.85, 20);
    rim.position.set(3, -1, 4);
    target.add(rim);
    const front = new THREE.SpotLight(0xfff4dc, 1.8, 24, Math.PI / 5, 0.35, 1);
    front.position.set(0, 2, 6);
    front.target.position.set(0, 0, 0);
    target.add(front);
    target.add(front.target);
  }

  function buildParticles(count) {
    const n = isMobile() ? Math.floor(count * 0.45) : count;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    particleSystem = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xc7a252,
        size: isMobile() ? 0.04 : 0.06,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(particleSystem);
  }

  async function setJewelFromImage(imageUrl) {
    if (jewelGroup) {
      PMJModelLoader.disposeObject(jewelGroup);
      scene.remove(jewelGroup);
    }
    jewelGroup = new THREE.Group();
    const png = typeof isPngSource === 'function' && isPngSource(imageUrl);

    const tex = await new Promise((resolve) => {
      new THREE.TextureLoader().load(
        imageUrl,
        (t) => {
          if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
          t.anisotropy = 8;
          resolve(t);
        },
        undefined,
        () => resolve(null)
      );
    });

    if (tex) {
      const img = tex.image || {};
      const aspect = img.width && img.height ? img.width / img.height : 1;
      const planeH = 1.85;
      const planeW = planeH * aspect;
      const mat = png
        ? new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshStandardMaterial({
            map: tex,
            metalness: 0.35,
            roughness: 0.38,
            transparent: true,
            side: THREE.DoubleSide,
          });
      jewelGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), mat));
    }

    if (!png) {
      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.025, 12, 64),
        new THREE.MeshStandardMaterial({ color: 0xc7a252, metalness: 1, roughness: 0.15 })
      );
      frame.rotation.x = Math.PI / 2;
      jewelGroup.add(frame);
    }

    jewelGroup.userData.source = 'image';
    jewelGroup.userData.motion = 'showcase';

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        color: 0xc7a252,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.position.z = -0.08;
    jewelGroup.add(glow);

    jewelGroup.visible = false;
    jewelGroup.position.set(0, -0.15, 0);
    scene.add(jewelGroup);
  }

  async function prepareIntroJewel() {
    const featured = typeof getFeaturedSettings === 'function' ? getFeaturedSettings() : {};
    const introImg = featured.desktopImage || featured.mobileImage;
    if (introImg && featured.useInIntro !== false) {
      await setJewelFromImage(introImg);
      return { type: 'image', imageUrl: introImg };
    }
    const heroProduct = PRODUCTS.find((p) => p.id === 'SPND998476') || PRODUCTS[0];
    await setJewelFromProduct(heroProduct);
    return { type: 'product', product: heroProduct };
  }

  async function setJewelFromProduct(product) {
    if (jewelGroup) {
      PMJModelLoader.disposeObject(jewelGroup);
      scene.remove(jewelGroup);
    }
    jewelGroup = await PMJModelLoader.loadDisplay(product, {
      targetSize: 2,
      withPedestal: true,
      renderer,
    });

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({
        color: 0xc7a252,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.position.z = -0.08;
    jewelGroup.add(glow);

    jewelGroup.visible = false;
    jewelGroup.position.set(0, -0.15, 0);
    scene.add(jewelGroup);
  }

  function initMain() {
    canvas = document.getElementById('experienceCanvas');
    if (!canvas || typeof THREE === 'undefined') return false;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.physicallyCorrectLights = true;

    PMJModelLoader.initEnvMap(renderer);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0d);
    scene.fog = new THREE.FogExp2(0x0b0b0d, 0.036);

    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    buildLights(scene);
    buildVault();
    buildParticles(1400);

    window.addEventListener('resize', onResize);
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    ready = true;
    return true;
  }

  function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  function onResize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (heroRenderer && heroCamera) {
      const box = document.getElementById('heroVisual');
      if (box) {
        const rect = box.getBoundingClientRect();
        heroRenderer.setSize(rect.width, rect.height);
        heroCamera.aspect = rect.width / rect.height;
        heroCamera.updateProjectionMatrix();
      }
    }
  }

  function burstParticles() {
    if (!particleSystem) return;
    const arr = particleSystem.geometry.attributes.position.array;
    const start = Float32Array.from(arr);
    const end = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i += 3) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 5;
      end[i] = Math.cos(a) * r;
      end[i + 1] = Math.sin(a) * r * 0.55;
      end[i + 2] = (Math.random() - 0.5) * 3;
    }
    gsap.to(particleSystem.material, { opacity: 0.95, duration: 0.4 });
    const proxy = { t: 0 };
    gsap.to(proxy, {
      t: 1,
      duration: 2.4,
      ease: 'power2.out',
      onUpdate: () => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = start[i] + (end[i] - start[i]) * proxy.t;
        }
        particleSystem.geometry.attributes.position.needsUpdate = true;
      },
      onComplete: () => gsap.to(particleSystem.material, { opacity: 0, duration: 1 }),
    });
  }

  function animateMain() {
    rafMain = requestAnimationFrame(animateMain);
    applyJewelMotion(jewelGroup, { mouseX: mouse.x, mouseY: mouse.y });
    renderer.render(scene, camera);
  }

  async function initHeroViewer(productOrKey) {
    const featuredImg =
      typeof getFeaturedImageForViewport === 'function' ? getFeaturedImageForViewport() : '';
    if (featuredImg) {
      stopHeroViewer();
      if (typeof applyFeaturedVisualNow === 'function') applyFeaturedVisualNow();
      return;
    }

    heroCanvas = document.getElementById('heroCanvas');
    const wrap = document.getElementById('heroVisual');
    if (!heroCanvas || !wrap || typeof THREE === 'undefined') return;

    if (rafHero) cancelAnimationFrame(rafHero);
    if (heroJewel) PMJModelLoader.disposeObject(heroJewel);

    heroCanvas.style.display = 'block';
    document.getElementById('heroImg')?.classList.add('hidden');

    const rect = wrap.getBoundingClientRect();
    const width = Math.max(rect.width, 1);
    const height = Math.max(rect.height, 1);
    heroRenderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true, alpha: true });
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    heroRenderer.setSize(width, height);
    if (THREE.sRGBEncoding) heroRenderer.outputEncoding = THREE.sRGBEncoding;
    heroRenderer.toneMapping = THREE.ACESFilmicToneMapping;

    heroScene = new THREE.Scene();
    buildLights(heroScene);
    PMJModelLoader.initEnvMap(heroRenderer);

    heroCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    heroCamera.position.z = 3.4;

    if (productOrKey?.imageUrl) {
      const png = typeof isPngSource === 'function' && isPngSource(productOrKey.imageUrl);
      const tex = await new Promise((resolve) => {
        new THREE.TextureLoader().load(productOrKey.imageUrl, (t) => {
          if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
          resolve(t);
        }, undefined, () => resolve(null));
      });
      heroJewel = new THREE.Group();
      if (tex) {
        const mat = png
          ? new THREE.MeshBasicMaterial({
              map: tex,
              transparent: true,
              alphaTest: 0.02,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          : new THREE.MeshStandardMaterial({
              map: tex,
              metalness: 0.4,
              roughness: 0.35,
              side: THREE.DoubleSide,
            });
        heroJewel.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
        heroJewel.userData.source = 'image';
        heroJewel.userData.motion = 'showcase';
      }
      heroScene.add(heroJewel);
    } else {
      const product =
        typeof productOrKey === 'object' && productOrKey?.id
          ? productOrKey
          : PRODUCTS.find((p) => p.images?.includes(productOrKey)) || PRODUCTS[0];
      heroJewel = await PMJModelLoader.loadDisplay(product, {
        targetSize: 1.6,
        withPedestal: false,
        renderer: heroRenderer,
      });
      heroScene.add(heroJewel);
    }

    (function tick() {
      rafHero = requestAnimationFrame(tick);
      const cfg = typeof getHeroRotationConfig === 'function' ? getHeroRotationConfig() : { autoRotate: true, speed: 0.004, float: 0.05 };
      if (heroJewel) {
        if (motionProfile(heroJewel) === 'rotate' && cfg.autoRotate) {
          applyRotateMotion(heroJewel, {
            baseY: 0,
            speed: cfg.speed,
            float: cfg.float,
            autoRotate: cfg.autoRotate,
          });
        } else {
          applyShowcaseMotion(heroJewel, { baseY: 0, float: cfg.float * 0.85 });
        }
      }
      heroRenderer.render(heroScene, heroCamera);
    })();
  }

  function stopHeroViewer() {
    if (rafHero) cancelAnimationFrame(rafHero);
    rafHero = null;
    if (heroJewel) {
      PMJModelLoader.disposeObject(heroJewel);
      heroJewel = null;
    }
    if (heroRenderer) {
      heroRenderer.dispose();
      heroRenderer = null;
    }
    heroScene = null;
    heroCamera = null;
    if (heroCanvas) heroCanvas.style.display = 'none';
  }

  function runLoadingForge(onComplete) {
    const screen = document.getElementById('loadingScreen');
    const bar = document.getElementById('loadingBar');
    const lockup = document.getElementById('forgeLogo');
    const brandLogo = lockup?.querySelector('.pmj-brand-logo');
    const brandEst = lockup?.querySelector('.brand-est');

    if (!screen || typeof gsap === 'undefined') {
      onComplete();
      return;
    }

    try {
      if (!lockup || !brandLogo || !bar) {
        onComplete();
        return;
      }
    } catch (err) {
      onComplete();
      return;
    }

    screen.classList.add('active');
    screen.style.pointerEvents = 'auto';
    try {
      gsap.timeline({
        onComplete: () => {
          gsap.to(screen, {
            opacity: 0,
            duration: 0.65,
            delay: 0.15,
            onComplete: () => {
              screen.classList.remove('active');
              screen.style.display = 'none';
              screen.style.pointerEvents = 'none';
              onComplete();
            },
          });
        },
      })
        .fromTo(brandLogo, { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.15, ease: 'power3.out' })
        .fromTo(brandEst, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.55)
        .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1.45, ease: 'power2.inOut' }, 0.4);
    } catch (err) {
      console.warn('Loading animation failed, skipping forge.', err);
      screen.classList.remove('active');
      screen.style.display = 'none';
      screen.style.pointerEvents = 'none';
      onComplete();
    }
  }

  async function playSequence(onComplete) {
    if (!ready && !initMain()) {
      onComplete();
      return;
    }

    const introJewel = await prepareIntroJewel();

    canvas.classList.add('active');
    document.body.classList.add('intro-active', 'vault-sealed');
    animateMain();

    if (prefersReducedMotion()) {
      finishSequence(onComplete, introJewel);
      return;
    }

    vaultLeft.rotation.y = 0;
    vaultRight.rotation.y = 0;
    if (vaultCenterEmblem) {
      vaultCenterEmblem.visible = true;
      vaultCenterEmblem.material.opacity = 1;
      vaultCenterEmblem.scale.set(1, 1, 1);
    }
    jewelGroup.visible = false;
    camera.position.set(0, 0.05, 8);
    camera.lookAt(0, 0, 0);

    const tl = gsap.timeline();
    const brandOverlay = document.getElementById('introBrandOverlay');

    tl.add(() => brandOverlay?.classList.add('visible'))
      .to('#forgeFlash', { opacity: 0.75, duration: 0.12 })
      .to('#introBrandOverlay', { opacity: 1, duration: 0.3 }, '<')
      .to('#forgeFlash', { opacity: 0, duration: 0.5 })
      .to({}, { duration: 0.25 })
      .add(() => burstParticles())
      .to('#introBrandOverlay', { opacity: 0, duration: 0.45, ease: 'power2.in' }, '-=0.05')
      .to(vaultLeft.rotation, { y: -Math.PI * 0.52, duration: 1.65, ease: 'power3.inOut' }, '<')
      .to(vaultRight.rotation, { y: Math.PI * 0.52, duration: 1.65, ease: 'power3.inOut' }, '<')
      .to(vaultCenterEmblem?.material, { opacity: 0, duration: 1.2, ease: 'power2.in' }, '-=1.5')
      .add(() => { if (vaultCenterEmblem) vaultCenterEmblem.visible = false; }, '-=0.35')
      .to(camera.position, { z: 2.8, y: 0.25, duration: 1.85, ease: 'power2.inOut' }, '-=0.85')
      .to(camera.position, { z: -0.8, duration: 1.35, ease: 'power1.inOut' }, '+=0.05')
      .add(() => {
        jewelGroup.visible = true;
        jewelGroup.scale.set(0.2, 0.2, 0.2);
        jewelGroup.rotation.set(0, 0, 0);
      })
      .to(jewelGroup.scale, { x: 1, y: 1, z: 1, duration: 1.35, ease: 'back.out(1.5)' })
      .to(camera.position, { x: 0, y: 0, z: 4.5, duration: 1.55, ease: 'power2.out' }, '<')
      .to({}, { duration: 2.1 })
      .add(() => finishSequence(onComplete, introJewel));
  }

  function finishSequence(onComplete, introJewel) {
    document.getElementById('introBrandOverlay')?.classList.remove('visible');
    gsap.set('#introBrandOverlay', { opacity: 0 });

    gsap.to(canvas, {
      opacity: 0,
      duration: 1,
      ease: 'power2.inOut',
      onComplete: () => {
        canvas.classList.remove('active');
        if (rafMain) cancelAnimationFrame(rafMain);
        onComplete();
        const featuredImg =
          typeof getFeaturedImageForViewport === 'function' ? getFeaturedImageForViewport() : '';
        if (featuredImg || typeof applyFeaturedVisual === 'function') {
          applyFeaturedVisual?.();
        } else if (introJewel?.product) {
          initHeroViewer(introJewel.product);
        } else if (introJewel?.imageUrl) {
          initHeroViewer({ imageUrl: introJewel.imageUrl });
        }
      },
    });
  }

  function bootstrap(onReady) {
    if (typeof THREE === 'undefined') {
      onReady();
      return;
    }
    try {
      initMain();
      runLoadingForge(onReady);
    } catch (err) {
      console.warn('PMJ WebGL init failed, continuing without intro forge.', err);
      onReady();
    }
  }

  return { bootstrap, playSequence, initHeroViewer, stopHeroViewer, ready: () => ready };
})();

window.PMJExperience = PMJExperience;
