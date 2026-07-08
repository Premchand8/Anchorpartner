/* 360° interactive product viewer — GLTF + OrbitControls + photo fallback */
const Viewer360 = (() => {
  let renderer, scene, camera, controls, meshGroup, canvas, rafId;
  let images = [];
  let angleIndex = 0;
  let useBillboardSwap = false;
  let activeProductId = null;
  let userInteracting = false;

  function dispose() {
    if (rafId) cancelAnimationFrame(rafId);
    if (meshGroup) PMJModelLoader.disposeObject(meshGroup);
    meshGroup = null;
    if (renderer) renderer.dispose();
    renderer = null;
    controls = null;
    scene = null;
    useBillboardSwap = false;
    activeProductId = null;
    userInteracting = false;
  }

  function buildLights(target) {
    target.add(new THREE.AmbientLight(0x2a2018, 0.5));
    const key = new THREE.DirectionalLight(0xfff5e0, 1.4);
    key.position.set(2, 4, 5);
    target.add(key);
    const gold = new THREE.PointLight(0xc7a252, 1.4, 14);
    gold.position.set(-2, 0, 3);
    target.add(gold);
  }

  function loadTexture(url) {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (t) => {
          t.anisotropy = 8;
          if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
          resolve(t);
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  function findBillboardPlane(group) {
    let plane = null;
    group.traverse((c) => {
      if (c.isMesh && c.material?.map && !plane) plane = c;
    });
    return plane;
  }

  async function show(product, startIndex = 0) {
    canvas = document.getElementById('viewer360Canvas');
    const wrap = document.getElementById('viewer360Wrap');
    const hint = wrap?.querySelector('.viewer360-hint');
    if (!canvas || !wrap || !product || typeof THREE === 'undefined') return false;

    dispose();
    activeProductId = product.id;
    images = product.images.map((k) => IMAGES[k]).filter(Boolean);
    angleIndex = Math.min(startIndex, Math.max(images.length - 1, 0));

    const rect = wrap.getBoundingClientRect();
    const w = Math.max(rect.width, 280);
    const h = Math.max(rect.height, 280);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    PMJModelLoader.initEnvMap(renderer);

    camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 50);
    camera.position.set(0, 0, 3.35);

    scene = new THREE.Scene();
    buildLights(scene);

    const imageUrl = IMAGES[product.images[angleIndex]];
    const png = window.isPngSource?.(imageUrl) || window.isPngDataUrl?.(imageUrl);

    meshGroup = await PMJModelLoader.loadDisplay(product, {
      imageKey: product.images[angleIndex],
      targetSize: png ? 2.9 : 2.6,
      withPedestal: false,
      renderer,
    });

    useBillboardSwap = meshGroup.userData.source === 'billboard' && images.length > 1;
    scene.add(meshGroup);

    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.055;
      controls.enablePan = false;
      controls.minDistance = 1.8;
      controls.maxDistance = 5.5;
      controls.minPolarAngle = Math.PI / 5;
      controls.maxPolarAngle = Math.PI / 1.35;
      controls.addEventListener('start', () => { userInteracting = true; });
      controls.addEventListener('end', () => { userInteracting = false; });
    }

    if (hint) {
      hint.textContent = meshGroup.userData.source === 'gltf'
        ? 'Hover to magnify · Drag to rotate · 3D model'
        : 'Hover to magnify · Drag to rotate · Pinch to zoom';
    }

    wrap.classList.toggle('viewer-png-mode', png || meshGroup.userData.isPng === true);

    canvas.style.display = 'block';
    document.getElementById('pmMainImg')?.classList.add('hidden');
    window.ViewerZoom?.bind(wrap);

    let lastAngle = 0;
    function tick() {
      rafId = requestAnimationFrame(tick);
      const cfg = typeof getRotationConfig === 'function'
        ? getRotationConfig(activeProductId)
        : { autoRotate: true, speed: 0.004, float: 0.035 };

      if (controls) controls.update();

      if (meshGroup) {
        const isFlat = meshGroup.userData.source === 'billboard' || meshGroup.userData.source === 'image';
        const allowAuto = cfg.autoRotate && !userInteracting;
        if (useBillboardSwap && allowAuto) {
          meshGroup.rotation.y += cfg.speed;
        } else if (!isFlat && (allowAuto || (!controls && meshGroup.userData.source === 'procedural'))) {
          meshGroup.rotation.y += cfg.speed;
        } else if (isFlat && !userInteracting) {
          const t = Date.now();
          meshGroup.rotation.y = Math.sin(t * 0.00055) * 0.09;
          meshGroup.rotation.x = Math.sin(t * 0.00038) * 0.022;
        }
        meshGroup.position.y = Math.sin(Date.now() * 0.0012) * cfg.float;
      }

      if (useBillboardSwap && meshGroup) {
        const a = ((meshGroup.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const seg = (Math.PI * 2) / images.length;
        const idx = Math.floor(a / seg) % images.length;
        if (idx !== angleIndex && Math.abs(a - lastAngle) > 0.04) {
          angleIndex = idx;
          loadTexture(images[idx]).then((t) => {
            const plane = findBillboardPlane(meshGroup);
            if (t && plane?.material) {
              plane.material.map = t;
              plane.material.needsUpdate = true;
            }
          });
        }
        lastAngle = a;
      }

      renderer.render(scene, camera);
    }
    tick();
    return true;
  }

  function hide() {
    dispose();
    if (canvas) canvas.style.display = 'none';
    document.getElementById('pmMainImg')?.classList.remove('hidden');
  }

  function resize() {
    if (!renderer || !camera) return;
    const wrap = document.getElementById('viewer360Wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pmj:display-settings-changed', resize);

  window.addEventListener('pmj:theme-changed', () => {
    if (activeProductId) resize();
  });

  return { show, hide, resize };
})();

window.Viewer360 = Viewer360;
