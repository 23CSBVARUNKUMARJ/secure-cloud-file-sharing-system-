@echo off
title MERN File Sharing App - Stopper
echo ==============================================
echo    Safely Stopping All Services...
echo ==============================================
echo.

:: Kill all node processes (Backend, Frontend, and LocalTunnel)
echo [1/2] Terminating Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1

:: Kill any stray cmd windows titled with our app names if possible
:: Note: taskkill by title is tricky, but killing node usually stops the heart of the app.

:: Kill localtunnel specifically if it's named separately
echo [2/2] Cleaning up tunnel connections...
taskkill /F /IM lt.exe /T >nul 2>&1

echo.
echo ==============================================
echo   SUCCESS: All services have been stopped.
echo ==============================================
echo.
timeout /t 3
exit
