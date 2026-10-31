# Sports Hub Platform - Windows 1-Click Launch Script
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Starting Sports Hub Platform Services..." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"

# 1. Start Backend in background process
Write-Host "[1/2] Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
$backendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; `$env:PYTHONPATH='$backendDir'; ./venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -PassThru

# 2. Start Frontend in background process
Write-Host "[2/2] Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Green
$frontendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev" -PassThru

Write-Host "`nSports Hub Platform is booting up!" -ForegroundColor Yellow
Write-Host "• Frontend UI: http://localhost:3000" -ForegroundColor White
Write-Host "• Backend API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "• Health Status: http://localhost:8000/health" -ForegroundColor White
Write-Host "`nPress any key to exit this launcher window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

