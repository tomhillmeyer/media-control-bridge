const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');
const config = require('../utils/config');

// Timeout for AppleScript calls to prevent hanging
// Must be shorter than poll rate (1000ms) to avoid overlap
const APPLESCRIPT_TIMEOUT = 800; // 800ms - leaves 200ms buffer before next poll

// Helper to execute AppleScript with timeout
async function execWithTimeout(command, timeout = APPLESCRIPT_TIMEOUT) {
  return await execAsync(command, { timeout });
}

class MacMediaController {
  constructor() {
    this.currentTrack = null;
    this.currentState = {
      isPlaying: false,
      position: 0
    };
    this.currentApp = null;
    this.pollInterval = null;
    this.pollRate = 1000; // Poll every 1 second (spec recommendation)
    this.lastTrackName = null; // Cache track name for quick comparison
    this.isChecking = false; // Prevent overlapping checks
    this.isRunning = false;
  }

  async start() {
    logger.info('Starting macOS media controller');
    this.isRunning = true;

    // Do initial check
    await this.checkMediaState();

    // Start polling loop that waits for each check to complete
    this.pollLoop();
  }

  async pollLoop() {
    while (this.isRunning) {
      // Wait for the poll interval
      await new Promise(resolve => setTimeout(resolve, this.pollRate));

      // Only check if we're not already checking (prevent overlap)
      if (!this.isChecking && this.isRunning) {
        this.checkMediaState().catch(err => {
          logger.error('Error in poll loop:', err);
        });
      }
    }
  }

  stop() {
    logger.info('Stopping macOS media controller');
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async checkMediaState() {
    // Prevent overlapping checks
    if (this.isChecking) {
      logger.debug('Skipping check - previous check still in progress');
      return;
    }

    this.isChecking = true;

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
    } finally {
      this.isChecking = false;
    }
  }

  async getQuickTrackName(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        script = `osascript -e 'if application "Spotify" is running then
          tell application "Spotify" to return name of current track
        else
          return ""
        end if'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'if application "Music" is running then
          tell application "Music" to return name of current track
        else
          return ""
        end if'`;
      } else {
        return null;
      }

      const { stdout } = await execWithTimeout(script);
      return stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async getCurrentMediaApp() {
    try {
      const preferredApp = config.get('media.preferredApp') || 'auto';

      // If user has a preferred app, check only that one
      if (preferredApp !== 'auto') {
        const isPlaying = await this.isAppPlaying(preferredApp);
        return isPlaying ? preferredApp : null;
      }

      // Auto mode: check current app first for performance
      if (this.currentApp && this.currentApp !== 'System') {
        const stillPlaying = await this.isAppPlaying(this.currentApp);
        if (stillPlaying) return this.currentApp;
      }

      // Auto mode: scan supported media apps with AppleScript control
      const supportedApps = ['Spotify', 'Music'];
      for (const app of supportedApps) {
        const isPlaying = await this.isAppPlaying(app);
        if (isPlaying) return app;
      }

      // Auto mode fallback: use system media controls
      // Always return 'System' if no Spotify/Music detected
      // This allows media keys to work with VLC, browsers, and any other media app
      return 'System';
    } catch (error) {
      logger.error('Error getting current media app:', error.message);
      return null;
    }
  }

  async isAppPlaying(appName) {
    try {
      let script;

      if (appName === 'Spotify') {
        // Check if Spotify is running AND has a track without launching it
        script = `osascript -e 'if application "Spotify" is running then
          tell application "Spotify"
            if player state is playing or player state is paused then
              return "true"
            end if
          end tell
        end if
        return "false"'`;
        const { stdout } = await execWithTimeout(script);
        return stdout.trim() === 'true';
      } else if (appName === 'Music') {
        // Check if Music is running AND has a track without launching it
        script = `osascript -e 'if application "Music" is running then
          tell application "Music"
            if player state is playing or player state is paused then
              return "true"
            end if
          end tell
        end if
        return "false"'`;
        const { stdout } = await execWithTimeout(script);
        return stdout.trim() === 'true';
      } else {
        // For other apps, just check if they're running
        script = `osascript -e 'tell application "System Events" to (name of processes) contains "${appName}"'`;
        const { stdout } = await execWithTimeout(script);
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
        script = `osascript -e 'if application "Spotify" is running then
          tell application "Spotify"
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackDuration to duration of current track
            return trackName & "|" & artistName & "|" & albumName & "|" & trackDuration
          end tell
        else
          return "|||0"
        end if'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'if application "Music" is running then
          tell application "Music"
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set trackDuration to duration of current track
            return trackName & "|" & artistName & "|" & albumName & "|" & trackDuration
          end tell
        else
          return "|||0"
        end if'`;
      } else if (appName === 'System') {
        // System media fallback - controls work via media keys
        return {
          title: 'System Audio',
          artist: '',
          album: '',
          duration: 0,
          artwork: null
        };
      } else {
        // For other apps, return generic info
        return {
          title: 'Playing from ' + appName,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: 0,
          artwork: null
        };
      }

      const { stdout } = await execWithTimeout(script);
      const [title, artist, album, duration] = stdout.trim().split('|');

      // Spotify returns duration in milliseconds, Music returns seconds
      const durationMs = appName === 'Music'
        ? Math.floor(parseFloat(duration) || 0) * 1000  // Convert seconds to milliseconds
        : Math.floor(parseFloat(duration) || 0);         // Already in milliseconds

      const trackInfo = {
        title: title || 'Unknown',
        artist: artist || 'Unknown Artist',
        album: album || 'Unknown Album',
        duration: durationMs,
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
        script = `osascript -e 'if application "Spotify" is running then
          tell application "Spotify"
            set playerState to player state as string
            set playerPosition to player position
            return playerState & "|" & playerPosition
          end tell
        else
          return "stopped|0"
        end if'`;
      } else if (appName === 'Music') {
        script = `osascript -e 'if application "Music" is running then
          tell application "Music"
            set playerState to player state as string
            set playerPosition to player position
            return playerState & "|" & playerPosition
          end tell
        else
          return "stopped|0"
        end if'`;
      } else if (appName === 'System') {
        // System media - assume playing (controls work even without state info)
        return { isPlaying: true, position: 0 };
      } else {
        return { isPlaying: true, position: 0 };
      }

      const { stdout } = await execWithTimeout(script);
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

  // Helper to determine if app supports AppleScript control
  supportsAppleScriptControl(appName) {
    // Apps with reliable AppleScript APIs
    return appName === 'Spotify' || appName === 'Music';
  }

  // Helper to send system media key event
  async sendMediaKey(key) {
    // key can be: 'play', 'pause', 'playpause', 'next', 'previous'
    const keyCode = {
      'playpause': 16,  // Play/Pause
      'next': 17,       // Fast Forward / Next
      'previous': 18    // Rewind / Previous
    }[key];

    if (!keyCode) {
      throw new Error(`Unknown media key: ${key}`);
    }

    // Use key code simulation - works for all apps via system media controls
    const script = `osascript -e 'tell application "System Events" to key code ${keyCode}'`;
    await execWithTimeout(script);
  }

  // Control methods
  async play() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      // If current app supports AppleScript, use it for precise control
      if (this.supportsAppleScriptControl(this.currentApp)) {
        let script;
        if (this.currentApp === 'Music') {
          script = `osascript -e 'tell application "Music" to play'`;
        } else {
          script = `osascript -e 'tell application "${this.currentApp}" to play'`;
        }
        await execWithTimeout(script);
      } else {
        // Use system media keys for other apps
        await this.sendMediaKey('playpause');
      }

      return { success: true };
    } catch (error) {
      logger.error('Error playing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async pause() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      // If current app supports AppleScript, use it for precise control
      if (this.supportsAppleScriptControl(this.currentApp)) {
        let script;
        if (this.currentApp === 'Music') {
          script = `osascript -e 'tell application "Music" to pause'`;
        } else {
          script = `osascript -e 'tell application "${this.currentApp}" to pause'`;
        }
        await execWithTimeout(script);
      } else {
        // Use system media keys for other apps
        await this.sendMediaKey('playpause');
      }

      return { success: true };
    } catch (error) {
      logger.error('Error pausing:', error.message);
      return { success: false, error: error.message };
    }
  }

  async toggle() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      // If current app supports AppleScript, use it for precise control
      if (this.supportsAppleScriptControl(this.currentApp)) {
        let script;
        if (this.currentApp === 'Music') {
          script = `osascript -e 'tell application "Music" to playpause'`;
        } else {
          script = `osascript -e 'tell application "${this.currentApp}" to playpause'`;
        }
        await execWithTimeout(script);
      } else {
        // Use system media keys for other apps
        await this.sendMediaKey('playpause');
      }

      // Wait a bit and get new state
      await new Promise(resolve => setTimeout(resolve, 100));
      const newState = await this.fetchPlaybackState(this.currentApp);

      return { success: true, isPlaying: newState.isPlaying };
    } catch (error) {
      logger.error('Error toggling:', error.message);
      return { success: false, error: error.message };
    }
  }

  async next() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      // If current app supports AppleScript, use it for precise control
      if (this.supportsAppleScriptControl(this.currentApp)) {
        let script;
        if (this.currentApp === 'Music') {
          script = `osascript -e 'tell application "Music" to next track'`;
        } else {
          script = `osascript -e 'tell application "${this.currentApp}" to next track'`;
        }
        await execWithTimeout(script);
      } else {
        // Use system media keys for other apps
        await this.sendMediaKey('next');
      }

      return { success: true };
    } catch (error) {
      logger.error('Error skipping to next:', error.message);
      return { success: false, error: error.message };
    }
  }

  async previous() {
    if (!this.currentApp) return { success: false, error: 'No media app active' };

    try {
      // If current app supports AppleScript, use it for precise control
      if (this.supportsAppleScriptControl(this.currentApp)) {
        let script;
        if (this.currentApp === 'Music') {
          script = `osascript -e 'tell application "Music" to previous track'`;
        } else {
          script = `osascript -e 'tell application "${this.currentApp}" to previous track'`;
        }
        await execWithTimeout(script);
      } else {
        // Use system media keys for other apps
        await this.sendMediaKey('previous');
      }

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
