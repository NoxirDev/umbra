// Particles animation module
(function() {
  'use strict';

  const { createElement } = window.UmbraUtils;

  const EMOJIS = ['🎉', '✨', '⭐', '💫', '🌟'];

  function spawn() {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = createElement('div', 'pt');
        p.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        p.style.left = (20 + Math.random() * 60) + '%';
        p.style.bottom = '100px';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1500);
      }, i * 100);
    }
  }

  // Export to global
  window.ParticlesUI = {
    spawn,
  };
})();
