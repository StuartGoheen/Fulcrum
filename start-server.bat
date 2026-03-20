@echo off
title Edge of the Empire — Local Server
echo ============================================
echo   The Edge of the Empire — Starting Server
echo ============================================
echo.

set PORT=5000

echo Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

echo Building CSS...
call npm run css:build
echo.

echo Starting server on port %PORT%...
echo Players can connect at:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   http://%%b:%PORT%
    )
)
echo   http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the server.
echo ============================================
echo.

node server/index.js

pause
