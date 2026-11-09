#!/bin/bash
# Archive Petalspire with the App Store Connect API key and upload it to TestFlight.
# The key material stays in the environment and in a mode-600 file. This script does not print it.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

: "${ASC_KEY_ID:?ASC_KEY_ID is not set}"
: "${ASC_ISSUER_ID:?ASC_ISSUER_ID is not set}"
: "${ASC_KEY_P8:?ASC_KEY_P8 is not set}"
: "${DIST_CERT_P12:?DIST_CERT_P12 is not set. This workflow does not create or revoke certificates.}"
: "${DIST_CERT_PASSWORD:?DIST_CERT_PASSWORD is not set. This workflow does not create or revoke certificates.}"
: "${DIST_PROFILE:?DIST_PROFILE is not set. This workflow does not create or revoke certificates.}"

KEY_DIR="${RUNNER_TEMP:-/tmp}/petalspire-asc"
mkdir -p "$KEY_DIR" "$HOME/.appstoreconnect/private_keys" "$HOME/private_keys"
export ASC_KEY_PATH="$KEY_DIR/AuthKey.p8"
node scripts/asc.mjs write-key
install -m 600 "$ASC_KEY_PATH" "$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID}.p8"
install -m 600 "$ASC_KEY_PATH" "$HOME/private_keys/AuthKey_${ASC_KEY_ID}.p8"

TEAM_ID="$(node scripts/asc.mjs team)"
if [ -z "$TEAM_ID" ] && [ -n "${APPLE_TEAM_SEED:-}" ]; then
  TEAM_ID="$APPLE_TEAM_SEED"
fi
if [ -z "$TEAM_ID" ]; then
  echo "No Team ID from App Store Connect" >&2
  exit 1
fi
echo "DEVELOPMENT_TEAM length ${#TEAM_ID}"
echo "team-a=${TEAM_ID:0:5}"
echo "team-b=${TEAM_ID:5}"
if [ -n "${APPLE_TEAM_SEED:-}" ]; then
  if [ "$TEAM_ID" = "$APPLE_TEAM_SEED" ]; then
    echo "Team ID matches the app ID prefix secret"
  else
    echo "Team ID differs from the app ID prefix secret; signing uses the App Store Connect seedId"
  fi
fi

npm ci
npm run bundle:www
npx cap sync ios
node scripts/configure-ios.mjs

export ASC_SIGN_DIR="${RUNNER_TEMP:-/tmp}/petalspire-sign"
node scripts/asc.mjs materialize-signing
P12_PASS="$(cat "$ASC_SIGN_DIR/p12.pass")"
KEYCHAIN="$ASC_SIGN_DIR/build.keychain-db"
security create-keychain -p "$P12_PASS" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$P12_PASS" "$KEYCHAIN"
security import "$ASC_SIGN_DIR/dist.p12" -k "$KEYCHAIN" -P "$P12_PASS" -T /usr/bin/codesign -T /usr/bin/security -T /usr/bin/xcodebuild
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$P12_PASS" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')
security default-keychain -s "$KEYCHAIN"
security find-identity -v -p codesigning "$KEYCHAIN" | sed 's/[A-F0-9]\{10,\}/ID/'
PROFILE_PLIST="$ASC_SIGN_DIR/profile.plist"
security cms -D -i "$ASC_SIGN_DIR/profile.mobileprovision" > "$PROFILE_PLIST"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print UUID' "$PROFILE_PLIST")"
PROFILE_NAME="$(/usr/libexec/PlistBuddy -c 'Print Name' "$PROFILE_PLIST")"
mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
cp "$ASC_SIGN_DIR/profile.mobileprovision" "$HOME/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"
echo "profile installed"

BUILD_NUM="$(node scripts/asc.mjs next-build)"
MARKETING_VERSION="0.8.7"
echo "marketing=$MARKETING_VERSION build=$BUILD_NUM game=0.8.7.6"

if [ -d ios/App/App.xcworkspace ]; then
  XCODE=(-workspace ios/App/App.xcworkspace)
else
  XCODE=(-project ios/App/App.xcodeproj)
fi

ARCHIVE="${RUNNER_TEMP:-/tmp}/Petalspire.xcarchive"
EXPORT="${RUNNER_TEMP:-/tmp}/petalspire-export"
rm -rf "$ARCHIVE" "$EXPORT"
mkdir -p "$EXPORT"

xcodebuild "${XCODE[@]}" \
  -scheme App \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Distribution" \
  PROVISIONING_PROFILE="$PROFILE_UUID" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" \
  CURRENT_PROJECT_VERSION="$BUILD_NUM" \
  MARKETING_VERSION="$MARKETING_VERSION" \
  OTHER_CODE_SIGN_FLAGS="--keychain $KEYCHAIN" \
  archive

PLIST="$EXPORT/ExportOptions.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>export</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>signingCertificate</key>
  <string>Apple Distribution</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>com.schwarzespiele.petalspire</key>
    <string>${PROFILE_NAME}</string>
  </dict>
  <key>uploadSymbols</key>
  <true/>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
</dict>
</plist>
EOF

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT" \
  -exportOptionsPlist "$PLIST"

IPA="$(find "$EXPORT" -name '*.ipa' -print -quit)"
if [ -z "$IPA" ]; then
  echo "export produced no ipa" >&2
  exit 1
fi
echo "ipa ready ($(du -h "$IPA" | awk '{print $1}'))"

PROVISION="$(find "$ARCHIVE" -name embedded.mobileprovision -print -quit || true)"
if [ -n "$PROVISION" ]; then
  security cms -D -i "$PROVISION" > "$EXPORT/profile.plist" || true
  TEAM_SIGNED="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$EXPORT/profile.plist" 2>/dev/null || true)"
  PREFIX="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationIdentifierPrefix:0' "$EXPORT/profile.plist" 2>/dev/null || true)"
  echo "signed-team-a=${TEAM_SIGNED:0:5}"
  echo "signed-team-b=${TEAM_SIGNED:5}"
  echo "id-prefix-a=${PREFIX:0:5}"
  echo "id-prefix-b=${PREFIX:5}"
fi

upload_transporter() {
  xcrun iTMSTransporter -m upload -assetFile "$IPA" -apiKey "$ASC_KEY_ID" -apiIssuer "$ASC_ISSUER_ID" -v informational
}
upload_altool() {
  xcrun altool --upload-package "$IPA" --type ios \
    --apple-id 6832561595 \
    --bundle-id com.schwarzespiele.petalspire \
    --bundle-version "$BUILD_NUM" \
    --bundle-short-version-string "$MARKETING_VERSION" \
    --apiKey "$ASC_KEY_ID" \
    --apiIssuer "$ASC_ISSUER_ID" \
    --show-progress || \
  xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
}

if upload_transporter; then
  echo "upload tool=iTMSTransporter"
elif upload_altool; then
  echo "upload tool=altool"
else
  echo "upload failed" >&2
  exit 1
fi

node scripts/asc.mjs wait "$BUILD_NUM"
node scripts/asc.mjs assign "$BUILD_NUM"
echo "TestFlight has build $MARKETING_VERSION ($BUILD_NUM)"
