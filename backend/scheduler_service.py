import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path

from config import DATA_FILE, settings
from glpi_service import (
    glpi_create_ticket, 
    check_it_scope, 
    SP_TZ, 
    now_sao_paulo, 
    resolve_opening_date, 
    format_glpi_date
)

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

# Substituição de Variáveis Macro com fuso America/Sao_Paulo
def replace_macros(text: str) -> str:
    now = now_sao_paulo()
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
    """Calcula a próxima execução de uma rotina no fuso America/Sao_Paulo."""
    now = now_sao_paulo()
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
        return candidate.isoformat()

    elif freq == "weekly":
        days = routine.get("daysOfWeek", [1])
        target_days = [d - 1 if d > 0 else 6 for d in days]
        for offset in range(1, 8):
            candidate = now + timedelta(days=offset)
            if candidate.weekday() in target_days:
                return candidate.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()
        return (now + timedelta(days=7)).replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()

    elif freq == "custom_interval":
        hours = routine.get("customIntervalHours", 24)
        return (now + timedelta(hours=hours)).isoformat()

    candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate <= now:
        candidate += timedelta(days=1)
    return candidate.isoformat()

executing_routines = set()

async def execute_routine_dispatch(
    routine: Dict[str, Any], 
    trigger_type: str = "scheduled", 
    triggered_by: str = "Agendador Automático TI",
    opening_date: Optional[str] = None
) -> Dict[str, Any]:
    """Dispara a execução de uma rotina de TI no GLPI com proteção contra concorrência e escopo.
       Garante que a data de abertura seja a cadastrada na rotina (ou informada no disparo),
       em America/Sao_Paulo, e NUNCA o relógio glpi_currenttime do servidor em UTC.
    """
    routine_id = routine.get("id")
    if routine_id in executing_routines:
        return {"success": False, "error": "Rotina já em processamento concorrente"}

    executing_routines.add(routine_id)
    cfg = db.data.get("glpiConfig", {})
    rendered_title = replace_macros(routine.get("title", ""))
    rendered_content = replace_macros(routine.get("content", ""))

    now_sp = now_sao_paulo()

    # REGRA DE DATA DE ABERTURA:
    # 1. Rotina agendada: a "Data de abertura" do chamado = a data e hora PROGRAMADA daquela execução
    #    (ex.: rotina diária às 08:00 -> abre no dia da ocorrência às 08:00:00 no fuso America/Sao_Paulo).
    # 2. Execução manual ("Executar agora") e "Testar Chamado": usa opening_date se preenchido,
    #    ou a hora atual de Brasília se vazio.
    if trigger_type == "scheduled":
        time_str = routine.get("time", "08:00")
        try:
            h, m = map(int, time_str.split(":"))
        except Exception:
            h, m = 8, 0
        occurrence_dt = now_sp.replace(hour=h, minute=m, second=0, microsecond=0)
        target_opening_date = occurrence_dt.strftime("%Y-%m-%d %H:%M:%S")
    else:
        if opening_date and str(opening_date).strip():
            target_opening_date = str(opening_date).strip()
        elif routine.get("openingDate"):
            target_opening_date = str(routine.get("openingDate")).strip()
        else:
            target_opening_date = format_glpi_date(now_sp)

    try:
        res = await glpi_create_ticket(
            base_url=cfg.get("url", settings.GLPI_BASE_URL),
            app_token=cfg.get("appToken", settings.GLPI_APP_TOKEN),
            user_token=cfg.get("userToken", settings.GLPI_USER_TOKEN),
            title=rendered_title,
            content=rendered_content,
            category_id=routine.get("categoryId", 1),
            category_name=routine.get("categoryName", "TI - Infraestrutura e Servidores"),
            group_id=routine.get("assignedGroupId") or routine.get("groupId") or cfg.get("defaultItGroupId", 1),
            urgency=routine.get("urgency", 3),
            impact=routine.get("impact", 3),
            priority=routine.get("priority", 3),
            entity_id=routine.get("entityId", 0),
            ticket_type=routine.get("type", 2),
            status_id=routine.get("statusId", 1),
            location_id=routine.get("locationId"),
            request_type_id=routine.get("requestTypeId", 6),
            requester_user_id=routine.get("requesterUserId") or 2,
            requester_group_id=routine.get("requesterGroupId"),
            assigned_user_id=routine.get("assignedUserId"),
            assigned_group_id=routine.get("assignedGroupId"),
            observer_user_id=routine.get("observerUserId"),
            observer_group_id=routine.get("observerGroupId"),
            extra_fields=routine.get("extraFields"),
            equipment=routine.get("equipment"),
            opening_date=target_opening_date,
            offset_hours=getattr(settings, "GLPI_DATE_OFFSET_HOURS", 0)
        )

        ticket_id = res["ticket_id"]
        log_entry = {
            "id": f"log-{int(time.time() * 1000)}",
            "routineId": routine_id,
            "routineTitle": rendered_title,
            "categoryName": routine.get("categoryName"),
            "triggeredAt": format_glpi_date(now_sp),
            "status": "success",
            "glpiTicketId": ticket_id,
            "glpiTicketUrl": res.get("ticket_url"),
            "executionType": trigger_type,
            "executedBy": triggered_by,
            "message": f"Chamado de TI #{ticket_id} criado com sucesso no GLPI! (Data de abertura: {res.get('date')})",
            "durationMs": res.get("duration_ms", 0),
            "requestPayload": res.get("payload"),
            "responsePayload": res.get("report") or res.get("response")
        }

        db.data["logs"].insert(0, log_entry)
        if len(db.data["logs"]) > 500:
            db.data["logs"].pop()

        routine["lastRunAt"] = format_glpi_date(now_sp)
        routine["nextRunAt"] = compute_next_run(routine)
        routine["totalDispatched"] = routine.get("totalDispatched", 0) + 1
        routine["lastExecutionStatus"] = "success"
        routine["lastTicketId"] = ticket_id

        db.data["glpiConfig"]["connectionStatus"] = "connected"
        db.data["glpiConfig"]["lastCheck"] = format_glpi_date(now_sp)
        db.data["glpiConfig"]["lastErrorMessage"] = None
        db.save()

        return {
            "success": True, 
            "ticketId": ticket_id, 
            "ticketUrl": res.get("ticket_url"),
            "log": log_entry, 
            "report": res.get("report")
        }

    except Exception as err:
        log_entry = {
            "id": f"log-{int(time.time() * 1000)}",
            "routineId": routine_id,
            "routineTitle": rendered_title,
            "categoryName": routine.get("categoryName"),
            "triggeredAt": format_glpi_date(now_sp),
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
    while True:
        try:
            cfg = db.data.get("glpiConfig", {})
            if cfg.get("schedulerRunning", True):
                now_sp = now_sao_paulo()
                db.data["glpiConfig"]["schedulerLastHeartbeat"] = format_glpi_date(now_sp)

                for routine in db.data.get("routines", []):
                    if not routine.get("isActive", True):
                        continue

                    next_run_str = routine.get("nextRunAt")
                    if next_run_str:
                        try:
                            clean_str = next_run_str.replace("Z", "").replace(" ", "T")
                            if "+" in clean_str or "-" in clean_str[10:]:
                                next_run = datetime.fromisoformat(clean_str).astimezone(SP_TZ)
                            else:
                                next_run = datetime.fromisoformat(clean_str).replace(tzinfo=SP_TZ)

                            if next_run <= now_sp:
                                # Prevenção de duplicidade: não executa se já executou nos últimos 55s
                                last_run_str = routine.get("lastRunAt")
                                if last_run_str:
                                    last_clean = last_run_str.replace("Z", "").replace(" ", "T")
                                    try:
                                        if "+" in last_clean or "-" in last_clean[10:]:
                                            last_run = datetime.fromisoformat(last_clean).astimezone(SP_TZ)
                                        else:
                                            last_run = datetime.fromisoformat(last_clean).replace(tzinfo=SP_TZ)
                                        if (now_sp - last_run).total_seconds() < 55:
                                            continue
                                    except Exception:
                                        pass

                                logger.info(f"Agendador disparando: {routine.get('title')}")
                                await execute_routine_dispatch(routine, "scheduled", "Agendador de TI (Serviço Automático)")
                        except Exception as e:
                            logger.error(f"Erro ao processar rotina {routine.get('id')}: {e}")

        except Exception as e:
            logger.error(f"Erro no loop do agendador: {e}")

        await asyncio.sleep(settings.SCHEDULER_INTERVAL_SEC)
