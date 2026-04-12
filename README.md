# UMBRA

<div align="center">

![UMBRA Logo](https://img.shields.io/badge/UMBRA-v2.1.1-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-33.0.0-47848F?style=for-the-badge&logo=electron)
![Node](https://img.shields.io/badge/Node.js-Latest-339933?style=for-the-badge&logo=node.js)

**Professional Stream Overlay for Twitch, YouTube, Kick**

Мощный и оптимизированный оверлей для стримеров с поддержкой донатов, чата и интеграций.

[Features](#-features) • [Installation](#-installation) • [API Docs](docs/API.md) • [Contributing](#-contributing) • [Changelog](#-changelog)

</div>

---

## ✨ Features

### 🎨 Визуал и темы
- 🌈 **6 тем оформления**: default, cyberpunk, minimal, neon, dark, matrix
- 🎭 Прозрачный оверлей поверх всех окон
- ✨ Анимированные донаты с эффектами
- 🎯 Прогресс-бар цели сбора
- 🖱️ Режим "клик сквозь" для работы с другими окнами

### 🔌 Интеграции
- 💜 **Twitch** - расширенная интеграция с badges, emotes (BTTV/FFZ/7TV), событиями (subs, bits, raids)
- 🔴 **YouTube** - live chat
- 🟢 **Kick** - чат и донаты
- 💰 **DonationAlerts** - донаты и алерты
- 💸 **DonatePay** - донаты

### 🚀 API v2 (NEW!)
- 📡 **REST API** + **WebSocket** для real-time событий
- 🔐 API key authentication с localhost bypass
- 📊 Rate limiting и защита от перегрузок
- 🎬 **OBS Integration** - 4 типа оверлеев для Browser Source
- 📝 Полная документация в [API.md](docs/API.md)

### ⚡ Производительность (v2.1.1)
- 🧠 **Memory: -20%** (~150MB → ~120MB)
- ⚙️ **CPU: -40%** (~5-8% → ~3-5%)
- 🚄 **OBS pages: -90% latency** (~50ms → ~5ms)
- 🎯 Оптимизированный рендеринг с requestAnimationFrame
- 💾 Pre-caching OBS страниц для мгновенной отдачи

### 🆕 Новое в v2.1.1
- 📊 **Расширенная статистика** - топ донатеров, история сессий
- 🔔 **Desktop уведомления** - донаты, достижение целей
- 📱 **Web Dashboard** - управление через браузер (http://127.0.0.1:4587)
- 📈 **API для статистики** - экспорт/импорт данных
- 💜 **Полная интеграция Twitch** - badges, emotes (BTTV/FFZ/7TV), события (subs/bits/raids)

### 🛠️ Дополнительно
- ⌨️ Глобальные горячие клавиши
- 🔔 Работа в системном трее
- 💾 Backup/restore настроек
- 🎛️ Модульная архитектура (34 файла, 8000+ строк)

---

## 📦 Installation

### Требования
- Windows 10/11
- Node.js 18+ (для разработки)

### Быстрый старт

```bash
# Клонировать репозиторий
git clone https://github.com/NoxirDev/umbra.git
cd umbra

# Установить зависимости
npm install

# Запустить приложение
npm start
```

### Разработка

```bash
# Dev режим с инспектором
npm run dev

# Сборка (требует admin права на Windows)
npm run build:win
```

---

## 🎯 API v2

**Base URL:** `http://127.0.0.1:4587`
**WebSocket:** `ws://127.0.0.1:4587`

### Quick Example

```javascript
// Отправить донат
fetch('http://127.0.0.1:4587/v2/donations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({
    name: 'John Doe',
    amount: '100',
    message: 'Great stream!',
    currency: 'RUB'
  })
});

// WebSocket подключение
const ws = new WebSocket('ws://127.0.0.1:4587?key=your_api_key');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.data);
};
```

**Полная документация:** [API.md](docs/API.md)

**Дополнительная документация:** [docs/](docs/)
- [Быстрый старт](docs/QUICKSTART.md)
- [Подключение к Twitch](docs/TWITCH_SETUP.md) 💜
- [Новые возможности v2.1.1](docs/FEATURES.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [Руководство для контрибьюторов](docs/CONTRIBUTING.md)
- [История изменений](docs/CHANGELOG.md)

---

## 🏗️ Project Structure

```
UMBRA/
├── src/
│   ├── main/                    # Main process
│   │   ├── index.js            # Entry point
│   │   ├── api-v2.js           # REST + WebSocket API
│   │   ├── settings.js         # Settings manager
│   │   ├── windows.js          # Window manager
│   │   ├── tray.js             # System tray
│   │   └── ipc-handlers.js     # IPC handlers
│   ├── renderer/               # Renderer processes
│   │   ├── overlay/            # Main overlay
│   │   ├── settings/           # Settings window
│   │   └── obs/                # OBS Browser Source pages
│   ├── shared/                 # Shared utilities
│   │   ├── constants.js
│   │   └── utils.js
│   └── preload/                # Preload scripts
├── assets/                     # Icons and resources
├── examples/                   # API usage examples
├── API.md                      # API documentation
├── OPTIMIZATIONS.md            # Performance report
└── package.json
```

---

## 🤝 Contributing

Мы приветствуем вклад от сообщества! UMBRA - это open-source проект, и каждый может помочь сделать его лучше.

### Как внести вклад?

1. **Fork** репозиторий
2. Создай **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** изменения (`git commit -m 'Add amazing feature'`)
4. **Push** в branch (`git push origin feature/amazing-feature`)
5. Открой **Pull Request**

### Что можно улучшить?

- 🎨 Новые темы оформления
- 🔌 Дополнительные интеграции (StreamElements, Streamlabs, VK Donut)
- 🎮 Новые виджеты (топ донатеры, счётчик зрителей, таймер стрима)
- 🌍 Переводы на другие языки
- 📝 Улучшение документации
- 🐛 Исправление багов
- ⚡ Оптимизация производительности

### Guidelines

- Следуй существующему стилю кода
- Добавляй комментарии для сложной логики
- Тестируй изменения перед PR
- Обновляй документацию при необходимости

### Нужна помощь?

- 📖 Читай [API.md](docs/API.md) для понимания API
- 💬 Открывай [Issues](https://github.com/NoxirDev/umbra/issues) для вопросов
- 🐛 Сообщай о багах через Issues
- 📢 Следи за новостями в [Telegram](https://t.me/Umbra_Official_Noxir)

---

## 📋 Changelog

### v2.1.1 (2026-04-11) - Performance & Features Update

**Новые функции:**
- 💜 **Полная интеграция Twitch** - badges, emotes (BTTV/FFZ/7TV), события (subs/bits/raids)
- 📊 Расширенная статистика с топ донатерами
- 🔔 Desktop уведомления для донатов и целей
- 📱 Web Dashboard для управления через браузер
- 📈 API endpoints для статистики (/v2/statistics)
- 💾 Экспорт/импорт статистики

**Исправления:**
- ✅ Исправлена ошибка с eventHistory в API
- ✅ Добавлена тема 'cyberpunk' в список доступных
- ✅ Улучшена валидация WebSocket сообщений
- ✅ Обновлена версия в константах

**Оптимизации:**
- ⚡ API v2: Pre-caching OBS страниц, оптимизация rate limiting
- 🚀 WebSocket: отключен compression для низкой latency
- 💾 IPC: снижен polling с 32ms до 50ms (-40% CPU)
- 🎨 Renderer: requestAnimationFrame batching для плавного UI
- 🛡️ Settings: atomic write с auto-backup
- 📊 Детальный отчёт в [OPTIMIZATIONS.md](OPTIMIZATIONS.md)

**Результаты:**
- Memory: -20% (~150MB → ~120MB)
- CPU: -40% (~5-8% → ~3-5%)
- OBS pages latency: -90% (~50ms → ~5ms)

### v2.1.0 (2026-04-10)
- ✨ Добавлена система тем (6 вариантов)
- 🎬 OBS интеграция с 4 типами оверлеев
- 🔐 API v2 с WebSocket и localhost bypass
- 📦 Electron-builder конфигурация

---

## 👨‍💻 Author

**Noxir (KayROSir)**
- GitHub: [@NoxirDev](https://github.com/NoxirDev)
- Project: [UMBRA](https://github.com/NoxirDev/umbra)
- Telegram: [Umbra_Official_Noxir](https://t.me/Umbra_Official_Noxir)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for streamers**

⭐ Star this repo if you find it useful!

</div>
