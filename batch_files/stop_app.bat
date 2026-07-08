@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo Stopping CropIn Model Validation Tool...

rem Close the console window running "npm start" (matches the title set by run_app.bat)
taskkill /fi "windowtitle eq CropIn Validation Tool*" /t /f >nul 2>&1

rem Fallback / cleanup: kill anything still bound to the backend (8000) or frontend (4200) ports
call npm run stop

echo App stopped.
endlocal
