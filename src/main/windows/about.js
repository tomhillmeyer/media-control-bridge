const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

class AboutWindow {
  constructor() {
    this.window = null;
    this.setupIPC();
  }

  setupIPC() {
    // Get app version from package.json
    ipcMain.handle('get-app-version', () => {
      try {
        const packageJson = require('../../../package.json');
        return packageJson.version;
      } catch (error) {
        console.error('Failed to read version:', error);
        return null;
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
      height: 260,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      show: false,
      title: 'About Media Control Bridge',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'about-preload.js')
      }
    });

    // Remove menu bar completely
    this.window.setMenuBarVisibility(false);

    // Load the about page
    this.window.loadFile(path.join(__dirname, '../../../resources/about.html'));

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

module.exports = AboutWindow;
