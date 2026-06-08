@echo off
setlocal EnableExtensions
set "PROJECT_DIR=%~dp0"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"

echo =======================================================
echo Knobs and Slides Studio 1.2.29 - Frontend Startup
echo =======================================================
echo.
echo Frontend folder: %FRONTEND_DIR%
echo.

if not exist "%FRONTEND_DIR%\index.html" (
    echo ERROR: frontend\index.html was not found.
    echo Please extract the complete ZIP before running this file.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\src\main.jsx" (
    echo WARNING: frontend\src\main.jsx was not found.
    echo This usually means the ZIP was not fully extracted or the script is being run from the wrong folder.
    echo.
    echo Starting the backend-served production app instead.
    echo Open: http://localhost:8000
    echo.
    call "%PROJECT_DIR%start_app_windows.bat"
    exit /b 0
)

cd /d "%FRONTEND_DIR%"

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not available in PATH.
    echo Install Node.js LTS from https://nodejs.org/ and reopen Command Prompt.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm is not installed or not available in PATH.
    echo Reinstall Node.js LTS and make sure npm is selected.
    pause
    exit /b 1
)

echo Node version:
node -v
echo npm version:
call npm -v
echo.

echo Setting npm registry...
call npm config set registry https://registry.npmjs.org/

if not exist node_modules goto INSTALL_DEPS
if not exist node_modules\.bin\vite.cmd goto CLEAN_INSTALL
if not exist node_modules\react goto CLEAN_INSTALL
goto START_DEV

:INSTALL_DEPS
echo Installing frontend dependencies...
call npm install --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 goto CLEAN_INSTALL
if not exist node_modules\.bin\vite.cmd goto CLEAN_INSTALL
goto START_DEV

:CLEAN_INSTALL
echo.
echo Running clean frontend dependency install...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
call npm cache clean --force
call npm install --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo ERROR: Frontend dependency installation failed.
    echo You can still use the backend-served app by running start_app_windows.bat.
    pause
    exit /b 1
)
if not exist node_modules\.bin\vite.cmd (
    echo.
    echo ERROR: Vite was still not installed locally.
    echo You can still use the backend-served app by running start_app_windows.bat.
    pause
    exit /b 1
)

:START_DEV
echo.
echo Confirming source file exists:
dir src\main.jsx

echo.
echo Starting frontend at http://localhost:5173 ...
echo Keep this window open while using the app.
echo.
call npm run dev
if errorlevel 1 (
    echo.
    echo Frontend dev server did not start.
    echo Use start_app_windows.bat and open http://localhost:8000 as the stable local option.
)

pause
