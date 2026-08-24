/**
 * PromptDeck Agent — local companion for Joule Desktop integration
 * Runs on http://localhost:27384
 *
 * Endpoints:
 *   GET  /status                → { running: bool, version: "1.0.0" }
 *   GET  /joule/status          → { running: bool, installed: bool }
 *   POST /joule/launch          → launches / focuses Joule Desktop
 *   POST /joule/send-prompt     → { prompt } → focus Joule, paste & submit prompt
 *   GET  /skills                → list installed skill names
 *   POST /skills/check          → { name } → { installed: bool, id? }
 *   POST /skills/install        → { name, content } → { ok, id }
 *   POST /shutdown              → graceful exit
 */

import http from 'http';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const PORT = 27384;
const ALLOWED_ORIGIN = 'https://chatonniers.github.io';
const ALLOWED_ORIGIN_LOCAL = 'http://localhost:5173';

// ── Joule exe detection ──────────────────────────────────────────────────────

function findJouleExe() {
  // 1. Windows registry (handles custom install paths)
  try {
    const regOut = execSync(
      'reg query "HKCU\\Software\\Classes\\joule\\shell\\open\\command" /ve',
      { timeout: 3000, encoding: 'utf8' }
    );
    const match = regOut.match(/"([^"]+Joule Desktop\.exe)"/i);
    if (match) return match[1];
  } catch { /* registry key absent */ }

  // 2. Fallback: standard install paths (no hardcoded usernames)
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Joule Desktop', 'Joule Desktop.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Joule Desktop', 'Joule Desktop.exe'),
    path.join('C:', 'Program Files', 'Joule Desktop', 'Joule Desktop.exe'),
    path.join('C:', 'Program Files (x86)', 'Joule Desktop', 'Joule Desktop.exe'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

// Skills dir uses APPDATA env var — no hardcoded path
const SKILLS_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Joule Desktop', 'skills'
);

// ── Joule process helpers ────────────────────────────────────────────────────

function isJouleRunning() {
  try {
    const out = execSync(
      'powershell -Command "if (Get-Process \'Joule Desktop\' -ErrorAction SilentlyContinue) { \'yes\' } else { \'no\' }"',
      { timeout: 3000 }
    ).toString().trim();
    return out === 'yes';
  } catch {
    return false;
  }
}

function launchJoule() {
  const exe = findJouleExe();
  if (!exe) throw new Error('Joule Desktop executable not found. Make sure Joule Desktop is installed.');
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
}

function focusJoule() {
  execSync('start joule://open', { shell: true, timeout: 3000 });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Paste text into the active Joule Desktop window and press Enter.
 * Strategy:
 *  1. Put prompt text on clipboard via PowerShell
 *  2. Launch or focus the Joule window
 *  3. Wait for window to be ready
 *  4. Send Ctrl+V then Enter via PowerShell SendKeys
 */
async function sendPromptToJoule(promptText) {
  const wasRunning = isJouleRunning();

  // 1. Put text on clipboard (PowerShell, no external deps)
  const escaped = promptText
    .replace(/'/g, "''")       // escape single quotes for PS string
    .replace(/[\r\n]+/g, ' '); // flatten newlines — Joule input is single-line trigger
  execSync(
    `powershell -Command "Set-Clipboard -Value '${escaped}'"`,
    { timeout: 5000 }
  );

  // 2. Launch or focus Joule
  if (!wasRunning) {
    launchJoule();
    // Wait for Joule to fully start up before sending keys
    await sleep(6000);
  } else {
    focusJoule();
    await sleep(1500);
  }

  // 3. Focus Joule window and send Ctrl+V + Enter via PowerShell UI automation
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
$joule = Get-Process 'Joule Desktop' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($joule) {
  [Win32]::ShowWindow($joule.MainWindowHandle, 9)
  [Win32]::SetForegroundWindow($joule.MainWindowHandle)
  Start-Sleep -Milliseconds 1200
  [System.Windows.Forms.SendKeys]::SendWait('^v')
  Start-Sleep -Milliseconds 500
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  Write-Output 'sent'
} else {
  Write-Output 'not-found'
}
`.trim();

  const tmpPs1 = path.join(os.tmpdir(), `pd-sendkeys-${Date.now()}.ps1`);
  fs.writeFileSync(tmpPs1, ps, 'utf8');
  let result;
  try {
    result = execSync(`powershell -ExecutionPolicy Bypass -File "${tmpPs1}"`, { timeout: 10000, encoding: 'utf8' });
    result = result.split(/\r?\n/).map(l => l.trim()).filter(Boolean).pop() || '';
    console.log('[send-prompt] PS result:', JSON.stringify(result));
  } catch (e) {
    console.error('[send-prompt] PS error:', e.message, e.stderr);
    result = 'error';
  } finally {
    try { fs.unlinkSync(tmpPs1); } catch { /* ignore */ }
  }
  return result === 'sent';
}

// ── Skill helpers ─────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return meta;
}

function getInstalledSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  const skills = [];
  for (const entry of fs.readdirSync(SKILLS_DIR)) {
    const skillMd = path.join(SKILLS_DIR, entry, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    try {
      const content = fs.readFileSync(skillMd, 'utf8');
      const meta = parseFrontmatter(content);
      if (meta.name) skills.push({ id: entry, name: meta.name, description: meta.description || '' });
    } catch { /* skip unreadable */ }
  }
  return skills;
}

function findSkill(name) {
  return getInstalledSkills().find(s => s.name === name) || null;
}

function installSkill(name, content) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Invalid skill name — must be kebab-case (e.g. my-skill)');
  }
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
  const id = uuidv4();
  const skillDir = path.join(SKILLS_DIR, id);
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  return id;
}

// ── CORS + HTTP helpers ───────────────────────────────────────────────────────

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN_LOCAL || origin.startsWith('http://localhost:')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/status') {
      return send(res, 200, { running: true, version: '1.0.0' });
    }

    if (req.method === 'GET' && url.pathname === '/joule/status') {
      return send(res, 200, { running: isJouleRunning(), installed: !!findJouleExe() });
    }

    if (req.method === 'POST' && url.pathname === '/joule/launch') {
      const running = isJouleRunning();
      if (!running) launchJoule();
      else focusJoule();
      return send(res, 200, { ok: true, wasRunning: running });
    }

    // POST /joule/send-prompt  { prompt: string }
    if (req.method === 'POST' && url.pathname === '/joule/send-prompt') {
      const { prompt } = await readBody(req);
      if (!prompt || typeof prompt !== 'string') return send(res, 400, { error: 'prompt required' });
      const ok = await sendPromptToJoule(prompt);
      return send(res, 200, { ok });
    }

    if (req.method === 'GET' && url.pathname === '/skills') {
      return send(res, 200, getInstalledSkills());
    }

    if (req.method === 'POST' && url.pathname === '/skills/check') {
      const { name } = await readBody(req);
      if (!name) return send(res, 400, { error: 'name required' });
      const found = findSkill(name);
      return send(res, 200, { installed: !!found, id: found?.id || null });
    }

    if (req.method === 'POST' && url.pathname === '/skills/install') {
      const { name, content } = await readBody(req);
      if (!name || !content) return send(res, 400, { error: 'name and content required' });
      const existing = findSkill(name);
      if (existing) return send(res, 200, { ok: true, id: existing.id, alreadyInstalled: true });
      const id = installSkill(name, content);
      return send(res, 200, { ok: true, id });
    }

    if (req.method === 'POST' && url.pathname === '/shutdown') {
      send(res, 200, { ok: true });
      setTimeout(() => { server.close(() => process.exit(0)); }, 200);
      return;
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PromptDeck Agent running on http://localhost:${PORT}`);
  console.log(`Joule Desktop exe: ${findJouleExe() || 'NOT FOUND'}`);
  console.log(`Skills dir: ${SKILLS_DIR}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use — agent may already be running.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down PromptDeck Agent…`);
  server.close(() => { console.log('Agent stopped.'); process.exit(0); });
  setTimeout(() => process.exit(1), 3000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
