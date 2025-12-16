#!/bin/bash
set -e

APP_PATH="$1"
APP_NAME=$(basename "$APP_PATH")

echo "Creating ZIP for notarization..."
cd "$(dirname "$APP_PATH")"
rm -f "${APP_NAME}.zip"
ditto -c -k --keepParent "$APP_NAME" "${APP_NAME}.zip"

echo "Submitting for notarization..."
xcrun notarytool submit "${APP_NAME}.zip" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_PASSWORD" \
  --wait

echo "Stapling notarization ticket..."
xcrun stapler staple "$APP_PATH"

echo "Cleaning up ZIP..."
rm -f "${APP_NAME}.zip"

echo "Notarization complete!"
