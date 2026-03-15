@echo off
title The Edge of the Empire — Campaign Server
setlocal

echo.
echo  =====================================================
echo   THE EDGE OF THE EMPIRE — Campaign System
echo  =====================================================
echo.

cd /d "%~dp0"
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Could not navigate to server directory.
    echo  Path: %~dp0
    echo.
    goto :error
)

echo  [OK]  Working directory: %CD%
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Install from: https://nodejs.org
    echo.
    goto :error
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo  [OK]  Node.js %NODE_VER%

if not exist "node_modules" (
    echo.
    echo  [SETUP] node_modules not found. Running npm install...
    echo.
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  [ERROR] npm install failed.
        goto :error
    )
    echo.
)

echo  [OK]  Dependencies ready.
echo.
echo  [CSS]  Building stylesheet...
call npm run css:build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] CSS build failed.
    echo  Check: tailwind.config.js and css/input.css
    goto :error
)
echo  [CSS]  Done.
echo.
echo  -------------------------------------------------------
echo   LOCAL     http://localhost:3000
echo   NETWORK   http://^<your-local-ip^>:3000
echo  -------------------------------------------------------
echo.
echo  [SERVER] Running. Press Ctrl+C to stop.
echo.

call npm run dev

echo.
echo  -------------------------------------------------------
echo  [INFO] Server stopped.
echo  -------------------------------------------------------
goto :done

:error
echo.
echo  -------------------------------------------------------
echo  [FAIL] Server did not start. See error above.
echo  -------------------------------------------------------

:done
echo.
echo  Press any key to close this window...
pause >nul
endlocal
