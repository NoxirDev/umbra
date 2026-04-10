const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  saveSettings:        (s)  => ipcRenderer.send('settings-saved', s),
  setOpacity:          (v)  => ipcRenderer.send('set-opacity', v),
  toggleClickThrough:  (on) => ipcRenderer.send('toggle-click-through', on),
  mouseOverUI:         (ov) => ipcRenderer.send('mouse-over-ui', ov),
  closeOverlay:        ()   => ipcRenderer.send('close-overlay'),
  openSettings:        ()   => ipcRenderer.send('open-settings'),
  requestSettings:     ()   => ipcRenderer.send('request-settings'),
  resizeOverlay:       (sz) => ipcRenderer.send('resize-overlay', sz),
  startResize:         ()   => ipcRenderer.send('start-resize'),
  stopResize:          ()   => ipcRenderer.send('stop-resize'),
  startMove:           ()   => ipcRenderer.send('start-move'),
  updateUIBounds:      (b)  => ipcRenderer.send('update-ui-bounds', b),
  stopMove:            ()   => ipcRenderer.send('stop-move'),
  onResizeTick:        () => {}, // deprecated — resize теперь полностью в main

  onApplySettings: (cb) => ipcRenderer.on('apply-settings', (_e, s) => cb(s)),
  onTestDonation:  (cb) => ipcRenderer.on('test-donation',  (_e, d) => cb(d)),
  onGoalReset:     (cb) => ipcRenderer.on('goal-reset',     ()      => cb()),
  onApiEvent:      (cb) => ipcRenderer.on('api-event',     (_e, d) => cb(d)),
  onApiError:      (cb) => ipcRenderer.on('api-error',      (_e, d) => cb(d)),
});

contextBridge.exposeInMainWorld('settingsAPI', {
  saveSettings: (s)  => ipcRenderer.send('settings-saved', s),
  onReady:      (cb) => ipcRenderer.on('settings-ready', (_e, s) => cb(s)),
});
