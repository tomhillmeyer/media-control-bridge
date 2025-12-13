const { app, BrowserWindow } = require('electron');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./utils/config');
const mediaInterface = require('./media/index');
const HTTPServer = require('./server');
const WebSocketServer = require('./websocket');
const TrayManager = require('./tray');

class MediaControlBridge {
  constructor() {
    this.httpServer = null;
    this.wsServer = null;
    this.trayManager = null;
    this.mainWindow = null;
  }

  async initialize() {
    try {
      logger.info('Starting Media Control Bridge...');

      // Initialize media interface
      await mediaInterface.initialize();

      // Start HTTP server
      this.httpServer = new HTTPServer(mediaInterface);
      await this.httpServer.start();

      // Start WebSocket server
      this.wsServer = new WebSocketServer(mediaInterface, this.httpServer);
      this.wsServer.start();

      // Create system tray
      this.trayManager = new TrayManager(mediaInterface, this.httpServer, this.wsServer);
      this.trayManager.create();

      logger.info('Media Control Bridge started successfully');
      logger.info(`HTTP API: http://localhost:${this.httpServer.getPort()}`);
      logger.info(`WebSocket: ws://localhost:${this.httpServer.getPort()}/ws`);

    } catch (error) {
      logger.error('Failed to start Media Control Bridge:', error);
      app.quit();
    }
  }

  async shutdown() {
    logger.info('Shutting down Media Control Bridge...');

    if (this.trayManager) {
      this.trayManager.destroy();
    }

    if (this.wsServer) {
      this.wsServer.stop();
    }

    if (this.httpServer) {
      await this.httpServer.stop();
    }

    if (mediaInterface) {
      await mediaInterface.shutdown();
    }

    logger.info('Media Control Bridge stopped');
  }
}

// Electron app lifecycle
const mcb = new MediaControlBridge();

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  mcb.initialize();
});

// Quit when all windows are closed (but keep tray running)
app.on('window-all-closed', () => {
  // On macOS, apps typically stay open even when windows are closed
  // We want to keep running in the tray
});

// Handle app termination
app.on('before-quit', async () => {
  await mcb.shutdown();
});

app.on('will-quit', async (event) => {
  event.preventDefault();
  await mcb.shutdown();
  app.exit(0);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.warn('Another instance is already running');
  app.quit();
} else {
  app.on('second-instance', () => {
    logger.info('Attempted to start second instance');
  });
}

// macOS specific: Don't show in dock
if (process.platform === 'darwin') {
  app.dock.hide();
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
});
