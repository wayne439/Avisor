@echo off
title PilotAvisor phone/iPad test (LAN)
cd /d "%~dp0"

if not exist "package.json" (
  echo This BAT file must live inside the avisor-native-shell folder.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm not found. Install LTS from https://nodejs.org/ then reopen this file.
  pause
  exit /b 1
)

echo.
echo [1/3] Installing dependencies if needed...
call npm install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/3] Copying planner from Desktop to public\avisor.html ...
call npm run sync:avisor
if errorlevel 1 (
  echo sync:avisor failed. Put avisor_v5.html on your Desktop, or set AVISOR_SRC to your HTML file path.
  pause
  exit /b 1
)

echo.
set /p LAN_IP=Enter your PC Wi-Fi IP (example 192.168.1.44): 
if "%LAN_IP%"=="" (
  echo No IP entered.
  pause
  exit /b 1
)
set "LAN_IP=%LAN_IP: =%"

echo.
echo [3/3] Starting LAN web server...
echo.
echo   >>> On this PC:         http://localhost:5173/avisor.html
echo   >>> On phone/iPad Wi-Fi: http://%LAN_IP%:5173/avisor.html
echo.
set "LAN_URL=http://%LAN_IP%:5173/avisor.html"
set "LINK_FILE=%~dp0PHONE_TEST_LINK.txt"
set "SHORTCUT_FILE=%~dp0PHONE_TEST_LINK.url"
(
  echo PilotAvisor Phone/iPad Test Link
  echo ===========================
  echo %LAN_URL%
  echo.
  echo Type this URL directly in phone/iPad Safari if needed.
) > "%LINK_FILE%"
(
  echo [InternetShortcut]
  echo URL=%LAN_URL%
) > "%SHORTCUT_FILE%"
echo   >>> Link file: %LINK_FILE%
echo   >>> Clickable shortcut: %SHORTCUT_FILE%
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
)

start "PilotAvisor LAN Server" cmd /k "cd /d %~dp0 && npm run dev:lan -- --strictPort"
timeout /t 4 /nobreak >nul
start "" "%SHORTCUT_FILE%"
start "" "%LINK_FILE%"
start "" "%LAN_URL%"

echo.
echo Make sure phone/iPad is on the SAME Wi-Fi network.
echo If it does not open, allow Node/Vite through Windows Firewall.
echo Keep the "PilotAvisor LAN Server" window open while testing.
echo.
echo iPhone/iPad web app: open the /avisor.html link in Safari, then Share ^> Add to Home Screen.
echo.
echo --- If testing does not work ---
echo 1) SYNC: avisor_v5.html must be on your Desktop, or set AVISOR_SRC to the full path of your HTML file before running this BAT.
echo 2) SERVER WINDOW: Leave "PilotAvisor LAN Server" open. If you see EADDRINUSE / port 5173, close other Vite terminals and run this BAT again.
echo 3) SAME Wi-Fi: Phone and PC must use the same network; use the PC Wi-Fi IP you typed ^(not cellular on the phone^).
echo 4) FIREWALL: Allow Node.js on Private networks when Windows asks ^(or allow TCP 5173^).
echo 5) OUTSIDE YOUR HOME ^(internet testers^): start this BAT, then open a NEW Command Prompt here and run:  npm run tunnel
echo    Use the HTTPS URL it prints + /avisor.html  ^(Vite must stay running on 5173^).
echo.
pause
