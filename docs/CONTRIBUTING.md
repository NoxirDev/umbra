# UMBRA - Руководство для контрибьюторов

> **Contributing Guide**
>
> Спасибо за интерес к улучшению UMBRA! Этот документ поможет вам внести вклад в проект.

---

## 📋 Оглавление

1. [Как начать](#как-начать)
2. [Стиль кода](#стиль-кода)
3. [Структура проекта](#структура-проекта)
4. [Процесс разработки](#процесс-разработки)
5. [Pull Request Guidelines](#pull-request-guidelines)
6. [Тестирование](#тестирование)
7. [Документация](#документация)
8. [Сообщество](#сообщество)

---

## 🚀 Как начать

### 1. Форк и клонирование

```bash
# 1. Форкните репозиторий на GitHub
# 2. Клонируйте свой форк
git clone https://github.com/YOUR_USERNAME/umbra.git
cd umbra

# 3. Добавьте upstream
git remote add upstream https://github.com/NoxirDev/umbra.git

# 4. Установите зависимости
npm install
```

### 2. Создайте ветку

```bash
# Синхронизируйте с upstream
git fetch upstream
git checkout main
git merge upstream/main

# Создайте feature branch
git checkout -b feature/your-feature-name
# или
git checkout -b fix/bug-description
```

### 3. Запустите проект

```bash
# Dev режим
npm run dev

# Обычный запуск
npm start
```

---

## 💻 Стиль кода

### JavaScript

**Общие правила:**
- Используйте **2 пробела** для отступов
- **Точка с запятой** обязательна
- **camelCase** для переменных и функций
- **PascalCase** для классов
- **UPPER_CASE** для констант

**Примеры:**

```javascript
// ✅ Хорошо
class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.settings = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[Settings] Failed to load:', error.message);
    }
    return this.getDefaults();
  }
}

// ❌ Плохо
class settingsmanager {
    constructor(){
        this.settingsPath=path.join(app.getPath('userData'),'settings.json')
        this.settings=this.load()
    }

    load(){
        try{
            if(fs.existsSync(this.settingsPath)){
                const data=fs.readFileSync(this.settingsPath,'utf8')
                return JSON.parse(data)
            }
        }catch(error){
            console.error('[Settings] Failed to load:',error.message)
        }
        return this.getDefaults()
    }
}
```

### Комментарии

**JSDoc для публичных методов:**

```javascript
/**
 * Load settings from disk with error handling
 * @returns {Object} Settings object
 */
load() {
  // ...
}

/**
 * Save settings to disk
 * @param {Object} settings - Settings to save
 * @returns {boolean} Success status
 */
save(settings) {
  // ...
}
```

**Inline комментарии для сложной логики:**

```javascript
// Check if cursor is over UI elements
let overUI = false;
for (const b of this.ctUIBounds) {
  if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) {
    overUI = true;
    break;
  }
}
```

### HTML/CSS

**HTML:**
- Используйте **2 пробела** для отступов
- **Lowercase** для тегов и атрибутов
- **Двойные кавычки** для атрибутов

**CSS:**
- **kebab-case** для классов
- **Группируйте** связанные свойства
- **Комментируйте** секции

```css
/* ── THEME PREVIEW ── */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 12px;
}

.theme-card {
  background: var(--void);
  border: 2px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all .3s;
}
```

---

## 📁 Структура проекта

### Где добавлять код:

**Main Process (Node.js):**
```
src/main/
  ├── index.js           # Точка входа (редко меняется)
  ├── api-v2.js          # API endpoints
  ├── settings.js        # Настройки
  ├── statistics.js      # Статистика
  ├── notifications.js   # Уведомления
  ├── windows.js         # Окна
  ├── tray.js            # Трей
  └── ipc-handlers.js    # IPC
```

**Renderer Process (Browser):**
```
src/renderer/
  ├── overlay/           # Главный оверлей
  │   ├── ui/           # UI модули (chat, donations, goal)
  │   ├── services/     # Интеграции (twitch, kick, youtube)
  │   └── utils/        # Утилиты
  ├── settings/         # Окно настроек
  ├── obs/              # OBS страницы
  └── web/              # Web Dashboard
```

**Shared:**
```
src/shared/
  ├── constants.js      # Константы
  └── utils.js          # Общие утилиты
```

### Создание нового модуля:

**1. Main Process модуль:**

```javascript
// src/main/my-module.js
class MyModule {
  constructor(dependencies) {
    this.dep = dependencies;
  }

  initialize() {
    // Инициализация
  }

  cleanup() {
    // Очистка ресурсов
  }
}

module.exports = MyModule;
```

**2. Интеграция в index.js:**

```javascript
const MyModule = require('./my-module');

const myModule = new MyModule(dependencies);
myModule.initialize();

app.on('before-quit', () => {
  myModule.cleanup();
});
```

**3. Renderer модуль:**

```javascript
// src/renderer/overlay/ui/my-ui.js
(function() {
  'use strict';

  function initialize() {
    // Инициализация UI
  }

  function render() {
    // Рендеринг
  }

  // Export to global
  window.MyUI = {
    initialize,
    render
  };
})();
```

---

## 🔄 Процесс разработки

### 1. Выберите задачу

**Где искать:**
- [Issues](https://github.com/NoxirDev/umbra/issues) - открытые задачи
- [Projects](https://github.com/NoxirDev/umbra/projects) - roadmap
- Метки: `good first issue`, `help wanted`, `bug`, `enhancement`

**Перед началом:**
- Проверьте, что никто не работает над этой задачей
- Оставьте комментарий, что берёте задачу
- Обсудите подход, если задача сложная

### 2. Разработка

**Workflow:**

```bash
# 1. Создайте ветку
git checkout -b feature/my-feature

# 2. Пишите код
# ... coding ...

# 3. Коммитьте часто
git add .
git commit -m "feat: add new feature"

# 4. Синхронизируйте с upstream
git fetch upstream
git rebase upstream/main

# 5. Пушьте в свой форк
git push origin feature/my-feature
```

**Commit messages:**

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add statistics export
fix: resolve memory leak in chat
docs: update API documentation
style: format code with prettier
refactor: simplify settings manager
perf: optimize WebSocket broadcast
test: add unit tests for statistics
chore: update dependencies
```

### 3. Тестирование

**Перед PR обязательно:**

```bash
# 1. Запустите приложение
npm start

# 2. Проверьте основной функционал
- Открытие оверлея
- Настройки
- API endpoints
- Интеграции

# 3. Проверьте ваши изменения
- Работает ли новая функция?
- Не сломалось ли что-то старое?
- Нет ли ошибок в консоли?

# 4. Проверьте производительность
- Нет ли утечек памяти?
- Не увеличилось ли потребление CPU?
```

---

## 📝 Pull Request Guidelines

### Создание PR

**1. Заголовок:**

```
feat: Add statistics export functionality
fix: Resolve memory leak in chat rendering
docs: Update API documentation for v2.1.1
```

**2. Описание:**

```markdown
## Описание
Добавлена функция экспорта статистики в JSON формат.

## Изменения
- Добавлен метод `export()` в StatisticsManager
- Добавлен endpoint `GET /v2/statistics/export`
- Обновлена документация в FEATURES.md

## Тестирование
- [x] Экспорт работает корректно
- [x] JSON валидный
- [x] Импорт экспортированных данных работает

## Скриншоты
(если применимо)

## Связанные Issues
Closes #123
```

**3. Чеклист:**

```markdown
- [ ] Код соответствует стилю проекта
- [ ] Добавлены комментарии для сложной логики
- [ ] Обновлена документация (если нужно)
- [ ] Протестировано вручную
- [ ] Нет конфликтов с main
- [ ] Коммиты имеют понятные сообщения
```

### Review процесс

**Что проверяется:**
- ✅ Код работает
- ✅ Соответствует стилю
- ✅ Нет багов
- ✅ Производительность
- ✅ Безопасность
- ✅ Документация

**Возможные результаты:**
- ✅ **Approved** - PR принят, будет смержен
- 💬 **Changes requested** - нужны правки
- ❌ **Rejected** - PR не подходит

---

## 🧪 Тестирование

### Ручное тестирование

**Чек-лист для тестирования:**

```
Основной функционал:
[ ] Оверлей открывается
[ ] Настройки сохраняются
[ ] API работает
[ ] WebSocket подключается
[ ] Уведомления показываются

Интеграции:
[ ] Twitch чат работает
[ ] Donation Alerts работает
[ ] OBS страницы загружаются

Производительность:
[ ] Нет утечек памяти
[ ] CPU < 5%
[ ] Плавные анимации

Безопасность:
[ ] Нет XSS уязвимостей
[ ] Валидация входных данных
[ ] Rate limiting работает
```

### Автоматическое тестирование

**TODO:** Добавить unit тесты (планируется)

```bash
# Когда будет готово:
npm test
```

---

## 📚 Документация

### Что документировать:

**1. Код:**
```javascript
/**
 * Calculate donation statistics
 * @param {Array} donations - Array of donation objects
 * @returns {Object} Statistics object with totals and averages
 */
function calculateStats(donations) {
  // ...
}
```

**2. API endpoints:**
```markdown
### GET /v2/statistics/export

Экспортирует всю статистику в JSON формат.

**Response:**
```json
{
  "ok": true,
  "data": {
    "allTime": {...},
    "sessions": [...]
  }
}
```
```

**3. Новые функции:**

Обновите соответствующие файлы:
- `FEATURES.md` - описание функции
- `API.md` - если добавлены endpoints
- `README.md` - если это важная функция
- `CHANGELOG.md` - всегда

---

## 🤝 Сообщество

### Где общаться:

- **GitHub Issues** - вопросы, баги, предложения
- **GitHub Discussions** - общие обсуждения (если включено)
- **Pull Requests** - обсуждение кода
- **Telegram** - новости и обновления: [Umbra_Official_Noxir](https://t.me/Umbra_Official_Noxir)

### Code of Conduct:

- ✅ Будьте вежливы и уважительны
- ✅ Конструктивная критика
- ✅ Помогайте новичкам
- ❌ Оскорбления и токсичность
- ❌ Спам и реклама

---

## 🎯 Приоритетные задачи

### Что нужно проекту:

**High Priority:**
- 🔴 Исправление критических багов
- 🟠 Улучшение производительности
- 🟡 Документация

**Medium Priority:**
- 🔵 Новые интеграции (StreamElements, Streamlabs)
- 🟣 Улучшение UI/UX
- 🟢 Новые темы

**Low Priority:**
- ⚪ Рефакторинг
- ⚪ Оптимизация кода
- ⚪ Дополнительные фичи

---

## 💡 Идеи для вклада

### Для начинающих:

- 📝 Исправление опечаток в документации
- 🎨 Создание новых тем
- 🌍 Перевод на другие языки
- 🐛 Исправление простых багов

### Для опытных:

- 🔌 Новые интеграции (7TV, BTTV, FFZ)
- ⚡ Оптимизация производительности
- 🧪 Написание тестов
- 🏗️ Рефакторинг архитектуры

### Для экспертов:

- 🔐 Аудит безопасности
- 📊 Система аналитики
- 🔌 Система плагинов
- 🤖 AI модерация чата

---

## 📞 Контакты

**Автор:** Noxir (KayROSir)
**GitHub:** [@NoxirDev](https://github.com/NoxirDev)
**Репозиторий:** https://github.com/NoxirDev/umbra
**Telegram:** [Umbra_Official_Noxir](https://t.me/Umbra_Official_Noxir)

**Вопросы?**
Открывайте [Issue](https://github.com/NoxirDev/umbra/issues/new)

---

## 🙏 Благодарности

Спасибо всем контрибьюторам за вклад в UMBRA!

**Список контрибьюторов:**
- Noxir (KayROSir) - автор и основной разработчик
- [Ваше имя здесь] - ваш вклад

---

**Версия:** 1.0
**Дата:** 2026-04-11

**Удачи в разработке! 🚀**
