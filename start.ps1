# WhatsApp Campaign Manager PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Launching WhatsApp Campaign Manager..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptRoot = $PSScriptRoot

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot'; .\backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8090 --reload"

# Start WhatsApp Gateway
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\whatsapp-gateway'; node server.js"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptRoot\frontend'; npm run dev"

Write-Host "`nAll services have been started:" -ForegroundColor Green
Write-Host " - Frontend:         http://localhost:5180" -ForegroundColor Yellow
Write-Host " - Backend API:      http://127.0.0.1:8090" -ForegroundColor Yellow
Write-Host " - WhatsApp Gateway: http://127.0.0.1:3050" -ForegroundColor Yellow

Start-Sleep -Seconds 2
Start-Process "http://localhost:5180"
