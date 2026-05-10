/**
 * UMBRA Update Manager
 * Handles automatic updates using electron-updater
 */

const { autoUpdater } = require('electron-updater');
const { app, dialog, Notification } = require('electron');
const path = require('path');
const logger = require('../shared/logger');

class UpdateManager {
  constructor(windowManager, settingsManager) {
    this.windowManager = windowManager;
    this.settingsManager = settingsManager;
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.updateInfo = null;
    this.checkInterval = null;
    this.isChecking = false;

    this.setupAutoUpdater();
  }

  setupAutoUpdater() {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    autoUpdater.logger = {
      info: (...args) => logger.info('[Updater]', ...args),
      warn: (...args) => logger.warn('[Updater]', ...args),
      error: (...args) => logger.error('[Updater]', ...args),
      debug: (...args) => logger.debug('[Updater]', ...args),
    };

    autoUpdater.on('checking-for-update', () => {
      logger.info('[Updater] Checking for updates...');
      this.isChecking = true;
      this.sendStatusToWindow('checking');
    });

    autoUpdater.on('update-available', (info) => {
      logger.info('[Updater] Update available:', info.version);
      this.updateAvailable = true;
      this.updateInfo = info;
      this.isChecking = false;
      this.sendStatusToWindow('available', this.formatUpdateInfo(info));
      this.showUpdateNotification(info);
    });

    autoUpdater.on('update-not-available', (info) => {
      logger.info('[Updater] No update available. Current version is latest.');
      this.updateAvailable = false;
      this.isChecking = false;
      this.sendStatusToWindow('not-available', {
        currentVersion: app.getVersion(),
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      const percent = progress.percent.toFixed(1);
      logger.info(`[Updater] Download progress: ${percent}%`);
      this.sendStatusToWindow('downloading', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      logger.info('[Updater] Update downloaded:', info.version);
      this.updateDownloaded = true;
      this.updateInfo = info;
      this.sendStatusToWindow('downloaded', this.formatUpdateInfo(info));
      this.showUpdateReadyNotification(info);
    });

    autoUpdater.on('error', (error) => {
      logger.error('[Updater] Error:', error.message);
      this.isChecking = false;
      this.sendStatusToWindow('error', {
        message: error.message,
        code: error.code,
      });
    });
  }

  formatUpdateInfo(info) {
    return {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
      releaseName: info.releaseName,
    };
  }

  sendStatusToWindow(status, data = {}) {
    const settingsWindow = this.windowManager?.getSettingsWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-status', { status, ...data });
    }
  }

  showUpdateNotification(info) {
    if (!Notification.isSupported()) return;

    try {
      const notification = new Notification({
        title: 'UMBRA — Доступно обновление',
        body: `Версия ${info.version} загружается...`,
        icon: this.getIconPath(),
        silent: false,
      });

      notification.on('click', () => {
        this.showSettingsWindow();
      });

      notification.show();
    } catch (error) {
      logger.warn('[Updater] Failed to show notification:', error.message);
    }
  }

  showUpdateReadyNotification(info) {
    if (!Notification.isSupported()) return;

    try {
      const notification = new Notification({
        title: 'UMBRA — Обновление готово',
        body: `Версия ${info.version} готова к установке. Нажмите для установки.`,
        icon: this.getIconPath(),
        silent: false,
        urgency: 'normal',
      });

      notification.on('click', () => {
        this.installUpdate();
      });

      notification.show();
    } catch (error) {
      logger.warn('[Updater] Failed to show notification:', error.message);
    }
  }

  showSettingsWindow() {
    const settingsWindow = this.windowManager?.getSettingsWindow();
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  }

  getIconPath() {
    return path.join(__dirname, '..', '..', 'assets', 'icon.png');
  }

  async checkForUpdates() {
    if (this.isChecking) {
      logger.info('[Updater] Already checking for updates');
      return null;
    }

    try {
      const result = await autoUpdater.checkForUpdates();
      return result;
    } catch (error) {
      logger.error('[Updater] Check failed:', error.message);
      this.sendStatusToWindow('error', { message: error.message });
      return null;
    }
  }

  startAutoCheck(delayMs = 10000, intervalMs = 4 * 60 * 60 * 1000) {
    const settings = this.settingsManager?.get() || {};

    if (settings.autoUpdate === false) {
      logger.info('[Updater] Auto-update disabled in settings');
      return;
    }

    if (!app.isPackaged) {
      logger.info('[Updater] Skipping auto-update in development mode');
      return;
    }

    setTimeout(() => {
      this.checkForUpdates();
    }, delayMs);

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalMs);

    logger.info(`[Updater] Auto-check started (interval: ${intervalMs / 1000 / 60} min)`);
  }

  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('[Updater] Auto-check stopped');
    }
  }

  async installUpdate() {
    if (!this.updateDownloaded) {
      logger.warn('[Updater] No update downloaded to install');
      return false;
    }

    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Установить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
      title: 'UMBRA — Установка обновления',
      message: `Готово обновление до версии ${this.updateInfo?.version}`,
      detail: 'Приложение будет перезапущено для завершения установки.\n\nThe application will restart to complete the installation.',
      noLink: true,
    });

    if (response === 0) {
      logger.info('[Updater] User accepted update installation');
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
      return true;
    }

    logger.info('[Updater] User postponed update installation');
    return false;
  }

  getUpdateStatus() {
    return {
      available: this.updateAvailable,
      downloaded: this.updateDownloaded,
      checking: this.isChecking,
      info: this.updateInfo ? this.formatUpdateInfo(this.updateInfo) : null,
      currentVersion: app.getVersion(),
    };
  }

  setAutoUpdateEnabled(enabled) {
    if (enabled) {
      this.startAutoCheck();
    } else {
      this.stopAutoCheck();
    }
  }

  cleanup() {
    this.stopAutoCheck();
  }
}

module.exports = UpdateManager;
