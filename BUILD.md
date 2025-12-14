# Building Media Control Bridge for macOS

This guide explains how to build and distribute the Media Control Bridge app for macOS.

## Prerequisites

1. **macOS** (required for building macOS apps)
2. **Xcode Command Line Tools** (for code signing)
3. **Apple Developer Account** (for signing and notarization)
4. **Node.js** 18+ and npm

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Apple Developer Credentials

For signed and notarized builds, create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Apple credentials:

```env
APPLE_ID=your-apple-id@email.com
APPLE_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=22SGVMMH49
```

**Getting your credentials:**

- **APPLE_ID**: Your Apple ID email address
- **APPLE_PASSWORD**: Generate an app-specific password at [appleid.apple.com](https://appleid.apple.com)
  - Go to: Sign In → Security → App-Specific Passwords → Generate Password
- **APPLE_TEAM_ID**: Find at [developer.apple.com/account](https://developer.apple.com/account)
  - Go to: Membership → Team ID

### 3. Code Signing Certificate

Ensure you have the **"Creativeland, LLC (22SGVMMH49)"** certificate installed in Keychain Access.

If not available, update `package.json` to use your certificate:

```json
"mac": {
  "identity": "Your Developer Name (TEAM_ID)"
}
```

## Building

### Development Build (No Signing)

To test the app without signing:

```bash
npm start
```

### Production Build

Build a signed and notarized DMG for distribution:

```bash
# Build for both Intel and Apple Silicon
npm run dist

# Or build for specific architecture:
npm run dist:mac:arm    # Apple Silicon (M1/M2/M3)
npm run dist:mac:intel  # Intel
```

The built app will be in the `dist/` directory:

```
dist/
├── Media Control Bridge-1.0.0-mac-arm64.dmg
├── Media Control Bridge-1.0.0-mac-x64.dmg
└── mac/
    └── Media Control Bridge.app
```

## Build Process

When you run `npm run dist`, the following happens:

1. **Compilation**: Electron Builder packages your app
2. **Code Signing**: The app is signed with your Developer ID certificate
3. **Notarization**: The app is uploaded to Apple for notarization
4. **Stapling**: The notarization ticket is stapled to the app
5. **DMG Creation**: A distributable DMG is created

## Notarization

Notarization is required for distributing macOS apps outside the Mac App Store.

- The `notarize.js` script handles this automatically
- If credentials are missing, the build will succeed but skip notarization
- Notarization can take 1-5 minutes

**To skip notarization** (for testing):

- Don't set the Apple credentials in `.env`
- The app will still be signed but not notarized

## Entitlements

The app requires these entitlements (defined in `entitlements.plist`):

- **JIT compilation**: For Electron runtime
- **Network server/client**: For HTTP and WebSocket servers
- **Apple Events**: For AppleScript to control media apps

## Testing the Build

After building:

1. Mount the DMG: `open dist/Media\ Control\ Bridge-1.0.0-mac-arm64.dmg`
2. Drag the app to Applications
3. Run from Applications folder
4. Check the menu bar for the MCB icon

## Troubleshooting

### "Developer cannot be verified" Error

If you get this error when opening the app:

1. Right-click the app → Open (instead of double-clicking)
2. Click "Open" in the dialog

Or, if you built without notarization:

```bash
xattr -cr "/Applications/Media Control Bridge.app"
```

### Code Signing Errors

Check available certificates:

```bash
security find-identity -v -p codesigning
```

Ensure the certificate in `package.json` matches one from the list.

### Notarization Fails

Check notarization status:

```bash
xcrun notarytool log --apple-id YOUR_APPLE_ID --team-id 22SGVMMH49 SUBMISSION_ID
```

Common issues:
- Incorrect app-specific password
- Missing entitlements
- Invalid bundle ID

## Distribution

Once built and notarized:

1. Upload the DMG to your distribution channel (website, GitHub Releases, etc.)
2. Users can download and install without warnings
3. The app will run without "unidentified developer" dialogs

## App Properties

- **Bundle ID**: `com.creativeland.mediacontrolbridge`
- **Category**: Utilities
- **LSUIElement**: `true` (hides from Dock, menu bar only)
- **Hardened Runtime**: Enabled
- **Notarized**: Yes (when credentials provided)

## Additional Commands

```bash
# Start development server
npm start

# Clean build directory
rm -rf dist/

# Check app signature
codesign -dvv "dist/mac/Media Control Bridge.app"

# Verify notarization
spctl -a -vv "dist/mac/Media Control Bridge.app"
```

## Notes

- App icons are in the `assets/` directory (`mcb-icon.png` for tray, `mcb-app-icon.png` for app bundle)
- Build artifacts are in the `dist/` directory (gitignored)
- The app requires macOS 10.15+ (Catalina or later)
- Universal build includes both Intel and Apple Silicon binaries

## Support

For build issues, check:

- [Electron Builder Documentation](https://www.electron.build/)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
