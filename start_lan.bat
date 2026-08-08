@echo off
echo =============================================
echo   BMU CBT - LAN Deployment Startup
echo =============================================
echo.

:: Auto-detect LAN IP
:: Uses a PowerShell helper script (avoids cmd quoting bugs) that picks the
:: adapter with a real default gateway (excludes VPNs and Hyper-V virtual
:: switches, which can have 0.0.0.0 or no gateway).
for /f "delims=" %%a in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0detect_lan_ip.ps1"') do set LAN_IP=%%a
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
    echo DEBUG=False
    echo ALLOWED_HOSTS=localhost,127.0.0.1,%LAN_IP%
    echo CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://%LAN_IP%:3000
    echo DB_NAME=cbt
    echo DB_USER=cbt_user
    echo DB_PASSWORD=BMUcbt@2026
    echo DB_HOST=127.0.0.1
    echo DB_PORT=3306
) > "%~dp0bmu_cbt\.env"

echo Configuration updated for IP: %LAN_IP%
echo.

:: Collect static files (admin/jazzmin CSS & JS). Required in production -
:: with DEBUG=False the admin theme is served from the collected staticfiles
:: folder, and a fresh machine won't have it until this runs.
cd /d %~dp0bmu_cbt
echo Collecting static files...
..\bmu_cbt\venv\Scripts\python.exe manage.py collectstatic --noinput
cd /d %~dp0

:: Start Django backend on 0.0.0.0:8000 using Waitress (production WSGI server).
:: Do NOT use "manage.py runserver" for exam day - it is the dev server and
:: cannot handle hundreds of concurrent students.
echo Starting Django backend on port 8000...
start "Django CBT Backend" cmd /k "cd /d %~dp0bmu_cbt && ..\bmu_cbt\venv\Scripts\python.exe -m waitress --listen=0.0.0.0:8000 --threads=8 bmu_cbt.wsgi:application"

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
