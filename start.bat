@echo off
title WhatsApp Campaign Manager Launcher
echo ========================================================
echo   Launching WhatsApp Campaign Manager...
echo ========================================================
echo.

:: Start Backend
start "WhatsApp Backend (Port 8090)" cmd /k "cd /d "%~dp0" && .\backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8090 --reload"

:: Start WhatsApp Gateway
start "WhatsApp Gateway (Port 3050)" cmd /k "cd /d "%~dp0whatsapp-gateway" && node server.js"

:: Start Frontend Vite Dev Server
start "WhatsApp Frontend (Port 5180)" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5180"

echo.
echo All services have been launched:
echo  - Frontend:         http://localhost:5180
echo  - Backend API:      http://127.0.0.1:8090
echo  - WhatsApp Gateway: http://127.0.0.1:3050
echo.
ping 127.0.0.1 -n 4 >nul
start http://localhost:5180
