<img src="https://raw.githubusercontent.com/tomhillmeyer/media-control-bridge/refs/heads/main/assets/mcb-app-icon.png" alt="drawing" width="100"/>


# Media Control Bridge

Control system media (Spotify, Apple Music, YouTube, VLC, etc.) on macOS and Windows over HTTP and receive real-time updates via WebSocket.

## API

Server runs on `http://localhost:6262` by default (configurable via the app's Settings menu).

### HTTP Endpoints

**GET /status** - Get current media status and track info
```json
{
  "connected": true,
  "appName": "Spotify",
  "isPlaying": false,
  "track": {
    "title": "Song Name",
    "artist": "Artist Name",
    "album": "Album Name",
    "duration": 180000,
    "position": 45000
  }
}
```

**GET /track** - Get current track information

**POST /play** - Start playback

**POST /pause** - Pause playback

**POST /toggle** - Toggle play/pause

**POST /next** - Skip to next track

**POST /previous** - Go to previous track

### WebSocket

Connect to `ws://localhost:6262/ws` for real-time updates.

**Events:**
- `track_changed` - New track started playing
- `playback_state_changed` - Play/pause state changed
- `connection_status` - Media app connected/disconnected
