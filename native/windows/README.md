# Windows Media Helper

C# console application that interfaces with Windows.Media.Control APIs to monitor and control system media.

## Requirements

- .NET 7.0 SDK or later
- Windows 10 version 1903 (19H1) or later

## Building

**Automatic Build (Recommended)**:

The helper is automatically built when you run from the project root:
```bash
npm run dist:win
```

**Manual Build**:

If you need to build manually:

### On Windows:
```bash
build.bat
```

### On Mac/Linux (with .NET SDK installed):
```bash
chmod +x build.sh
./build.sh
```

This will compile the helper and output `MediaHelper.exe` to `resources/bin/win-x64/` and `resources/bin/win-arm64/`.

## Usage

The executable supports several commands:

### Watch Mode (continuous monitoring)
```bash
MediaHelper.exe watch
```
Outputs JSON events to stdout:
- `{"type":"ready"}` - Helper is ready
- `{"type":"media_connected","data":{"appName":"Spotify"}}` - Media app connected
- `{"type":"media_disconnected","data":{"connected":false}}` - Media app disconnected
- `{"type":"track_changed","data":{...}}` - Track changed
- `{"type":"playback_state_changed","data":{...}}` - Playback state changed

### Query Status (one-time)
```bash
MediaHelper.exe status
```
Returns current media status as JSON.

### Control Commands
```bash
MediaHelper.exe play
MediaHelper.exe pause
MediaHelper.exe toggle
MediaHelper.exe next
MediaHelper.exe previous
```
Returns `{"success":true}` or `{"success":false,"error":"..."}`.

## Development Notes

- Uses `GlobalSystemMediaTransportControlsSessionManager` for system-wide media control
- Supports any app that uses `SystemMediaTransportControls` API
- Automatically detects the active media session
- Event-driven updates for track changes and playback state
