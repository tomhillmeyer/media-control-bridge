# Media Control Bridge API Documentation

## Overview

Media Control Bridge (MCB) provides both REST API and WebSocket interfaces for controlling media playback and receiving real-time updates.

**Base URL:** `http://localhost:6262` (configurable)

**WebSocket URL:** `ws://localhost:6262/ws`

---

## REST API Endpoints

### GET /status

Get the complete current media status.

**Response:**

```json
{
  "connected": true,
  "appName": "Spotify",
  "isPlaying": true,
  "track": {
    "title": "Agnes",
    "artist": "Glass Animals",
    "album": "How To Be A Human Being",
    "artwork": null,
    "duration": 271672,
    "position": 45000
  }
}
```

**Response Fields:**

- `connected` (boolean) - Whether a media app is currently active
- `appName` (string|null) - Name of the active media application
- `isPlaying` (boolean) - Current playback state
- `track` (object|null) - Current track information
  - `title` (string) - Track title
  - `artist` (string) - Artist name
  - `album` (string) - Album name
  - `artwork` (string|null) - Base64 encoded artwork (currently null)
  - `duration` (number) - Track duration in milliseconds
  - `position` (number) - Current playback position in milliseconds

**Status Codes:**

- `200 OK` - Success

---

### GET /track

Get information about the currently playing track.

**Response:**

```json
{
  "title": "Agnes",
  "artist": "Glass Animals",
  "album": "How To Be A Human Being",
  "duration": 271672,
  "artwork": null,
  "appName": "Spotify"
}
```

**Status Codes:**

- `200 OK` - Track information returned
- `404 Not Found` - No track currently playing

**Error Response (404):**

```json
{
  "error": "No track currently playing"
}
```

---

### POST /play

Start playback.

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

- `200 OK` - Playback started successfully
- `500 Internal Server Error` - Error occurred

**Error Response:**

```json
{
  "success": false,
  "error": "No media app active"
}
```

---

### POST /pause

Pause playback.

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

- `200 OK` - Playback paused successfully
- `500 Internal Server Error` - Error occurred

**Error Response:**

```json
{
  "success": false,
  "error": "No media app active"
}
```

---

### POST /toggle

Toggle between play and pause.

**Response:**

```json
{
  "success": true,
  "isPlaying": true
}
```

**Response Fields:**

- `success` (boolean) - Whether the operation succeeded
- `isPlaying` (boolean) - New playback state after toggle

**Status Codes:**

- `200 OK` - Toggle successful
- `500 Internal Server Error` - Error occurred

**Error Response:**

```json
{
  "success": false,
  "error": "No media app active"
}
```

---

### POST /next

Skip to the next track.

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

- `200 OK` - Skipped to next track
- `500 Internal Server Error` - Error occurred

**Error Response:**

```json
{
  "success": false,
  "error": "No media app active"
}
```

---

### POST /previous

Go back to the previous track.

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

- `200 OK` - Went to previous track
- `500 Internal Server Error` - Error occurred

**Error Response:**

```json
{
  "success": false,
  "error": "No media app active"
}
```

---

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-13T22:10:00.000Z"
}
```

**Status Codes:**

- `200 OK` - Server is healthy

---

## WebSocket API

### Connection

Connect to the WebSocket server at `ws://localhost:6262/ws`

Upon connection, you will immediately receive the current media status.

### Events

All WebSocket messages follow this format:

```json
{
  "event": "event_name",
  "data": { /* event data */ }
}
```

#### track_changed

Sent when a new track starts playing or track information changes.

```json
{
  "event": "track_changed",
  "data": {
    "title": "Agnes",
    "artist": "Glass Animals",
    "album": "How To Be A Human Being",
    "artwork": null,
    "duration": 271672,
    "appName": "Spotify"
  }
}
```

#### playback_state_changed

Sent when playback state changes (play/pause).

```json
{
  "event": "playback_state_changed",
  "data": {
    "isPlaying": true,
    "position": 45000
  }
}
```

**Data Fields:**

- `isPlaying` (boolean) - Current playback state
- `position` (number) - Current playback position in milliseconds

#### connection_status

Sent when a media app connects or disconnects.

```json
{
  "event": "connection_status",
  "data": {
    "connected": true,
    "appName": "Spotify"
  }
}
```

**Connected:**

```json
{
  "event": "connection_status",
  "data": {
    "connected": true,
    "appName": "Spotify"
  }
}
```

**Disconnected:**

```json
{
  "event": "connection_status",
  "data": {
    "connected": false
  }
}
```

---

## Supported Media Applications

### macOS

- Spotify
- Apple Music (Music.app)
- Safari (with media playing)
- Google Chrome (with media playing)
- Firefox (with media playing)
- VLC
- Any app that integrates with macOS media controls

---

## Configuration

Configuration file location: `~/.media-control-bridge/config.json`

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

**Configuration Options:**

- `server.httpPort` - HTTP server port (default: 6262)
- `server.websocketPort` - WebSocket server port (default: 6262)
- `media.allowedApps` - Array of allowed media apps, or `["all"]` for all apps
- `media.excludedApps` - Array of apps to exclude from media control

---

## CORS

The API has CORS enabled, allowing requests from any origin. This makes it easy to integrate with web-based applications like Bitfocus Companion.

---

## Rate Limiting

Currently, there is no rate limiting on the API endpoints.

---

## Examples

### Using cURL

**Get current status:**

```bash
curl http://localhost:6262/status
```

**Toggle playback:**

```bash
curl -X POST http://localhost:6262/toggle
```

**Next track:**

```bash
curl -X POST http://localhost:6262/next
```

### Using JavaScript (Fetch API)

```javascript
// Get current status
const response = await fetch('http://localhost:6262/status');
const status = await response.json();
console.log(status);

// Toggle playback
await fetch('http://localhost:6262/toggle', { method: 'POST' });

// Next track
await fetch('http://localhost:6262/next', { method: 'POST' });
```

### WebSocket Connection (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:6262/ws');

ws.onopen = () => {
  console.log('Connected to Media Control Bridge');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.event) {
    case 'track_changed':
      console.log('Now playing:', message.data.title, 'by', message.data.artist);
      break;

    case 'playback_state_changed':
      console.log('Playback state:', message.data.isPlaying ? 'Playing' : 'Paused');
      break;

    case 'connection_status':
      if (message.data.connected) {
        console.log('Media app connected:', message.data.appName);
      } else {
        console.log('Media app disconnected');
      }
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from Media Control Bridge');
};
```

---

## Bitfocus Companion Integration

To integrate with Bitfocus Companion:

1. In Companion, add a new Generic HTTP/WebSocket connection
2. Configure the connection:
   - **Host:** `localhost` (or the IP of the machine running MCB)
   - **Port:** `6262`
   - **WebSocket URL:** `ws://localhost:6262/ws`

3. Create buttons for control actions:
   - Play: `POST http://localhost:6262/play`
   - Pause: `POST http://localhost:6262/pause`
   - Toggle: `POST http://localhost:6262/toggle`
   - Next: `POST http://localhost:6262/next`
   - Previous: `POST http://localhost:6262/previous`

4. Use WebSocket messages to update button text with current track info

---

## Error Handling

All endpoints return JSON responses. In case of errors:

- Check the `success` field (for control endpoints)
- Check the HTTP status code
- Read the `error` field for error messages

Common error scenarios:

- **No media app active:** Media player is not running or not detected
- **Port already in use:** Another application is using port 6262
- **AppleScript error:** Permission denied or app doesn't support AppleScript

---

## Logging

Application logs are stored at: `~/.media-control-bridge/logs/app.log`

---

## Support

For issues, feature requests, or questions, please refer to the project's README.md or documentation.
