# UMBRA

<div align="center">

![UMBRA Logo](https://img.shields.io/badge/UMBRA-v2.1.1-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-33.0.0-47848F?style=for-the-badge&logo=electron)
![Node](https://img.shields.io/badge/Node.js-Latest-339933?style=for-the-badge&logo=node.js)

**Professional Stream Overlay for Twitch** (YouTube и Kick в коде есть, но **временно отключены** в окне настроек — планируется доработка и возврат)

Мощный и оптимизированный оверлей для стримеров с поддержкой донатов, чата и интеграций.

[Features](#-features) • [Installation](#-installation) • [Запуск, API, OBS](#как-запустить-api-и-obs) • [API Docs](docs/API.md) • [Contributing](#-contributing) • [Changelog](#-changelog)

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
- 🔴 **YouTube** (live chat) — *временно отключено в настройках* (`src/renderer/settings/index.html`), модуль сохранён для будущего исправления
- 🟢 **Kick** (чат) — *временно отключено в настройках*, модуль сохранён для будущего исправления
- 💰 **DonationAlerts** - донаты и алерты

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

### 🛠️ Профессиональный установщик
- 📦 **Множество форматов**: NSIS, Portable, Inno Setup, AppX/MSIX
- 🖼️ **Кастомная графика** (welcome, header, sidebar) для установщика
- 🔐 **Подпись кода** с самоподписанным сертификатом (можно заменить на доверенный)
- 🏗️ **Кастомный NSIS скрипт** с проверкой системных требований
- 🔄 **Автоматические обновления** через electron-updater (готово к интеграции)
- 🚀 **CI/CD пайплайн** (GitHub Actions) для автоматических релизов
- 📄 **Генерация .appinstaller** для установки через Microsoft Store

### � Новое в v2.1.1
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
- 🧪 **Unit-тесты** для критических модулей (statistics, utils)

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

# Сборка установщиков (требует admin права на Windows)
npm run build:win          # NSIS установщик
npm run build:portable     # Portable версия
npm run build:appx         # AppX пакет для Microsoft Store
npm run build:all          # Все форматы

# Генерация сертификата подписи (требуется PowerShell)
npm run cert:create

# Генерация .appinstaller файла
npm run generate:appinstaller
```

### Установка для конечных пользователей
1. Скачайте последний релиз с [GitHub Releases](https://github.com/NoxirDev/umbra/releases)
2. Выберите нужный формат:
   - **UMBRA Setup.exe** – стандартный установщик с графическим интерфейсом
   - **UMBRA Portable.exe** – портативная версия без установки
   - **UMBRA.appinstaller** – установка через Microsoft Store (требуется Windows 10/11)
3. Запустите установщик и следуйте инструкциям.

**Примечание:** Установщик подписан самоподписанным сертификатом. При первом запуске Windows может предупредить о неизвестном издателе. Для доверенной установки рекомендуется использовать сертификат от доверенного центра сертификации.

---

## 🚀 Как запустить, API и OBS

### Запуск приложения

1. В каталоге проекта: `npm install` (один раз), затем **`npm start`** — откроются **оверлей** и **окно настроек**.
2. Иконка UMBRA в **системном трее**: правый клик → «Настройки» / «Показать оверлей».
3. В разделе **Connections** укажи Twitch и при необходимости DonationAlerts, нажми сохранение — оверлей подхватит настройки.

### Как работает встроенный API

- Пока UMBRA запущен, в main-процессе поднимается **локальный HTTP-сервер** (по умолчанию порт **`4587`**, только интерфейс **`127.0.0.1`**).
- **Включение:** настройки → **System → API** → включить API. При первом включении обычно **автоматически создаётся API key** (его можно скопировать в том же разделе).
- **REST** доступен по префиксу `/v2/…` (донаты, сообщения, цель, статистика и т.д. — см. [docs/API.md](docs/API.md)).
- **WebSocket** на том же хосте/порте: события в реальном времени для подписанных клиентов.
- **Запросы с этого же ПК** (`127.0.0.1` / `::1`): проверка ключа **часто не требуется** (localhost bypass). **С другого устройства в сети** доступ по IP к `4587` потребует **API key** в заголовке `X-API-Key` / `Authorization: Bearer …` или для WS — параметр `?key=…` (см. документацию API).
- **Web Dashboard:** в браузере на этой машине открой `http://127.0.0.1:4587` (или `/dashboard`) — когда API включён.

### Как подключить OBS (Browser Source)

1. Запусти **UMBRA** и убедись, что **API включён** (без этого страницы для OBS не отдаются).
2. В **OBS** добавь источник **Browser** (Browser Source).
3. В поле **URL** укажи адрес страницы оверлея на том же компьютере, где крутится UMBRA:

| Страница | Пример URL (тот же ПК) |
|----------|-------------------------|
| Полный оверлей | `http://127.0.0.1:4587/obs/overlay` |
| Только чат | `http://127.0.0.1:4587/obs/chat` |
| Донаты | `http://127.0.0.1:4587/obs/donations` |
| Цель | `http://127.0.0.1:4587/obs/goal` |

4. Задай **ширину/высоту** под сцену (например 1920×1080 для полного кадра или меньше для виджета).
5. Готовые ссылки с **подставленным ключом** можно взять в настройках UMBRA (раздел **OBS**), либо через API `GET /v2/obs/config` (когда используешь клиент с ключом).

**Важно:** OBS и UMBRA должны работать на **одной машине**, если используешь `127.0.0.1`. Для другого ПК в локальной сети подставь **IP компьютера с UMBRA** и при необходимости **`?key=…`** в URL.

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
- [Руководство по установщику](docs/INSTALLER_GUIDE.md) 📦

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
├── assets/                     # Icons and resources (включая графику для установщика)
├── certs/                      # Сертификаты для подписи кода
├── scripts/                    # Вспомогательные скрипты (генерация .appinstaller)
├── tests/                      # Unit-тесты
├── examples/                   # API usage examples
├── docs/                       # Документация
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
- 📦 Улучшение установщика (новые форматы, автоматизация)

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

### v2.1.1 (2026-04-14) - Installer Improvements

**Улучшения установщика:**
- 🖼️ Добавлены графические ресурсы для установщика (welcome.bmp, header.bmp, sidebar.bmp)
- 🔐 Обновлена конфигурация подписи кода (исправлены невалидные свойства)
- 🏗️ Создан кастомный NSIS скрипт с проверкой системных требований
- 🚀 Настроен CI/CD пайплайн (GitHub Actions) для автоматических релизов
- 🔄 Интегрирована поддержка автоматических обновлений через electron-updater
- 📦 Добавлены скрипты генерации сертификатов и .appinstaller файлов

**Исправления:**
- 🐛 Исправлена утечка таймеров в StatisticsManager (добавлен cleanup)
- 🧪 Обновлены unit-тесты с fake timers для предотвращения утечек
- 📝 Обновлена документация по установщику (docs/INSTALLER_GUIDE.md)

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
