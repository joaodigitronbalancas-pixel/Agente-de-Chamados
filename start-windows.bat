@echo off
title Digi-Tron TI - GLPI Autoscheduler Launcher
echo ================================================================
echo   Digi-Tron Balancas - GLPI Autoscheduler (Ambiente Local)
echo ================================================================
echo.
echo Este script inicia o backend FastAPI (porta 8000) e o frontend (porta 3000).
echo Certifique-se de que o GLPI esta rodando no Docker Desktop em:
echo   http://localhost:8080/front/central.php (Web)
echo   http://localhost:8080/apirest.php (API REST)
echo.

if not exist ".env" (
    if exist ".env.example" (
        copy .env.example .env
        echo [INFO] Criado arquivo .env a partir de .env.example
    )
)

echo [1/2] Iniciando Backend Python FastAPI em nova janela...
start "Digi-Tron TI - Backend FastAPI (Porta 8000)" cmd /k "call backend\run.bat"

timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend React/Vite...
echo.
echo Acesse o sistema no seu navegador em: http://localhost:3000
echo.
npm run dev

pause
