@echo off
title SecureTag App Launcher
color 0A

echo.
echo ========================================
echo     SecureTag App - Quick Launcher
echo ========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies!
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully!
    echo.
)

echo 🚀 Starting SecureTag App...
echo.
echo Backend will start on: http://localhost:3000
echo Frontend will start on: http://localhost:8080
echo.
echo 📱 For mobile testing, use your IP address:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo    Mobile URL: http://%%b:8080
    )
)
echo.
echo 🧪 Test QR Codes:
echo    - EMP001-SECURE-2024 (John Doe - Engineering)
echo    - EMP002-SECURE-2024 (Jane Smith - Security)
echo    - VISITOR-TEMP-001 (Mike Johnson - Visitor)
echo.
echo 💡 Tip: Generate QR codes at https://qr-code-generator.com/
echo.
echo ----------------------------------------
echo Starting servers...
echo ----------------------------------------

:: Start backend in new window
start "SecureTag Backend" cmd /k "echo Backend Server && echo. && npm start"

:: Wait a bit for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend server in new window  
start "SecureTag Frontend" cmd /k "echo Frontend Server && echo. && npx http-server . -p 8080 -c-1 --cors"

:: Wait a bit for frontend to start
timeout /t 3 /nobreak >nul

:: Open browser
echo 🌐 Opening browser...
start http://localhost:8080

echo.
echo ✅ SecureTag App is now running!
echo.
echo 📋 Quick Commands:
echo    - Press Ctrl+C in server windows to stop
echo    - Close this window to keep servers running
echo    - Re-run this file to restart everything
echo.
echo 🔗 URLs:
echo    - App: http://localhost:8080
echo    - API: http://localhost:3000/api/health
echo.

pause