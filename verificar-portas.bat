@echo off
title Digi-Tron TI - Diagnostico de Portas Locais (Windows)
echo =======================================================================
echo   Digi-Tron TI — Agente de Chamados
echo   Diagnostico de Portas e Conflitos no Windows
echo =======================================================================
echo.
echo Este script apenas VERIFICA as portas. Nenhum processo e finalizado.
echo.

echo -----------------------------------------------------------------------
echo [PORTA 5522] - Agente de Chamados (Frontend + Servidor Principal)
echo -----------------------------------------------------------------------
netstat -ano | findstr :5522
if errorlevel 1 (
    echo [LIVRE] A porta 5522 esta livre e pronta para o Agente de Chamados!
) else (
    echo.
    echo [OCUPADA] A porta 5522 ja possui um processo escutando (EADDRINUSE).
    echo Para identificar qual programa e, anote o PID (ultimo numero da linha acima).
    echo Em seguida, verifique o nome do processo:
    echo     tasklist /fi "pid eq <NUMERO_DO_PID>"
    echo Se for uma instancia antiga do node.exe / tsx, finalize-a com:
    echo     taskkill /PID <NUMERO_DO_PID> /F
)
echo.

echo -----------------------------------------------------------------------
echo [PORTA 8000] - Backend Python FastAPI
echo -----------------------------------------------------------------------
netstat -ano | findstr :8000
if errorlevel 1 (
    echo [INATIVO] Backend FastAPI nao esta rodando no momento.
) else (
    echo [ATIVO] Backend FastAPI rodando na porta 8000.
)
echo.

echo -----------------------------------------------------------------------
echo [PORTA 8080] - GLPI (Docker Desktop)
echo -----------------------------------------------------------------------
netstat -ano | findstr :8080
if errorlevel 1 (
    echo [ALERTA] GLPI nao detectado na porta 8080. Verifique se o Docker Desktop esta em execucao.
) else (
    echo [ATIVO] GLPI detectado na porta 8080 (preservado).
)
echo.

echo -----------------------------------------------------------------------
echo [PORTA 3000] - Grafana (Container ou Servico Local)
echo -----------------------------------------------------------------------
netstat -ano | findstr :3000
if errorlevel 1 (
    echo [INATIVO] Nenhum servico escutando na porta 3000.
) else (
    echo [ATIVO] Porta 3000 ocupada por Grafana/outro servico (preservado integralmente).
)
echo.
echo =======================================================================
echo Fim do diagnostico.
echo =======================================================================
pause
