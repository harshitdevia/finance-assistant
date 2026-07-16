@echo off
echo ===================================================
echo   WealthAI - Environment Setup Script
echo ===================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/3] Setting up Node.js Express Server...
cd server
if not exist ".env" (
    echo Creating server .env from example...
    copy .env.example .env
)
echo Installing server dependencies...
call npm install
cd ..
echo.

echo [2/3] Setting up React Client...
cd client
echo Installing client dependencies...
call npm install
cd ..
echo.

echo [3/3] Setting up Python Flask ML Service...
cd ml-service
if not exist ".env" (
    echo Creating ML service .env from example...
    copy .env.example .env
)
echo Creating Python virtual environment...
python -m venv venv
echo Installing Python requirements...
call venv\Scripts\python.exe -m pip install --upgrade pip
call venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
echo.

echo ===================================================
echo Setup complete! 
echo Please verify database connections in server/.env
echo and API keys in ml-service/.env.
echo Run "start-all.bat" to start all 3 services.
echo ===================================================
pause
