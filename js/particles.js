/* Gold particle burst during vault intro */
function spawnIntroParticles(count = 28) {
  const box = document.getElementById('introBox');
  if (!box) return;

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'intro-particle';
    const size = 2 + Math.random() * 4;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.left = '50%';
    p.style.top = '50%';
    box.appendChild(p);

    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 220;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    p.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.4}px), calc(-50% + ${dy * 0.4}px)) scale(1.2)`, opacity: 0.9, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`, opacity: 0 }
    ], {
      duration: 900 + Math.random() * 600,
      delay: 700 + Math.random() * 250,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards'
    }).onfinish = () => p.remove();
  }
}
