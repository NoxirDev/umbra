// System tray module
const { Tray, Menu, nativeImage } = require('electron');
const fs = require('fs');
const CONSTANTS = require('../shared/constants');

class TrayManager {
  constructor(iconPath, iconPathIco, windowManager, clickThroughState) {
    this.iconPath = iconPath;
    this.iconPathIco = iconPathIco;
    this.windowManager = windowManager;
    this.clickThroughState = clickThroughState;
    this.tray = null;
  }

  create() {
    const icoFile = process.platform === 'win32' && fs.existsSync(this.iconPathIco)
      ? this.iconPathIco
      : this.iconPath;

    const icon = fs.existsSync(icoFile)
      ? nativeImage.createFromPath(icoFile).resize({ width: 16, height: 16 })
      : nativeImage.createEmpty();

    this.tray = new Tray(icon);
    this.tray.setToolTip(`${CONSTANTS.APP_NAME} — Created by ${CONSTANTS.AUTHOR}`);
    this.updateMenu();

    this.tray.on('double-click', () => {
      const overlay = this.windowManager.getOverlayWindow();
      if (overlay) {
        overlay.show();
      } else {
        this.windowManager.createOverlayWindow({});
      }
    });

    return this.tray;
  }

  updateMenu() {
    if (!this.tray) return;

    const overlay = this.windowManager.getOverlayWindow();
    const clickThrough = this.clickThroughState.get();

    const menu = Menu.buildFromTemplate([
      {
        label: `⚡ ${CONSTANTS.APP_NAME}  ·  Created by ${CONSTANTS.AUTHOR}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '👁 Показать оверлей',
        click: () => {
          if (overlay) {
            overlay.show();
          } else {
            this.windowManager.createOverlayWindow({});
          }
        },
      },
      {
        label: '🙈 Скрыть оверлей',
        click: () => overlay?.hide(),
      },
      {
        label: '⚙️ Настройки',
        click: () => this.windowManager.createSettingsWindow({}),
      },
      { type: 'separator' },
      {
        label: clickThrough ? '🖱 Клики сквозь: ВКЛ' : '🖱 Клики сквозь: ВЫКЛ',
        click: () => {
          this.clickThroughState.toggle();
          this.updateMenu();
        },
      },
      { type: 'separator' },
      {
        label: '❌ Выход',
        click: () => {
          const { app } = require('electron');
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayManager;
