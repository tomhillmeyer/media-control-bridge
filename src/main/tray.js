const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');
const os = require('os');
const logger = require('./utils/logger');
const AboutWindow = require('./windows/about');
const SettingsWindow = require('./windows/settings');

class TrayManager {
  constructor(mediaInterface, httpServer, wsServer, onSettingsChanged) {
    this.mediaInterface = mediaInterface;
    this.httpServer = httpServer;
    this.wsServer = wsServer;
    this.onSettingsChanged = onSettingsChanged;
    this.tray = null;
    this.currentTrack = null;
    this.currentApp = null;
    this.isPlaying = false;
    this.aboutWindow = new AboutWindow();
    this.settingsWindow = new SettingsWindow(onSettingsChanged);
  }

  create() {
    try {
      // Load the icon - different formats for different platforms
      let iconPath;
      let icon;

      // Windows uses .ico format, macOS uses PNG
      if (process.platform === 'win32') {
        iconPath = path.join(__dirname, '../../assets/mcb-icon.ico');
      } else {
        // macOS: use template images that adapt to light/dark menu bar
        iconPath = path.join(__dirname, '../../assets/mcb-icon-black.png');
      }

      try {
        icon = nativeImage.createFromPath(iconPath);

        // Resize for macOS menu bar
        if (process.platform === 'darwin' && !icon.isEmpty()) {
          icon = icon.resize({ width: 16, height: 16 });
          // Mark as template image so macOS automatically adjusts for light/dark appearance
          icon.setTemplateImage(true);
        }

        if (icon.isEmpty()) {
          logger.warn('Icon is empty, using default');
          icon = nativeImage.createEmpty();
        }
      } catch (error) {
        logger.error('Error loading icon:', error);
        icon = nativeImage.createEmpty();
      }

      this.tray = new Tray(icon);
      this.tray.setToolTip('Media Control Bridge');

      // Windows: Handle left-click to show menu
      if (process.platform === 'win32') {
        this.tray.on('click', () => {
          this.tray.popUpContextMenu();
        });
      }

      // Set up event handlers
      this.setupMediaEventHandlers();

      // Get initial state from media interface
      this.initializeState();

      // Build initial menu
      this.updateMenu();

      logger.info('System tray created');
    } catch (error) {
      logger.error('Error creating tray:', error);
    }
  }

  setupMediaEventHandlers() {
    this.mediaInterface.on('track_changed', (data) => {
      this.currentTrack = data || null;
      if (data && data.appName) {
        this.currentApp = data.appName;
      }
      this.updateMenu();
    });

    this.mediaInterface.on('playback_state_changed', (data) => {
      if (data && typeof data.isPlaying !== 'undefined') {
        this.isPlaying = data.isPlaying;
      }
      this.updateMenu();
    });

    this.mediaInterface.on('media_connected', (data) => {
      if (data && data.appName) {
        this.currentApp = data.appName;
      }
      this.updateMenu();
    });

    this.mediaInterface.on('media_disconnected', () => {
      this.currentTrack = null;
      this.currentApp = null;
      this.isPlaying = false;
      this.updateMenu();
    });
  }

  initializeState() {
    // Get current state from media interface
    const status = this.mediaInterface.getFullStatus();

    if (status && status.connected) {
      if (status.appName) {
        this.currentApp = status.appName;
      }
      if (typeof status.isPlaying !== 'undefined') {
        this.isPlaying = status.isPlaying;
      }
      if (status.track) {
        this.currentTrack = status.track;
      }
    }
  }

  getNetworkAddresses() {
    const addresses = [];
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }

    return addresses;
  }

  updateMenu() {
    if (!this.tray) return;

    const menuTemplate = [];

    // App version at the top
    const packageJson = require('../../package.json');
    menuTemplate.push({
      label: `MCB v${packageJson.version}`,
      click: () => {
        this.aboutWindow.create();
      }
    });

    menuTemplate.push({ type: 'separator' });


    // Current track info
    if (this.currentTrack && this.currentTrack.title) {
      const trackTitle = this.currentTrack.title.length > 40
        ? this.currentTrack.title.substring(0, 37) + '...'
        : this.currentTrack.title;

      menuTemplate.push({
        label: trackTitle,
        enabled: false
      });

      // Artist if available
      if (this.currentTrack.artist && this.currentTrack.artist !== 'Unknown Artist') {
        const artist = this.currentTrack.artist.length > 40
          ? this.currentTrack.artist.substring(0, 37) + '...'
          : this.currentTrack.artist;

        menuTemplate.push({
          label: `${artist}`,
          enabled: false
        });
      }
    } else {
      menuTemplate.push({
        label: 'No track playing',
        enabled: false
      });
    }

    // Source app
    if (this.currentApp) {
      menuTemplate.push({
        label: `Playing from ${this.currentApp}`,
        enabled: false
      });
    } else {
      menuTemplate.push({
        label: 'No media app',
        enabled: false
      });
    }

    menuTemplate.push({ type: 'separator' });

    // Playback controls
    const hasMedia = this.currentApp !== null;

    menuTemplate.push({
      label: this.isPlaying ? 'Pause' : 'Play',
      enabled: hasMedia,
      click: () => {
        this.mediaInterface.toggle().catch(err => {
          logger.error('Error toggling playback:', err);
        });
      }
    });

    menuTemplate.push({
      label: 'Next Track',
      enabled: hasMedia,
      click: () => {
        this.mediaInterface.next().catch(err => {
          logger.error('Error skipping to next:', err);
        });
      }
    });

    menuTemplate.push({
      label: 'Previous Track',
      enabled: hasMedia,
      click: () => {
        this.mediaInterface.previous().catch(err => {
          logger.error('Error going to previous:', err);
        });
      }
    });

    menuTemplate.push({ type: 'separator' });

    // Server info
    const clientCount = this.wsServer.getClientCount();
    const port = this.httpServer.getPort();

    // Get all network IP addresses
    const addresses = this.getNetworkAddresses();


    menuTemplate.push({
      label: `API Port: ${port}`,
      enabled: false
    });

    // Add all network IP addresses
    addresses.forEach(addr => {
      menuTemplate.push({
        label: `${addr}`,
        enabled: false
      });
    });

    menuTemplate.push({ type: 'separator' });


    menuTemplate.push({
      label: `(${clientCount}) WebSocket connections`,
      enabled: false
    });

    menuTemplate.push({ type: 'separator' });


    // Settings
    menuTemplate.push({
      label: 'Settings',
      click: () => {
        this.settingsWindow.create();
      }
    });


    menuTemplate.push({ type: 'separator' });

    // Quit
    menuTemplate.push({
      label: 'Quit',
      click: () => {
        app.quit();
      }
    });

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    // Close windows
    if (this.aboutWindow) {
      this.aboutWindow.close();
    }
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }

    // Destroy tray
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      logger.info('System tray destroyed');
    }
  }
}

module.exports = TrayManager;
