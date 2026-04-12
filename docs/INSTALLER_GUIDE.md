# Создание профессионального установщика для UMBRA

## Текущая конфигурация

UMBRA уже использует Electron Builder с NSIS для создания установщиков Windows. Текущая конфигурация включает:

- **NSIS установщик** с поддержкой русского и английского языков
- **Portable версия** (без установки)
- **Настраиваемые параметры**: выбор директории, создание ярлыков
- **Информация для "Установка и удаление программ"**
- **Поддержка x64 архитектуры**

## Как создать установщик

### Требования
- Node.js 18+
- Windows 10/11 (для сборки Windows установщика)
- Административные права (для подписи кода)

### Команды сборки

```bash
# Установить зависимости
npm install

# Собрать NSIS установщик
npm run build:nsis

# Собрать portable версию
npm run build:portable

# Собрать все версии
npm run build:all

# Полная сборка (включая подпись, если настроена)
npm run build
```

### Где найти собранные файлы

Собранные установщики будут в директории `dist/`:
- `UMBRA-Setup-2.1.1.exe` - NSIS установщик
- `UMBRA-2.1.1-Portable.exe` - Portable версия
- `UMBRA-2.1.1-x64.exe` - Распакованное приложение

## Улучшение установщика до профессионального уровня

### 1. Подпись кода (Code Signing)

Для доверия Windows Defender и отсутствия предупреждений "Неизвестный издатель":

**Вариант A: Let's Encrypt (бесплатно)**
```bash
# Установить Azure Key Vault и настроить подпись
# Требуется Azure аккаунт
```

**Вариант B: Коммерческий сертификат**
- Купить код-сигнатурный сертификат у DigiCert, Sectigo, etc.
- Цена: ~$200-500 в год

**Настройка в package.json:**
```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "password",
  "signingHashAlgorithms": ["sha256"],
  "rfc3161TimeStampServer": "http://timestamp.digicert.com"
}
```

### 2. Автоматическое обновление

Electron Builder поддерживает автообновления через различные провайдеры:

```json
"publish": {
  "provider": "github",
  "owner": "Noxir",
  "repo": "UMBRA",
  "releaseType": "release",
  "publishAutoUpdate": true
}
```

### 3. Кастомные страницы установщика

Создайте файл `build/installer.nsi` для полного контроля над установщиком:

```nsis
; Пример кастомной страницы с выбором компонентов
!include "MUI2.nsh"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
```

### 4. Проверка зависимостей

Добавьте проверку системных требований:

```nsis
Function .onInit
  # Проверка версии Windows
  ${If} ${AtLeastWin10}
    # OK
  ${Else}
    MessageBox MB_OK "UMBRA requires Windows 10 or later."
    Abort
  ${EndIf}
  
  # Проверка .NET Framework (если нужно)
  # Проверка свободного места на диске
FunctionEnd
```

### 5. Создание службы Windows (для автозапуска)

Для запуска UMBRA как службы (опционально):

```javascript
// В main process
const { Service } = require('node-windows');
const svc = new Service({
  name: 'UMBRA Overlay',
  description: 'UMBRA Stream Overlay Service',
  script: require('path').join(__dirname, 'service.js')
});
```

### 6. Графические ресурсы для установщика

Создайте файлы в `assets/`:
- `welcome.bmp` (164x314) - изображение приветствия
- `header.bmp` (150x57) - заголовок установщика
- `sidebar.bmp` (165x300) - боковая панель

### 7. Многоязычная поддержка

Текущая конфигурация уже поддерживает русский и английский. Для добавления новых языков:

```json
"installerLanguages": [
  "en_US",
  "ru_RU",
  "de_DE",
  "fr_FR"
]
```

## Рекомендации для production

1. **Всегда подписывайте установщик** - без подписи Windows будет показывать предупреждения
2. **Используйте CI/CD** - настройте GitHub Actions для автоматической сборки при каждом релизе
3. **Тестируйте на чистой системе** - проверьте, что установщик работает без установленных зависимостей
4. **Добавьте контрольные суммы** - предоставьте SHA256 хеши для проверки целостности
5. **Создайте веб-страницу загрузки** - с инструкциями и системными требованиями

## Пример GitHub Actions workflow

Создайте `.github/workflows/build.yml`:

```yaml
name: Build and Release
on:
  push:
    tags:
      - 'v*'
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: UMBRA-Installer
          path: dist/
```

## Заключение

Текущая конфигурация Electron Builder уже предоставляет хороший базовый установщик. Для профессионального уровня нужно:

1. **Подпись кода** - самый важный шаг
2. **Автообновления** - для удобства пользователей
3. **Кастомные страницы** - для лучшего UX
4. **CI/CD пайплайн** - для автоматизации

Эти улучшения займут 1-2 дня разработки, но значительно улучшат восприятие приложения как профессионального продукта.