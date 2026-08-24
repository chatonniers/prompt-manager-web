# PromptDeck Agent — automated installer
# Usage (run once in PowerShell):
#   irm https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent/install.ps1 | iex

$ErrorActionPreference = "Stop"
$AgentDir = "$env:USERPROFILE\promptdeck-agent"
$AgentRepo = "https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent"

Write-Host ""
Write-Host "=== PromptDeck Agent Installer ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Ensure Node.js 18+ ────────────────────────────────────────────────────
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeOk = $false
try {
    $v = & node --version 2>$null
    if ($v -match "v(\d+)" -and [int]$Matches[1] -ge 18) {
        Write-Host "  Node.js $v found." -ForegroundColor Green
        $nodeOk = $true
    }
} catch {}

if (-not $nodeOk) {
    Write-Host "  Installing Node.js via winget..." -ForegroundColor Yellow
    try {
        winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "  Node.js installed." -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: Could not install Node.js automatically." -ForegroundColor Red
        Write-Host "  Please install Node.js 18+ from https://nodejs.org then re-run this command." -ForegroundColor Red
        exit 1
    }
}

# ── 2. Download agent files ──────────────────────────────────────────────────
Write-Host "Downloading PromptDeck Agent..." -ForegroundColor Yellow
if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir | Out-Null }

$files = @("agent.js", "package.json", "start-agent.bat")
foreach ($f in $files) {
    Invoke-WebRequest -Uri "$AgentRepo/$f" -OutFile "$AgentDir\$f" -UseBasicParsing
}
Write-Host "  Downloaded to $AgentDir" -ForegroundColor Green

# ── 3. npm install ───────────────────────────────────────────────────────────
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $AgentDir
try {
    & npm install --silent
    Write-Host "  Done." -ForegroundColor Green
} finally {
    Pop-Location
}

# ── 4. Register promptdeck:// URI scheme ─────────────────────────────────────
Write-Host "Registering promptdeck:// URI scheme..." -ForegroundColor Yellow
$batPath = "$AgentDir\start-agent.bat"
$regContent = @"
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\promptdeck]
@="PromptDeck Agent"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\promptdeck\shell]

[HKEY_CURRENT_USER\Software\Classes\promptdeck\shell\open]

[HKEY_CURRENT_USER\Software\Classes\promptdeck\shell\open\command]
@="cmd /c \"$($batPath.Replace('\','\\'))\""
"@
$regFile = "$env:TEMP\promptdeck-uri.reg"
$regContent | Out-File -FilePath $regFile -Encoding ascii
reg import $regFile | Out-Null
Remove-Item $regFile -Force
Write-Host "  Registered." -ForegroundColor Green

# ── 5. Start agent now ───────────────────────────────────────────────────────
Write-Host "Starting PromptDeck Agent..." -ForegroundColor Yellow
Start-Process "node" -ArgumentList "agent.js" -WorkingDirectory $AgentDir -WindowStyle Hidden
Start-Sleep -Seconds 3

try {
    $s = Invoke-RestMethod -Uri "http://localhost:27384/status" -TimeoutSec 5
    if ($s.running) { Write-Host "  Agent is running!" -ForegroundColor Green }
} catch {
    Write-Host "  Agent starting — may take a few more seconds." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done! Return to PromptDeck and click 'Try again'. ===" -ForegroundColor Cyan
Write-Host ""
