/* Mobile PDP — touch swipe gallery, pinch/double-tap zoom, finger-friendly controls */
const PMJMobilePdp = (() => {
  const SWIPE_MIN = 48;
  const SWIPE_MAX_Y = 80;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let lastTap = 0;
  let pinchStartDist = 0;
  let pinchScale = 1;
  let lightboxPinchScale = 1;
  let lightboxPinchStartDist = 0;
  let lightboxBasePinchScale = 1;

  function isMobile() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  function isCoarsePointer() {
    return window.matchMedia('(pointer: coarse)').matches;
  }

  function getWrap() {
    return document.getElementById('viewer360Wrap');
  }

  function getStage() {
    return getWrap()?.querySelector('.viewer360-stage');
  }

  function getLightboxStage() {
    return document.getElementById('pmLightboxStage');
  }

  function onSwipeEnd(dx, dy) {
    if (Math.abs(dy) > SWIPE_MAX_Y) return;
    if (Math.abs(dx) < SWIPE_MIN) return;
    if (typeof window.pmStepImage !== 'function') return;
    if (dx < 0) window.pmStepImage(1);
    else window.pmStepImage(-1);
  }

  function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  let basePinchScale = 1;

  function applyPinchScale(scale, stage = getStage()) {
    if (!stage) return;
    const clamped = Math.min(3, Math.max(1, scale));
    if (stage.id === 'pmLightboxStage') lightboxPinchScale = clamped;
    else pinchScale = clamped;
    stage.style.setProperty('--pmj-pinch-scale', String(clamped));
    stage.classList.toggle('is-pinch-zoomed', clamped > 1.02);
  }

  function resetPinch() {
    pinchScale = 1;
    pinchStartDist = 0;
    const stage = getStage();
    if (stage) {
      stage.style.removeProperty('--pmj-pinch-scale');
      stage.classList.remove('is-pinch-zoomed');
    }
  }

  function resetLightboxPinch() {
    lightboxPinchScale = 1;
    lightboxPinchStartDist = 0;
    const stage = getLightboxStage();
    if (stage) {
      stage.style.removeProperty('--pmj-pinch-scale');
      stage.classList.remove('is-pinch-zoomed');
    }
  }

  function bindTouchSurface(wrap, stageGetter, isLightbox = false) {
    if (!wrap || wrap.dataset.touchBound === '1') return;
    wrap.dataset.touchBound = '1';

    wrap.addEventListener('touchstart', (e) => {
      if (!isMobile()) return;
      if (e.touches.length === 2) {
        const dist = getPinchDistance(e.touches);
        if (isLightbox) {
          lightboxPinchStartDist = dist;
          lightboxBasePinchScale = lightboxPinchScale;
        } else {
          pinchStartDist = dist;
          basePinchScale = pinchScale;
        }
        return;
      }
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (!isMobile()) return;
      const stage = stageGetter();
      if (e.touches.length === 2) {
        const dist = getPinchDistance(e.touches);
        if (isLightbox && lightboxPinchStartDist > 0) {
          applyPinchScale(lightboxBasePinchScale * (dist / lightboxPinchStartDist), stage);
        } else if (!isLightbox && pinchStartDist > 0) {
          applyPinchScale(basePinchScale * (dist / pinchStartDist), stage);
        }
      }
    }, { passive: true });

    wrap.addEventListener('touchend', (e) => {
      if (!isMobile()) return;
      if (e.touches.length > 0) return;

      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const elapsed = Date.now() - touchStartTime;
      const stage = stageGetter();

      if (isLightbox && lightboxPinchStartDist > 0) {
        lightboxPinchStartDist = 0;
        return;
      }
      if (!isLightbox && pinchStartDist > 0) {
        pinchStartDist = 0;
        return;
      }

      const now = Date.now();
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && elapsed < 280) {
        if (now - lastTap < 320) {
          if (stage?.classList.contains('is-pinch-zoomed')) {
            isLightbox ? resetLightboxPinch() : resetPinch();
          } else {
            applyPinchScale(2.2, stage);
          }
          lastTap = 0;
          return;
        }
        lastTap = now;
      }

      onSwipeEnd(dx, dy);
    }, { passive: true });
  }

  function bindGalleryTouch() {
    bindTouchSurface(getWrap(), getStage, false);
  }

  function bindLightboxTouch() {
    const viewer = document.getElementById('pmLightboxViewer');
    bindTouchSurface(viewer, getLightboxStage, true);
  }

  function syncMobileThumbStrip() {
    const strip = document.getElementById('pmThumbs');
    if (!strip || !isMobile()) return;
    strip.querySelectorAll('.pm-thumb').forEach((thumb) => {
      thumb.classList.toggle('active', parseInt(thumb.dataset.i, 10) === window.pmImageIndex);
    });
    strip.querySelector('.pm-thumb.active')?.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    });
  }

  function init() {
    bindGalleryTouch();
    bindLightboxTouch();
    window.PMJMobilePdp = {
      isMobile,
      isCoarsePointer,
      resetPinch,
      resetLightboxPinch,
      syncMobileThumbStrip,
      rebind: bindGalleryTouch,
      rebindLightbox: bindLightboxTouch,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { isMobile, isCoarsePointer, resetPinch, resetLightboxPinch, syncMobileThumbStrip };
})();

window.PMJMobilePdp = PMJMobilePdp;
