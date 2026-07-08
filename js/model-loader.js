/* ============================================================
   PMJ Model Loader — GLTF/GLB with env reflections & fallbacks
   Drop .glb files into assets/models/{productId}.glb
   ============================================================ */
const PMJModelLoader = (() => {
  const cache = new Map();
  let envMap = null;

  const GOLD = { color: 0xc7a252, metalness: 1, roughness: 0.18 };
  const GEM_RUBY = { color: 0x7c1f2e, metalness: 0.2, roughness: 0.15 };
  const GEM_EMERALD = { color: 0x1a6640, metalness: 0.2, roughness: 0.15 };

  function modelPath(product) {
    if (product.model) return product.model;
    return `assets/models/${product.id}.glb`;
  }

  function initEnvMap(renderer) {
    if (envMap || !renderer || typeof THREE.PMREMGenerator === 'undefined') return envMap;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0b0b0d);
    [
      [0xc7a252, 5, 0, 2, 3],
      [0xfff0d0, 3, -3, 1, 2],
      [0xf5e6c0, 2.5, 2, 3, 1],
      [0x7c1f2e, 1.4, 3, -1, 2],
      [0xffffff, 1.2, 0, -2, 4],
    ].forEach(([c, i, x, y, z]) => {
      const l = new THREE.PointLight(c, i, 14);
      l.position.set(x, y, z);
      envScene.add(l);
    });
    envMap = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    return envMap;
  }

  function applyEnv(object, renderer) {
    initEnvMap(renderer);
    object.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
          m.envMap = envMap;
          m.envMapIntensity = 1.1;
          if (m.metalness === undefined || m.metalness > 0.5) {
            m.metalness = Math.max(m.metalness || 0, 0.85);
            m.roughness = Math.min(m.roughness ?? 0.3, 0.35);
          }
        }
      });
    });
  }

  function loadGLTF(url) {
    if (cache.has(url)) return cache.get(url);
    if (typeof THREE.GLTFLoader === 'undefined') return Promise.resolve(null);

    const promise = new Promise((resolve) => {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        () => resolve(null)
      );
    });
    cache.set(url, promise);
    return promise;
  }

  function fitToBox(object, targetSize = 1.8) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const max = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / max;
    object.scale.setScalar(scale);
    box.setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    object.position.sub(center);
  }

  function loadImageTexture(url) {
    return new Promise((resolve) => {
      if (!url) { resolve(null); return; }
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

  /** Procedural premium placeholder by jewellery category */
  function buildProcedural(product) {
    const group = new THREE.Group();
    const cat = product.cat || 'necklace';

    if (cat === 'ring') {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.07, 20, 48),
        new THREE.MeshStandardMaterial(GOLD)
      );
      band.rotation.x = Math.PI / 2;
      group.add(band);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ ...GEM_RUBY, emissive: 0x3a0810, emissiveIntensity: 0.15 })
      );
      gem.position.y = 0.55;
      group.add(gem);
    } else if (cat === 'earring') {
      [-0.35, 0.35].forEach((x) => {
        const g = new THREE.Group();
        const hook = new THREE.Mesh(
          new THREE.TorusGeometry(0.12, 0.02, 8, 24),
          new THREE.MeshStandardMaterial(GOLD)
        );
        hook.rotation.x = Math.PI / 2;
        g.add(hook);
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 24, 24),
          new THREE.MeshStandardMaterial(GOLD)
        );
        drop.position.y = -0.28;
        g.add(drop);
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.08, 0),
          new THREE.MeshStandardMaterial(GEM_RUBY)
        );
        gem.position.y = -0.28;
        g.add(gem);
        g.position.x = x;
        group.add(g);
      });
    } else if (cat === 'bangle') {
      const bangle = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.09, 24, 64),
        new THREE.MeshStandardMaterial(GOLD)
      );
      bangle.rotation.x = Math.PI / 2;
      group.add(bangle);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const gem = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 12, 12),
          new THREE.MeshStandardMaterial(i % 2 ? GEM_RUBY : GEM_EMERALD)
        );
        gem.position.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75);
        group.add(gem);
      }
    } else {
      /* necklace / pendant */
      const chain = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.025, 12, 64),
        new THREE.MeshStandardMaterial(GOLD)
      );
      chain.rotation.x = Math.PI / 2;
      group.add(chain);
      const pendant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.12, 6),
        new THREE.MeshStandardMaterial(GOLD)
      );
      pendant.position.y = -0.55;
      group.add(pendant);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({ ...GEM_EMERALD, emissive: 0x0a3020, emissiveIntensity: 0.12 })
      );
      gem.position.y = -0.55;
      gem.position.z = 0.08;
      group.add(gem);
    }

    return group;
  }

  async function buildImageBillboard(product, imageKey, withPedestal = true, isPng = false) {
    const group = new THREE.Group();
    const url = IMAGES[imageKey || product.images[0]];
    const tex = await loadImageTexture(url);
    const png = isPng || window.isPngSource?.(url) || window.isPngDataUrl?.(url);

    if (withPedestal && !png) {
      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.02, 12, 64),
        new THREE.MeshStandardMaterial(GOLD)
      );
      frame.rotation.x = Math.PI / 2;
      group.add(frame);
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.88, 0.07, 32),
        new THREE.MeshStandardMaterial({ color: 0x1a1410, metalness: 0.8, roughness: 0.35 })
      );
      pedestal.position.y = -1.05;
      group.add(pedestal);
    }

    if (tex) {
      const img = tex.image || {};
      const aspect = img.width && img.height ? img.width / img.height : 1;
      const planeH = png ? 2.85 : 2.55;
      const planeW = planeH * aspect;
      const material = png
        ? new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            alphaTest: 0.02,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        : new THREE.MeshStandardMaterial({
            map: tex,
            metalness: 0.18,
            roughness: 0.42,
            side: THREE.DoubleSide,
            transparent: true,
          });

      const jewel = new THREE.Mesh(new THREE.PlaneGeometry(planeW, planeH), material);
      group.add(jewel);
      group.userData.isPng = png;
    }

    return group;
  }

  /**
   * Load display object for a product.
   * Priority: GLTF/GLB → photo billboard → procedural 3D
   */
  async function loadDisplay(product, options = {}) {
    const {
      imageKey = product.images[0],
      targetSize = 1.8,
      withPedestal = true,
      renderer = null,
      forceBillboard = false,
    } = options;

    let display = null;
    const path = modelPath(product);

    if (!forceBillboard) {
      const gltf = await loadGLTF(path);
      if (gltf?.scene) {
        display = gltf.scene.clone(true);
        fitToBox(display, targetSize);
        if (product.modelScale) display.scale.multiplyScalar(product.modelScale);
        if (product.modelRotation) {
          display.rotation.set(
            product.modelRotation[0] || 0,
            product.modelRotation[1] || 0,
            product.modelRotation[2] || 0
          );
        }
        if (renderer) applyEnv(display, renderer);
        display.userData.source = 'gltf';
        return display;
      }
    }

    const url = IMAGES[imageKey || product.images[0]];
    const isPng = window.isPngSource?.(url) || window.isPngDataUrl?.(url);

    display = await buildImageBillboard(product, imageKey, withPedestal && !isPng, isPng);
    const hasPhoto = display.children.some((c) => c.isMesh && c.material?.map);
    if (!hasPhoto) {
      PMJModelLoader.disposeObject(display);
      display = buildProcedural(product);
      fitToBox(display, targetSize * 0.85);
      display.userData.source = 'procedural';
    } else {
      display.userData.source = 'billboard';
    }

    if (renderer) applyEnv(display, renderer);
    return display;
  }

  function disposeObject(object) {
    if (!object) return;
    object.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  return {
    loadDisplay,
    loadGLTF,
    disposeObject,
    initEnvMap,
    buildProcedural,
    modelPath,
  };
})();

window.PMJModelLoader = PMJModelLoader;
