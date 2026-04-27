@echo off
title PilotAvisor web test
cd /d "%~dp0"

if not exist "package.json" (
  echo This BAT file must live inside the avisor-native-shell folder.
  pause
  exit /b 1
)

echo.
echo Launch target:
echo   1 = This PC only (localhost)
echo   2 = Phone/iPad on same Wi-Fi (LAN)
choice /c 12 /n /m "Press 1 or 2: "
if errorlevel 2 (
  call "%~dp0LAUNCH_WEB_APP_PHONE_IPAD.bat"
  exit /b %errorlevel%
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
echo [3/3] Starting web server...
echo.
echo   >>> Open this in Chrome or Edge:  http://localhost:5173/
echo   >>> Then click "Open PilotAvisor planner"
echo.
echo Press Ctrl+C in this window to stop the server.
echo.

call npm run dev
pause
