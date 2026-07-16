@echo off
echo ===================================================
echo   WealthAI - Launch Services Script
echo ===================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/3] Starting Express Backend Server on port 5000...
start "WealthAI Express Server" cmd /k "cd /d \"%ROOT_DIR%server\" && npm run dev"

echo [2/3] Starting React Vite Client on port 5173...
start "WealthAI React Client" cmd /k "cd /d \"%ROOT_DIR%client\" && npm run dev"

echo [3/3] Starting Flask ML Service on port 5001...
start "WealthAI Flask ML Service" cmd /k "cd /d \"%ROOT_DIR%ml-service\" && venv\Scripts\python.exe app.py"

echo.
echo ===================================================
echo All services have been launched in separate windows!
echo - Express Backend: http://localhost:5000
echo - React Client: http://localhost:5173
echo - Python ML Service: http://localhost:5001
echo ===================================================
echo.
pause
