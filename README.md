<img src="https://raw.githubusercontent.com/tomhillmeyer/media-control-bridge/refs/heads/main/assets/mcb-app-icon.png" alt="drawing" width="100"/>


# Media Control Bridge

Control system media, Spotify, or Apple Music on macOS and Windows over HTTP and receive real-time updates via WebSocket.

## How to use
Download the latest release and open the app. This will put an icon in your toolbar on macOS and your taskbar on Windows. Clicking that icon brings up the menu, with a preview of what MCB is connected to and the network connections and ports it's sending that information on. This also gives you pause/next/previous buttons to test your MCB connection.

![Screenshot](https://github.com/tomhillmeyer/media-control-bridge/blob/main/assets/mcb-screenshot-1.png?raw=true)

Clicking settings opens a window where you can select a media app and change the port. For selecting the media app you can select Auto, Spotify, or Apple Music. Selecting auto will have the app automatically control your actively playing media, according to your system. If that's Spotify or Apple Music it will control those directly. If it's neither of those two (like a web browser, VLC, etc.) it will use your system's media controls.

![Screenshot](https://github.com/tomhillmeyer/media-control-bridge/blob/main/assets/mcb-screenshot-2.png?raw=true)
![Screenshot](https://github.com/tomhillmeyer/media-control-bridge/blob/main/assets/mcb-screenshot-3.png?raw=true)


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

## Current Compatibility
|                                                  	| macOS + Spotify 	| macOS + Apple Music 	| macOS + Others 	| Windows 	|
|--------------------------------------------------	|-----------------	|---------------------	|----------------	|---------	|
| Play, Pause, Next, Previous controls             	| ✅               	| ✅                   	| ✅              	| ✅       	|
| Title, Artist, Album, App Name, Connected Status 	| ✅               	| ✅                   	| ✅              	| ✅       	|
| Duration, Playback Position                      	| ✅               	| ✅                   	| ❌              	| ❌       	|
| Album Artwork                                    	| ✅               	| ❌                   	| ❌              	| ❌       	|