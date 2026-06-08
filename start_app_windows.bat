@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo =======================================================
echo Knobs and Slides Studio 1.2.29 - One Click Local Start
echo =======================================================
echo.
echo This starts the FastAPI backend, which also serves the built React app.
echo Use this if Vite shows /src/main.jsx errors.
echo.

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python is not installed or not available in PATH.
        pause
        exit /b 1
    )
)

if not exist frontend\dist\index.html (
    echo ERROR: frontend\dist\index.html not found.
    echo This package should include the built frontend.
    pause
    exit /b 1
)

start "Knobs and Slides Backend" cmd /k "cd /d "%~dp0" && call start_backend_windows.bat"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo Opening http://localhost:8000 ...
start http://localhost:8000

echo.
echo If the browser does not open, manually open:
echo http://localhost:8000
echo.
pause
