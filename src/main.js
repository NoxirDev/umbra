const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, nativeTheme, globalShortcut } = require('electron');
const http   = require('http');
const crypto = require('crypto');
const path = require('path');
const fs   = require('fs');

// Single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

// Block navigation & new windows
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('before-input-event', (e, input) => { if (input.key === 'F12') e.preventDefault(); });
});

// ── ICON ──
const iconPath    = path.join(__dirname, '..', 'assets', 'icon.png');
const iconPathIco = path.join(__dirname, '..', 'assets', 'icon.ico');

// ── SETTINGS ──
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { if (fs.existsSync(settingsPath)) return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
  return {};
}

function safeInt(val, def) { const n = parseInt(val); return isNaN(n) ? def : n; }

function sanitizeSettings(s) {
  const hk = s.hotkeys || {};
  function safeKey(k) { return String(k || '').replace(/[^a-zA-Z0-9+\-_ ]/g, '').slice(0, 30); }
  return {
    twitchChannel:    String(s.twitchChannel  || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 25),
    youtubeVideoId:   String(s.youtubeVideoId || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20),
    daToken:          String(s.daToken        || '').slice(0, 512),
    dxToken:          String(s.dxToken        || '').slice(0, 512),
    opacity:          Math.min(100, Math.max(20, safeInt(s.opacity, 85))),
    donationSound:    s.donationSound !== false,
    donationDuration: Math.min(60, Math.max(0, safeInt(s.donationDuration, 8))),
    compactMode:      s.compactMode === true,
    autoHide:         Math.min(300, Math.max(0, safeInt(s.autoHide, 0))),
    goalTitle:        String(s.goalTitle  || '').replace(/[<>]/g, '').slice(0, 80),
    goalTarget:       Math.max(0, safeInt(s.goalTarget, 0)),
    goalCurrent:      Math.max(0, safeInt(s.goalCurrent, 0)),
    chatFilter:       String(s.chatFilter || '').replace(/[<>]/g, '').slice(0, 500).toLowerCase(),
    kickChannel:      String(s.kickChannel  || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50),
    apiPort:          Math.min(65535, Math.max(1024, safeInt(s.apiPort, 4587))),
    apiKey:           String(s.apiKey || '').replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 128),
    apiEnabled:       s.apiEnabled === true,
    // New settings
    theme:            ['default','minimal','neon','dark','matrix'].includes(s.theme) ? s.theme : 'default',
    fontSize:         Math.min(18, Math.max(10, safeInt(s.fontSize, 13))),
    animSpeed:        Math.min(10, Math.max(1, safeInt(s.animSpeed, 5))),
    soundType:        ['default','bell','coin','fanfare','custom'].includes(s.soundType) ? s.soundType : 'default',
    soundVolume:      Math.min(100, Math.max(0, safeInt(s.soundVolume, 50))),
    saveHistory:      s.saveHistory === true,
    hotkeys: {
      clickThrough: safeKey(hk.clickThrough),
      clearChat:    safeKey(hk.clearChat),
      hideOverlay:  safeKey(hk.hideOverlay),
      openSettings: safeKey(hk.openSettings),
    },
  };
}

let currentSettings = loadSettings();

// ── WINDOWS ──
let overlayWindow  = null;
let settingsWindow = null;
let tray           = null;
let clickThroughEnabled = false;

function createOverlayWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    icon: process.platform === 'win32' ? iconPathIco : iconPath,
    width: 380, height: 700,
    x: width - 400, y: 50,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setOpacity((currentSettings.opacity || 85) / 100);
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow?.webContents.send('apply-settings', currentSettings);
  });
  overlayWindow.on('closed', () => { overlayWindow = null; clickThroughEnabled = false; });
}

function createSettingsWindow() {
  if (settingsWindow) { settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    icon: process.platform === 'win32' ? iconPathIco : iconPath,
    width: 600, height: 760,
    title: 'UMBRA — Настройки',
    resizable: false,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.webContents.on('did-finish-load', () => {
    settingsWindow?.webContents.send('settings-ready', currentSettings);
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '⚡ UMBRA  ·  Created by Noxir (KayROSir)', enabled: false },
    { type: 'separator' },
    { label: '👁 Показать оверлей', click: () => overlayWindow ? overlayWindow.show() : createOverlayWindow() },
    { label: '🙈 Скрыть оверлей',   click: () => overlayWindow?.hide() },
    { label: '⚙️ Настройки',        click: createSettingsWindow },
    { type: 'separator' },
    {
      label: clickThroughEnabled ? '🖱 Клики сквозь: ВКЛ' : '🖱 Клики сквозь: ВЫКЛ',
      click: () => {
        clickThroughEnabled = !clickThroughEnabled;
        if (clickThroughEnabled) {
          overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
          startCtPolling();
        } else {
          overlayWindow?.setIgnoreMouseEvents(false);
          stopCtPolling();
        }
        overlayWindow?.webContents.send('apply-settings', { ...currentSettings, _clickThrough: clickThroughEnabled });
        tray.setContextMenu(buildTrayMenu()); // обновляем label
      }
    },
    { type: 'separator' },
    { label: '❌ Выход',             click: () => app.quit() }
  ]);
}

function createTray() {
  const icoFile = process.platform === 'win32' && fs.existsSync(iconPathIco) ? iconPathIco : iconPath;
  const icon = fs.existsSync(icoFile) ? nativeImage.createFromPath(icoFile).resize({ width: 16, height: 16 }) : nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('UMBRA — Created by Noxir (KayROSir)');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => overlayWindow ? overlayWindow.show() : createOverlayWindow());
}


// ── UMBRA API SERVER ──────────────────────────────────────────────
let apiServer = null;

function generateApiKey() {
  return crypto.randomBytes(24).toString('hex');
}

function sendOverlayEvent(type, payload) {
  if (!overlayWindow) return false;
  overlayWindow.webContents.send('api-event', { type, payload });
  return true;
}

function startApiServer(port, apiKey) {
  if (apiServer) { try { apiServer.close(); } catch {} apiServer = null; }

  // Rate limiting
  const rateLimit = new Map();
  const rateLimitCleanup = setInterval(() => rateLimit.clear(), 60000);

  apiServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // Auth
    const key = req.headers['x-api-key'] || '';
    if (key !== apiKey) {
      res.writeHead(401);
      res.end(JSON.stringify({ ok: false, error: 'Invalid API key' }));
      return;
    }

    // Rate limit
    const clientIp = req.socket.remoteAddress;
    let reqs = (rateLimit.get(clientIp) || []).filter(t => t > Date.now() - 60000);
    if (reqs.length >= 100) { res.writeHead(429); res.end(JSON.stringify({ ok: false, error: 'Too many requests' })); return; }
    rateLimit.set(clientIp, [...reqs, Date.now()]);

    const url = req.url.split('?')[0];

    // GET /v1/status
    if (req.method === 'GET' && url === '/v1/status') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, version: '1.0', overlay: !!overlayWindow }));
      return;
    }

    // POST endpoints — parse body
    let body = '';
    const MAX_BODY_SIZE = 65536; // 64KB
    req.on('data', d => {
      body += d;
      if (body.length > MAX_BODY_SIZE) {
        res.writeHead(413); res.end(JSON.stringify({ ok: false, error: 'Payload too large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch { res.writeHead(400); res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' })); return; }

      // POST /v1/donation
      if (url === '/v1/donation') {
        const name    = String(data.name    || 'anonymous').slice(0, 100);
        const amount  = String(data.amount  || '0').slice(0, 20);
        const message = String(data.message || '').slice(0, 500);
        const currency= String(data.currency|| '').slice(0, 10);
        sendOverlayEvent('donation', { name, amount, message, currency });
        // Also save to goal
        currentSettings.goalCurrent = (currentSettings.goalCurrent || 0) + (parseFloat(amount) || 0);
        try { fs.writeFileSync(settingsPath, JSON.stringify(sanitizeSettings(currentSettings), null, 2)); } catch {}
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // POST /v1/message
      if (url === '/v1/message') {
        const platform = ['twitch','youtube','kick','da','dx'].includes(data.platform) ? data.platform : 'api';
        const author   = String(data.author || 'anonymous').slice(0, 100);
        const text     = String(data.text   || '').slice(0, 1000);
        const color    = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#a8a8b3';
        sendOverlayEvent('message', { platform, author, text, color });
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // POST /v1/alert
      if (url === '/v1/alert') {
        const title   = String(data.title   || 'ALERT').slice(0, 100);
        const text    = String(data.text    || '').slice(0, 500);
        const icon    = String(data.icon    || '📢').slice(0, 4);
        sendOverlayEvent('alert', { title, text, icon });
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // POST /v1/goal
      if (url === '/v1/goal') {
        if (data.current !== undefined) currentSettings.goalCurrent = Math.max(0, parseFloat(data.current) || 0);
        if (data.target  !== undefined) currentSettings.goalTarget  = Math.max(0, parseFloat(data.target)  || 0);
        if (data.title   !== undefined) currentSettings.goalTitle   = String(data.title).slice(0, 80);
        try { fs.writeFileSync(settingsPath, JSON.stringify(sanitizeSettings(currentSettings), null, 2)); } catch {}
        overlayWindow?.webContents.send('apply-settings', currentSettings);
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // POST /v1/clear-chat
      if (url === '/v1/clear-chat') {
        overlayWindow?.webContents.send('apply-settings', { ...currentSettings, _clearChat: true });
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // POST /v1/settings
      if (url === '/v1/settings') {
        if (data.theme) currentSettings.theme = data.theme;
        if (data.opacity !== undefined) currentSettings.opacity = Math.min(100, Math.max(20, parseInt(data.opacity) || 85));
        try { fs.writeFileSync(settingsPath, JSON.stringify(sanitizeSettings(currentSettings), null, 2)); } catch {}
        overlayWindow?.webContents.send('apply-settings', currentSettings);
        overlayWindow?.setOpacity(currentSettings.opacity / 100);
        res.writeHead(200); res.end(JSON.stringify({ ok: true })); return;
      }

      // GET /v1/stats
      if (req.method === 'GET' && url === '/v1/stats') {
        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          goal: {
            current: currentSettings.goalCurrent || 0,
            target: currentSettings.goalTarget || 0,
            title: currentSettings.goalTitle || ''
          },
          settings: {
            theme: currentSettings.theme || 'default',
            opacity: currentSettings.opacity || 85
          }
        }));
        return;
      }

      res.writeHead(404); res.end(JSON.stringify({ ok: false, error: 'Unknown endpoint' }));
    });
  });

  apiServer.on('error', (e) => {
    console.error('UMBRA API error:', e.message);
    settingsWindow?.webContents.send('api-error', { message: e.message, code: e.code });
  });

  apiServer.once('close', () => clearInterval(rateLimitCleanup));

  apiServer.listen(port, '127.0.0.1', () => {
    console.log('UMBRA API listening on http://127.0.0.1:' + port);
  });
}

function stopApiServer() {
  if (apiServer) { try { apiServer.close(); } catch {} apiServer = null; }
}

function applyApiSettings(settings) {
  if (settings.apiEnabled) {
    // Генерируем ключ если нет
    if (!settings.apiKey) {
      settings.apiKey = generateApiKey();
      currentSettings.apiKey = settings.apiKey;
      try { fs.writeFileSync(settingsPath, JSON.stringify(sanitizeSettings(currentSettings), null, 2)); } catch {}
      // Уведомляем settings окно
      settingsWindow?.webContents.send('settings-ready', currentSettings);
    }
    startApiServer(settings.apiPort || 4587, settings.apiKey);
  } else {
    stopApiServer();
  stopCtPolling();
  }
}

// ── GLOBAL HOTKEYS ──
function convertKey(k) {
  // Конвертим формат "Ctrl+Shift+F1" в формат Electron globalShortcut
  if (!k) return null;
  return k
    .replace(/\bCtrl\b/g,  'CommandOrControl')
    .replace(/\bAlt\b/g,   'Alt')
    .replace(/\bShift\b/g, 'Shift')
    .replace(/\bEnd\b/g,   'End')
    .replace(/\bHome\b/g,  'Home')
    .replace(/\bInsert\b/g,'Insert')
    .replace(/\bDelete\b/g,'Delete')
    .replace(/\bF(\d+)\b/g,'F$1')
    .trim();
}

function registerHotkeys(hk) {
  globalShortcut.unregisterAll();
  if (!hk) return;
  const reg = (key, fn) => {
    const k = convertKey(key);
    if (!k) return;
    try { globalShortcut.register(k, fn); } catch(e) { console.warn('Hotkey register failed:', k, e.message); }
  };
  reg(hk.clickThrough, () => {
    clickThroughEnabled = !clickThroughEnabled;
    if (clickThroughEnabled) {
      overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
      startCtPolling();
    } else {
      overlayWindow?.setIgnoreMouseEvents(false);
      stopCtPolling();
    }
    overlayWindow?.webContents.send('apply-settings', { ...currentSettings, _clickThrough: clickThroughEnabled });
    if (tray) tray.setContextMenu(buildTrayMenu());
  });
  reg(hk.clearChat, () => {
    overlayWindow?.webContents.send('apply-settings', { ...currentSettings, _clearChat: true });
  });
  reg(hk.hideOverlay, () => {
    if (overlayWindow?.isVisible()) overlayWindow.hide();
    else overlayWindow?.show();
  });
  reg(hk.openSettings, () => {
    settingsWindow ? settingsWindow.focus() : createSettingsWindow();
  });
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  createOverlayWindow();
  createSettingsWindow();
  createTray();
  applyApiSettings(currentSettings);
  registerHotkeys(currentSettings.hotkeys);
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('second-instance', () => { settingsWindow ? settingsWindow.focus() : createSettingsWindow(); });
app.on('window-all-closed', () => {
  // Не выходим — живём в трее. Выход только через меню трея (app.quit)
});
app.on('before-quit', () => {
  // Полная очистка всех ресурсов
  stopApiServer();
  if (resizeInterval) { clearInterval(resizeInterval); resizeInterval = null; }
  if (moveInterval)   { clearInterval(moveInterval);   moveInterval   = null; }
  if (tray) { tray.destroy(); tray = null; }
  if (overlayWindow  && !overlayWindow.isDestroyed())  { overlayWindow.destroy();  overlayWindow  = null; }
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.destroy(); settingsWindow = null; }
});

// ── IPC ──
ipcMain.on('settings-saved', (_e, s) => {
  // Handle special actions
  if (s._testDonation) {
    overlayWindow?.webContents.send('test-donation', { name: s.name || 'TestUser', amount: s.amount || 100 });
    return;
  }
  if (s._testAlert) {
    overlayWindow?.webContents.send('api-event', { type: 'alert', payload: { title: 'TEST ALERT', text: 'Это тестовый алерт', icon: '📢' } });
    return;
  }
  if (s._resetGoal) {
    currentSettings.goalCurrent = 0;
    fs.writeFileSync(settingsPath, JSON.stringify(sanitizeSettings(currentSettings), null, 2));
    overlayWindow?.webContents.send('goal-reset');
    return;
  }
  // Preserve goalCurrent from memory — settings UI doesn't send it
  const safe = sanitizeSettings({ ...s, goalCurrent: s.goalCurrent ?? currentSettings.goalCurrent ?? 0 });
  currentSettings = safe;
  try { fs.writeFileSync(settingsPath, JSON.stringify(safe, null, 2)); } catch {}
  overlayWindow?.webContents.send('apply-settings', safe);
  overlayWindow?.setOpacity(safe.opacity / 100);
  applyApiSettings(safe);
  registerHotkeys(safe.hotkeys);
});

ipcMain.on('request-settings', (e) => {
  e.sender.send('apply-settings', currentSettings);
});

ipcMain.on('set-opacity', (_e, value) => {
  overlayWindow?.setOpacity(Math.min(1, Math.max(0.2, parseFloat(value) || 0.85)));
});

ipcMain.on('toggle-click-through', (_e, enabled) => {
  clickThroughEnabled = !!enabled;
  if (clickThroughEnabled) {
    overlayWindow?.setIgnoreMouseEvents(true, { forward: true });
    startCtPolling();
  } else {
    overlayWindow?.setIgnoreMouseEvents(false);
    stopCtPolling();
  }
});

ipcMain.on('mouse-over-ui', (_e, overUI) => {
  // Deprecated — теперь используем polling в main
});

// ── CLICK-THROUGH POLLING ──
// Когда click-through включён — main сам следит за курсором и переключает setIgnoreMouseEvents
// Это нужно потому что при forward:true события mousemove в renderer не приходят
let ctPollInterval = null;
let ctUIBounds = null; // bounds UI элементов, присылает overlay

ipcMain.on('update-ui-bounds', (_e, bounds) => {
  ctUIBounds = bounds; // [{x,y,w,h}, ...]
});

function startCtPolling() {
  if (ctPollInterval) return;
  ctPollInterval = setInterval(() => {
    if (!clickThroughEnabled || !overlayWindow) return;
    const cur = screen.getCursorScreenPoint();
    const ob = overlayWindow.getBounds();
    // Переводим курсор в координаты окна
    const lx = cur.x - ob.x;
    const ly = cur.y - ob.y;
    // Проверяем все UI bounds
    let overUI = false;
    if (ctUIBounds && Array.isArray(ctUIBounds)) {
      for (const b of ctUIBounds) {
        if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) {
          overUI = true; break;
        }
      }
    }
    overlayWindow.setIgnoreMouseEvents(!overUI, { forward: true });
  }, 32); // ~30fps достаточно
}

function stopCtPolling() {
  if (ctPollInterval) { clearInterval(ctPollInterval); ctPollInterval = null; }
  ctUIBounds = null;
}

ipcMain.on('close-overlay',  () => overlayWindow?.hide());
ipcMain.on('open-settings',  createSettingsWindow);

ipcMain.on('resize-overlay', (_e, { width, height }) => {
  if (!overlayWindow) return;
  overlayWindow.setSize(
    Math.min(800,  Math.max(280, parseInt(width)  || 380)),
    Math.min(1200, Math.max(300, parseInt(height) || 700))
  );
});

// ── RESIZE TRACKING ──
// Main сам считает размер через getSize() — без проблем DPI scaling
let resizeInterval = null;
let resizeStart = null;

ipcMain.on('start-resize', (_e) => {
  if (!overlayWindow) return;
  const cur = screen.getCursorScreenPoint();
  const bounds = overlayWindow.getBounds(); // getBounds надёжнее getSize на DPI экранах
  resizeStart = { cursorX: cur.x, cursorY: cur.y, winW: bounds.width, winH: bounds.height };
  if (resizeInterval) clearInterval(resizeInterval);
  resizeInterval = setInterval(() => {
    if (!overlayWindow || !resizeStart) { clearInterval(resizeInterval); resizeInterval = null; return; }
    const now = screen.getCursorScreenPoint();
    const w = Math.min(800,  Math.max(280, resizeStart.winW + (now.x - resizeStart.cursorX)));
    const h = Math.min(1200, Math.max(300, resizeStart.winH + (now.y - resizeStart.cursorY)));
    overlayWindow.setBounds({ width: w, height: h }); // setBounds вместо setSize
  }, 16);
});

ipcMain.on('stop-resize', () => {
  if (resizeInterval) { clearInterval(resizeInterval); resizeInterval = null; }
  resizeStart = null;
});

// ── MOVE TRACKING ──
// Перемещение через IPC — webkit-app-region ненадежен на transparent окнах
let moveInterval = null;
let moveStart = null;

ipcMain.on('start-move', (_e) => {
  if (!overlayWindow) return;
  const cur = screen.getCursorScreenPoint();
  const bounds = overlayWindow.getBounds();
  moveStart = { cursorX: cur.x, cursorY: cur.y, winX: bounds.x, winY: bounds.y };
  if (moveInterval) clearInterval(moveInterval);
  moveInterval = setInterval(() => {
    if (!overlayWindow || !moveStart) { clearInterval(moveInterval); moveInterval = null; return; }
    const now = screen.getCursorScreenPoint();
    overlayWindow.setBounds({
      x: moveStart.winX + (now.x - moveStart.cursorX),
      y: moveStart.winY + (now.y - moveStart.cursorY),
    });
  }, 16);
});

ipcMain.on('stop-move', () => {
  if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
  moveStart = null;
});
