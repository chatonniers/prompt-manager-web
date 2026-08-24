# PromptDeck Agent

A tiny local HTTP server that bridges PromptDeck (browser) with Joule Desktop.

Runs on `http://localhost:27384`.

## Quick start

```bash
npm install
node agent.js
```

Keep it running in the background whenever you want to use Joule Desktop integration from PromptDeck.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /status | Check agent is up |
| GET | /joule/status | Is Joule Desktop running? |
| POST | /joule/launch | Launch or focus Joule Desktop |
| GET | /skills | List installed skill names |
| POST | /skills/check | `{ name }` → `{ installed, id }` |
| POST | /skills/install | `{ name, content }` → `{ ok, id }` |

## Build standalone .exe (optional)

```bash
npm install
npx pkg agent.js --target node18-win-x64 --output promptdeck-agent.exe
```

Then run `promptdeck-agent.exe` directly — no Node.js required.

## What it does

- Checks if Joule Desktop is running via PowerShell `Get-Process`
- Launches Joule Desktop from its install path
- Focuses Joule via `joule://open` URI scheme
- Reads/writes skills in `%APPDATA%\Joule Desktop\skills\{uuid}\SKILL.md`
- Skill name must be kebab-case (e.g. `my-demo-skill`)

## Security

- Binds to `127.0.0.1` only — not accessible from network
- CORS restricted to `https://chatonniers.github.io` and `localhost`
