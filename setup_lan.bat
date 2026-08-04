@echo off
echo =============================================
echo   BMU CBT - First-Time LAN Setup
echo =============================================
echo.
echo This builds the frontend for production.
echo Run this once before the first LAN deployment.
echo.

echo [1/2] Installing frontend dependencies...
cd /d "%~dp0bmu_cbt\frontend"
call npm install

echo.
echo [2/2] Building frontend for production...
call npm run build

echo.
echo =============================================
echo   Build complete!
echo   Run start_lan.bat to launch both servers.
echo =============================================
pause
