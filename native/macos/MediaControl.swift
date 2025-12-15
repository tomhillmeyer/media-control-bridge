#!/usr/bin/swift
import AppKit
import Foundation

// MediaRemote action codes
enum MediaAction: Int {
    case play = 0
    case pause = 1
    case togglePlayPause = 2
    case stop = 3
    case nextTrack = 4
    case previousTrack = 5
}

class MediaController {
    private var bundle: CFBundle?

    init() throws {
        guard let frameworkURL = URL(string: "/System/Library/PrivateFrameworks/MediaRemote.framework"),
              let bundle = CFBundleCreate(kCFAllocatorDefault, frameworkURL as CFURL) else {
            throw NSError(domain: "MediaControl", code: 1,
                         userInfo: [NSLocalizedDescriptionKey: "Unable to load MediaRemote framework"])
        }
        self.bundle = bundle
    }

    func sendCommand(_ action: MediaAction) -> Bool {
        guard let bundle = bundle else { return false }

        let command = unsafeBitCast(
            CFBundleGetFunctionPointerForName(bundle, "MRMediaRemoteSendCommand" as CFString),
            to: (@convention(c) (Int, Any?) -> Bool).self
        )

        return command(action.rawValue, nil)
    }

    func getNowPlayingInfo(completion: @escaping ([String: Any]) -> Void) {
        guard let bundle = bundle else {
            completion([:])
            return
        }

        let command = unsafeBitCast(
            CFBundleGetFunctionPointerForName(bundle, "MRMediaRemoteGetNowPlayingInfo" as CFString),
            to: (@convention(c) (DispatchQueue, @escaping ([String: Any]) -> Void) -> Void).self
        )

        command(DispatchQueue.global(qos: .default)) { info in
            completion(info)
        }
    }

    func getApplicationInfo(completion: @escaping ([String: Any]) -> Void) {
        guard let bundle = bundle else {
            completion([:])
            return
        }

        let command = unsafeBitCast(
            CFBundleGetFunctionPointerForName(bundle, "MRMediaRemoteGetNowPlayingApplicationIsPlaying" as CFString),
            to: (@convention(c) (DispatchQueue, @escaping (Bool) -> Void) -> Void).self
        )

        command(DispatchQueue.global(qos: .default)) { isPlaying in
            completion(["isPlaying": isPlaying])
        }
    }
}

// Command-line interface
func printJSON(_ dict: [String: Any]) {
    if let jsonData = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
       let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    }
}

func main() {
    let args = CommandLine.arguments

    guard args.count > 1 else {
        print("Usage: MediaControl <command>")
        print("Commands:")
        print("  get        - Get now playing info")
        print("  play       - Play")
        print("  pause      - Pause")
        print("  toggle     - Toggle play/pause")
        print("  next       - Next track")
        print("  previous   - Previous track")
        exit(1)
    }

    let command = args[1]

    do {
        let controller = try MediaController()

        switch command {
        case "get":
            let semaphore = DispatchSemaphore(value: 0)
            controller.getNowPlayingInfo { info in
                printJSON(info)
                semaphore.signal()
            }
            semaphore.wait()

        case "play":
            let success = controller.sendCommand(.play)
            printJSON(["success": success])

        case "pause":
            let success = controller.sendCommand(.pause)
            printJSON(["success": success])

        case "toggle":
            let success = controller.sendCommand(.togglePlayPause)
            printJSON(["success": success])

        case "next":
            let success = controller.sendCommand(.nextTrack)
            printJSON(["success": success])

        case "previous":
            let success = controller.sendCommand(.previousTrack)
            printJSON(["success": success])

        default:
            print("Unknown command: \(command)")
            exit(1)
        }

    } catch {
        printJSON(["error": error.localizedDescription])
        exit(1)
    }
}

main()
