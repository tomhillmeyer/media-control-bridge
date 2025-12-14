const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

class WindowsMediaController {
  constructor() {
    this.currentTrack = null;
    this.currentState = {
      isPlaying: false,
      position: 0
    };
    this.currentApp = null;
    this.watchProcess = null;
    this.eventCallback = null;
  }

  async start() {
    logger.info('Starting Windows media controller');

    // Determine the correct helper path based on architecture
    const arch = process.arch === 'arm64' ? 'win-arm64' : 'win-x64';
    const helperPath = this.getHelperPath(arch);

    logger.info(`Using MediaHelper at: ${helperPath}`);

    // Start the watch process
    this.watchProcess = spawn(helperPath, ['watch'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Handle stdout (JSON events)
    this.watchProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          this.handleEvent(event);
        } catch (error) {
          logger.error('Error parsing MediaHelper output:', error.message);
        }
      }
    });

    // Handle stderr
    this.watchProcess.stderr.on('data', (data) => {
      logger.error('MediaHelper stderr:', data.toString());
    });

    // Handle process exit
    this.watchProcess.on('exit', (code) => {
      logger.warn(`MediaHelper process exited with code ${code}`);
      this.watchProcess = null;

      // Attempt to restart after a delay
      setTimeout(() => {
        if (!this.watchProcess) {
          logger.info('Attempting to restart MediaHelper...');
          this.start().catch(err => {
            logger.error('Failed to restart MediaHelper:', err);
          });
        }
      }, 5000);
    });

    // Wait for ready signal
    return new Promise((resolve) => {
      const readyHandler = (event) => {
        if (event.type === 'ready') {
          logger.info('MediaHelper is ready');
          resolve();
        }
      };

      const originalCallback = this.eventCallback;
      this.eventCallback = (event) => {
        readyHandler(event);
        if (originalCallback) {
          originalCallback(event);
        }
      };
    });
  }

  stop() {
    logger.info('Stopping Windows media controller');
    if (this.watchProcess) {
      this.watchProcess.kill();
      this.watchProcess = null;
    }
  }

  getHelperPath(arch) {
    // In production (packaged app), the helper will be in resources/bin
    // In development, it should be in resources/bin relative to project root
    if (process.env.NODE_ENV === 'production' || process.resourcesPath) {
      // Production: app.asar.unpacked or resources folder
      const resourcesPath = process.resourcesPath || path.join(process.cwd(), 'resources');
      return path.join(resourcesPath, 'bin', arch, 'MediaHelper.exe');
    } else {
      // Development: relative to project root
      return path.join(__dirname, '..', '..', '..', 'resources', 'bin', arch, 'MediaHelper.exe');
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case 'ready':
        // Ready signal handled in start()
        break;

      case 'media_connected':
        this.currentApp = event.data.appName;
        this.emit('media_connected', { appName: event.data.appName });
        break;

      case 'media_disconnected':
        this.currentApp = null;
        this.currentTrack = null;
        this.emit('media_disconnected', { connected: false });
        break;

      case 'track_changed':
        this.currentTrack = {
          title: event.data.title,
          artist: event.data.artist,
          album: event.data.album,
          duration: event.data.duration,
          artwork: event.data.artwork
        };
        this.currentApp = event.data.appName;
        this.emit('track_changed', { ...this.currentTrack, appName: this.currentApp });
        break;

      case 'playback_state_changed':
        this.currentState.isPlaying = event.data.isPlaying;
        this.currentState.position = event.data.position;
        this.emit('playback_state_changed', {
          isPlaying: event.data.isPlaying,
          position: event.data.position
        });
        break;

      default:
        logger.warn('Unknown event type:', event.type);
    }

    // Allow external event handling
    if (this.eventCallback) {
      this.eventCallback(event);
    }
  }

  async executeCommand(command) {
    const arch = process.arch === 'arm64' ? 'win-arm64' : 'win-x64';
    const helperPath = this.getHelperPath(arch);

    return new Promise((resolve, reject) => {
      const process = spawn(helperPath, [command], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`MediaHelper exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse MediaHelper output: ${error.message}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Control methods
  async play() {
    try {
      const result = await this.executeCommand('play');
      return result;
    } catch (error) {
      logger.error('Error playing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async pause() {
    try {
      const result = await this.executeCommand('pause');
      return result;
    } catch (error) {
      logger.error('Error pausing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async toggle() {
    try {
      const result = await this.executeCommand('toggle');
      // Get updated state
      const isPlaying = !this.currentState.isPlaying;
      return { ...result, isPlaying };
    } catch (error) {
      logger.error('Error toggling:', error.message);
      return { success: false, error: error.message };
    }
  }

  async next() {
    try {
      const result = await this.executeCommand('next');
      return result;
    } catch (error) {
      logger.error('Error skipping to next:', error.message);
      return { success: false, error: error.message };
    }
  }

  async previous() {
    try {
      const result = await this.executeCommand('previous');
      return result;
    } catch (error) {
      logger.error('Error going to previous:', error.message);
      return { success: false, error: error.message };
    }
  }

  getTrackInfo() {
    return this.currentTrack;
  }

  getPlaybackState() {
    return this.currentState;
  }

  getSourceApp() {
    return this.currentApp;
  }

  // Event emitter functionality
  emit(eventName, data) {
    if (this.eventCallback) {
      this.eventCallback(eventName, data);
    }
  }

  on(callback) {
    this.eventCallback = callback;
  }
}

module.exports = WindowsMediaController;
