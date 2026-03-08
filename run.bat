@echo off
title MERN File Sharing App - Launcher
echo ==============================================
echo     Starting MERN Cloud File Sharing App
echo ==============================================
echo.

:: Force injection of Node.js path for the current session (avoids restart requirement)
set PATH=%PATH%;C:\Program Files\nodejs

:: Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not recognized in this terminal.
    echo Please restart your computer or Visual Studio Code so the new PATH is applied, then try again!
    pause
    exit
)

echo [1/3] Installing Dependencies...
echo Starting Background Processes...
echo.

:: Start Application (Backend + Frontend)
echo Starting App...
start "MERN App" cmd /k "set PATH=%PATH%;C:\Program Files\nodejs && npm install && npm run dev"
echo ==============================================
echo   Services are starting up!
echo   - Backend will run on http://localhost:5000
echo   - Frontend will open at http://localhost:5173
echo ==============================================
echo.
echo Please wait a few seconds for Vite to compile and open the browser...
timeout /t 5 >nul
start http://localhost:5173