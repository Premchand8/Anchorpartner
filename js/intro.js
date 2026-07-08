/* Login gate & cinematic WebGL intro sequence */
const PARTNER_ACCESS_CODE = 'PMJVIP2026';
const ADMIN_ACCESS_CODE = 'PMJADMIN26';

window.PARTNER_ACCESS_CODE = PARTNER_ACCESS_CODE;
window.ADMIN_ACCESS_CODE = ADMIN_ACCESS_CODE;

const loginGate = document.getElementById('loginGate');
const introBox = document.getElementById('introBox');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO_MS = 2800;

function normalizeAccessCode(val) {
  return String(val || '').trim().toUpperCase().replace(/\s+/g, '');
}

function dismissLoadingScreen() {
  const screen = document.getElementById('loadingScreen');
  if (!screen) return;
  screen.classList.remove('active');
  screen.style.display = 'none';
  screen.style.opacity = '0';
  screen.style.pointerEvents = 'none';
}

function showLoginGate() {
  dismissLoadingScreen();
  if (!loginGate) return;
  loginGate.style.visibility = 'visible';
  loginGate.style.display = 'flex';
  loginGate.style.opacity = '1';
  loginGate.style.pointerEvents = 'auto';
  loginGate.classList.remove('fade-out');
  document.getElementById('accessCode')?.focus();
}

function revealCatalogue() {
  document.body.classList.remove('intro-active', 'vault-sealed');
  document.body.classList.add('catalogue-ready', 'site-revealed');
  if (introBox) {
    introBox.classList.remove('opening', 'is-visible');
    introBox.classList.add('done');
  }
  window.dispatchEvent(new CustomEvent('pmj:intro-complete'));
  window.PMJTheme?.updateToggleVisibility?.();
}

function playCssIntroFallback() {
  if (!introBox) {
    revealCatalogue();
    return;
  }
  document.body.classList.add('vault-sealed', 'intro-active');
  introBox.classList.add('is-visible');
  void introBox.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      introBox.classList.add('opening');
      if (typeof spawnIntroParticles === 'function') spawnIntroParticles(36);
    });
  });
  setTimeout(revealCatalogue, INTRO_MS);
}

function playIntro() {
  const useWebGL =
    !prefersReducedMotion &&
    window.PMJExperience &&
    typeof THREE !== 'undefined' &&
    typeof gsap !== 'undefined';

  if (useWebGL) {
    PMJExperience.playSequence(revealCatalogue);
  } else {
    playCssIntroFallback();
  }
}

function attemptLogin() {
  const input = document.getElementById('accessCode');
  const errEl = document.getElementById('loginError');
  const val = normalizeAccessCode(input?.value);

  if (!loginGate || !input) return;

  if (val !== PARTNER_ACCESS_CODE) {
    if (errEl) errEl.textContent = 'Incorrect access code. Please try again.';
    input.focus();
    input.select?.();
    return;
  }

  sessionStorage.setItem('pmj_partner_authed', 'true');
  if (errEl) errEl.textContent = '';
  loginGate.classList.add('fade-out');

  setTimeout(() => {
    loginGate.style.display = 'none';
    playIntro();
  }, 480);
}

function initLoginGate() {
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const input = document.getElementById('accessCode');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    attemptLogin();
  });

  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    attemptLogin();
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      attemptLogin();
    }
  });
}

function onAppReady() {
  dismissLoadingScreen();
  const authed = sessionStorage.getItem('pmj_partner_authed') === 'true';

  if (authed) {
    if (loginGate) loginGate.style.display = 'none';
    if (introBox) introBox.classList.add('done');
    document.body.classList.add('catalogue-ready', 'site-revealed');
    if (typeof applyFeaturedVisual === 'function') {
      applyFeaturedVisual();
    } else {
      const hero = PRODUCTS?.find((p) => p.id === 'SPND998476');
      if (hero && window.PMJExperience) PMJExperience.initHeroViewer(hero);
    }
    if (window.PromoBanner) {
      PromoBanner.init();
      PromoBanner.render();
    }
    window.dispatchEvent(new CustomEvent('pmj:intro-complete'));
    window.PMJTheme?.updateToggleVisibility?.();
    return;
  }

  showLoginGate();
  document.body.classList.add('vault-sealed');
}

function startBootstrap() {
  if (loginGate) {
    loginGate.style.visibility = 'hidden';
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onAppReady();
  };

  const fallbackMs = 4500;
  const fallbackTimer = setTimeout(finish, fallbackMs);

  const wrappedFinish = () => {
    clearTimeout(fallbackTimer);
    Promise.resolve(window.PMJSiteSync?.ready)
      .catch(() => null)
      .finally(finish);
  };

  try {
    if (window.PMJExperience && typeof THREE !== 'undefined') {
      PMJExperience.bootstrap(wrappedFinish);
    } else {
      wrappedFinish();
    }
  } catch (err) {
    console.warn('PMJ bootstrap failed, opening login gate.', err);
    wrappedFinish();
  }
}

initLoginGate();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBootstrap);
} else {
  startBootstrap();
}
