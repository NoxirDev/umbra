# UMBRA

**Stream Overlay by Noxir**

Стриминговый оверлей для показа донатов и чата на трансляциях.

## Версия
2.1.0

## Технологии
- Electron 39.8.0
- Node.js
- WebSocket (Twitch, Kick)
- REST API

## Интеграции
- Twitch
- YouTube
- Kick
- DonationAlerts
- DonatePay

## Возможности
- Прозрачный оверлей поверх всех окон
- Анимированные донаты
- Чат из разных платформ
- Прогресс-бар цели сбора
- 5 тем оформления (default, minimal, neon, dark, matrix)
- Режим "клик сквозь"
- Глобальные горячие клавиши
- HTTP API для интеграций
- Работа в системном трее

## API Server
По умолчанию запускается на `http://127.0.0.1:4587`

### Эндпоинты
- `GET /v1/status` - статус оверлея
- `POST /v1/donation` - отправка доната
- `POST /v1/message` - отправка сообщения в чат
- `POST /v1/alert` - показ алерта
- `POST /v1/goal` - обновление цели
- `POST /v1/clear-chat` - очистка чата
- `POST /v1/settings` - изменение настроек
- `GET /v1/stats` - получение статистики

## Структура проекта
```
UMBRA/
├── src/
│   ├── main.js         # Main process
│   ├── preload.js      # Preload script
│   ├── overlay.html    # Overlay window
│   └── settings.html   # Settings window
├── assets/
│   └── icon.*          # App icons
└── package.json
```

## Автор
Created by Noxir (KayROSir)

## Лицензия
MIT
