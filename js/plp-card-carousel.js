/* PLP card image carousel — touch swipe + dot navigation on mobile */
const PMJPlcardCarousel = (() => {
  const SWIPE_MIN = 40;

  function isActive() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function getCardParts(media) {
    const card = media.closest('.card');
    const track = media.querySelector('.card-carousel-track');
    const dots = card?.querySelectorAll('.card-dot');
    return { card, track, dots };
  }

  function setCardSlide(media, index) {
    if (!media) return;
    const max = Math.max(0, parseInt(media.dataset.slides || '1', 10) - 1);
    const slide = Math.max(0, Math.min(index, max));
    media.dataset.slide = String(slide);
    media.style.setProperty('--card-slide', String(slide));

    const { dots } = getCardParts(media);
    dots?.forEach((dot) => {
      dot.classList.toggle('active', parseInt(dot.dataset.i, 10) === slide);
    });
  }

  function bindCarouselMedia(media) {
    if (media.dataset.carouselBound === '1') return;
    media.dataset.carouselBound = '1';

    let startX = 0;
    let startY = 0;
    let swiping = false;

    media.addEventListener('touchstart', (e) => {
      if (!isActive()) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = false;
    }, { passive: true });

    media.addEventListener('touchmove', (e) => {
      if (!isActive()) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) swiping = true;
    }, { passive: true });

    media.addEventListener('touchend', (e) => {
      if (!isActive() || !swiping) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < SWIPE_MIN) return;

      e.stopPropagation();
      media.dataset.swipped = '1';
      window.setTimeout(() => {
        delete media.dataset.swipped;
      }, 450);

      const slide = parseInt(media.dataset.slide || '0', 10);
      setCardSlide(media, dx < 0 ? slide + 1 : slide - 1);
    }, { passive: true });
  }

  function bindDotClicks() {
    const grid = document.getElementById('productGrid');
    if (!grid || grid.dataset.carouselDotsBound === '1') return;
    grid.dataset.carouselDotsBound = '1';

    grid.addEventListener('click', (e) => {
      const dot = e.target.closest('.card-dot');
      if (!dot) return;
      e.preventDefault();
      e.stopPropagation();
      const card = dot.closest('.card');
      const media = card?.querySelector('.card-media--carousel');
      if (!media) return;
      setCardSlide(media, parseInt(dot.dataset.i, 10));
    });
  }

  function bindCarousels(container = document.getElementById('productGrid')) {
    if (!container) return;
    container.querySelectorAll('.card-media--carousel').forEach((media) => {
      bindCarouselMedia(media);
      setCardSlide(media, parseInt(media.dataset.slide || '0', 10));
    });
  }

  function init() {
    bindDotClicks();
    bindCarousels();
    window.addEventListener('pmj:catalogue-updated', () => bindCarousels());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { bindCarousels, setCardSlide, wasSwiped: (el) => el?.dataset?.swipped === '1' };
})();

window.PMJPlcardCarousel = PMJPlcardCarousel;
