#!/bin/bash
# Registers promptdeck:// URI scheme on macOS
# Run once: bash install-mac.sh

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.promptdeck.urischeme.plist"
APP_DIR="$HOME/Applications/PromptDeckAgent.app"

mkdir -p "$APP_DIR/Contents/MacOS"

cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.promptdeck.agent</string>
  <key>CFBundleName</key>
  <string>PromptDeckAgent</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>PromptDeck Agent</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>promptdeck</string>
      </array>
    </dict>
  </array>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
</dict>
</plist>
EOF

cat > "$APP_DIR/Contents/MacOS/launcher" <<EOF
#!/bin/bash
nohup node "$AGENT_DIR/agent.js" > "$AGENT_DIR/agent.log" 2>&1 &
EOF

chmod +x "$APP_DIR/Contents/MacOS/launcher"

/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP_DIR"

echo "promptdeck:// URI scheme registered. You can now use the Joule toggle in PromptDeck."
