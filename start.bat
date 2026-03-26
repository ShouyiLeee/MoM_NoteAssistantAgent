@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ═══════════════════════════════════════════════════════════════════════════
::  MoM Interview Note Agent — One-click Startup Script (Windows)
::
::  Usage:
::    start.bat              Start all services
::    start.bat --stop       Stop all services
::    start.bat --restart    Restart all services
::    start.bat --logs       View live logs
::    start.bat --status     Check service status
:: ═══════════════════════════════════════════════════════════════════════════

echo.
echo ======================================================
echo   MoM Interview Note Agent — Startup Script
echo ======================================================
echo.

set "PROJECT_DIR=%~dp0"
set "ENV_FILE=%PROJECT_DIR%backend\.env"
set "ENV_EXAMPLE=%PROJECT_DIR%backend\.env.example"

:: ── Parse arguments ──────────────────────────────────────────────────────
if "%~1"=="--stop"    goto :stop
if "%~1"=="-s"        goto :stop
if "%~1"=="--restart" goto :restart
if "%~1"=="-r"        goto :restart
if "%~1"=="--logs"    goto :logs
if "%~1"=="-l"        goto :logs
if "%~1"=="--status"  goto :status
goto :start

:: ── Check Docker ─────────────────────────────────────────────────────────
:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running.
    echo   Please install and start Docker Desktop: https://docs.docker.com/get-docker/
    exit /b 1
)
echo [OK] Docker is running
goto :eof

:: ── Setup .env ───────────────────────────────────────────────────────────
:setup_env
if exist "%ENV_FILE%" (
    echo [OK] .env file found
    findstr /C:"your-gemini-api-key-here" "%ENV_FILE%" >nul 2>&1
    if not errorlevel 1 (
        echo [WARN] GEMINI_API_KEY is not configured in backend\.env
        set /p "API_KEY=  Enter your Gemini API key (or press Enter to skip): "
        if defined API_KEY (
            powershell -Command "(Get-Content '%ENV_FILE%') -replace 'your-gemini-api-key-here', '%API_KEY%' | Set-Content '%ENV_FILE%'"
            echo [OK] Gemini API key saved
        ) else (
            echo [SKIP] AI features will not work without an API key
        )
    )
) else (
    echo [INFO] Creating .env from .env.example ...
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul

    set /p "API_KEY=  Enter your Gemini API key (or press Enter to skip): "
    if defined API_KEY (
        powershell -Command "(Get-Content '%ENV_FILE%') -replace 'your-gemini-api-key-here', '!API_KEY!' | Set-Content '%ENV_FILE%'"
        echo [OK] Gemini API key saved
    ) else (
        echo [SKIP] AI features will not work without an API key
    )

    :: Generate random JWT secret
    for /f %%a in ('powershell -Command "[System.Guid]::NewGuid().ToString('N') + [System.Guid]::NewGuid().ToString('N')"') do set "JWT_SECRET=%%a"
    powershell -Command "(Get-Content '%ENV_FILE%') -replace 'change-me-to-a-strong-random-secret', '!JWT_SECRET!' | Set-Content '%ENV_FILE%'"
    echo [OK] JWT secret auto-generated
)
goto :eof

:: ── Start ────────────────────────────────────────────────────────────────
:start
call :check_docker
if errorlevel 1 exit /b 1
call :setup_env

echo.
echo [1/3] Building Docker images...
cd /d "%PROJECT_DIR%"
docker compose build --parallel

echo.
echo [2/3] Starting services...
docker compose up -d

echo.
echo [3/3] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

:: Wait for backend
echo   Checking backend...
set "READY=0"
for /L %%i in (1,1,30) do (
    if !READY!==0 (
        curl -sf http://localhost:8000/health >nul 2>&1
        if not errorlevel 1 (
            echo   Backend: ready
            set "READY=1"
        ) else (
            timeout /t 2 /nobreak >nul
        )
    )
)
if !READY!==0 echo   Backend: still starting (run: start.bat --logs)

:: Wait for frontend
set "READY=0"
echo   Checking frontend...
for /L %%i in (1,1,30) do (
    if !READY!==0 (
        curl -sf http://localhost:3000 >nul 2>&1
        if not errorlevel 1 (
            echo   Frontend: ready
            set "READY=1"
        ) else (
            timeout /t 2 /nobreak >nul
        )
    )
)
if !READY!==0 echo   Frontend: still starting (run: start.bat --logs)

echo.
echo ======================================================
echo   All services are up!
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo   Qdrant:    http://localhost:6333/dashboard
echo.
echo   Logs:    start.bat --logs
echo   Stop:    start.bat --stop
echo ======================================================
echo.
goto :eof

:: ── Stop ─────────────────────────────────────────────────────────────────
:stop
call :check_docker
if errorlevel 1 exit /b 1
echo Stopping all services...
cd /d "%PROJECT_DIR%"
docker compose down
echo All services stopped.
goto :eof

:: ── Restart ──────────────────────────────────────────────────────────────
:restart
call :check_docker
if errorlevel 1 exit /b 1
echo Stopping all services...
cd /d "%PROJECT_DIR%"
docker compose down
call :setup_env
goto :start_after_env

:start_after_env
echo.
echo [1/3] Building Docker images...
docker compose build --parallel
echo.
echo [2/3] Starting services...
docker compose up -d
echo [3/3] Services restarted.
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
goto :eof

:: ── Logs ─────────────────────────────────────────────────────────────────
:logs
cd /d "%PROJECT_DIR%"
docker compose logs -f --tail=100
goto :eof

:: ── Status ───────────────────────────────────────────────────────────────
:status
cd /d "%PROJECT_DIR%"
docker compose ps
goto :eof
