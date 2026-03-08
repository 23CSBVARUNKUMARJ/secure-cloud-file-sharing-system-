:: cspell:disable
@echo off
title Cloud Secure - Master Controller
setlocal

echo ==============================================
echo    CLOUD SECURE - PREMIUM SYSTEM LAUNCHER
echo ==============================================
echo.

:: 1. Force kill any hanging processes on ports 5000 and 5173
echo [1/4] Cleaning up system ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

:: 2. Install dependencies if node_modules missing (Optional but safe)
if not exist node_modules (
    echo [2/4] Installing root dependencies...
    call npm install --no-audit >nul 2>&1
)

:: 3. Launch the Stack
echo [3/4] Initializing Frontend ^& Backend...
start "CLOUD_SECURE_SERVER" cmd /k "echo Server Console && npm run dev"

:: 4. Connectivity Check (Wait for ports)
echo [4/4] Stabilizing connection threads...
:check_ports
timeout /t 2 >nul
netstat -an | findstr :5000 >nul
if errorlevel 1 goto check_ports

:: Finalize and show link
powershell -Command "(Invoke-WebRequest api.ipify.org).Content" > "%~dp0ip.tmp"
set /p IP_ADDR= < "%~dp0ip.tmp"
del "%~dp0ip.tmp"

cls
echo ==============================================
echo    SYSTEM ONLINE - ACTIVE CLOUD SECURE
echo ==============================================
echo.
echo    INTERNAL ACCESS: http://localhost:5173
echo    EXTERNAL LINK:   https://varun-cloud-v2.loca.lt
echo    TUNNEL PASSWORD: %IP_ADDR%
echo.
echo ==============================================
echo.
echo Starting Tunnel...
start http://localhost:5173
npx -y localtunnel --port 5173 --subdomain varun-cloud-v2 --local-host 127.0.0.1
pause
