# Media Control Bridge (MCB)

A macOS desktop application that runs in the system menu bar and bridges media players with Bitfocus Companion. Provides reliable connection by interfacing directly with macOS media controls, supporting any media player that integrates with the system (Spotify, Apple Music, YouTube, VLC, browsers, etc.).

## Features

- **System tray integration**: Runs quietly in the macOS menu bar
- **Universal media support**: Works with any app that uses macOS media controls
  - Spotify
  - Apple Music
  - YouTube (Safari, Chrome, Firefox)
  - VLC
  - And more!
- **REST API**: HTTP endpoints for controlling playback
- **WebSocket server**: Real-time updates for media state changes
- **Simple menu controls**: Play/pause, next, previous directly from menu bar

## Installation

```bash
# Install dependencies
npm install

# Start the application
npm start
```

## Usage

1. Start the app with `npm start`
2. The MCB icon will appear in your macOS menu bar
3. Play any media in a supported app (Spotify, Apple Music, etc.)
4. Click the MCB icon to see current track and control playback

## API Endpoints

The server runs on `http://localhost:6262` by default.

### GET /status
Get current media status

**Response:**
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

### GET /track
Get current track information

### POST /play
Start playback

### POST /pause
Pause playback

### POST /toggle
Toggle play/pause

### POST /next
Skip to next track

### POST /previous
Go to previous track

## WebSocket Connection

Connect to `ws://localhost:6262/ws` for real-time updates.

**Events:**
- `track_changed` - New track started playing
- `playback_state_changed` - Play/pause state changed
- `connection_status` - Media app connected/disconnected

## Configuration

Configuration is stored in `~/.media-control-bridge/config.json`

Default settings:
```json
{
  "server": {
    "httpPort": 6262,
    "websocketPort": 6262
  },
  "media": {
    "allowedApps": ["all"],
    "excludedApps": []
  }
}
```

## Logs

Application logs are stored in `~/.media-control-bridge/logs/app.log`

## Bitfocus Companion Integration

To use with Bitfocus Companion:

1. Start MCB
2. In Companion, add a new connection
3. Configure connection:
   - Host: `localhost`
   - Port: `6262`
   - WebSocket URL: `ws://localhost:6262/ws`

You can now create buttons to control media playback and display current track information!

## Requirements

- macOS (tested on macOS 14+)
- Node.js 18+
- A media player that integrates with macOS media controls

## License

MIT
