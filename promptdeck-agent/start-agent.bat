@echo off
powershell -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'agent.js' -WorkingDirectory '%USERPROFILE%\promptdeck-agent' -WindowStyle Hidden -RedirectStandardOutput '%USERPROFILE%\promptdeck-agent\agent.log' -RedirectStandardError '%USERPROFILE%\promptdeck-agent\agent-err.log'"
