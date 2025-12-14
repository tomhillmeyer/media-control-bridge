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

    // Set up promise to wait for ready signal BEFORE spawning process
    const readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });

    // Start the watch process
    this.watchProcess = spawn(helperPath, ['watch'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Handle stdout (JSON events)
    this.watchProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      const lines = dataStr.split('\n').filter(line => line.trim());
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
      const message = data.toString().trim();
      // Some stderr messages are informational, not errors
      if (message.includes('Current session:') || message.includes('Media properties returned null')) {
        logger.info('MediaHelper:', message);
      } else {
        logger.error('MediaHelper stderr:', message);
      }
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

    // Return the ready promise
    return readyPromise;
  }

  stop() {
    logger.info('Stopping Windows media controller');
    if (this.watchProcess) {
      this.watchProcess.kill();
      this.watchProcess = null;
    }
  }

  getHelperPath(arch) {
    let helperPath;

    if (process.resourcesPath) {
      // Production: packaged app
      // Check app.asar.unpacked first (where unpacked files go)
      helperPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'bin', arch, 'MediaHelper.exe');
      logger.info(`Looking for MediaHelper at: ${helperPath}`);
    } else {
      // Development: relative to project root
      helperPath = path.join(__dirname, '..', '..', '..', 'resources', 'bin', arch, 'MediaHelper.exe');
      logger.info(`Development mode - Looking for MediaHelper at: ${helperPath}`);
    }

    return helperPath;
  }

  handleEvent(event) {
    // Validate event structure
    if (!event || !event.type) {
      logger.warn('Invalid event received:', event);
      return;
    }

    switch (event.type) {
      case 'ready':
        if (this._readyResolve) {
          this._readyResolve();
          this._readyResolve = null;
        }
        break;

      case 'media_connected':
        if (event.data && event.data.appName) {
          this.currentApp = event.data.appName;
          this.emit('media_connected', { appName: event.data.appName });
        }
        break;

      case 'media_disconnected':
        this.currentApp = null;
        this.currentTrack = null;
        this.emit('media_disconnected', { connected: false });
        break;

      case 'track_changed':
        if (event.data) {
          this.currentTrack = {
            title: event.data.title || 'Unknown',
            artist: event.data.artist || 'Unknown Artist',
            album: event.data.album || 'Unknown Album',
            duration: event.data.duration || 0,
            artwork: event.data.artwork
          };
          if (event.data.appName) {
            this.currentApp = event.data.appName;
          }
          this.emit('track_changed', { ...this.currentTrack, appName: this.currentApp });
        }
        break;

      case 'playback_state_changed':
        if (event.data && typeof event.data.isPlaying !== 'undefined') {
          this.currentState.isPlaying = event.data.isPlaying;
          this.currentState.position = event.data.position || 0;
          this.emit('playback_state_changed', {
            isPlaying: event.data.isPlaying,
            position: event.data.position || 0
          });
        }
        break;

      default:
        logger.warn('Unknown event type:', event.type);
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
