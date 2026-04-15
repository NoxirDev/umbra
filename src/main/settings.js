const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const CONSTANTS = require('../shared/constants');
const { safeInt } = require('../shared/utils');

const SECRET_KEYS = ['daToken', 'youtubeApiKey', 'apiKey'];

class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.secretsPath = path.join(app.getPath('userData'), 'secrets.enc');
    this.settings = this.load();
  }

  _canEncrypt() {
    return safeStorage && safeStorage.isEncryptionAvailable();
  }

  _encryptSecrets(settings) {
    if (!this._canEncrypt()) return;
    try {
      const secrets = {};
      for (const key of SECRET_KEYS) {
        if (settings[key]) {
          secrets[key] = settings[key];
        }
      }
      if (Object.keys(secrets).length > 0) {
        const encrypted = safeStorage.encryptString(JSON.stringify(secrets));
        fs.writeFileSync(this.secretsPath, encrypted);
      } else if (fs.existsSync(this.secretsPath)) {
        fs.unlinkSync(this.secretsPath);
      }
    } catch (e) {
      console.error('[Settings] Failed to encrypt secrets:', e.message);
    }
  }

  _decryptSecrets() {
    if (!this._canEncrypt() || !fs.existsSync(this.secretsPath)) return {};
    try {
      const encrypted = fs.readFileSync(this.secretsPath);
      const decrypted = safeStorage.decryptString(encrypted);
      return JSON.parse(decrypted);
    } catch (e) {
      console.error('[Settings] Failed to decrypt secrets:', e.message);
      try { fs.unlinkSync(this.secretsPath); } catch {}
      return {};
    }
  }

  load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        const parsed = JSON.parse(data);
        const secrets = this._decryptSecrets();
        for (const key of SECRET_KEYS) {
          if (secrets[key]) parsed[key] = secrets[key];
        }
        return this.sanitize(parsed);
      }
    } catch (error) {
      console.error('[Settings] Failed to load:', error.message);
      this.backupCorruptedFile();
    }
    return this.getDefaults();
  }

  backupCorruptedFile() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const backupPath = this.settingsPath + '.backup.' + Date.now();
        fs.copyFileSync(this.settingsPath, backupPath);
      }
    } catch (err) {
      console.error('[Settings] Failed to backup corrupted file:', err.message);
    }
  }

  save(settings) {
    try {
      this.settings = this.sanitize(settings);
      const secrets = {};
      const publicSettings = { ...this.settings };
      for (const key of SECRET_KEYS) {
        if (publicSettings[key]) {
          secrets[key] = publicSettings[key];
          publicSettings[key] = '';
        }
      }
      this._encryptSecrets(this.settings);

      const data = JSON.stringify(publicSettings, null, 2);
      const tempPath = this.settingsPath + '.tmp';
      fs.writeFileSync(tempPath, data, 'utf8');
      fs.renameSync(tempPath, this.settingsPath);

      return true;
    } catch (error) {
      console.error('[Settings] Failed to save:', error.message);
      return false;
    }
  }

  get() {
    return { ...this.settings };
  }

  update(partial) {
    this.settings = this.sanitize({ ...this.settings, ...partial });
    return this.save(this.settings);
  }

  sanitize(s) {
    const safeKey = (k) => {
      return String(k || '').replace(/[^a-zA-Z0-9+\-_ ]/g, '').slice(0, 30);
    };

    const hk = s.hotkeys || {};

    return {
      twitchChannel: String(s.twitchChannel || '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 25),

      youtubeVideoId: String(s.youtubeVideoId || '')
        .replace(/[^a-zA-Z0-9_\-]/g, '')
        .slice(0, 20),

      youtubeApiKey: String(s.youtubeApiKey || '').slice(0, 512),

      daToken: String(s.daToken || '').slice(0, 512),

      kickChannel: String(s.kickChannel || '')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 50),

      opacity: Math.min(
        CONSTANTS.OPACITY_MAX,
        Math.max(CONSTANTS.OPACITY_MIN, safeInt(s.opacity, CONSTANTS.OPACITY_DEFAULT))
      ),

      theme: CONSTANTS.THEMES.includes(s.theme) ? s.theme : 'default',

      fontSize: Math.min(
        CONSTANTS.FONT_SIZE_MAX,
        Math.max(CONSTANTS.FONT_SIZE_MIN, safeInt(s.fontSize, CONSTANTS.FONT_SIZE_DEFAULT))
      ),

      compactMode: s.compactMode === true,

      autoHide: Math.min(
        CONSTANTS.AUTOHIDE_MAX,
        Math.max(CONSTANTS.AUTOHIDE_MIN, safeInt(s.autoHide, 0))
      ),

      donationSound: s.donationSound !== false,

      donationDuration: Math.min(
        CONSTANTS.DONATION_DURATION_MAX,
        Math.max(
          CONSTANTS.DONATION_DURATION_MIN,
          safeInt(s.donationDuration, CONSTANTS.DONATION_DURATION_DEFAULT)
        )
      ),

      soundType: CONSTANTS.SOUND_TYPES.includes(s.soundType)
        ? s.soundType
        : 'default',

      soundVolume: Math.min(
        CONSTANTS.SOUND_VOLUME_MAX,
        Math.max(
          CONSTANTS.SOUND_VOLUME_MIN,
          safeInt(s.soundVolume, CONSTANTS.SOUND_VOLUME_DEFAULT)
        )
      ),

      goalTitle: String(s.goalTitle || '')
        .replace(/[<>]/g, '')
        .slice(0, 80),

      goalTarget: Math.max(0, safeInt(s.goalTarget, 0)),
      goalCurrent: Math.max(0, safeInt(s.goalCurrent, 0)),

      chatFilter: String(s.chatFilter || '')
        .replace(/[<>]/g, '')
        .slice(0, 500)
        .toLowerCase(),

      apiPort: Math.min(
        65535,
        Math.max(1024, safeInt(s.apiPort, CONSTANTS.DEFAULT_API_PORT))
      ),

      apiKey: String(s.apiKey || '')
        .replace(/[^a-zA-Z0-9\-_]/g, '')
        .slice(0, 128),

      apiEnabled: s.apiEnabled !== false,

      animSpeed: Math.min(10, Math.max(1, safeInt(s.animSpeed, 5))),
      saveHistory: s.saveHistory === true,

      notifyDonations: s.notifyDonations !== false,
      notifyGoals: s.notifyGoals !== false,
      notifyMilestones: s.notifyMilestones !== false,
      minDonationAmount: Math.max(0, safeInt(s.minDonationAmount, 0)),

      hotkeys: {
        clickThrough: safeKey(hk.clickThrough),
        clearChat: safeKey(hk.clearChat),
        hideOverlay: safeKey(hk.hideOverlay),
        openSettings: safeKey(hk.openSettings),
      },

      widgetTopDonors: s.widgetTopDonors === true,
      widgetLastDonation: s.widgetLastDonation === true,
      widgetSessionTotal: s.widgetSessionTotal === true,
      widgetPosition: ['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(s.widgetPosition)
        ? s.widgetPosition
        : 'top-right',
    };
  }

  getDefaults() {
    return this.sanitize({});
  }

  reset() {
    this.settings = this.getDefaults();
    return this.save(this.settings);
  }
}

module.exports = SettingsManager;
