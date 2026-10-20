@echo off
title Digi-Tron TI - Backend FastAPI GLPI
echo ===================================================
echo   Digi-Tron TI - GLPI Autoscheduler (Backend Local)
echo ===================================================
echo.

cd /d "%~dp0"

if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Criando arquivo .env a partir de .env.example...
        copy .env.example .env
        echo [ATENCAO] Configure suas credenciais em backend\.env caso necessario.
    )
)

if not exist "venv\Scripts\activate.bat" (
    echo [INFO] Criando ambiente virtual Python (venv)...
    python -m venv venv
    if errorlevel 1 (
        echo [ERRO] Falha ao criar ambiente virtual. Certifique-se de que o Python 3.10+ esta instalado e no PATH do Windows.
        pause
        exit /b 1
    )
)

echo [INFO] Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo [INFO] Verificando dependencias...
pip install -r requirements.txt --quiet

echo.
echo ===================================================
echo   Iniciando Backend FastAPI em http://localhost:8000
echo   Documentacao Swagger: http://localhost:8000/docs
echo   Endpoint GLPI: http://localhost:8080/apirest.php
echo ===================================================
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
