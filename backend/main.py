import os
import platform
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings, mask_token
from glpi_service import (
    glpi_test_connection,
    glpi_create_ticket,
    glpi_get_real_tickets,
    check_it_scope
)
from scheduler_service import (
    db,
    compute_next_run,
    execute_routine_dispatch,
    scheduler_loop
)

scheduler_task: Optional[asyncio.Task] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler_task
    # Inicia o agendador em segundo plano
    scheduler_task = asyncio.create_task(scheduler_loop())
    yield
    # Encerra o agendador ao desligar
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Digi-Tron TI — GLPI Autoscheduler API",
    description="Backend local FastAPI para agendamento e automação de chamados de TI no GLPI",
    version="2.0.0",
    lifespan=lifespan
)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- MODELOS PYDANTIC -----------------
class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    newPassword: str

class GlpiConfigUpdate(BaseModel):
    url: Optional[str] = None
    authType: Optional[str] = None
    appToken: Optional[str] = None
    userToken: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    entityId: Optional[int] = None
    defaultItGroupId: Optional[int] = None
    defaultItGroupName: Optional[str] = None

class TestConnectionRequest(BaseModel):
    url: Optional[str] = None
    authType: Optional[str] = "user_token"
    appToken: Optional[str] = None
    userToken: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    entityId: Optional[int] = 0
    defaultItGroupId: Optional[int] = 1
    defaultItGroupName: Optional[str] = "Equipe de TI"

class TestCreateTicketRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    categoryId: Optional[int] = 1
    categoryName: Optional[str] = "TI - Infraestrutura e Servidores"

class RoutineCreateRequest(BaseModel):
    title: str
    content: str
    frequency: str = "daily"
    time: str = "08:00"
    daysOfWeek: List[int] = [1]
    dayOfMonth: int = 1
    customIntervalHours: int = 24
    cronExpression: Optional[str] = ""
    isActive: bool = True
    type: int = 2
    urgency: int = 3
    impact: int = 3
    priority: int = 3
    categoryId: int = 1
    categoryName: str = "TI - Infraestrutura e Servidores"
    requester: str = "joao.leopoldino@digitronbalancas.com.br"
    assignee: str = "Equipe de TI"
    technicalGroup: str = "Equipe de TI"
    entityId: int = 0
    tags: List[str] = ["TI"]

# ----------------- ROTAS DE AMBIENTE -----------------
@app.get("/api/environment")
async def get_environment():
    is_docker = os.path.exists("/.dockerenv")
    return {
        "environment": {
            "type": "local_machine" if not is_docker else "docker_container",
            "title": "Computador Local Windows (Digi-Tron TI)" if not is_docker else "Container Docker",
            "description": "O backend Python FastAPI executa localmente. Requisições para http://localhost:8080/apirest.php alcançam diretamente o GLPI no Docker Desktop do Windows.",
            "isCloud": False,
            "isDocker": is_docker,
            "platform": platform.system(),
            "hostname": platform.node(),
            "serviceName": "FastAPI Local Worker",
            "nodeVersion": f"Python {platform.python_version()}"
        }
    }

# ----------------- ROTAS DE AUTENTICAÇÃO -----------------
@app.post("/api/auth/login")
async def login(req: LoginRequest):
    users = db.data.get("users", [])
    user = next((u for u in users if u["email"].lower() == req.email.strip().lower()), None)
    if not user or user.get("passwordHash") != req.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso negado. Credenciais inválidas ou usuário não autorizado pela TI Digi-Tron."
        )

    safe_user = {k: v for k, v in user.items() if k != "passwordHash"}
    return {
        "token": f"sess_fastapi_{user['id']}_{int(datetime.utcnow().timestamp())}",
        "user": safe_user
    }

@app.get("/api/auth/me")
async def get_me():
    users = db.data.get("users", [])
    if not users:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    safe_user = {k: v for k, v in users[0].items() if k != "passwordHash"}
    return {"user": safe_user}

reset_codes: Dict[str, Dict[str, Any]] = {}

@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    email = req.email.strip().lower()
    users = db.data.get("users", [])
    user = next((u for u in users if u["email"].lower() == email), None)
    if not user:
        raise HTTPException(status_code=404, detail="E-mail não localizado na equipe de TI")

    import random
    code = str(random.randint(100000, 999999))
    reset_codes[email] = {
        "code": code,
        "expires_at": datetime.utcnow().timestamp() + 900
    }
    return {
        "success": True,
        "message": f"Código de recuperação gerado para {email}.",
        "recoveryCode": code,
        "email": email
    }

@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    email = req.email.strip().lower()
    entry = reset_codes.get(email)
    if not entry or entry["code"] != req.code.strip():
        raise HTTPException(status_code=400, detail="Código de recuperação inválido ou expirado")

    if datetime.utcnow().timestamp() > entry["expires_at"]:
        raise HTTPException(status_code=400, detail="Código expirado. Solicite outro.")

    users = db.data.get("users", [])
    user = next((u for u in users if u["email"].lower() == email), None)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    user["passwordHash"] = req.newPassword
    db.save()
    reset_codes.pop(email, None)
    return {"success": True, "message": "Senha alterada com sucesso! Efetue login com a nova senha."}

# ----------------- CONFIGURAÇÃO & DIAGNÓSTICO GLPI -----------------
@app.get("/api/glpi/config")
async def get_glpi_config():
    cfg = db.data.get("glpiConfig", {})
    return {
        **cfg,
        "appTokenMasked": mask_token(cfg.get("appToken", "")),
        "userTokenMasked": mask_token(cfg.get("userToken", "")),
        "hasPassword": bool(cfg.get("password"))
    }

@app.post("/api/glpi/config")
async def update_glpi_config(req: GlpiConfigUpdate):
    cfg = db.data.get("glpiConfig", {})
    updates = req.model_dump(exclude_unset=True)

    # Não sobrescrever tokens mascarados
    if updates.get("appToken", "").startswith("***"):
        updates.pop("appToken", None)
    if updates.get("userToken", "").startswith("***"):
        updates.pop("userToken", None)

    cfg.update(updates)
    db.save()
    return cfg

@app.post("/api/glpi/test-connection")
async def test_glpi_connection_endpoint(req: TestConnectionRequest):
    cfg = db.data.get("glpiConfig", {})
    base_url = req.url or cfg.get("url", settings.GLPI_BASE_URL)
    app_token = req.appToken or cfg.get("appToken", settings.GLPI_APP_TOKEN)
    user_token = req.userToken or cfg.get("userToken", settings.GLPI_USER_TOKEN)
    username = req.username or cfg.get("username", settings.GLPI_USERNAME)
    password = req.password or cfg.get("password", settings.GLPI_PASSWORD)
    auth_type = req.authType or cfg.get("authType", "user_token")

    res = await glpi_test_connection(
        base_url=base_url,
        app_token=app_token,
        user_token=user_token,
        username=username,
        password=password,
        auth_type=auth_type,
        default_group_id=req.defaultItGroupId or 1,
        default_group_name=req.defaultItGroupName or "Equipe de TI"
    )

    if res.get("success"):
        cfg["connectionStatus"] = "connected"
        cfg["lastCheck"] = datetime.utcnow().isoformat() + "Z"
        cfg["lastErrorMessage"] = None
        db.save()
        return res
    else:
        cfg["connectionStatus"] = "error"
        cfg["lastErrorMessage"] = res.get("error")
        cfg["lastCheck"] = datetime.utcnow().isoformat() + "Z"
        db.save()
        return JSONResponse(status_code=400, content=res)

@app.post("/api/glpi/test-create-ticket")
async def test_create_real_ticket_endpoint(req: TestCreateTicketRequest):
    """
    Cria um chamado de teste real no GLPI mediante confirmação explícita do usuário.
    Garante categoria de TI e não-interferência em balanças/produção.
    """
    cfg = db.data.get("glpiConfig", {})
    url = cfg.get("url", settings.GLPI_BASE_URL)
    app_token = cfg.get("appToken", settings.GLPI_APP_TOKEN)
    user_token = cfg.get("userToken", settings.GLPI_USER_TOKEN)

    title = req.title or f"[TI - TESTE] Teste de Conexão e Abertura de Chamado GLPI ({datetime.now().strftime('%d/%m/%Y %H:%M')})"
    content = req.description or (
        "## 🛠️ Chamado de Teste de Integração — Digi-Tron TI\n"
        "Este chamado foi disparado manualmente a partir do painel GLPI AutoScheduler para validar a criação de tickets via API REST oficial.\n"
        "- **Setor:** Tecnologia da Informação\n"
        "- **Objetivo:** Validação de conectividade, permissões de escrita e encerramento de sessão."
    )

    category_name = req.categoryName or "TI - Infraestrutura e Servidores"
    valid, reason = check_it_scope(title, content, category_name)
    if not valid:
        raise HTTPException(status_code=400, detail=reason)

    try:
        result = await glpi_create_ticket(
            base_url=url,
            app_token=app_token,
            user_token=user_token,
            title=title,
            content=content,
            category_id=req.categoryId or 1,
            category_name=category_name,
            group_id=cfg.get("defaultItGroupId", 1)
        )
        return {
            "success": True,
            "ticketId": result["ticket_id"],
            "ticketUrl": result["ticket_url"],
            "message": f"Chamado de teste #{result['ticket_id']} criado com sucesso no GLPI!"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/glpi/real-tickets")
async def get_real_tickets():
    cfg = db.data.get("glpiConfig", {})
    tickets = await glpi_get_real_tickets(
        base_url=cfg.get("url", settings.GLPI_BASE_URL),
        app_token=cfg.get("appToken", settings.GLPI_APP_TOKEN),
        user_token=cfg.get("userToken", settings.GLPI_USER_TOKEN)
    )
    return tickets

# ----------------- ROTAS DE ROTINAS DE TI -----------------
@app.get("/api/routines")
async def get_routines():
    return db.data.get("routines", [])

@app.post("/api/routines", status_code=201)
async def create_routine(req: RoutineCreateRequest):
    valid, reason = check_it_scope(req.title, req.content, req.categoryName)
    if not valid:
        raise HTTPException(status_code=400, detail=f"Criação bloqueada: {reason}")

    new_routine = {
        "id": f"rot-it-{int(datetime.utcnow().timestamp() * 1000)}",
        **req.model_dump(),
        "lastRunAt": None,
        "nextRunAt": compute_next_run(req.model_dump()),
        "totalDispatched": 0,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    }

    db.data.setdefault("routines", []).insert(0, new_routine)
    db.save()
    return new_routine

@app.put("/api/routines/{routine_id}")
async def update_routine(routine_id: str, updates: Dict[str, Any]):
    routines = db.data.get("routines", [])
    routine = next((r for r in routines if r["id"] == routine_id), None)
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")

    cand_title = updates.get("title", routine["title"])
    cand_content = updates.get("content", routine["content"])
    cand_cat = updates.get("categoryName", routine.get("categoryName", "TI - Infraestrutura e Servidores"))

    valid, reason = check_it_scope(cand_title, cand_content, cand_cat)
    if not valid:
        raise HTTPException(status_code=400, detail=f"Alteração bloqueada: {reason}")

    routine.update(updates)
    routine["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    db.save()
    return routine

@app.delete("/api/routines/{routine_id}")
async def delete_routine(routine_id: str):
    routines = db.data.get("routines", [])
    idx = next((i for i, r in enumerate(routines) if r["id"] == routine_id), -1)
    if idx == -1:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")
    routines.pop(idx)
    db.save()
    return {"success": True}

@app.post("/api/routines/{routine_id}/toggle")
async def toggle_routine(routine_id: str):
    routines = db.data.get("routines", [])
    routine = next((r for r in routines if r["id"] == routine_id), None)
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")
    routine["isActive"] = not routine.get("isActive", True)
    db.save()
    return routine

@app.post("/api/routines/{routine_id}/trigger")
async def trigger_routine(routine_id: str):
    routines = db.data.get("routines", [])
    routine = next((r for r in routines if r["id"] == routine_id), None)
    if not routine:
        raise HTTPException(status_code=404, detail="Rotina não encontrada")

    res = await execute_routine_dispatch(routine, "manual", "João Leopoldino (Disparo Manual)")
    return res

# ----------------- LOGS & ESTATÍSTICAS -----------------
@app.get("/api/logs")
async def get_logs():
    return db.data.get("logs", [])

@app.delete("/api/logs")
async def clear_logs():
    db.data["logs"] = []
    db.save()
    return {"success": True}

@app.get("/api/stats")
async def get_stats():
    routines = db.data.get("routines", [])
    logs = db.data.get("logs", [])
    cfg = db.data.get("glpiConfig", {})

    total_routines = len(routines)
    active_routines = sum(1 for r in routines if r.get("isActive", True))

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    dispatched_today = sum(
        1 for l in logs 
        if l.get("status") == "success" and l.get("triggeredAt", "").startswith(today_str)
    )

    total_success = sum(1 for l in logs if l.get("status") == "success")
    total_logs = len(logs)
    success_rate = int((total_success / total_logs * 100)) if total_logs > 0 else 100

    next_runs = [r.get("nextRunAt") for r in routines if r.get("isActive") and r.get("nextRunAt")]
    next_run_at = min(next_runs) if next_runs else None

    return {
        "activeRoutines": active_routines,
        "totalRoutines": total_routines,
        "dispatchedToday": dispatched_today,
        "dispatchedTotal": total_success,
        "successRate": success_rate,
        "nextRunAt": next_run_at,
        "glpiConnected": cfg.get("connectionStatus") == "connected",
        "glpiStatus": cfg.get("connectionStatus", "pending_configuration"),
        "schedulerRunning": cfg.get("schedulerRunning", True),
        "totalErrors": sum(1 for l in logs if l.get("status") == "failed")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
