// UMBRA Overlay Main Logic
(function() {
  'use strict';

  // Global error handlers
  window.addEventListener('error', (e) => {
    const msg = e.error?.stack || e.message || 'Unknown error';
    console.error('[Overlay] error:', msg);
    API.reportError?.(msg);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.stack || e.reason || 'Unhandled rejection';
    console.error('[Overlay] promise rejection:', msg);
    API.reportError?.(msg);
  });

  // API bridge
  const API = window.overlayAPI || {
    setOpacity: () => {},
    toggleClickThrough: () => {},
    closeOverlay: () => {},
    openSettings: () => {},
    requestSettings: () => {},
    onApplySettings: () => {},
    onTestDonation: () => {},
    onGoalReset: () => {},
    startResize: () => {},
    stopResize: () => {},
    startMove: () => {},
    stopMove: () => {},
    updateUIBounds: () => {},
    onApiEvent: () => {},
  };

  // State
  let settings = {};
  let clickThrough = false;
  let autoHideTimer = null;

  // Combo system with optimized timeout
  let comboSum = 0;
  let comboTimer = null;
  let comboCount = 0;
  let comboEntries = [];
  const COMBO_TIMEOUT = 5000;

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    setupResizeHandle();
    setupMoveHandles();
    setupHotkeys();
    setupAutoHide();
    registerAPIHandlers();

    // Request initial settings
    API.requestSettings();

    // Welcome message
    setTimeout(() => {
      window.ChatUI.addMessage('da', 'UMBRA', 'UMBRA v2 ready / Created by Noxir (KayROSir)', '#6b6b78', false, null);
    }, 300);
  });

  // Setup resize handle
  function setupResizeHandle() {
    const handle = document.getElementById('resize-handle');
    let active = false;

    handle.addEventListener('mousedown', (e) => {
      active = true;
      e.preventDefault();
      e.stopPropagation();
      API.startResize();
    });

    window.addEventListener('mouseup', () => {
      if (!active) return;
      active = false;
      API.stopResize();
    });

    window.addEventListener('blur', () => {
      if (active) {
        active = false;
        API.stopResize();
      }
    });
  }

  // Setup move handles (goal and msgs-wrap)
  function setupMoveHandles() {
    const goal = document.getElementById('goal');
    const msgs = document.getElementById('msgs-wrap');
    let active = false;

    const startMove = (e) => {
      if (e.button !== 0) return;
      active = true;
      e.preventDefault();
      API.startMove();
    };

    goal.addEventListener('mousedown', startMove);
    msgs.addEventListener('mousedown', startMove);

    window.addEventListener('mouseup', () => {
      if (!active) return;
      active = false;
      API.stopMove();
    });

    window.addEventListener('blur', () => {
      if (active) {
        active = false;
        API.stopMove();
      }
    });
  }

  // Setup hotkeys
  function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
      const hk = settings.hotkeys || {};
      const key = (e.ctrlKey ? 'Ctrl+' : '') +
                  (e.shiftKey ? 'Shift+' : '') +
                  (e.altKey ? 'Alt+' : '') +
                  e.key;

      if (hk.clearChat && key === hk.clearChat) {
        window.ChatUI.clearMessages();
        return;
      }
      if (hk.hideOverlay && key === hk.hideOverlay) {
        API.closeOverlay();
        return;
      }
      if (hk.openSettings && key === hk.openSettings) {
        API.openSettings();
        return;
      }
      if (!hk.clickThrough && e.key === 'End') {
        setClickThrough(!clickThrough);
      }
    });
  }

  // Setup auto-hide
  function setupAutoHide() {
    // Reset auto-hide timer when new message arrives
    // This is called from ChatUI.addMessage
  }

  function resetAutoHide() {
    const wrap = document.getElementById('msgs-wrap');
    wrap.classList.remove('autohidden');
    if (autoHideTimer) clearTimeout(autoHideTimer);
    const delay = (settings.autoHide || 0) * 1000;
    if (delay > 0) {
      autoHideTimer = setTimeout(() => wrap.classList.add('autohidden'), delay);
    }
  }

  // Click-through with debounced bounds update
  function setClickThrough(on) {
    clickThrough = on;
    API.toggleClickThrough(on);
    if (on) sendUIBounds();
  }

  let boundsUpdateTimer = null;
  function sendUIBounds() {
    // Debounce bounds updates
    if (boundsUpdateTimer) return;

    boundsUpdateTimer = setTimeout(() => {
      const ids = ['goal', 'msgs-wrap', 'resize-handle', 'don-alert'];
      const bounds = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          bounds.push({
            x: Math.floor(r.left),
            y: Math.floor(r.top),
            w: Math.ceil(r.width),
            h: Math.ceil(r.height),
          });
        }
      }
      API.updateUIBounds(bounds);
      boundsUpdateTimer = null;
    }, 100); // Debounce 100ms
  }

  let resizeDebounce = null;
  window.addEventListener('resize', () => {
    if (!clickThrough) return;
    if (resizeDebounce) clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      sendUIBounds();
      resizeDebounce = null;
    }, 150);
  });

  // Register API handlers
  function registerAPIHandlers() {
    API.onApplySettings((s) => {
      // Special signals
      if (s._clearChat) {
        window.ChatUI.clearMessages();
        return;
      }
      if (s._clickThrough !== undefined) {
        clickThrough = s._clickThrough;
        return;
      }

      // Check if reconnect needed
      const isFirstLoad = !settings.twitchChannel && !settings.daToken && !settings.kickChannel && !settings.youtubeVideoId;
      const needReconnect = isFirstLoad ||
        settings.twitchChannel !== s.twitchChannel ||
        settings.daToken !== s.daToken ||
        settings.kickChannel !== s.kickChannel ||
        settings.youtubeVideoId !== s.youtubeVideoId ||
        settings.youtubeApiKey !== s.youtubeApiKey;

      settings = s;
      API.setOpacity(s.opacity / 100);

      // Apply theme
      if (s.theme) document.body.setAttribute('data-theme', s.theme);

      // Apply font size
      if (s.fontSize) {
        document.querySelectorAll('.msg-text').forEach((el) => {
          el.style.fontSize = s.fontSize + 'px';
        });
      }

      // Update modules
      window.GoalUI.setGoal(s.goalCurrent, s.goalTarget, s.goalTitle);
      window.ChatUI.setBlockedWords(
        s.chatFilter ? s.chatFilter.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) : []
      );
      window.DonationsUI.updateSettings(s);
      window.AudioManager.updateSettings(s);

      resetAutoHide();

      if (needReconnect) {
        reconnectAll();
      }
    });

    API.onTestDonation((d) => {
      const amt = Math.max(0, Number(d.amount) || 0);
      window.ChatUI.addMessage('test', d.name, String(amt), '#a8a8b3', true, String(amt));
      handleDonation(amt, d.name, 'Test Donation', 'test');
    });

    API.onGoalReset(() => {
      window.GoalUI.resetGoal();
    });

    API.onApiEvent((ev) => {
      if (!ev || !ev.type) return;

      if (ev.type === 'donation') {
        const p = ev.payload || {};
        const name = String(p.name || 'anonymous');
        const amount = String(p.amount || '0');
        const message = String(p.message || '');
        const display = amount + (p.currency ? ' ' + p.currency : '');
        window.ChatUI.addMessage('api', name, display + (message ? ': ' + message : ''), '#ffc832', true, display);
        handleDonation(parseFloat(amount) || 0, name, message, 'api');
      }

      if (ev.type === 'message') {
        const p = ev.payload || {};
        window.ChatUI.addMessage(p.platform || 'api', p.author || 'API', p.text || '', p.color || '#ffc832', false, null);
      }

      if (ev.type === 'alert') {
        const p = ev.payload || {};
        window.DonationsUI.showDonation(p.title || 'ALERT', '', p.text || '', 'api');
        document.getElementById('don-icon').textContent = p.icon || '📢';
      }
    });
  }

  // Donation handler with optimized combo system
  function handleDonation(amount, name, message, platform) {
    const safe = Math.max(0, Number(amount) || 0);
    if (safe <= 0) return;

    window.GoalUI.addToGoal(safe);
    comboSum += safe;
    comboCount++;
    comboEntries.push({ name: name || 'anonymous', amount: safe, msg: message || '', platform: platform || 'da' });

    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      if (comboCount === 1) {
        const e = comboEntries[0];
        window.DonationsUI.showDonation(e.name, String(e.amount), e.msg, e.platform);
      } else {
        const platforms = [...new Set(comboEntries.map(e => e.platform))];
        const last = comboEntries[comboEntries.length - 1];
        window.DonationsUI.showDonation('COMBO x' + comboCount, String(comboSum), '🔥 DONATION COMBO', platforms[0] || last.platform);
      }
      comboSum = 0;
      comboCount = 0;
      comboEntries = [];
      comboTimer = null;
    }, COMBO_TIMEOUT);
  }

  // Reconnect all services
  function reconnectAll() {
    window.TwitchService.connect(settings.twitchChannel);
    window.DonationAlertsService.connect(settings.daToken);
    window.KickService.connect(settings.kickChannel);
    window.YouTubeService.connect(settings.youtubeVideoId, settings.youtubeApiKey);
  }

  // Export for donation handling from services
  window.OverlayApp = {
    handleDonation,
    resetAutoHide,
  };
})();
