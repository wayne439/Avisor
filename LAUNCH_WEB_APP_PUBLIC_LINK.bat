@echo off
title PilotAvisor phone test (public HTTPS link)
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
echo [3/3] Starting app and public HTTPS tunnel...
echo.
echo - Window 1: Vite server ^(starts first^)
echo - Window 2: Public URL ^(https://....tunnelmole.net — use /avisor.html on the end^)
echo.
echo If Window 2 shows an error, wait until Window 1 says Vite is ready, then close Window 2 and run: npm run tunnel
echo.
echo Copy the HTTPS link from window 2, add /avisor.html if needed, and open in Chrome or Safari.
echo.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
)
start "PilotAvisor App Server" cmd /k "cd /d %~dp0 && npm run dev:lan -- --strictPort"
timeout /t 4 /nobreak >nul
start "PilotAvisor Tunnel Link" cmd /k "cd /d %~dp0 && npm run tunnel"
echo.
echo App server + tunnel windows are open.
echo Keep both windows running while testing on iPhone/iPad.
pause
