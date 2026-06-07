@echo off
setlocal EnableExtensions
cd /d "%~dp0frontend"

echo =======================================================
echo Knobs and Slides Studio 1.2.8 - Frontend Repair
echo =======================================================
echo.

echo Setting npm registry...
call npm config set registry https://registry.npmjs.org/

echo Removing old frontend dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo Cleaning npm cache...
call npm cache clean --force

echo Installing frontend dependencies...
call npm install --no-audit --no-fund --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

if not exist node_modules\.bin\vite.cmd (
    echo.
    echo ERROR: Vite did not install. Please check internet/npm access.
    pause
    exit /b 1
)

echo.
echo Repair complete. Starting frontend...
call node .\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173
pause
