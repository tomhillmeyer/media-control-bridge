# Media Control Bridge (MCB) - Project Specification

## Overview
A cross-platform (macOS/Windows) desktop application that runs in the system tray/menu bar and bridges media players with Bitfocus Companion. Provides reliable connection by interfacing directly with OS media controls, supporting any media player that integrates with the system (Spotify, Apple Music, YouTube, VLC, browsers, etc.).

## Project Structure

```
media-control-bridge/
├── package.json
├── vite.config.js
├── electron-builder.config.js
├── .gitignore
├── README.md
│
├── src/
│   ├── main/
│   │   ├── index.js                 # Electron main process entry
│   │   ├── tray.js                  # System tray/menu bar management
│   │   ├── server.js                # HTTP REST API server (Express)
│   │   ├── websocket.js             # WebSocket server for push updates
│   │   ├── media/
│   │   │   ├── index.js             # Media interface abstraction
│   │   │   ├── mac.js               # macOS MediaRemote implementation
│   │   │   └── windows.js           # Windows Media Control implementation
│   │   └── utils/
│   │       ├── config.js            # App configuration/settings
│   │       └── logger.js            # Logging utility
│   │
│   ├── renderer/
│   │   ├── index.html               # Settings/status window
│   │   ├── main.js                  # Renderer process entry
│   │   ├── App.vue                  # Main Vue component
│   │   ├── components/
│   │   │   ├── StatusDisplay.vue    # Current playback status
│   │   │   └── Settings.vue         # Port/connection settings
│   │   └── style.css
│   │
│   └── preload/
│       └── index.js                 # Preload script for IPC
│
├── resources/
│   ├── icon.png                     # App icon
│   ├── iconTemplate.png             # Mac menu bar icon (template)
│   └── iconTemplate@2x.png
│
└── native/
    ├── macos/                       # Native macOS module (if needed)
    └── windows/                     # Native Windows module (if needed)
```

## Core Dependencies

```json
{
  "name": "media-control-bridge",
  "productName": "Media Control Bridge",
  "version": "1.0.0",
  "description": "Bridge media players to Bitfocus Companion via OS media controls",
  "dependencies": {
    "electron": "^28.0.0",
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "electron-builder": "^24.9.1",
    "vite": "^5.0.0",
    "vue": "^3.3.0"
  }
}
```

### Platform-Specific Dependencies

**macOS:**
- Native integration via `osascript` (AppleScript - built into macOS, no dependencies)
- Alternative: `mediaremote-adapter` CLI tool (requires separate installation via Homebrew)
- Fallback: `node-ffi-napi` for direct MediaRemote framework access (most complex)

**Windows:**
- `windows-media-controller` - Access to Windows Runtime Media APIs (npm package)

## Architecture Flow

### 1. Native OS Integration

#### macOS (MediaRemote Framework)
```
Any Media Player (Spotify, Apple Music, VLC, Browser, etc.)
    ↓ (broadcasts via MediaRemote)
macOS Now Playing Info
    ↓ (osascript/AppleScript or mediaremote-adapter CLI)
main/media/mac.js
    ↓
main/media/index.js (unified API)
```

**macOS Implementation Details:**
- **Recommended approach**: Use `osascript` to query system media info via AppleScript
- Execute shell commands like: `osascript -e 'tell application "Music" to get {name, artist} of current track'`
- Poll for changes or use filesystem watching on media info endpoints
- Extract: title, artist, album, artwork path, playback state, duration, position, app name
- Send commands via AppleScript: `osascript -e 'tell application "Music" to play'`
- Works with any app that registers with macOS media controls
- **Alternative**: Install `mediaremote-adapter` via Homebrew and shell out to it for more reliable tracking
- **Advanced**: Use `node-ffi-napi` to call MediaRemote.framework directly (requires native bindings)

#### Windows (Windows Media Control)
```
Any Media Player (Spotify, Chrome, VLC, Windows Media Player, etc.)
    ↓ (broadcasts via Windows.Media.Control)
Windows Media Session
    ↓ (windows-media-controller npm package)
main/media/windows.js
    ↓
main/media/index.js (unified API)
```

**Windows Implementation Details:**
- Use `windows-media-controller` npm package (actively maintained)
- Monitor GlobalSystemMediaTransportControlsSessionManager events
- Extract metadata: title, artist, album, thumbnail, playback state, app name
- Send commands via session controls: play, pause, next, previous
- Works with any app using SystemMediaTransportControls API
- Package provides event-based updates (no polling needed)

### 2. Internal Data Flow

```
main/media/index.js (Unified Media Interface)
    ↓ (emits events on changes)
    ├─→ main/websocket.js (broadcasts to all WebSocket clients)
    └─→ main/server.js (updates current state for HTTP endpoints)
```

**Unified Media Interface API:**
```javascript
// Events emitted by media/index.js
Events:
  - 'track_changed' → { title, artist, album, artwork, duration, appName }
  - 'playback_state_changed' → { isPlaying, position }
  - 'media_connected' → { connected: true, appName }
  - 'media_disconnected' → { connected: false }

Methods:
  - play()
  - pause()
  - next()
  - previous()
  - toggle()
  - getTrackInfo() → returns current track object
  - getPlaybackState() → returns playback state
  - getSourceApp() → returns name of media player
```

### 3. Communication with Companion

#### HTTP REST API (Express Server)

**Base URL:** `http://localhost:6262` (configurable)

**Endpoints:**

```
GET /status
Response: {
  "connected": true,
  "appName": "Spotify",
  "isPlaying": false,
  "track": {
    "title": "Song Name",
    "artist": "Artist Name",
    "album": "Album Name",
    "artwork": "data:image/jpeg;base64,...",
    "duration": 180000,
    "position": 45000
  }
}

POST /play
Response: { "success": true }

POST /pause
Response: { "success": true }

POST /toggle
Response: { "success": true, "isPlaying": true }

POST /next
Response: { "success": true }

POST /previous
Response: { "success": true }

GET /track
Response: {
  "title": "Song Name",
  "artist": "Artist Name",
  "album": "Album Name",
  "artwork": "data:image/jpeg;base64,...",
  "appName": "Spotify"
}
```

#### WebSocket Server (Real-time Updates)

**URL:** `ws://localhost:6262/ws`

**Messages sent to clients:**

```javascript
// On track change
{
  "event": "track_changed",
  "data": {
    "title": "Song Name",
    "artist": "Artist Name",
    "album": "Album Name",
    "artwork": "data:image/jpeg;base64,...",
    "duration": 180000,
    "appName": "Spotify"
  }
}

// On playback state change
{
  "event": "playback_state_changed",
  "data": {
    "isPlaying": true,
    "position": 45000
  }
}

// On media player connection status change
{
  "event": "connection_status",
  "data": {
    "connected": true,
    "appName": "Spotify"
  }
}
```

### 4. Companion Integration

**From Companion to MCB (Control):**
```
Bitfocus Companion
    ↓ (HTTP POST requests)
http://localhost:6262/play (or /pause, /next, /previous)
    ↓
Express Server (main/server.js)
    ↓
main/media/index.js
    ↓
Native OS Media Control
    ↓
Active Media Player
```

**From MCB to Companion (Feedback):**
```
Active Media Player
    ↓
Native OS Media Control
    ↓
main/media/index.js (detects change)
    ↓
main/websocket.js (broadcasts)
    ↓ (WebSocket connection)
Bitfocus Companion (receives real-time updates)
```

## Implementation Notes

### macOS Media Integration

**Option 1: osascript/AppleScript (Recommended for MVP)**
```javascript
const { exec } = require('child_process');

// Get current track info
exec('osascript -e \'tell application "System Events" to get name of first process whose background only is false\'', 
  (err, stdout) => {
    const appName = stdout.trim();
    // Query that specific app for media info
  }
);

// Control playback
exec('osascript -e \'tell application "Spotify" to playpause\'');
exec('osascript -e \'tell application "Spotify" to next track\'');
```

**Pros:**
- No dependencies
- Works immediately
- Simple to implement

**Cons:**
- Requires polling (check every 1-2 seconds)
- AppleScript syntax varies by app
- Slightly higher latency

**Option 2: mediaremote-adapter CLI**
- User installs via: `brew install ungive/tap/mediaremote-adapter`
- MCB shells out to the CLI tool
- Provides reliable event-based updates
- More consistent than AppleScript

**Option 3: Native MediaRemote binding**
- Build native Node addon using `node-gyp`
- Direct access to private MediaRemote.framework
- Most reliable but requires native compilation
- Consider for v2.0

### Windows Media Integration

Use `windows-media-controller` package:
```javascript
const MediaController = require('windows-media-controller');

const mediaController = new MediaController();

mediaController.on('update', (media) => {
  console.log(media.title, media.artist, media.playbackStatus);
});

mediaController.on('change', (event) => {
  // Handle media source changes
});
```

This package provides event-based updates with no polling needed.

**macOS:**
- Spotify
- Apple Music
- YouTube (Safari, Chrome, Firefox)
- VLC
- Plex
- Any app using MPNowPlayingInfoCenter

**Windows:**
- Spotify
- Apple Music
- YouTube (Chrome, Edge, Firefox)
- VLC
- Windows Media Player
- Groove Music
- Any app using SystemMediaTransportControls

## UI/UX Flow

### System Tray/Menu Bar

**Display Name:** Media Control Bridge or MCB

**Menu Items:**
- 🎵 [Current Track Title] (disabled, shows current song)
- 📱 [Source App Name] (disabled, shows which app is playing)
- ▶️ Play/Pause (contextual)
- ⏭️ Next Track
- ⏮️ Previous Track
- ---
- 📊 Show Status Window
- ⚙️ Settings
- ---
- 🔄 Restart Server
- ❌ Quit

### Status Window (Optional)

Small window showing:
- Media Control Bridge (MCB) branding
- Connection status (Media player connected/disconnected)
- Source app name and icon
- Current track info with artwork
- Server status (HTTP: port 6262, WebSocket: Active)
- Number of connected Companion clients

## Configuration

**Stored in:** `~/.media-control-bridge/config.json` (or platform-specific app data)

```json
{
  "server": {
    "httpPort": 6262,
    "websocketPort": 6262
  },
  "media": {
    "allowedApps": ["all"],
    "excludedApps": []
  },
  "ui": {
    "showNotifications": true,
    "startMinimized": true
  },
  "autoStart": false
}
```

**App Filtering Options:**
- `allowedApps: ["all"]` - Accept media from any player (default)
- `allowedApps: ["Spotify"]` - Only respond to Spotify
- `allowedApps: ["Spotify", "Apple Music"]` - Multiple specific apps
- `excludedApps: ["Safari"]` - Accept all except specified apps

## Build Configuration

**electron-builder.config.js:**
```javascript
module.exports = {
  appId: 'com.yourname.media-control-bridge',
  productName: 'Media Control Bridge',
  directories: {
    output: 'dist'
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.utilities',
    icon: 'resources/icon.png',
    extendInfo: {
      LSUIElement: true // Hide from dock
    }
  },
  win: {
    target: ['nsis', 'portable'],
    icon: 'resources/icon.png'
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Utility'
  }
}
```

## Development Workflow

1. `npm install` - Install dependencies
2. `npm run dev` - Start Vite dev server + Electron
3. `npm run build` - Build for production
4. `npm run dist` - Create distributable packages

## Error Handling

- Gracefully handle no media players running (show "disconnected" status)
- Handle port conflicts (try alternate ports or show error)
- Log errors to file for debugging (`~/.media-control-bridge/logs/`)
- Show user-friendly error messages in tray menu
- Handle media player switching (e.g., from Spotify to YouTube)

## Companion Module Configuration

When setting up the MCB module in Companion:

**Connection Settings:**
- **Host:** `localhost` (or IP if MCB is on another machine)
- **Port:** `6262` (default, configurable in MCB)
- **WebSocket URL:** `ws://localhost:6262/ws`

**Module Features:**
- Control actions (play, pause, next, previous, toggle)
- Feedback variables (track title, artist, album, playback state, app name)
- Dynamic button text using track info
- Artwork display (if Companion supports image variables)

## Future Enhancements

- [ ] App filtering UI (choose which media players to monitor)
- [ ] Custom port configuration via UI
- [ ] Playback position seeking
- [ ] Volume control
- [ ] Multiple Companion instance support
- [ ] Auto-discovery of Companion on network
- [ ] Playlist/queue information
- [ ] Media player priority settings (prefer Spotify over browser, etc.)
- [ ] Linux support via MPRIS D-Bus interface
- [ ] Companion module bundled with MCB installer