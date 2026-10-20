import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path

from config import DATA_FILE, settings
from glpi_service import glpi_create_ticket, check_it_scope

logger = logging.getLogger("GLPIScheduler")

DEFAULT_DB: Dict[str, Any] = {
    "users": [
        {
            "id": "usr-admin-1",
            "name": "João Leopoldino",
            "email": "joao.leopoldino@digitronbalancas.com.br",
            "passwordHash": "123456",
            "role": "admin",
            "department": "TI",
            "company": "Digitron Balanças",
            "createdAt": "2026-01-15T08:00:00.000Z"
        },
        {
            "id": "usr-tech-2",
            "name": "Suporte TI Digi-Tron",
            "email": "suporte.ti@digitronbalancas.com.br",
            "passwordHash": "123456",
            "role": "tecnico",
            "department": "TI",
            "company": "Digitron Balanças",
            "createdAt": "2026-02-01T08:00:00.000Z"
        }
    ],
    "glpiConfig": {
        "url": settings.GLPI_BASE_URL,
        "authType": "user_token",
        "appToken": settings.GLPI_APP_TOKEN,
        "userToken": settings.GLPI_USER_TOKEN,
        "username": settings.GLPI_USERNAME,
        "password": settings.GLPI_PASSWORD,
        "entityId": settings.GLPI_ENTITY_ID,
        "defaultItGroupId": settings.GLPI_DEFAULT_IT_GROUP_ID,
        "defaultItGroupName": settings.GLPI_DEFAULT_IT_GROUP_NAME,
        "connectionStatus": "pending_configuration",
        "lastCheck": None,
        "glpiVersion": None,
        "glpiUser": None,
        "activeProfile": None,
        "lastErrorMessage": None,
        "schedulerRunning": True,
        "schedulerLastHeartbeat": datetime.utcnow().isoformat() + "Z"
    },
    "routines": [
        {
            "id": "rot-it-101",
            "title": "[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})",
            "content": "## 💾 Verificação Diária de Backups — Tecnologia da Informação\n**Data Programada:** {data} às {hora}\n**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron\n**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.\n- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados principal.\n- [ ] Conferir replicação segura dos snapshots para o storage NAS secundário e nuvem.\n- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.\n- [ ] Realizar teste de montagem e restauração amostral em ambiente sandbox de homologação.\n- [ ] Registrar evidências e anexar print do relatório no chamado antes do encerramento.",
            "frequency": "daily",
            "time": "06:30",
            "daysOfWeek": [1, 2, 3, 4, 5],
            "dayOfMonth": 1,
            "customIntervalHours": 24,
            "isActive": True,
            "type": 2,
            "urgency": 4,
            "impact": 4,
            "priority": 4,
            "categoryId": 2,
            "categoryName": "TI - Backups e Armazenamento",
            "requester": "joao.leopoldino@digitronbalancas.com.br",
            "assignee": "Equipe de TI",
            "technicalGroup": "Equipe de TI",
            "entityId": 0,
            "tags": ["TI", "Backups", "ERP Factory OS", "Crítico"],
            "lastRunAt": None,
            "nextRunAt": "2026-10-21T06:30:00.000Z",
            "totalDispatched": 0,
            "createdBy": "João Leopoldino (Admin TI)",
            "createdAt": "2026-10-20T08:00:00.000Z",
            "updatedAt": "2026-10-20T08:00:00.000Z"
        },
        {
            "id": "rot-it-102",
            "title": "[TI] Auditoria Semanal de Conectividade, Wi-Fi e Switches da Fábrica ({data})",
            "content": "## 🌐 Auditoria Semanal de Infraestrutura de Rede e Wi-Fi\n**Data Programada:** {data} às {hora}\n**Setor:** Tecnologia da Informação Digi-Tron\n\n### 📋 Procedimentos Operacionais:\n- [ ] Verificar latência e perda de pacotes entre o gateway central e os switches gerenciaveis.\n- [ ] Monitorar temperatura e consumo de CPU dos roteadores de borda.\n- [ ] Testar sinal e qualidade dos Access Points Wi-Fi da área fabril e expedição.\n- [ ] Conferir tabela de leases DHCP do escopo corporativo e visitantes.\n- [ ] Inspecionar visualmente o rack do CPD e organização dos patch cords.",
            "frequency": "weekly",
            "time": "07:00",
            "daysOfWeek": [1],
            "dayOfMonth": 1,
            "customIntervalHours": 168,
            "isActive": True,
            "type": 2,
            "urgency": 3,
            "impact": 3,
            "priority": 3,
            "categoryId": 3,
            "categoryName": "TI - Redes e Conectividade",
            "requester": "joao.leopoldino@digitronbalancas.com.br",
            "assignee": "Equipe de TI",
            "technicalGroup": "Equipe de TI",
            "entityId": 0,
            "tags": ["TI", "Redes", "Infraestrutura", "Switches"],
            "lastRunAt": None,
            "nextRunAt": "2026-10-27T07:00:00.000Z",
            "totalDispatched": 0,
            "createdBy": "Equipe de TI",
            "createdAt": "2026-10-20T08:00:00.000Z",
            "updatedAt": "2026-10-20T08:00:00.000Z"
        }
    ],
    "logs": []
}

class DatabaseManager:
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self._lock = asyncio.Lock()
        self.data: Dict[str, Any] = {}
        self.load()

    def load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                    return
            except Exception as e:
                logger.error(f"Erro ao ler banco local: {e}. Usando dados padrão.")
        self.data = json.loads(json.dumps(DEFAULT_DB))
        self.save()

    def save(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao salvar banco local: {e}")

db = DatabaseManager(DATA_FILE)

# Substituição de Variáveis Macro
def replace_macros(text: str) -> str:
    now = datetime.now()
    months_pt = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    weekdays_pt = [
        "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"
    ]

    replacements = {
        "{data}": now.strftime("%d/%m/%Y"),
        "{data_iso}": now.strftime("%Y-%m-%d"),
        "{hora}": now.strftime("%H:%M"),
        "{dia}": now.strftime("%d"),
        "{mes}": months_pt[now.month - 1],
        "{mes_num}": now.strftime("%m"),
        "{ano}": now.strftime("%Y"),
        "{mes_ano}": now.strftime("%m/%Y"),
        "{mes_extenso}": months_pt[now.month - 1],
        "{dia_semana}": weekdays_pt[now.weekday()],
        "{empresa}": "Digi-Tron Balanças",
        "{responsavel}": "Equipe de TI Digi-Tron"
    }

    res = text
    for key, val in replacements.items():
        res = res.replace(key, val)
    return res

def compute_next_run(routine: Dict[str, Any]) -> str:
    """Calcula a próxima execução de uma rotina."""
    now = datetime.now()
    time_str = routine.get("time", "08:00")
    try:
        hour, minute = map(int, time_str.split(":"))
    except Exception:
        hour, minute = 8, 0

    freq = routine.get("frequency", "daily")

    if freq == "daily":
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate.isoformat() + "Z"

    elif freq == "weekly":
        days = routine.get("daysOfWeek", [1])
        # Converte para 0=Segunda, 6=Domingo do Python
        # Se frontend usa 1=Segunda, 0=Domingo:
        target_days = [d - 1 if d > 0 else 6 for d in days]
        for offset in range(1, 8):
            candidate = now + timedelta(days=offset)
            if candidate.weekday() in target_days:
                return candidate.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat() + "Z"
        return (now + timedelta(days=7)).replace(hour=hour, minute=minute).isoformat() + "Z"

    elif freq == "custom_interval":
        hours = routine.get("customIntervalHours", 24)
        return (now + timedelta(hours=hours)).isoformat() + "Z"

    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate.isoformat() + "Z"

executing_routines = set()

async def execute_routine_dispatch(routine: Dict[str, Any], trigger_type: str = "scheduled", triggered_by: str = "Agendador Automático TI") -> Dict[str, Any]:
    """Dispara a execução de uma rotina de TI no GLPI com proteção contra concorrência e escopo."""
    routine_id = routine.get("id")
    if routine_id in executing_routines:
        return {"success": False, "error": "Rotina já em processamento concorrente"}

    executing_routines.add(routine_id)
    cfg = db.data.get("glpiConfig", {})
    rendered_title = replace_macros(routine.get("title", ""))
    rendered_content = replace_macros(routine.get("content", ""))

    try:
        res = await glpi_create_ticket(
            base_url=cfg.get("url", settings.GLPI_BASE_URL),
            app_token=cfg.get("appToken", settings.GLPI_APP_TOKEN),
            user_token=cfg.get("userToken", settings.GLPI_USER_TOKEN),
            title=rendered_title,
            content=rendered_content,
            category_id=routine.get("categoryId", 1),
            category_name=routine.get("categoryName", "TI - Infraestrutura e Servidores"),
            group_id=cfg.get("defaultItGroupId", 1),
            urgency=routine.get("urgency", 3),
            impact=routine.get("impact", 3),
            priority=routine.get("priority", 3),
            entity_id=routine.get("entityId", 0),
            requester=routine.get("requester", "joao.leopoldino@digitronbalancas.com.br")
        )

        ticket_id = res["ticket_id"]
        log_entry = {
            "id": f"log-{int(time.time() * 1000)}",
            "routineId": routine_id,
            "routineTitle": rendered_title,
            "categoryName": routine.get("categoryName"),
            "triggeredAt": datetime.utcnow().isoformat() + "Z",
            "status": "success",
            "glpiTicketId": ticket_id,
            "glpiTicketUrl": res.get("ticket_url"),
            "executionType": trigger_type,
            "executedBy": triggered_by,
            "message": f"Chamado de TI #{ticket_id} criado com sucesso no GLPI!",
            "durationMs": res.get("duration_ms", 0),
            "requestPayload": res.get("payload"),
            "responsePayload": res.get("response")
        }

        db.data["logs"].insert(0, log_entry)
        if len(db.data["logs"]) > 500:
            db.data["logs"].pop()

        routine["lastRunAt"] = datetime.utcnow().isoformat() + "Z"
        routine["nextRunAt"] = compute_next_run(routine)
        routine["totalDispatched"] = routine.get("totalDispatched", 0) + 1
        routine["lastExecutionStatus"] = "success"
        routine["lastTicketId"] = ticket_id

        db.data["glpiConfig"]["connectionStatus"] = "connected"
        db.data["glpiConfig"]["lastCheck"] = datetime.utcnow().isoformat() + "Z"
        db.data["glpiConfig"]["lastErrorMessage"] = None
        db.save()

        return {"success": True, "ticketId": ticket_id, "log": log_entry}

    except Exception as err:
        log_entry = {
            "id": f"log-{int(time.time() * 1000)}",
            "routineId": routine_id,
            "routineTitle": rendered_title,
            "categoryName": routine.get("categoryName"),
            "triggeredAt": datetime.utcnow().isoformat() + "Z",
            "status": "failed",
            "glpiTicketId": None,
            "executionType": trigger_type,
            "executedBy": triggered_by,
            "message": f"Falha na rotina de TI: {str(err)}",
            "durationMs": 0,
            "errorDetails": str(err)
        }
        db.data["logs"].insert(0, log_entry)
        routine["lastExecutionStatus"] = "failed"
        db.data["glpiConfig"]["connectionStatus"] = "error"
        db.data["glpiConfig"]["lastErrorMessage"] = str(err)
        db.save()
        return {"success": False, "error": str(err), "log": log_entry}

    finally:
        executing_routines.discard(routine_id)

async def scheduler_loop():
    """Loop de fundo do agendador automático independente do navegador."""
    import time
    while True:
        try:
            cfg = db.data.get("glpiConfig", {})
            if cfg.get("schedulerRunning", True):
                db.data["glpiConfig"]["schedulerLastHeartbeat"] = datetime.utcnow().isoformat() + "Z"
                now = datetime.utcnow()

                for routine in db.data.get("routines", []):
                    if not routine.get("isActive", True):
                        continue

                    next_run_str = routine.get("nextRunAt")
                    if next_run_str:
                        try:
                            # Converte ISO para datetime
                            next_run = datetime.fromisoformat(next_run_str.replace("Z", "+00:00"))
                            if next_run <= now.replace(tzinfo=next_run.tzinfo):
                                # Prevenção de duplicidade: não executa se já executou nos últimos 55s
                                last_run_str = routine.get("lastRunAt")
                                if last_run_str:
                                    last_run = datetime.fromisoformat(last_run_str.replace("Z", "+00:00"))
                                    if (now.replace(tzinfo=last_run.tzinfo) - last_run).total_seconds() < 55:
                                        continue

                                logger.info(f"Agendador disparando: {routine.get('title')}")
                                await execute_routine_dispatch(routine, "scheduled", "Agendador de TI (Serviço Automático)")
                        except Exception as e:
                            logger.error(f"Erro ao processar rotina {routine.get('id')}: {e}")

        except Exception as e:
            logger.error(f"Erro no loop do agendador: {e}")

        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SEC)
