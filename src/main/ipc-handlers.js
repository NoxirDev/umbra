// IPC handlers module
const { ipcMain, screen } = require('electron');

class IpcHandlers {
  constructor(settingsManager, windowManager, apiServer, trayManager) {
    this.settingsManager = settingsManager;
    this.windowManager = windowManager;
    this.apiServer = apiServer;
    this.trayManager = trayManager;
    this.clickThroughEnabled = false;
    this.ctPollInterval = null;
    this.ctUIBounds = null;
    this.resizeInterval = null;
    this.resizeStart = null;
    this.moveInterval = null;
    this.moveStart = null;
  }

  register() {
    // Settings saved
    ipcMain.on('settings-saved', (_e, s) => {
      // Handle special actions
      if (s._testDonation) {
        const overlay = this.windowManager.getOverlayWindow();
        overlay?.webContents.send('test-donation', {
          name: s.name || 'TestUser',
          amount: s.amount || 100,
        });
        return;
      }

      if (s._testAlert) {
        const overlay = this.windowManager.getOverlayWindow();
        overlay?.webContents.send('api-event', {
          type: 'alert',
          payload: { title: 'TEST ALERT', text: 'Это тестовый алерт', icon: '📢' },
        });
        return;
      }

      if (s._resetGoal) {
        const settings = this.settingsManager.get();
        settings.goalCurrent = 0;
        this.settingsManager.save(settings);
        const overlay = this.windowManager.getOverlayWindow();
        overlay?.webContents.send('goal-reset');
        return;
      }

      // Preserve goalCurrent from memory
      const currentSettings = this.settingsManager.get();
      const safe = {
        ...s,
        goalCurrent: s.goalCurrent ?? currentSettings.goalCurrent ?? 0,
      };

      this.settingsManager.save(safe);

      const overlay = this.windowManager.getOverlayWindow();
      overlay?.webContents.send('apply-settings', safe);
      overlay?.setOpacity(safe.opacity / 100);

      this.applyApiSettings(safe);
      this.registerHotkeys(safe.hotkeys);
    });

    // Request settings
    ipcMain.on('request-settings', (e) => {
      e.sender.send('apply-settings', this.settingsManager.get());
    });

    // Opacity
    ipcMain.on('set-opacity', (_e, value) => {
      const overlay = this.windowManager.getOverlayWindow();
      overlay?.setOpacity(Math.min(1, Math.max(0.2, parseFloat(value) || 0.85)));
    });

    // Click-through
    ipcMain.on('toggle-click-through', (_e, enabled) => {
      this.clickThroughEnabled = !!enabled;
      const overlay = this.windowManager.getOverlayWindow();
      if (this.clickThroughEnabled) {
        overlay?.setIgnoreMouseEvents(true, { forward: true });
        this.startCtPolling();
      } else {
        overlay?.setIgnoreMouseEvents(false);
        this.stopCtPolling();
      }
    });

    // UI bounds for click-through
    ipcMain.on('update-ui-bounds', (_e, bounds) => {
      this.ctUIBounds = bounds;
    });

    // Window controls
    ipcMain.on('close-overlay', () => {
      this.windowManager.getOverlayWindow()?.hide();
    });

    ipcMain.on('open-settings', () => {
      this.windowManager.createSettingsWindow(this.settingsManager.get());
    });

    // Resize
    ipcMain.on('start-resize', () => {
      const overlay = this.windowManager.getOverlayWindow();
      if (!overlay) return;

      const cur = screen.getCursorScreenPoint();
      const bounds = overlay.getBounds();
      this.resizeStart = {
        cursorX: cur.x,
        cursorY: cur.y,
        winW: bounds.width,
        winH: bounds.height,
      };

      if (this.resizeInterval) clearInterval(this.resizeInterval);
      this.resizeInterval = setInterval(() => {
        if (!overlay || !this.resizeStart) {
          clearInterval(this.resizeInterval);
          this.resizeInterval = null;
          return;
        }
        const now = screen.getCursorScreenPoint();
        const w = Math.min(800, Math.max(280, this.resizeStart.winW + (now.x - this.resizeStart.cursorX)));
        const h = Math.min(1200, Math.max(300, this.resizeStart.winH + (now.y - this.resizeStart.cursorY)));
        overlay.setBounds({ width: w, height: h });
      }, 16);
    });

    ipcMain.on('stop-resize', () => {
      if (this.resizeInterval) {
        clearInterval(this.resizeInterval);
        this.resizeInterval = null;
      }
      this.resizeStart = null;
    });

    // Move
    ipcMain.on('start-move', () => {
      const overlay = this.windowManager.getOverlayWindow();
      if (!overlay) return;

      const cur = screen.getCursorScreenPoint();
      const bounds = overlay.getBounds();
      this.moveStart = {
        cursorX: cur.x,
        cursorY: cur.y,
        winX: bounds.x,
        winY: bounds.y,
      };

      if (this.moveInterval) clearInterval(this.moveInterval);
      this.moveInterval = setInterval(() => {
        if (!overlay || !this.moveStart) {
          clearInterval(this.moveInterval);
          this.moveInterval = null;
          return;
        }
        const now = screen.getCursorScreenPoint();
        overlay.setBounds({
          x: this.moveStart.winX + (now.x - this.moveStart.cursorX),
          y: this.moveStart.winY + (now.y - this.moveStart.cursorY),
        });
      }, 16);
    });

    ipcMain.on('stop-move', () => {
      if (this.moveInterval) {
        clearInterval(this.moveInterval);
        this.moveInterval = null;
      }
      this.moveStart = null;
    });
  }

  startCtPolling() {
    if (this.ctPollInterval) return;
    this.ctPollInterval = setInterval(() => {
      if (!this.clickThroughEnabled) return;
      const overlay = this.windowManager.getOverlayWindow();
      if (!overlay) return;

      const cur = screen.getCursorScreenPoint();
      const ob = overlay.getBounds();
      const lx = cur.x - ob.x;
      const ly = cur.y - ob.y;

      let overUI = false;
      if (this.ctUIBounds && Array.isArray(this.ctUIBounds)) {
        for (const b of this.ctUIBounds) {
          if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) {
            overUI = true;
            break;
          }
        }
      }
      overlay.setIgnoreMouseEvents(!overUI, { forward: true });
    }, 32);
  }

  stopCtPolling() {
    if (this.ctPollInterval) {
      clearInterval(this.ctPollInterval);
      this.ctPollInterval = null;
    }
    this.ctUIBounds = null;
  }

  applyApiSettings(settings) {
    if (settings.apiEnabled) {
      if (!settings.apiKey) {
        settings.apiKey = this.apiServer.generateApiKey();
        this.settingsManager.update({ apiKey: settings.apiKey });
        const settingsWindow = this.windowManager.getSettingsWindow();
        settingsWindow?.webContents.send('settings-ready', this.settingsManager.get());
      }
      this.apiServer.start(settings.apiPort || 4587, settings.apiKey);
    } else {
      this.apiServer.stop();
    }
  }

  registerHotkeys(hotkeys) {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();
    if (!hotkeys) return;

    const convertKey = (k) => {
      if (!k) return null;
      return k
        .replace(/\bCtrl\b/g, 'CommandOrControl')
        .replace(/\bAlt\b/g, 'Alt')
        .replace(/\bShift\b/g, 'Shift')
        .replace(/\bEnd\b/g, 'End')
        .replace(/\bHome\b/g, 'Home')
        .replace(/\bInsert\b/g, 'Insert')
        .replace(/\bDelete\b/g, 'Delete')
        .replace(/\bF(\d+)\b/g, 'F$1')
        .trim();
    };

    const reg = (key, fn) => {
      const k = convertKey(key);
      if (!k) return;
      try {
        globalShortcut.register(k, fn);
      } catch (e) {
        console.warn('Hotkey register failed:', k, e.message);
      }
    };

    reg(hotkeys.clickThrough, () => {
      this.clickThroughEnabled = !this.clickThroughEnabled;
      const overlay = this.windowManager.getOverlayWindow();
      if (this.clickThroughEnabled) {
        overlay?.setIgnoreMouseEvents(true, { forward: true });
        this.startCtPolling();
      } else {
        overlay?.setIgnoreMouseEvents(false);
        this.stopCtPolling();
      }
      overlay?.webContents.send('apply-settings', {
        ...this.settingsManager.get(),
        _clickThrough: this.clickThroughEnabled,
      });
      this.trayManager.updateMenu();
    });

    reg(hotkeys.clearChat, () => {
      const overlay = this.windowManager.getOverlayWindow();
      overlay?.webContents.send('apply-settings', {
        ...this.settingsManager.get(),
        _clearChat: true,
      });
    });

    reg(hotkeys.hideOverlay, () => {
      const overlay = this.windowManager.getOverlayWindow();
      if (overlay?.isVisible()) overlay.hide();
      else overlay?.show();
    });

    reg(hotkeys.openSettings, () => {
      const settingsWindow = this.windowManager.getSettingsWindow();
      if (settingsWindow) {
        settingsWindow.focus();
      } else {
        this.windowManager.createSettingsWindow(this.settingsManager.get());
      }
    });
  }

  cleanup() {
    this.stopCtPolling();
    if (this.resizeInterval) {
      clearInterval(this.resizeInterval);
      this.resizeInterval = null;
    }
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
  }
}

module.exports = IpcHandlers;
