// Donations UI module
(function() {
  'use strict';

  const { escapeHtml } = window.UmbraUtils;

  let donTimer = null;
  let settings = {};

  function showDonation(name, amount, message, platform) {
    clearTimeout(donTimer);

    document.getElementById('don-name').textContent = escapeHtml(name);
    document.getElementById('don-amount').textContent = escapeHtml(amount);
    document.getElementById('don-text').textContent = escapeHtml(message);

    // Set icon based on platform
    const iconMap = {
      kick: '🟢',
      api: '⚡',
      default: '🎉',
    };
    document.getElementById('don-icon').textContent = iconMap[platform] || iconMap.default;

    const alert = document.getElementById('don-alert');
    alert.classList.remove('show');
    void alert.offsetWidth; // Force reflow
    alert.classList.add('show');

    // Play sound and spawn particles
    if (window.AudioManager) {
      window.AudioManager.playDonationSound();
    }
    if (window.ParticlesUI) {
      window.ParticlesUI.spawn();
    }

    // Auto-hide after duration
    const duration = settings.donationDuration || 8;
    if (duration > 0) {
      donTimer = setTimeout(() => {
        alert.classList.remove('show');
      }, duration * 1000);
    }
  }

  function updateSettings(newSettings) {
    settings = newSettings;
  }

  // Export to global
  window.DonationsUI = {
    showDonation,
    updateSettings,
  };
})();
