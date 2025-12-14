const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

class SettingsWindow {
  constructor(onSettingsChanged) {
    this.window = null;
    this.onSettingsChanged = onSettingsChanged;
    this.setupIPC();
  }

  setupIPC() {
    // Get current settings
    ipcMain.handle('get-settings', () => {
      return {
        httpPort: config.get('server.httpPort') || 6262
      };
    });

    // Save settings
    ipcMain.handle('save-settings', async (_event, settings) => {
      try {
        const oldPort = config.get('server.httpPort');

        config.set('server.httpPort', parseInt(settings.httpPort));
        config.set('server.websocketPort', parseInt(settings.httpPort));

        logger.info('Settings saved:', settings);

        // Notify that settings changed if port changed
        if (oldPort !== parseInt(settings.httpPort) && this.onSettingsChanged) {
          this.onSettingsChanged();
        }

        return { success: true };
      } catch (error) {
        logger.error('Error saving settings:', error);
        return { success: false, error: error.message };
      }
    });

    // Restart app
    ipcMain.handle('restart-app', () => {
      logger.info('Restarting application...');
      app.relaunch();
      app.quit();
    });
  }

  create() {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 300,
      height: 200,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'Settings',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'settings-preload.js')
      }
    });

    // Load the settings page
    this.window.loadFile(path.join(__dirname, '../../../resources/settings.html'));

    // Show when ready
    this.window.once('ready-to-show', () => {
      this.window.show();
    });

    // Clear reference when closed
    this.window.on('closed', () => {
      this.window = null;
    });
  }

  close() {
    if (this.window) {
      this.window.close();
    }
  }
}

module.exports = SettingsWindow;
