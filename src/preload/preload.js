const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SETTINGS_KEYS = new Set([
  'twitchChannel', 'youtubeVideoId', 'youtubeApiKey', 'daToken', 'kickChannel',
  'opacity', 'theme', 'fontSize', 'compactMode', 'autoHide',
  'donationSound', 'donationDuration', 'soundType', 'soundVolume',
  'goalTitle', 'goalTarget', 'goalCurrent',
  'chatFilter', 'apiPort', 'apiKey', 'apiEnabled',
  'animSpeed', 'saveHistory',
  'notifyDonations', 'notifyGoals', 'notifyMilestones', 'minDonationAmount',
  'hotkeys',
  '_testDonation', '_testAlert', '_resetGoal', 'name', 'amount',
]);

function sanitizeSettings(s) {
  if (!s || typeof s !== 'object') return {};
  const out = {};
  for (const key of Object.keys(s)) {
    if (ALLOWED_SETTINGS_KEYS.has(key)) {
      out[key] = s[key];
    }
  }
  return out;
}

function createListener(channel) {
  let currentCallback = null;
  return {
    set: (cb) => {
      if (currentCallback) {
        ipcRenderer.removeListener(channel, currentCallback);
      }
      if (typeof cb === 'function') {
        currentCallback = (_e, ...args) => cb(...args);
        ipcRenderer.on(channel, currentCallback);
      } else {
        currentCallback = null;
      }
    }
  };
}

contextBridge.exposeInMainWorld('overlayAPI', {
  saveSettings:        (s)  => ipcRenderer.send('settings-saved', sanitizeSettings(s)),
  setOpacity:          (v)  => ipcRenderer.send('set-opacity', typeof v === 'number' ? v : 0.85),
  toggleClickThrough:  (on) => ipcRenderer.send('toggle-click-through', !!on),
  mouseOverUI:         (ov) => ipcRenderer.send('mouse-over-ui', !!ov),
  closeOverlay:        ()   => ipcRenderer.send('close-overlay'),
  openSettings:        ()   => ipcRenderer.send('open-settings'),
  requestSettings:     ()   => ipcRenderer.send('request-settings'),
  resizeOverlay:       (sz) => ipcRenderer.send('resize-overlay', sz),
  startResize:         ()   => ipcRenderer.send('start-resize'),
  stopResize:          ()   => ipcRenderer.send('stop-resize'),
  startMove:           ()   => ipcRenderer.send('start-move'),
  updateUIBounds:      (b)  => {
    if (!Array.isArray(b)) return;
    ipcRenderer.send('update-ui-bounds', b.map(item => ({
      x: Number(item.x) || 0, y: Number(item.y) || 0,
      w: Number(item.w) || 0, h: Number(item.h) || 0,
    })));
  },
  stopMove:            ()   => ipcRenderer.send('stop-move'),

  onApplySettings: createListener('apply-settings').set,
  onTestDonation:  createListener('test-donation').set,
  onGoalReset:     createListener('goal-reset').set,
  onApiEvent:      createListener('api-event').set,
  onApiError:      createListener('api-error').set,

  reportError: (message) => ipcRenderer.send('renderer-error', String(message).slice(0, 500)),
});

contextBridge.exposeInMainWorld('settingsAPI', {
  saveSettings: (s)  => ipcRenderer.send('settings-saved', sanitizeSettings(s)),
  onReady:      createListener('settings-ready').set,
});
