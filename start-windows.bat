@echo off
title Digi-Tron TI - GLPI Autoscheduler Launcher
echo ================================================================
echo   Digi-Tron Balancas - GLPI Autoscheduler (Ambiente Local)
echo ================================================================
echo.
echo Este script inicia o backend FastAPI (porta 8000) e o Agente de Chamados (porta 5522).
echo Servicos preservados:
echo   - GLPI Docker:    http://localhost:8080/front/central.php (Web) / apirest.php (API)
echo   - Grafana:        Preservado na sua porta original (3000) sem alteracao
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

echo [2/2] Iniciando Agente de Chamados na porta 5522...
echo.
echo =========================================================echo.
npm run dev

pause
