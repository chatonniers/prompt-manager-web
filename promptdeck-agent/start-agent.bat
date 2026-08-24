@echo off
cd /d "%~dp0"
powershell -WindowStyle Hidden -Command "Start-Process 'node' -ArgumentList 'agent.js' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
