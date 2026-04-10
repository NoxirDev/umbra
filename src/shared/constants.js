// UMBRA Constants
module.exports = {
  APP_NAME: 'UMBRA',
  APP_VERSION: '2.1.0',
  AUTHOR: 'Noxir (KayROSir)',

  // Window sizes
  OVERLAY_WIDTH: 380,
  OVERLAY_HEIGHT: 700,
  SETTINGS_WIDTH: 600,
  SETTINGS_HEIGHT: 760,

  // Limits
  MAX_MESSAGES: 100,
  MAX_RECONNECT_ATTEMPTS: 10,

  // API
  DEFAULT_API_PORT: 4587,
  API_RATE_LIMIT: 100, // requests per minute
  MAX_BODY_SIZE: 65536, // 64KB

  // Settings limits
  OPACITY_MIN: 20,
  OPACITY_MAX: 100,
  OPACITY_DEFAULT: 85,

  AUTOHIDE_MIN: 0,
  AUTOHIDE_MAX: 300,

  DONATION_DURATION_MIN: 0,
  DONATION_DURATION_MAX: 60,
  DONATION_DURATION_DEFAULT: 8,

  FONT_SIZE_MIN: 10,
  FONT_SIZE_MAX: 18,
  FONT_SIZE_DEFAULT: 13,

  SOUND_VOLUME_MIN: 0,
  SOUND_VOLUME_MAX: 100,
  SOUND_VOLUME_DEFAULT: 50,

  // Themes
  THEMES: ['default', 'minimal', 'neon', 'dark', 'matrix'],
  SOUND_TYPES: ['default', 'bell', 'coin', 'fanfare', 'custom'],

  // WebSocket URLs
  TWITCH_WS: 'wss://irc-ws.chat.twitch.tv:443',
  KICK_WS: 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false',
  DA_WS: 'wss://socket.donationalerts.ru:443/socket.io/?EIO=4&transport=websocket',

  // YouTube API
  YOUTUBE_API_BASE: 'https://www.googleapis.com/youtube/v3',
  YOUTUBE_POLL_INTERVAL: 5000,

  // Reconnect delays
  RECONNECT_BASE_DELAY: 2000,
  RECONNECT_MAX_DELAY: 30000,

  // Combo
  COMBO_TIMEOUT: 5000,

  // Platform colors
  PLATFORM_COLORS: {
    twitch: '#9147ff',
    youtube: '#ff0000',
    kick: '#53fc18',
    da: '#ffffff',
    api: '#ffc832',
  },
};
