# UMBRA Changelog

## v2.1.1 - 2026-04-11

### 🐛 Bug Fixes
- Fixed `eventHistory` undefined error in `/v2/stats` endpoint
- Updated version in constants.js (2.1.0 → 2.1.1)
- Added 'cyberpunk' theme to THEMES array
- Added WebSocket message validation (size and structure checks)

### ✨ New Features

#### 💜 Full Twitch Integration
- **Badges support** - broadcaster, moderator, VIP, subscriber, prime, turbo, partner, staff, admin
- **Emotes integration:**
  - Twitch native emotes from IRC tags
  - BTTV (BetterTTV) - global and channel emotes
  - FFZ (FrankerFaceZ) - global and channel emotes
  - 7TV - global and channel emotes
- **Events support:**
  - Subscriptions (sub/resub) with tier and months
  - Gifted subscriptions (single and mass gifts)
  - Raids with viewer count
  - Bits/Cheers with amount display
- **Enhanced IRC parsing** - full tag support with twitch.tv/tags, twitch.tv/commands, twitch.tv/membership
- **Automatic emote loading** - fetches emotes on channel connect
- **Visual improvements:**
  - Badge icons next to usernames
  - Inline emote rendering in messages
  - Bits indicator for cheers
  - Animated alerts for events

#### 📊 Statistics System
- **All-time statistics tracking** - donations, messages, total amounts
- **Top donators list** - tracks top 100 donators with amounts and counts
- **Session history** - stores last 30 streaming sessions
- **Export/Import** - backup and restore statistics in JSON format
- **New API endpoints:**
  - `GET /v2/statistics` - Get all-time stats
  - `GET /v2/statistics/top?limit=10` - Get top donators
  - `GET /v2/statistics/sessions?limit=10` - Get recent sessions
  - `GET /v2/statistics/export` - Export statistics
  - `POST /v2/statistics/import` - Import statistics
  - `POST /v2/statistics/reset` - Reset all statistics

#### 🔔 Desktop Notifications
- **Donation notifications** - system notifications for new donations
- **Goal notifications** - alerts when donation goal is reached
- **Milestone notifications** - custom milestone alerts
- **Configurable settings:**
  - Enable/disable per notification type
  - Minimum donation amount threshold
  - Click notification to focus overlay window

#### 📱 Web Dashboard
- **Full-featured web interface** at `http://127.0.0.1:4587`
- **Real-time statistics** - goal progress, session stats, all-time stats
- **Top donators display** - visual leaderboard with rankings
- **Quick actions** - test donation, clear chat, refresh stats
- **Send messages** - post messages to overlay chat from browser
- **WebSocket integration** - live updates without page refresh
- **Mobile responsive** - works on phones and tablets

#### 🎨 Theme Preview
- **Visual theme selector** - see themes before applying
- **Interactive cards** - click to select theme
- **Live preview** - shows goal bar, messages, and donations
- **6 themes available:**
  - Default (Green)
  - Cyberpunk (Red/Cyan)
  - Minimal (Monochrome)
  - Neon (Bright colors)
  - Dark (Purple)
  - Matrix (Green matrix)

### 📝 Documentation
- Added `FEATURES.md` - detailed documentation for new features
- Updated `README.md` - changelog and feature list
- Updated `package.json` - version and description

### 🏗️ Technical Changes
- New module: `src/main/statistics.js` - Statistics manager
- New module: `src/main/notifications.js` - Notification manager
- New file: `src/renderer/web/dashboard.html` - Web dashboard
- Updated: `src/main/index.js` - Integrated new modules
- Updated: `src/main/api-v2.js` - New endpoints and notifications
- Updated: `src/main/settings.js` - Notification settings
- Updated: `src/renderer/settings/index.html` - Theme preview UI

### 📦 File Structure
```
src/
  main/
    statistics.js          ← NEW
    notifications.js       ← NEW
  renderer/
    web/
      dashboard.html       ← NEW
```

### 🎯 Next Steps (Planned)
- [ ] Full Twitch integration (badges, emotes, 7TV/BTTV)
- [ ] Theme customization UI
- [ ] Multiple goals support
- [ ] Plugin system
- [ ] StreamElements integration
- [ ] Telegram bot

---

## v2.1.0 - 2026-04-10
- Added theme system (6 themes)
- Added OBS integration (4 overlay types)
- Added API v2 with WebSocket
- Added electron-builder configuration

## v2.0.0 - 2026-04-09
- Initial modular architecture
- Refactored to 34 files
- Improved performance
