@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

where npm >nul 2>&1
if errorlevel 1 (
    echo Node.js/npm was not found on PATH. Install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

where python >nul 2>&1
if errorlevel 1 (
    echo Python was not found on PATH. Install Python 3 and try again.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\node_modules" (
    echo First-time setup: installing root dependencies...
    call npm install
)

if not exist "%PROJECT_DIR%\frontend\node_modules" (
    echo First-time setup: installing frontend dependencies...
    call npm run install:frontend
)

if not exist "%PROJECT_DIR%\backend\.venv\Scripts\python.exe" (
    echo First-time setup: creating backend virtual environment...
    call npm run setup:backend
)

echo Starting CropIn Model Validation Tool (backend + frontend)...
start "CropIn Validation Tool" cmd /k npm start

echo App starting. Backend: http://localhost:8000  Frontend: http://localhost:4200
endlocal
