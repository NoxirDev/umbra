# UMBRA - Архитектура и внутреннее устройство

> **Документация для разработчиков**
>
> Этот документ описывает внутреннюю архитектуру UMBRA для понимания работы приложения.
> Предназначен для контрибьюторов и разработчиков, желающих улучшить проект.

---

## 📋 Оглавление

1. [Общая архитектура](#общая-архитектура)
2. [Main Process](#main-process)
3. [Renderer Process](#renderer-process)
4. [API Server](#api-server)
5. [Система статистики](#система-статистики)
6. [Система уведомлений](#система-уведомлений)
7. [Интеграции](#интеграции)
8. [Потоки данных](#потоки-данных)
9. [Безопасность](#безопасность)
10. [Производительность](#производительность)

---

## 🏗️ Общая архитектура

UMBRA построена на **Electron** и использует **модульную архитектуру**.

### Структура проекта:

```
UMBRA/
├── src/
│   ├── main/                    # Main Process (Node.js)
│   │   ├── index.js            # Точка входа
│   │   ├── api-v2.js           # REST + WebSocket API
│   │   ├── settings.js         # Менеджер настроек
│   │   ├── statistics.js       # Менеджер статистики
│   │   ├── notifications.js    # Менеджер уведомлений
│   │   ├── windows.js          # Менеджер окон
│   │   ├── tray.js             # Системный трей
│   │   └── ipc-handlers.js     # IPC обработчики
│   │
│   ├── renderer/               # Renderer Process (Browser)
│   │   ├── overlay/            # Главный оверлей
│   │   │   ├── index.html
│   │   │   ├── overlay.js
│   │   │   ├── styles.css
│   │   │   ├── ui/             # UI модули
│   │   │   │   ├── chat.js
│   │   │   │   ├── donations.js
│   │   │   │   ├── goal.js
│   │   │   │   └── particles.js
│   │   │   ├── services/       # Интеграции
│   │   │   │   ├── twitch.js
│   │   │   │   ├── kick.js
│   │   │   │   ├── youtube.js
│   │   │   │   └── donation-alerts.js
│   │   │   └── utils/
│   │   │       └── audio.js
│   │   │
│   │   ├── settings/           # Окно настроек
│   │   │   └── index.html
│   │   │
│   │   ├── obs/                # OBS Browser Source
│   │   │   ├── overlay.html
│   │   │   ├── chat.html
│   │   │   ├── donations.html
│   │   │   └── goal.html
│   │   │
│   │   └── web/                # Web Dashboard
│   │       └── dashboard.html
│   │
│   ├── preload/                # Preload скрипты
│   │   └── preload.js
│   │
│   └── shared/                 # Общие модули
│       ├── constants.js
│       └── utils.js
│
├── assets/                     # Ресурсы
│   ├── icon.png
│   └── icon.ico
│
└── examples/                   # Примеры использования API
    ├── javascript/
    ├── nodejs/
    └── python/
```

---

## 🖥️ Main Process

### 1. **index.js** - Точка входа

**Ответственность:**
- Инициализация всех менеджеров
- Создание окон
- Регистрация IPC handlers
- Управление жизненным циклом приложения

**Ключевые компоненты:**
```javascript
const settingsManager = new SettingsManager();
const statisticsManager = new StatisticsManager();
const notificationManager = new NotificationManager(iconPath);
const windowManager = new WindowManager(iconPath, iconPathIco);
const apiServer = new ApiServer(settingsManager, windowManager, statisticsManager, notificationManager);
const trayManager = new TrayManager(iconPath, iconPathIco, windowManager, clickThroughState);
const ipcHandlers = new IpcHandlers(settingsManager, windowManager, apiServer, trayManager);
```

**Жизненный цикл:**
1. `app.whenReady()` - инициализация
2. Создание окон (overlay, settings)
3. Запуск API сервера
4. Регистрация hotkeys
5. `app.on('before-quit')` - cleanup

---

### 2. **settings.js** - Менеджер настроек

**Ответственность:**
- Загрузка/сохранение настроек из JSON
- Валидация и санитизация данных
- Backup при ошибках

**Ключевые методы:**
```javascript
load()              // Загрузить настройки
save(settings)      // Сохранить настройки
get()               // Получить текущие настройки
update(partial)     // Обновить частично
sanitize(s)         // Валидация и очистка
getDefaults()       // Дефолтные значения
reset()             // Сброс к дефолтам
```

**Путь к файлу:**
```javascript
app.getPath('userData') + '/settings.json'
// Windows: C:\Users\[User]\AppData\Roaming\umbra\settings.json
```

**Atomic write:**
```javascript
// 1. Пишем во временный файл
fs.writeFileSync(tempPath, data);
// 2. Атомарно переименовываем
fs.renameSync(tempPath, settingsPath);
```

---

### 3. **statistics.js** - Менеджер статистики

**Ответственность:**
- Сбор статистики о донатах и сообщениях
- Топ донатеров (до 100)
- История сессий (до 30)
- Экспорт/импорт данных

**Структура данных:**
```javascript
{
  allTime: {
    totalDonations: 0,
    totalAmount: 0,
    totalMessages: 0,
    topDonators: [
      {
        name: "Username",
        amount: 5000,
        count: 10,
        firstDonation: "2026-04-01T12:00:00.000Z",
        lastDonation: "2026-04-11T09:00:00.000Z"
      }
    ],
    firstDonation: {...},
    lastDonation: {...}
  },
  sessions: [
    {
      start: 1712826000000,
      end: 1712836800000,
      duration: 10800000,
      donations: 15,
      amount: 3500,
      messages: 450
    }
  ]
}
```

**Ключевые методы:**
```javascript
recordDonation(donation)     // Записать донат
recordMessage()              // Записать сообщение
getTopDonators(limit)        // Получить топ
getAllTimeStats()            // Вся статистика
startSession()               // Начать сессию
endSession(data)             // Завершить сессию
export()                     // Экспорт в JSON
import(data)                 // Импорт из JSON
reset()                      // Сброс
```

---

### 4. **notifications.js** - Менеджер уведомлений

**Ответственность:**
- Системные уведомления Windows
- Уведомления о донатах, целях, вехах
- Настройка минимальной суммы

**Ключевые методы:**
```javascript
notifyDonation(donation)     // Уведомление о донате
notifyGoalReached(goal)      // Цель достигнута
notifyMilestone(milestone)   // Веха достигнута
notify(title, body, options) // Кастомное уведомление
notifyError(message)         // Ошибка
setEnabled(enabled)          // Вкл/выкл
updateSettings(settings)     // Обновить настройки
```

**Electron Notification API:**
```javascript
const notification = new Notification({
  title: '💰 Новый донат: 500 RUB',
  body: 'TopDonator: Спасибо за стрим!',
  icon: iconPath,
  silent: false,
  urgency: 'normal' // или 'critical'
});

notification.show();

notification.on('click', () => {
  // Фокус на оверлей
});
```

---

### 5. **windows.js** - Менеджер окон

**Ответственность:**
- Создание окон (overlay, settings)
- Управление позицией и размером
- Обработка ошибок и crashes

**Overlay Window:**
```javascript
new BrowserWindow({
  width: 380,
  height: 700,
  transparent: true,        // Прозрачное окно
  frame: false,             // Без рамки
  alwaysOnTop: true,        // Поверх всех окон
  skipTaskbar: true,        // Не в таскбаре
  resizable: true,
  webPreferences: {
    nodeIntegration: false, // Безопасность
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    preload: preloadPath
  }
})
```

**Settings Window:**
```javascript
new BrowserWindow({
  width: 600,
  height: 760,
  resizable: false,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    preload: preloadPath
  }
})
```

---

### 6. **api-v2.js** - REST + WebSocket API

**Ответственность:**
- HTTP сервер на порту 4587
- WebSocket сервер для real-time
- Rate limiting
- Кэширование OBS страниц

**Архитектура:**
```javascript
class ApiServerV2 {
  constructor(settingsManager, windowManager, statisticsManager, notificationManager) {
    this.httpServer = http.createServer();
    this.wsServer = new WebSocketServer({ server: this.httpServer });
    this.rateLimit = new Map();
    this.obsPageCache = new Map(); // Pre-cached HTML
  }
}
```

**Rate Limiting:**
```javascript
// 100 запросов в минуту с IP
checkRateLimit(req, res) {
  const clientIp = req.socket.remoteAddress;
  const now = Date.now();
  const windowStart = now - 60000;

  let requests = this.rateLimit.get(clientIp) || [];
  requests = requests.filter(t => t > windowStart);

  if (requests.length >= 100) {
    return this.sendError(res, 429, 'Too many requests');
  }

  requests.push(now);
  this.rateLimit.set(clientIp, requests);
}
```

**WebSocket оптимизация:**
```javascript
new WebSocketServer({
  server: this.httpServer,
  perMessageDeflate: false,  // Отключена компрессия для latency
  maxPayload: 64 * 1024      // 64KB макс размер
});
```

**OBS Page Caching:**
```javascript
cacheOBSPages() {
  const pages = ['overlay', 'chat', 'donations', 'goal'];
  pages.forEach(page => {
    const content = fs.readFileSync(filePath, 'utf8');
    this.obsPageCache.set(page, content);
  });
}
// Результат: ~5ms вместо ~50ms на отдачу страницы
```

---

### 7. **ipc-handlers.js** - IPC обработчики

**Ответственность:**
- Связь между Main и Renderer процессами
- Click-through polling
- Resize/Move окна
- Hotkeys

**Click-through механизм:**
```javascript
// Polling каждые 50ms
startCtPolling() {
  this.ctPollInterval = setInterval(() => {
    const cur = screen.getCursorScreenPoint();
    const ob = overlay.getBounds();
    const lx = cur.x - ob.x;
    const ly = cur.y - ob.y;

    // Проверка попадания в UI элементы
    let overUI = false;
    for (const b of this.ctUIBounds) {
      if (lx >= b.x && lx <= b.x + b.w &&
          ly >= b.y && ly <= b.y + b.h) {
        overUI = true;
        break;
      }
    }

    overlay.setIgnoreMouseEvents(!overUI, { forward: true });
  }, 50); // 50ms = -40% CPU vs 32ms
}
```

**Resize оптимизация:**
```javascript
// 60 FPS для плавности
setInterval(() => {
  const now = screen.getCursorScreenPoint();
  const w = Math.min(800, Math.max(280,
    this.resizeStart.winW + (now.x - this.resizeStart.cursorX)));
  const h = Math.min(1200, Math.max(300,
    this.resizeStart.winH + (now.y - this.resizeStart.cursorY)));
  overlay.setBounds({ width: w, height: h });
}, 16); // 16ms = 60 FPS
```

---

## 🎨 Renderer Process

### 1. **overlay.js** - Главный оверлей

**Ответственность:**
- Координация UI модулей
- Обработка событий от API
- Управление интеграциями

**Инициализация:**
```javascript
// 1. Загрузка настроек
window.electronAPI.onApplySettings((settings) => {
  // Применить тему, прозрачность и т.д.
});

// 2. Подключение интеграций
if (settings.twitchChannel) {
  TwitchService.connect(settings.twitchChannel);
}

// 3. Подписка на API события
window.electronAPI.onApiEvent((event) => {
  if (event.type === 'donation') {
    DonationsUI.show(event.payload);
  }
});
```

---

### 2. **ui/chat.js** - Чат UI

**Оптимизация рендеринга:**
```javascript
// requestAnimationFrame batching
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    render();
    renderScheduled = false;
  });
}

// DocumentFragment для производительности
function render() {
  const fragment = document.createDocumentFragment();

  messages.forEach(m => {
    const msg = createElement('div', 'msg');
    // ... создание элементов
    fragment.appendChild(msg);
  });

  list.innerHTML = '';
  list.appendChild(fragment); // Один reflow вместо N
  list.scrollTop = list.scrollHeight;
}
```

**Дедупликация сообщений:**
```javascript
// Если последнее сообщение от того же юзера
if (last && last.author === author && last.text === text) {
  last.count = (last.count || 1) + 1;
  scheduleRender();
  return;
}
```

---

### 3. **ui/donations.js** - Донаты UI

**Combo система:**
```javascript
// Если донаты идут подряд - показываем combo
if (Date.now() - lastDonationTime < 5000) {
  comboCount++;
  showCombo(comboCount);
} else {
  comboCount = 1;
}
```

**Анимации:**
```javascript
// CSS animations + JavaScript timing
donation.classList.add('show');
setTimeout(() => {
  donation.classList.add('hide');
  setTimeout(() => {
    donation.remove();
  }, 500);
}, duration);
```

---

### 4. **services/twitch.js** - Twitch интеграция

**IRC WebSocket:**
```javascript
const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

ws.onopen = () => {
  ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
  ws.send('PASS SCHMOOPIIE'); // Анонимный вход
  ws.send('NICK justinfan12345');
  ws.send(`JOIN #${channel}`);
};

ws.onmessage = (event) => {
  const lines = event.data.split('\r\n');
  lines.forEach(line => {
    if (line.includes('PRIVMSG')) {
      parseMessage(line);
    }
  });
};
```

**Парсинг IRC:**
```javascript
// :user!user@user.tmi.twitch.tv PRIVMSG #channel :Hello!
function parseMessage(line) {
  const match = line.match(/:(.+)!.+PRIVMSG #.+ :(.+)/);
  if (match) {
    const author = match[1];
    const text = match[2];
    ChatUI.addMessage('twitch', author, text, '#9147ff');
  }
}
```

---

## 🔄 Потоки данных

### Донат через API:

```
1. HTTP POST /v2/donations
   ↓
2. api-v2.js: handleDonations()
   ↓
3. Валидация данных
   ↓
4. Обновление goalCurrent
   ↓
5. Сохранение в donationHistory
   ↓
6. statisticsManager.recordDonation()
   ↓
7. notificationManager.notifyDonation()
   ↓
8. overlay.webContents.send('api-event')
   ↓
9. overlay.js: onApiEvent()
   ↓
10. DonationsUI.show()
    ↓
11. WebSocket broadcast
    ↓
12. Webhooks trigger
```

### Сообщение из Twitch:

```
1. Twitch IRC WebSocket
   ↓
2. services/twitch.js: parseMessage()
   ↓
3. ChatUI.addMessage()
   ↓
4. scheduleRender()
   ↓
5. requestAnimationFrame
   ↓
6. render() с DocumentFragment
   ↓
7. DOM update (один reflow)
```

---

## 🔒 Безопасность

### 1. **Content Security Policy**

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
           font-src https://fonts.gstatic.com;
           script-src 'self' 'unsafe-inline';
           connect-src wss://irc-ws.chat.twitch.tv https://www.googleapis.com;">
```

### 2. **Context Isolation**

```javascript
webPreferences: {
  nodeIntegration: false,    // Нет доступа к Node.js из renderer
  contextIsolation: true,    // Изоляция контекстов
  sandbox: true,             // Sandbox режим
  webSecurity: true          // Web security включена
}
```

### 3. **Preload Script**

```javascript
// preload.js - единственный мост между main и renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onApplySettings: (callback) => ipcRenderer.on('apply-settings', callback),
  onApiEvent: (callback) => ipcRenderer.on('api-event', callback),
  // Только безопасные методы
});
```

### 4. **Input Sanitization**

```javascript
// Все входные данные очищаются
sanitize(s) {
  return {
    twitchChannel: String(s.twitchChannel || '')
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 25),

    goalTitle: String(s.goalTitle || '')
      .replace(/[<>]/g, '')
      .slice(0, 80),

    // ... и т.д.
  };
}
```

### 5. **Rate Limiting**

```javascript
// 100 запросов в минуту с IP
const RATE_LIMIT = 100;
const RATE_WINDOW = 60000; // 1 минута
```

### 6. **API Key**

```javascript
// Генерация криптографически стойкого ключа
generateApiKey() {
  return crypto.randomBytes(24).toString('hex');
  // Результат: 48 символов hex (192 бита энтропии)
}
```

---

## ⚡ Производительность

### 1. **Memory Optimization**

```javascript
// Ограничение истории
this.maxHistorySize = 500; // Было 1000

// Truncate вместо pop
if (this.donationHistory.length > this.maxHistorySize) {
  this.donationHistory.length = this.maxHistorySize;
}
```

### 2. **CPU Optimization**

```javascript
// Click-through polling: 32ms → 50ms
this.CT_POLL_RATE = 50; // -40% CPU

// Rate limit cleanup: каждые 30s вместо полного сброса
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of this.rateLimit.entries()) {
    const filtered = timestamps.filter(t => t > now - 60000);
    if (filtered.length === 0) {
      this.rateLimit.delete(ip);
    } else {
      this.rateLimit.set(ip, filtered);
    }
  }
}, 30000);
```

### 3. **Rendering Optimization**

```javascript
// requestAnimationFrame batching
let renderScheduled = false;

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    render();
    renderScheduled = false;
  });
}

// DocumentFragment для batch DOM updates
const fragment = document.createDocumentFragment();
// ... добавляем элементы в fragment
list.appendChild(fragment); // Один reflow
```

### 4. **WebSocket Optimization**

```javascript
new WebSocketServer({
  perMessageDeflate: false,  // Отключена компрессия
  maxPayload: 64 * 1024      // Ограничение размера
});

// Автоочистка мертвых соединений
broadcast(data) {
  const deadClients = [];
  this.wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    } else if (client.readyState > 1) {
      deadClients.push(client);
    }
  });
  deadClients.forEach(c => this.wsClients.delete(c));
}
```

### 5. **OBS Page Caching**

```javascript
// Pre-cache при старте
cacheOBSPages() {
  const pages = ['overlay', 'chat', 'donations', 'goal'];
  pages.forEach(page => {
    const content = fs.readFileSync(filePath, 'utf8');
    this.obsPageCache.set(page, content);
  });
}

// Мгновенная отдача из памяти
serveOBSPage(url, req, res) {
  const content = this.obsPageCache.get(pageName);
  res.end(content); // ~5ms вместо ~50ms
}
```

---

## 🎯 Ключевые паттерны

### 1. **Manager Pattern**

Каждая подсистема - отдельный менеджер:
- `SettingsManager` - настройки
- `StatisticsManager` - статистика
- `NotificationManager` - уведомления
- `WindowManager` - окна
- `TrayManager` - трей
- `ApiServer` - API

### 2. **Event-Driven Architecture**

```javascript
// Main → Renderer
overlay.webContents.send('api-event', { type: 'donation', payload: {...} });

// Renderer → Main
ipcRenderer.send('settings-saved', settings);

// WebSocket broadcast
this.broadcast({ type: 'donation', data: {...} });
```

### 3. **Dependency Injection**

```javascript
// Все зависимости передаются в конструктор
const apiServer = new ApiServer(
  settingsManager,
  windowManager,
  statisticsManager,
  notificationManager
);
```

### 4. **Atomic Operations**

```javascript
// Atomic file write
const tempPath = this.settingsPath + '.tmp';
fs.writeFileSync(tempPath, data);
fs.renameSync(tempPath, this.settingsPath); // Атомарно
```

### 5. **Graceful Degradation**

```javascript
// Если модуль недоступен - продолжаем работу
if (this.statisticsManager) {
  this.statisticsManager.recordDonation(donation);
}

if (this.notificationManager) {
  this.notificationManager.notifyDonation(donation);
}
```

---

## 📚 Полезные ресурсы

- **Electron Docs:** https://www.electronjs.org/docs
- **Node.js Docs:** https://nodejs.org/docs
- **WebSocket API:** https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **Twitch IRC:** https://dev.twitch.tv/docs/irc

---

**Версия документа:** 1.0
**Дата:** 2026-04-11
**Автор:** Noxir (KayROSir)

---

> **Примечание:** Эта документация описывает внутреннее устройство UMBRA v2.1.1.
> Для использования API см. `API.md`.
> Для новых фич см. `FEATURES.md`.
