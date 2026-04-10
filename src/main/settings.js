// Settings management module
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const CONSTANTS = require('../shared/constants');

class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        return this.sanitize(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return this.getDefaults();
  }

  save(settings) {
    try {
      this.settings = this.sanitize(settings);
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
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
    const safeInt = (val, def) => {
      const n = parseInt(val);
      return isNaN(n) ? def : n;
    };

    const safeKey = (k) => {
      return String(k || '').replace(/[^a-zA-Z0-9+\-_ ]/g, '').slice(0, 30);
    };

    const hk = s.hotkeys || {};

    return {
      // Connections
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

      // Display
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

      // Donations
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

      // Goal
      goalTitle: String(s.goalTitle || '')
        .replace(/[<>]/g, '')
        .slice(0, 80),

      goalTarget: Math.max(0, safeInt(s.goalTarget, 0)),
      goalCurrent: Math.max(0, safeInt(s.goalCurrent, 0)),

      // Moderation
      chatFilter: String(s.chatFilter || '')
        .replace(/[<>]/g, '')
        .slice(0, 500)
        .toLowerCase(),

      // API
      apiPort: Math.min(
        65535,
        Math.max(1024, safeInt(s.apiPort, CONSTANTS.DEFAULT_API_PORT))
      ),

      apiKey: String(s.apiKey || '')
        .replace(/[^a-zA-Z0-9\-_]/g, '')
        .slice(0, 128),

      apiEnabled: s.apiEnabled === true,

      // Other
      animSpeed: Math.min(10, Math.max(1, safeInt(s.animSpeed, 5))),
      saveHistory: s.saveHistory === true,

      // Hotkeys
      hotkeys: {
        clickThrough: safeKey(hk.clickThrough),
        clearChat: safeKey(hk.clearChat),
        hideOverlay: safeKey(hk.hideOverlay),
        openSettings: safeKey(hk.openSettings),
      },
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
