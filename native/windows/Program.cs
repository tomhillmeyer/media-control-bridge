using System;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.Media.Control;

namespace MediaHelper
{
    class Program
    {
        private static GlobalSystemMediaTransportControlsSessionManager? sessionManager;
        private static GlobalSystemMediaTransportControlsSession? currentSession;
        private static string? lastTrackId;
        private static bool lastIsPlaying;

        static async Task Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.Error.WriteLine("Usage: MediaHelper.exe [watch|status|play|pause|next|previous|toggle]");
                Environment.Exit(1);
                return;
            }

            string command = args[0].ToLower();

            try
            {
                switch (command)
                {
                    case "watch":
                        await WatchMode();
                        break;
                    case "status":
                        await GetStatus();
                        break;
                    case "play":
                        await SendCommand("play");
                        break;
                    case "pause":
                        await SendCommand("pause");
                        break;
                    case "toggle":
                        await SendCommand("toggle");
                        break;
                    case "next":
                        await SendCommand("next");
                        break;
                    case "previous":
                        await SendCommand("previous");
                        break;
                    default:
                        Console.Error.WriteLine($"Unknown command: {command}");
                        Environment.Exit(1);
                        break;
                }
            }
            catch (Exception ex)
            {
                var error = new
                {
                    success = false,
                    error = ex.Message
                };
                Console.WriteLine(JsonSerializer.Serialize(error));
                Environment.Exit(1);
            }
        }

        static async Task WatchMode()
        {
            sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();

            // Set up event handlers first
            sessionManager.SessionsChanged += OnSessionsChanged;

            // Output ready signal
            var ready = new { type = "ready" };
            Console.WriteLine(JsonSerializer.Serialize(ready));

            // Send initial status after ready
            await CheckAndEmitStatus();

            // Keep running
            await Task.Delay(-1);
        }

        static async void OnSessionsChanged(GlobalSystemMediaTransportControlsSessionManager sender, SessionsChangedEventArgs args)
        {
            await CheckAndEmitStatus();
        }

        static async void OnMediaPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args)
        {
            await CheckAndEmitStatus();
        }

        static async void OnPlaybackInfoChanged(GlobalSystemMediaTransportControlsSession sender, PlaybackInfoChangedEventArgs args)
        {
            await CheckAndEmitStatus();
        }

        static async Task CheckAndEmitStatus()
        {
            try
            {
                var session = GetCurrentSession();

                if (session == null)
                {
                    // No media playing
                    if (currentSession != null)
                    {
                        var disconnected = new
                        {
                            type = "media_disconnected",
                            data = new { connected = false }
                        };
                        Console.WriteLine(JsonSerializer.Serialize(disconnected));

                        currentSession.MediaPropertiesChanged -= OnMediaPropertiesChanged;
                        currentSession.PlaybackInfoChanged -= OnPlaybackInfoChanged;
                        currentSession = null;
                    }
                    return;
                }

                // New session
                if (currentSession == null || currentSession.SourceAppUserModelId != session.SourceAppUserModelId)
                {
                    if (currentSession != null)
                    {
                        currentSession.MediaPropertiesChanged -= OnMediaPropertiesChanged;
                        currentSession.PlaybackInfoChanged -= OnPlaybackInfoChanged;
                    }

                    currentSession = session;
                    currentSession.MediaPropertiesChanged += OnMediaPropertiesChanged;
                    currentSession.PlaybackInfoChanged += OnPlaybackInfoChanged;

                    var connected = new
                    {
                        type = "media_connected",
                        data = new { appName = GetAppName(session.SourceAppUserModelId) }
                    };
                    Console.WriteLine(JsonSerializer.Serialize(connected));
                }

                var playbackInfo = session.GetPlaybackInfo();
                var timelineProps = session.GetTimelineProperties();

                var mediaProperties = await session.TryGetMediaPropertiesAsync();
                bool isPlaying = playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;

                if (mediaProperties == null)
                {
                    // Emit a placeholder track if we haven't sent one yet for this session
                    if (lastTrackId == null)
                    {
                        lastTrackId = "unknown";
                        var trackChanged = new
                        {
                            type = "track_changed",
                            data = new
                            {
                                title = "Playing from " + GetAppName(session.SourceAppUserModelId),
                                artist = "Track information unavailable",
                                album = "",
                                duration = (int)timelineProps.EndTime.TotalSeconds,
                                artwork = (string?)null,
                                appName = GetAppName(session.SourceAppUserModelId)
                            }
                        };
                        Console.WriteLine(JsonSerializer.Serialize(trackChanged));
                    }

                    // Still emit playback state if we have it
                    if (isPlaying != lastIsPlaying)
                    {
                        lastIsPlaying = isPlaying;
                        var playbackStateChanged = new
                        {
                            type = "playback_state_changed",
                            data = new
                            {
                                isPlaying = isPlaying,
                                position = (int)timelineProps.Position.TotalSeconds
                            }
                        };
                        Console.WriteLine(JsonSerializer.Serialize(playbackStateChanged));
                    }
                    return;
                }

                string trackId = $"{mediaProperties.Title}|{mediaProperties.Artist}|{mediaProperties.AlbumTitle}";

                // Check if track changed
                if (trackId != lastTrackId)
                {
                    lastTrackId = trackId;

                    var trackChanged = new
                    {
                        type = "track_changed",
                        data = new
                        {
                            title = mediaProperties.Title ?? "Unknown",
                            artist = mediaProperties.Artist ?? "Unknown Artist",
                            album = mediaProperties.AlbumTitle ?? "Unknown Album",
                            duration = (int)timelineProps.EndTime.TotalSeconds,
                            artwork = (string?)null,
                            appName = GetAppName(session.SourceAppUserModelId)
                        }
                    };
                    Console.WriteLine(JsonSerializer.Serialize(trackChanged));
                }

                // Check if playback state changed
                if (isPlaying != lastIsPlaying)
                {
                    lastIsPlaying = isPlaying;

                    var playbackStateChanged = new
                    {
                        type = "playback_state_changed",
                        data = new
                        {
                            isPlaying = isPlaying,
                            position = (int)timelineProps.Position.TotalSeconds
                        }
                    };
                    Console.WriteLine(JsonSerializer.Serialize(playbackStateChanged));
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error in CheckAndEmitStatus: {ex.Message}");
            }
        }

        static async Task GetStatus()
        {
            var session = GetCurrentSession();

            if (session == null)
            {
                var response = new
                {
                    connected = false,
                    appName = (string?)null,
                    isPlaying = false,
                    track = (object?)null
                };
                Console.WriteLine(JsonSerializer.Serialize(response));
                return;
            }

            var mediaProperties = await session.TryGetMediaPropertiesAsync();
            var playbackInfo = session.GetPlaybackInfo();

            // Check if media properties are available
            if (mediaProperties == null)
            {
                var emptyStatus = new
                {
                    connected = true,
                    appName = GetAppName(session.SourceAppUserModelId),
                    isPlaying = playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
                    track = (object?)null
                };
                Console.WriteLine(JsonSerializer.Serialize(emptyStatus));
                return;
            }

            var status = new
            {
                connected = true,
                appName = GetAppName(session.SourceAppUserModelId),
                isPlaying = playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
                track = new
                {
                    title = mediaProperties.Title ?? "Unknown",
                    artist = mediaProperties.Artist ?? "Unknown Artist",
                    album = mediaProperties.AlbumTitle ?? "Unknown Album",
                    duration = 0,
                    position = 0,
                    artwork = (string?)null
                }
            };

            Console.WriteLine(JsonSerializer.Serialize(status));
        }

        static async Task SendCommand(string command)
        {
            var session = GetCurrentSession();

            if (session == null)
            {
                var response = new
                {
                    success = false,
                    error = "No active media session"
                };
                Console.WriteLine(JsonSerializer.Serialize(response));
                return;
            }

            bool success = false;

            switch (command)
            {
                case "play":
                    success = await session.TryPlayAsync();
                    break;
                case "pause":
                    success = await session.TryPauseAsync();
                    break;
                case "toggle":
                    success = await session.TryTogglePlayPauseAsync();
                    break;
                case "next":
                    success = await session.TrySkipNextAsync();
                    break;
                case "previous":
                    success = await session.TrySkipPreviousAsync();
                    break;
            }

            var result = new
            {
                success = success
            };
            Console.WriteLine(JsonSerializer.Serialize(result));
        }

        static GlobalSystemMediaTransportControlsSession? GetCurrentSession()
        {
            try
            {
                if (sessionManager == null)
                {
                    sessionManager = GlobalSystemMediaTransportControlsSessionManager.RequestAsync().GetAwaiter().GetResult();
                }

                var session = sessionManager.GetCurrentSession();

                // If GetCurrentSession returns null, try to get the first available session
                if (session == null)
                {
                    var sessions = sessionManager.GetSessions();
                    Console.Error.WriteLine($"GetCurrentSession returned null, trying fallback. Total sessions: {sessions.Count}");

                    if (sessions.Count > 0)
                    {
                        // Return the first session
                        session = sessions[0];
                        Console.Error.WriteLine($"Using first available session: {session.SourceAppUserModelId}");
                    }
                    else
                    {
                        Console.Error.WriteLine("No sessions available");
                    }
                }
                else
                {
                    Console.Error.WriteLine($"Current session: {session.SourceAppUserModelId}");
                }

                return session;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error in GetCurrentSession: {ex.Message}");
                return null;
            }
        }

        static string GetAppName(string appUserModelId)
        {
            // Parse common app names from the app user model ID
            if (string.IsNullOrEmpty(appUserModelId))
                return "Unknown App";

            if (appUserModelId.Contains("Spotify"))
                return "Spotify";
            if (appUserModelId.Contains("Chrome"))
                return "Google Chrome";
            if (appUserModelId.Contains("msedge"))
                return "Microsoft Edge";
            if (appUserModelId.Contains("Firefox"))
                return "Firefox";
            if (appUserModelId.Contains("vlc"))
                return "VLC";
            if (appUserModelId.Contains("iTunes") || appUserModelId.Contains("AppleMusic"))
                return "Apple Music";
            if (appUserModelId.Contains("MediaPlayer"))
                return "Windows Media Player";

            // Return the app ID if we can't determine a friendly name
            return appUserModelId;
        }
    }
}
