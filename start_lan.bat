@echo off
echo =============================================
echo   BMU CBT - LAN Deployment Startup
echo =============================================
echo.

:: Auto-detect LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    for /f "tokens=*" %%b in ("%%a") do set LAN_IP=%%b
)
set LAN_IP=%LAN_IP: =%

if "%LAN_IP%"=="" (
    echo ERROR: Could not detect LAN IP. Make sure you are connected to a network.
    pause
    exit /b 1
)

echo Detected LAN IP: %LAN_IP%
echo.

:: Update Django .env with detected IP
echo Updating Django configuration...
(
    echo SECRET_KEY=django-insecure-s^j6vfedmuud=bnswpt$%%bn#3+%%nkc30+$0vjppa^&1ieawstr7
    echo DEBUG=True
    echo ALLOWED_HOSTS=localhost,127.0.0.1,%LAN_IP%
    echo CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://%LAN_IP%:3000
) > "%~dp0bmu_cbt\.env"

echo Configuration updated for IP: %LAN_IP%
echo.

:: Start Django backend on 0.0.0.0:8000
echo Starting Django backend on port 8000...
start "Django CBT Backend" cmd /k "cd /d %~dp0bmu_cbt && ..\bmu_cbt\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"

:: Wait a moment for Django to start
timeout /t 3 /nobreak >nul

:: Start Next.js frontend on 0.0.0.0:3000
echo Starting Next.js frontend on port 3000...
start "Next.js CBT Frontend" cmd /k "cd /d %~dp0bmu_cbt\frontend && npx next start -H 0.0.0.0 -p 3000"

echo.
echo =============================================
echo   Both servers are starting!
echo   Frontend: http://%LAN_IP%:3000
echo   Backend:  http://%LAN_IP%:8000/api
echo   Admin:    http://%LAN_IP%:8000/admin
echo.
echo   Students open: http://%LAN_IP%:3000
echo =============================================
echo.
echo Close this window or press Ctrl+C to stop both servers.
pause
