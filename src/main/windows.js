// Window management module
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const CONSTANTS = require('../shared/constants');

class WindowManager {
  constructor(iconPath, iconPathIco) {
    this.iconPath = iconPath;
    this.iconPathIco = iconPathIco;
    this.overlayWindow = null;
    this.settingsWindow = null;
  }

  createOverlayWindow(settings) {
    if (this.overlayWindow) {
      this.overlayWindow.focus();
      return this.overlayWindow;
    }

    const { width } = screen.getPrimaryDisplay().workAreaSize;

    this.overlayWindow = new BrowserWindow({
      icon: process.platform === 'win32' ? this.iconPathIco : this.iconPath,
      width: CONSTANTS.OVERLAY_WIDTH,
      height: CONSTANTS.OVERLAY_HEIGHT,
      x: width - 400,
      y: 50,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      },
    });

    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    this.overlayWindow.setOpacity((settings.opacity || CONSTANTS.OPACITY_DEFAULT) / 100);
    this.overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay', 'index.html'));

    this.overlayWindow.webContents.on('did-finish-load', () => {
      this.overlayWindow?.webContents.send('apply-settings', settings);
    });

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
    });

    return this.overlayWindow;
  }

  createSettingsWindow(settings) {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      icon: process.platform === 'win32' ? this.iconPathIco : this.iconPath,
      width: CONSTANTS.SETTINGS_WIDTH,
      height: CONSTANTS.SETTINGS_HEIGHT,
      title: `${CONSTANTS.APP_NAME} — Настройки`,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      },
    });

    this.settingsWindow.setMenuBarVisibility(false);
    this.settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'index.html'));

    this.settingsWindow.webContents.on('did-finish-load', () => {
      this.settingsWindow?.webContents.send('settings-ready', settings);
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  getOverlayWindow() {
    return this.overlayWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  closeAll() {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.destroy();
      this.overlayWindow = null;
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.destroy();
      this.settingsWindow = null;
    }
  }
}

module.exports = WindowManager;
