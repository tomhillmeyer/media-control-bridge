const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');

class MacMediaController {
  constructor() {
    this.currentTrack = null;
    this.currentState = {
      isPlaying: false,
      position: 0
    };
    this.currentApp = null;
    this.pollInterval = null;
    this.pollRate = 500; // Poll every 500ms for faster track change detection
    this.lastTrackName = null; // Cache track name for quick comparison
  }

  async start() {
    logger.info('Starting macOS media controller');

    // Start polling for media changes
    this.pollInterval = setInterval(() => {
      this.checkMediaState();
    }, this.pollRate);

    // Do initial check
    await this.checkMediaState();
  }

  stop() {
    logger.info('Stopping macOS media controller');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async checkMediaState() {
    try {
      // Try to get the current playing app and track info
      const app = await this.getCurrentMediaApp();

      if (!app) {
        // No media playing
        if (this.currentApp !== null) {
          this.currentApp = null;
          this.currentTrack = null;
          this.lastTrackName = null;
          this.emit('media_disconnected');
        }
        return;
      }

      // Run quick track name check and playback state in parallel
      const [quickTrackName, playbackState] = await Promise.all([
        this.getQuickTrackName(app),
        this.fetchPlaybackState(app)
      ]);

      // Only fetch full track info if track name changed
      let trackInfo = null;
      if (quickTrackName !== this.lastTrackName) {
        trackInfo = await this.fetchTrackInfo(app);
        this.lastTrackName = quickTrackName;
      }

      // Check if app changed
      if (this.currentApp !== app) {
        this.currentApp = app;
        this.emit('media_connected', { appName: app });
      }

      // Check if track changed
      if (trackInfo && this.hasTrackChanged(trackInfo)) {
        this.currentTrack = trackInfo;
        this.emit('track_changed', { ...trackInfo, appName: app });

        // Fetch artwork asynchronously only when track changes
        this.fetchArtworkUrl(app).then(artworkUrl => {
          if (artworkUrl && this.currentTrack && this.currentTrack.title === trackInfo.title) {
            this.currentTrack.artwork = artworkUrl;
            // Emit updated track info with artwork
            this.emit('track_changed', { ...this.currentTrack, appName: app });
          }
        }).catch(() => {
          // Ignore artwork errors
        });
      }

      // Check for play/pause state changes (critical, needs immediate update)
      const playingChanged = this.currentState.isPlaying !== playbackState.isPlaying;
      const positionChanged = this.currentState.position !== playbackState.position;

      // Always emit if playing state changed, or if position changed
      if (playingChanged || positionChanged) {
        this.currentState = playbackState;
        this.emit('playback_state_changed', playbackState);
      }

    } catch (error) {
      logger.error('Error checking media state:', error.message);
    }
  }

  async getQuickTrackName(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        script = `osascript -e 'tell application "Spotify" to return name of current track'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'tell application "Music" to return name of current track'`;
      } else {
        return null;
      }

      const { stdout } = await execAsync(script);
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async getCurrentMediaApp() {
    try {
      // Optimization: if we already have a current app, check it first
      if (this.currentApp) {
        const stillPlaying = await this.isAppPlaying(this.currentApp);
        if (stillPlaying) return this.currentApp;
      }

      // Try Spotify first
      const spotifyPlaying = await this.isAppPlaying('Spotify');
      if (spotifyPlaying) return 'Spotify';

      // Try Music (Apple Music)
      const musicPlaying = await this.isAppPlaying('Music');
      if (musicPlaying) return 'Music';

      // Try other common apps
      const apps = ['Safari', 'Google Chrome', 'Firefox', 'VLC'];
      for (const app of apps) {
        const isPlaying = await this.isAppPlaying(app);
        if (isPlaying) return app;
      }

      return null;
    } catch (error) {
      logger.error('Error getting current media app:', error.message);
      return null;
    }
  }

  async isAppPlaying(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        // First check if Spotify is running
        script = `osascript -e 'tell application "System Events" to (name of processes) contains "Spotify"'`;
        const { stdout: isRunning } = await execAsync(script);
        if (isRunning.trim() !== 'true') {
          return false;
        }

        // Then check if it has a track
        script = `osascript -e 'tell application "Spotify" to return name of current track'`;
        const { stdout } = await execAsync(script);
        return stdout.trim().length > 0;
      } else if (appName === 'Music') {
        // First check if Music is running
        script = `osascript -e 'tell application "System Events" to (name of processes) contains "Music"'`;
        const { stdout: isRunning } = await execAsync(script);
        if (isRunning.trim() !== 'true') {
          return false;
        }

        // Then check if it has a track
        script = `osascript -e 'tell application "Music" to return name of current track'`;
        const { stdout } = await execAsync(script);
        return stdout.trim().length > 0;
      } else {
        // For browsers and other apps, check if they're running
        script = `osascript -e 'tell application "System Events" to (name of processes) contains "${appName}"'`;
        const { stdout } = await execAsync(script);
        return stdout.trim() === 'true';
      }
    } catch (error) {
      return false;
    }
  }

  async fetchTrackInfo(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        script = `osascript -e 'tell application "Spotify"
          set trackName to name of current track
          set artistName to artist of current track
          set albumName to album of current track
          set trackDuration to duration of current track
          return trackName & "|" & artistName & "|" & albumName & "|" & trackDuration
        end tell'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'tell application "Music"
          set trackName to name of current track
          set artistName to artist of current track
          set albumName to album of current track
          set trackDuration to duration of current track
          return trackName & "|" & artistName & "|" & albumName & "|" & trackDuration
        end tell'`;
      } else {
        // For browsers, we can't easily get track info via AppleScript
        // Return generic info
        return {
          title: 'Playing from ' + appName,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: 0,
          artwork: null
        };
      }

      const { stdout } = await execAsync(script);
      const [title, artist, album, duration] = stdout.trim().split('|');

      const trackInfo = {
        title: title || 'Unknown',
        artist: artist || 'Unknown Artist',
        album: album || 'Unknown Album',
        duration: parseInt(duration) || 0,
        artwork: null  // Will be fetched separately only when track changes
      };

      return trackInfo;
    } catch (error) {
      logger.error('Error getting track info from ' + appName + ':', error);
      return {
        title: 'Unknown',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        duration: 0,
        artwork: null
      };
    }
  }

  async fetchArtworkUrl(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        script = `osascript -e 'tell application "Spotify" to return artwork url of current track'`;
      } else if (appName === 'Music') {
        // Music app doesn't provide direct artwork URL via AppleScript
        // We would need to export the artwork to a temp file
        return null;
      } else {
        return null;
      }

      const { stdout } = await execAsync(script);
      const artworkUrl = stdout.trim();

      return artworkUrl || null;
    } catch (error) {
      // Artwork is optional, don't log errors
      return null;
    }
  }

  async fetchPlaybackState(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        script = `osascript -e 'tell application "Spotify"
          set playerState to player state as string
          set playerPosition to player position
          return playerState & "|" & playerPosition
        end tell'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'tell application "Music"
          set playerState to player state as string
          set playerPosition to player position
          return playerState & "|" & playerPosition
        end tell'`;
      } else {
        return { isPlaying: true, position: 0 };
      }

      const { stdout } = await execAsync(script);
      const [state, position] = stdout.trim().split('|');

      return {
        isPlaying: state === 'playing',
        position: Math.floor(parseFloat(position) || 0) * 1000 // Convert to milliseconds
      };
    } catch (error) {
      return { isPlaying: false, position: 0 };
    }
  }

  hasTrackChanged(newTrack) {
    if (!newTrack) return false;
    if (!this.currentTrack) return true;
    return (
      this.currentTrack.title !== newTrack.title ||
      this.currentTrack.artist !== newTrack.artist ||
      this.currentTrack.album !== newTrack.album
    );
  }

  hasPlaybackStateChanged(newState) {
    return (
      this.currentState.isPlaying !== newState.isPlaying
    );
  }

  // Control methods
  async play() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      const script = this.currentApp === 'Music'
        ? `osascript -e 'tell application "Music" to play'`
        : `osascript -e 'tell application "${this.currentApp}" to play'`;

      await execAsync(script);
      return { success: true };
    } catch (error) {
      logger.error('Error playing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async pause() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      const script = this.currentApp === 'Music'
        ? `osascript -e 'tell application "Music" to pause'`
        : `osascript -e 'tell application "${this.currentApp}" to pause'`;

      await execAsync(script);
      return { success: true };
    } catch (error) {
      logger.error('Error pausing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async toggle() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      const script = this.currentApp === 'Music'
        ? `osascript -e 'tell application "Music" to playpause'`
        : `osascript -e 'tell application "${this.currentApp}" to playpause'`;

      await execAsync(script);

      // Wait a bit and get new state
      await new Promise(resolve => setTimeout(resolve, 100));
      const newState = await this.getPlaybackState(this.currentApp);

      return { success: true, isPlaying: newState.isPlaying };
    } catch (error) {
      logger.error('Error toggling:', error.message);
      return { success: false, error: error.message };
    }
  }

  async next() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      const script = this.currentApp === 'Music'
        ? `osascript -e 'tell application "Music" to next track'`
        : `osascript -e 'tell application "${this.currentApp}" to next track'`;

      await execAsync(script);
      return { success: true };
    } catch (error) {
      logger.error('Error skipping to next:', error.message);
      return { success: false, error: error.message };
    }
  }

  async previous() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      const script = this.currentApp === 'Music'
        ? `osascript -e 'tell application "Music" to previous track'`
        : `osascript -e 'tell application "${this.currentApp}" to previous track'`;

      await execAsync(script);
      return { success: true };
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

module.exports = MacMediaController;
