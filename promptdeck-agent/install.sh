#!/bin/bash
# PromptDeck Agent — macOS/Linux automated installer
# Usage (run once in Terminal):
#   curl -fsSL https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent/install.sh | bash

set -e
AGENT_DIR="$HOME/promptdeck-agent"
AGENT_REPO="https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent"

echo ""
echo "=== PromptDeck Agent Installer ==="
echo ""

# ── 1. Ensure Node.js 18+ ────────────────────────────────────────────────────
echo "Checking Node.js..."
NODE_OK=false
if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
        echo "  Node.js $(node --version) found."
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" = false ]; then
    if ! command -v brew &>/dev/null; then
        echo "  Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    echo "  Installing Node.js via Homebrew..."
    brew install node
    echo "  Node.js installed."
fi

# ── 2. Download agent files ──────────────────────────────────────────────────
echo "Downloading PromptDeck Agent to $AGENT_DIR..."
mkdir -p "$AGENT_DIR"
for f in agent.js package.json start-agent.sh; do
    curl -fsSL "$AGENT_REPO/$f" -o "$AGENT_DIR/$f"
done
chmod +x "$AGENT_DIR/start-agent.sh"
echo "  Downloaded."

# ── 3. npm install ───────────────────────────────────────────────────────────
echo "Installing dependencies..."
cd "$AGENT_DIR"
npm install --silent
echo "  Done."

# ── 4. Register promptdeck:// URI scheme ─────────────────────────────────────
echo "Registering promptdeck:// URI scheme..."
APP_DIR="$HOME/Applications/PromptDeckAgent.app"
mkdir -p "$APP_DIR/Contents/MacOS"

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>com.promptdeck.agent</string>
  <key>CFBundleName</key><string>PromptDeckAgent</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleURLTypes</key>
  <array><dict>
    <key>CFBundleURLName</key><string>PromptDeck Agent</string>
    <key>CFBundleURLSchemes</key><array><string>promptdeck</string></array>
  </dict></array>
</dict>
</plist>
PLIST

cat > "$APP_DIR/Contents/MacOS/launcher" <<LAUNCHER
#!/bin/bash
nohup node "$AGENT_DIR/agent.js" > "$AGENT_DIR/agent.log" 2>&1 &
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/launcher"

/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP_DIR"
echo "  Registered."

# ── 5. Start agent now ───────────────────────────────────────────────────────
echo "Starting PromptDeck Agent..."
nohup node "$AGENT_DIR/agent.js" > "$AGENT_DIR/agent.log" 2>&1 &
sleep 3

if curl -sf http://localhost:27384/status 2>/dev/null | grep -q '"running":true'; then
    echo "  Agent is running!"
else
    echo "  Agent starting — may take a few more seconds."
fi

echo ""
echo "=== Done! Return to PromptDeck and click 'Try again'. ==="
echo ""
