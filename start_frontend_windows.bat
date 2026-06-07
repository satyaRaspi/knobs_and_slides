@echo off
setlocal EnableExtensions
cd /d "%~dp0frontend"

echo =======================================================
echo Knobs and Slides Studio 1.2.9 - Frontend Startup
echo =======================================================
echo.

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

REM Vite must be installed locally in frontend\node_modules.
REM If node_modules exists but Vite is missing, reinstall dependencies.
if not exist node_modules (
    goto INSTALL_DEPS
)

if not exist node_modules\.bin\vite.cmd (
    echo node_modules exists but Vite is missing. Reinstalling frontend dependencies...
    goto CLEAN_INSTALL
)

if not exist node_modules\react (
    echo node_modules exists but React is missing. Reinstalling frontend dependencies...
    goto CLEAN_INSTALL
)

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
    echo Please copy the error above and share it.
    pause
    exit /b 1
)
if not exist node_modules\.bin\vite.cmd (
    echo.
    echo ERROR: Vite was still not installed locally.
    echo Try running fix_frontend_install_windows.bat and share the output if it fails.
    pause
    exit /b 1
)

:START_DEV
echo.
echo Starting frontend at http://localhost:5173 ...
echo Keep this window open while using the app.
echo.
call node .\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173
if errorlevel 1 (
    echo.
    echo Frontend did not start. Trying npm run dev as fallback...
    call npm run dev
)

pause
