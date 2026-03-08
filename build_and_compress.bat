@echo off
title Cloud Project - Build ^& Compress Tool
echo ==============================================
echo    Building and Compressing Project
echo ==============================================
echo.

:: 1. Build Frontend
echo [1/2] Building Frontend (Minifying Code)...
cd frontend
call npm run build
cd ..

:: 2. Compress Project (Excluding node_modules)
echo [2/2] Creating Project ZIP Archive (This skips node_modules to save space)...

:: Create an exclude file for xcopy
echo \node_modules\> exclude.txt
echo \.git\>> exclude.txt
echo \dist\>> exclude.txt
echo \uploads\>> exclude.txt
echo .zip>> exclude.txt
echo \temp_cloud_build_zip\>> exclude.txt

:: Copy to a temp folder
mkdir temp_cloud_build_zip 2>nul
xcopy . temp_cloud_build_zip /E /I /H /Y /EXCLUDE:exclude.txt >nul

:: Compress the temp folder
powershell -Command "Compress-Archive -Path temp_cloud_build_zip\* -DestinationPath 'Cloud_Project.zip' -Force"

:: Cleanup
rmdir /s /q temp_cloud_build_zip
del exclude.txt
echo.
echo ==============================================
echo   DONE! 
echo   - Minified code created in: frontend/dist
echo   - Full source code compressed to: Cloud_Project.zip
echo ==============================================
echo.
pause
