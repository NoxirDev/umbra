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

## Современные методы установки: AppInstaller и MSIX

### Что такое AppInstaller?
AppInstaller - это современный формат установки для Windows 10/11, который предоставляет:
- **Автоматические обновления** - приложение обновляется при запуске
- **Безопасная установка** - изолированная среда (контейнеры Windows)
- **Простая установка** - двойной щелчок по `.appinstaller` файлу
- **Интеграция с Microsoft Store** - возможность распространения через Store

### Подготовка к созданию AppInstaller

#### 1. Создание самоподписанного сертификата
```powershell
# Запустите скрипт из директории certs
cd certs
powershell -ExecutionPolicy Bypass -File .\create-certificate-simple.ps1
```

Сертификат будет создан в `certs/umbra-signing-cert.pfx` (пароль: `umbra123`).

#### 2. Конфигурация AppX в package.json
UMBRA уже настроена для сборки AppX/MSIX пакетов. Проверьте секцию `appx` в `package.json`:

```json
"appx": {
  "identityName": "Noxir.UMBRA",
  "publisher": "CN=Noxir",
  "publisherDisplayName": "Noxir",
  "displayName": "UMBRA Stream Overlay",
  "backgroundColor": "#1a1a2e",
  "artifactName": "${productName}-${version}-${arch}.msix",
  "languages": ["en-US", "ru-RU"]
}
```

#### 3. Сборка MSIX пакета
```bash
# Собрать AppX/MSIX пакет
npm run build:appx
```

**Примечание:** В текущей версии Electron Builder есть проблема с загрузкой winCodeSign на Windows (символические ссылки на macOS файлы). В качестве временного решения можно:
- Использовать Windows Server для сборки
- Или использовать уже собранный NSIS установщик

### Создание AppInstaller файла

#### Автоматическая генерация
Запустите скрипт для создания AppInstaller файла:
```bash
node scripts/generate-appinstaller.js 2.1.1.0 https://example.com/umbra/UMBRA.msix
```

Файлы будут созданы в `dist/`:
- `UMBRA.appinstaller` - XML файл для установки
- `install.html` - веб-страница для загрузки

#### Структура AppInstaller файла
```xml
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
    xmlns="http://schemas.microsoft.com/appx/appinstaller/2018"
    Version="2.1.1.0"
    Uri="https://example.com/umbra/UMBRA.msix">
    <MainPackage
        Name="UMBRA"
        Publisher="CN=Noxir"
        Version="2.1.1.0"
        ProcessorArchitecture="x64"
        Uri="https://example.com/umbra/UMBRA.msix"/>
    <UpdateSettings>
        <OnLaunch HoursBetweenUpdateChecks="0"/>
        <AutomaticBackgroundTask/>
    </UpdateSettings>
</AppInstaller>
```

### Установка через AppInstaller

#### Для конечных пользователей:
1. **Скачайте** `UMBRA.appinstaller` и `UMBRA.msix` в одну папку
2. **Дважды щелкните** по `UMBRA.appinstaller`
3. **Разрешите установку** (Windows может предупредить о неизвестном издателе)
4. **Приложение установится** и появится в меню "Пуск"

#### Для разработчиков:
1. **Установите сертификат** в доверенные корневые центры:
   ```powershell
   Import-Certificate -FilePath "certs/umbra-signing-cert.cer" -CertStoreLocation "Cert:\LocalMachine\Root"
   ```
2. **Установите пакет** через PowerShell:
   ```powershell
   Add-AppxPackage -Path "dist\UMBRA.msix"
   ```

### Преимущества MSIX/AppInstaller

| Функция | NSIS | MSIX/AppInstaller |
|---------|------|-------------------|
| Автоматические обновления | ❌ Требуется отдельный механизм | ✅ Встроенная поддержка |
| Безопасность | ❌ Полный доступ к системе | ✅ Изолированная среда |
| Откат установки | ❌ Сложно | ✅ Встроенный откат |
| Установка без прав администратора | ❌ Часто требует | ✅ Обычно не требует |
| Распространение через Microsoft Store | ❌ Невозможно | ✅ Возможно |

### Ограничения MSIX для UMBRA

1. **Доступ к файловой системе** - MSIX приложения работают в изолированной среде, что может ограничить доступ к некоторым папкам
2. **Фоновые процессы** - могут требовать специальных разрешений
3. **Совместимость с Electron** - не все функции Electron могут работать в контейнере MSIX

### Рекомендации

1. **Для большинства пользователей** используйте NSIS установщик - он проверен и работает
2. **Для продвинутых пользователей** предложите MSIX вариант с автоматическими обновлениями
3. **Для Microsoft Store** потребуется коммерческий сертификат и проверка Microsoft

## Заключение

Текущая конфигурация Electron Builder уже предоставляет хороший базовый установщик. Для профессионального уровня нужно:

1. **Подпись кода** - самый важный шаг
2. **Автообновления** - для удобства пользователей
3. **Кастомные страницы** - для лучшего UX
4. **CI/CD пайплайн** - для автоматизации
5. **Современные форматы** - AppInstaller для Windows 10/11

Эти улучшения займут 1-2 дня разработки, но значительно улучшат восприятие приложения как профессионального продукта.