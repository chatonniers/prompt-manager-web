@echo off
powershell -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'agent.js' -WorkingDirectory 'C:\Users\I536576\promptdeck-agent' -WindowStyle Hidden -RedirectStandardOutput 'C:\Users\I536576\promptdeck-agent\agent.log' -RedirectStandardError 'C:\Users\I536576\promptdeck-agent\agent-err.log'"
