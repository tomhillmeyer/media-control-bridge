const { BrowserWindow } = require('electron');
const path = require('path');

class AboutWindow {
  constructor() {
    this.window = null;
  }

  create() {
    if (this.window) {
      this.window.focus();
      return;
    }

    this.window = new BrowserWindow({
      width: 300,
      height: 180,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'About Media Control Bridge',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

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
