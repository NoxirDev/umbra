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

  /**
   * Show alert for Twitch events (subs, raids, etc.)
   */
  function showAlert(data) {
    clearTimeout(donTimer);

    const { type, name, icon } = data;
    let title = name;
    let amount = '';
    let message = '';

    switch (type) {
      case 'subscription':
        title = name;
        amount = `${data.tier} - ${data.months} месяцев`;
        message = data.message || '⭐ Подписка!';
        break;
      case 'gift_sub':
        title = name;
        amount = `${data.tier} → ${data.recipient}`;
        message = '🎁 Подарил подписку!';
        break;
      case 'mystery_gift':
        title = name;
        amount = `${data.count} x ${data.tier}`;
        message = '🎉 Подарил подписки сообществу!';
        break;
      case 'raid':
        title = name;
        amount = `${data.viewers} зрителей`;
        message = '🚀 Рейд!';
        break;
      default:
        title = name;
        amount = '';
        message = data.message || '';
    }

    document.getElementById('don-name').textContent = escapeHtml(title);
    document.getElementById('don-amount').textContent = escapeHtml(amount);
    document.getElementById('don-text').textContent = escapeHtml(message);
    document.getElementById('don-icon').textContent = icon || '🎉';

    const alert = document.getElementById('don-alert');
    alert.classList.remove('show');
    void alert.offsetWidth;
    alert.classList.add('show');

    // Play sound and spawn particles
    if (window.AudioManager) {
      window.AudioManager.playDonationSound();
    }
    if (window.ParticlesUI) {
      window.ParticlesUI.spawn();
    }

    // Auto-hide
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
    showAlert,
    updateSettings,
  };
})();
