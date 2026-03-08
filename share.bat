:: cspell:disable
@echo off
title Secure Cloud - Public Link Generator
echo ========================================================
echo   Generating Public HTTPS Link for Secure Cloud
echo ========================================================
echo.
echo Instructions:
echo 1. Wait a few seconds for an SSH connection to establish.
echo 2. You will see a green link that looks like: "your url is: https://[random-string].loca.lt"
echo 3. Copy out that EXACT link. That is your Public Sharing Link!
echo 4. Send this link to your friends or open it on your phone.
echo 5. IMPORTANT: Keep this black window OPEN. If you close it, the link dies.
echo.
echo ========================================================
echo   YOUR TUNNEL PASSWORD (REQUIRED FOR FIRST VISIT):
echo ========================================================
curl -s ifconfig.me
echo.
echo.
echo Please give this password to your friend!
echo ========================================================
echo.
echo Starting Tunnel...
call npx -y localtunnel --port 5173
pause
