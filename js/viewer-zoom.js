/* Hover magnify for product viewer — smooth follow with rAF lerp */
const ViewerZoom = (() => {
  let activeWrap = null;
  let rafId = null;
  let targetX = 50;
  let targetY = 50;
  let currentX = 50;
  let currentY = 50;

  function applyOrigin(wrap, stage, x, y) {
    const xs = `${x}%`;
    const ys = `${y}%`;
    stage.style.setProperty('--zoom-x', xs);
    stage.style.setProperty('--zoom-y', ys);
    wrap.style.setProperty('--zoom-x', xs);
    wrap.style.setProperty('--zoom-y', ys);
  }

  function tick() {
    if (!activeWrap) {
      rafId = null;
      return;
    }
    const stage = activeWrap.querySelector('.viewer360-stage') || activeWrap;
    currentX += (targetX - currentX) * 0.2;
    currentY += (targetY - currentY) * 0.2;
    applyOrigin(activeWrap, stage, currentX, currentY);

    if (
      activeWrap.classList.contains('is-zooming') ||
      Math.abs(targetX - currentX) > 0.05 ||
      Math.abs(targetY - currentY) > 0.05
    ) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
    }
  }

  function scheduleTick(wrap) {
    activeWrap = wrap;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function setTarget(wrap, clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    targetX = ((clientX - rect.left) / rect.width) * 100;
    targetY = ((clientY - rect.top) / rect.height) * 100;
    wrap.classList.add('is-zooming');
    scheduleTick(wrap);
  }

  function bind(wrap) {
    if (!wrap || wrap.dataset.zoomBound === '1') return;
    wrap.dataset.zoomBound = '1';

    wrap.addEventListener('mousemove', (e) => {
      setTarget(wrap, e.clientX, e.clientY);
    });

    wrap.addEventListener('mouseleave', () => {
      wrap.classList.remove('is-zooming');
      currentX = targetX;
      currentY = targetY;
    });

    wrap.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t) return;
      setTarget(wrap, t.clientX, t.clientY);
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (!t) return;
      setTarget(wrap, t.clientX, t.clientY);
    }, { passive: true });

    wrap.addEventListener('touchend', () => {
      wrap.classList.remove('is-zooming');
    }, { passive: true });

    activeWrap = wrap;
  }

  function rebind(wrap) {
    if (!wrap) return;
    wrap.dataset.zoomBound = '0';
    bind(wrap);
  }

  function reset(wrap) {
    const target = wrap || activeWrap;
    if (!target) return;
    target.classList.remove('is-zooming');
    targetX = 50;
    targetY = 50;
    currentX = 50;
    currentY = 50;
    const stage = target.querySelector('.viewer360-stage') || target;
    applyOrigin(target, stage, 50, 50);
  }

  return { bind, rebind, reset };
})();

window.ViewerZoom = ViewerZoom;
