const { BrowserWindow, ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
        httpPort: config.get('server.httpPort') || 6262,
        preferredApp: config.get('media.preferredApp') || 'auto'
      };
    });

    // Save settings
    ipcMain.handle('save-settings', async (_event, settings) => {
      try {
        const oldPort = config.get('server.httpPort');
        const oldApp = config.get('media.preferredApp');

        config.set('server.httpPort', parseInt(settings.httpPort));
        config.set('server.websocketPort', parseInt(settings.httpPort));
        config.set('media.preferredApp', settings.preferredApp || 'auto');

        logger.info('Settings saved:', settings);

        // Notify that settings changed if port or app changed
        if ((oldPort !== parseInt(settings.httpPort) || oldApp !== settings.preferredApp) && this.onSettingsChanged) {
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

    // Get logs
    ipcMain.handle('get-logs', () => {
      try {
        const logFile = path.join(os.homedir(), '.media-control-bridge', 'logs', 'app.log');
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          // Get last 100 lines
          const lines = content.split('\n').filter(line => line.trim()).slice(-100);
          return lines.map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { timestamp: '', level: 'RAW', message: line };
            }
          });
        }
        return [];
      } catch (error) {
        logger.error('Error reading logs:', error);
        return [];
      }
    });
  }

  create() {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 300,
      height: 250,
      resizable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      show: false,
      title: 'Settings',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'settings-preload.js')
      }
    });

    // Remove menu bar completely
    this.window.setMenuBarVisibility(false);

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
