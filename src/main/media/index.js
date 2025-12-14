const EventEmitter = require('events');
const logger = require('../utils/logger');

class MediaInterface extends EventEmitter {
  constructor() {
    super();
    this.platformController = null;
    this.currentTrack = null;
    this.currentState = {
      isPlaying: false,
      position: 0,
      connected: false
    };
    this.currentApp = null;
  }

  async initialize() {
    logger.info('Initializing media interface');

    // Determine platform and load appropriate controller
    const platform = process.platform;

    if (platform === 'darwin') {
      const MacMediaController = require('./mac');
      this.platformController = new MacMediaController();
    } else if (platform === 'win32') {
      const WindowsMediaController = require('./windows');
      this.platformController = new WindowsMediaController();
    } else {
      logger.error('Unsupported platform:', platform);
      throw new Error('Unsupported platform: ' + platform);
    }

    // Set up event forwarding from platform controller to this interface
    this.platformController.on((eventName, data) => {
      this.handlePlatformEvent(eventName, data);
    });

    // Start the platform controller
    await this.platformController.start();

    logger.info('Media interface initialized');
  }

  handlePlatformEvent(event, data) {
    switch (event) {
      case 'track_changed':
        this.currentTrack = data;
        this.emit('track_changed', data);
        break;

      case 'playback_state_changed':
        this.currentState.isPlaying = data.isPlaying;
        this.currentState.position = data.position;
        this.emit('playback_state_changed', data);
        break;

      case 'media_connected':
        this.currentApp = data.appName;
        this.currentState.connected = true;
        this.emit('media_connected', data);
        break;

      case 'media_disconnected':
        this.currentApp = null;
        this.currentState.connected = false;
        this.currentTrack = null;
        this.emit('media_disconnected', { connected: false });
        break;
    }
  }

  // Control methods
  async play() {
    return await this.platformController.play();
  }

  async pause() {
    return await this.platformController.pause();
  }

  async toggle() {
    return await this.platformController.toggle();
  }

  async next() {
    return await this.platformController.next();
  }

  async previous() {
    return await this.platformController.previous();
  }

  // State getters
  getTrackInfo() {
    if (!this.currentTrack) {
      return null;
    }

    return {
      ...this.currentTrack,
      appName: this.currentApp
    };
  }

  getPlaybackState() {
    return {
      isPlaying: this.currentState.isPlaying,
      position: this.currentState.position
    };
  }

  getSourceApp() {
    return this.currentApp;
  }

  isConnected() {
    return this.currentState.connected;
  }

  getFullStatus() {
    return {
      connected: this.currentState.connected,
      appName: this.currentApp,
      isPlaying: this.currentState.isPlaying,
      track: this.currentTrack ? {
        title: this.currentTrack.title,
        artist: this.currentTrack.artist,
        album: this.currentTrack.album,
        artwork: this.currentTrack.artwork,
        duration: this.currentTrack.duration,
        position: this.currentState.position
      } : null
    };
  }

  async shutdown() {
    logger.info('Shutting down media interface');
    if (this.platformController) {
      await this.platformController.stop();
    }
  }
}

module.exports = new MediaInterface();
