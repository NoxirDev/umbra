// UMBRA Main Process
const { app, nativeTheme, globalShortcut, shell } = require('electron');
const path = require('path');

// Modules
const CONSTANTS = require('../shared/constants');
const SettingsManager = require('./settings');
const WindowManager = require('./windows');
const TrayManager = require('./tray');
const ApiServer = require('./api-v2');
const IpcHandlers = require('./ipc-handlers');
const StatisticsManager = require('./statistics');
const NotificationManager = require('./notifications');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

/**
 * Security: Block navigation & new windows
 */
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  contents.on('before-input-event', (e, input) => {
    if (input.key === 'F12' ||
        (input.key === 'I' && input.control && input.shift)) {
      e.preventDefault();
    }
  });
});

// Icon paths
const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const iconPathIco = path.join(__dirname, '..', '..', 'assets', 'icon.ico');

// Initialize managers
const settingsManager = new SettingsManager();
const statisticsManager = new StatisticsManager();
const windowManager = new WindowManager(iconPath, iconPathIco);
const notificationManager = new NotificationManager(iconPath, windowManager);
const apiServer = new ApiServer(settingsManager, windowManager, statisticsManager, notificationManager);

/**
 * Click-through state (shared between tray and IPC)
 */
const clickThroughState = {
  enabled: false,
  get: () => clickThroughState.enabled,
  set: (val) => { clickThroughState.enabled = val; },
  toggle: () => {
    clickThroughState.enabled = !clickThroughState.enabled;
    ipcHandlers.clickThroughEnabled = clickThroughState.enabled;
    const overlay = windowManager.getOverlayWindow();
    if (clickThroughState.enabled) {
      overlay?.setIgnoreMouseEvents(true, { forward: true });
      ipcHandlers.startCtPolling();
    } else {
      overlay?.setIgnoreMouseEvents(false);
      ipcHandlers.stopCtPolling();
    }
    overlay?.webContents.send('apply-settings', {
      ...settingsManager.get(),
      _clickThrough: clickThroughState.enabled,
    });
  },
};

const trayManager = new TrayManager(iconPath, iconPathIco, windowManager, clickThroughState);
const ipcHandlers = new IpcHandlers(settingsManager, windowManager, apiServer, trayManager, notificationManager);

/**
 * App ready - Initialize application
 */
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';

  const settings = settingsManager.get();

  // Create windows
  windowManager.createOverlayWindow(settings);
  windowManager.createSettingsWindow(settings);

  // Create tray
  trayManager.create();

  // Register IPC handlers
  ipcHandlers.register();

  // Renderer error reporting
  const { ipcMain } = require('electron');
  ipcMain.on('renderer-error', (_e, message) => {
    console.error('[Renderer Error]', message);
  });

  // Start API if enabled
  if (settings.apiEnabled) {
    if (!settings.apiKey) {
      settings.apiKey = apiServer.generateApiKey();
      settingsManager.save(settings);
    }
    apiServer.start(settings.apiPort || CONSTANTS.DEFAULT_API_PORT, settings.apiKey);
  }

  // Register hotkeys
  ipcHandlers.registerHotkeys(settings.hotkeys);
});

/**
 * Cleanup on quit
 */
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

/**
 * Second instance - focus settings window
 */
app.on('second-instance', () => {
  const settingsWindow = windowManager.getSettingsWindow();
  if (settingsWindow) {
    settingsWindow.focus();
  } else {
    windowManager.createSettingsWindow(settingsManager.get());
  }
});

/**
 * Don't quit on all windows closed (tray app)
 */
app.on('window-all-closed', () => {
  // Keep running in tray
});

/**
 * Before quit cleanup
 */
app.on('before-quit', () => {
  statisticsManager._flushSave();
  apiServer.stop();
  ipcHandlers.cleanup();
  trayManager.destroy();
  windowManager.closeAll();
});
