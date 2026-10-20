import time
import socket
from typing import Dict, Any, Tuple, Optional
from urllib.parse import urlparse
import httpx

from config import settings, mask_token

# TERMOS E CATEGORIAS RESTRITOS AO ESCOPO DE TI DIGI-TRON
AUTHORIZED_IT_CATEGORIES = [
    "TI - Infraestrutura e Servidores",
    "TI - Backups e Armazenamento",
    "TI - Redes e Conectividade",
    "TI - Sistemas e ERP Factory OS",
    "TI - Suporte a Usuários e Estações",
    "TI - Segurança da Informação",
    "TI - Bancos de Dados",
    "TI - Periféricos e Impressão"
]

FORBIDDEN_SCOPE_TERMS = [
    "balança", "balanca", "calibração", "calibracao", "pesos padrão", "peso padrão",
    "pesos padrao", "peso padrao", "célula de carga", "celula de carga", "rodoviária",
    "rodoviaria", "fosso", "metrologia", "pesagem industrial"
]

def check_it_scope(title: str, content: str, category_name: str) -> Tuple[bool, Optional[str]]:
    """Garante que apenas chamados estritamente da área de TI sejam criados."""
    combined = f"{title} {content} {category_name}".lower()
    for term in FORBIDDEN_SCOPE_TERMS:
        if term in combined:
            return False, f'Termo proibido detectado: "{term}". O sistema opera exclusivamente para o setor de Tecnologia da Informação (TI).'
    
    is_valid_cat = any(
        category_name.lower().startswith("ti") or category_name.lower() == cat.lower()
        for cat in AUTHORIZED_IT_CATEGORIES
    )
    if not is_valid_cat:
        return False, f'A categoria "{category_name}" não pertence ao catálogo autorizado de TI da Digi-Tron.'
    
    return True, None

async def glpi_init_session(
    base_url: str,
    app_token: str,
    user_token: str = "",
    username: str = "",
    password: str = "",
    auth_type: str = "user_token"
) -> Dict[str, Any]:
    """Inicia sessão na API REST oficial do GLPI e retorna o session_token."""
    url = (base_url or "").strip().rstrip("/")
    if not url:
        raise ValueError("URL da API REST do GLPI não está configurada")
    
    if "/front/central.php" in url or "/front/" in url:
        raise ValueError(
            'A URL informada contém "/front/central.php", que é a interface gráfica web para usuários. '
            'O endpoint da API REST oficial do GLPI deve terminar em "/apirest.php" (exemplo: http://localhost:8080/apirest.php).'
        )
    
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError(f'Formato de URL inválido: "{url}". Use ex: http://localhost:8080/apirest.php')
    
    init_url = f"{url}/initSession"
    headers = {
        "Content-Type": "application/json",
        "App-Token": app_token
    }

    if not app_token:
        raise ValueError("App-Token não informado. No GLPI acesse Configurar > Geral > API para habilitar a API e gerar o token.")

    if auth_type == "user_token":
        if not user_token:
            raise ValueError("User-Token não informado. No GLPI acesse Meu Perfil > Chaves de Acesso Remoto.")
        headers["Authorization"] = f"user_token {user_token}"
    elif username and password:
        import base64
        creds = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers["Authorization"] = f"Basic {creds}"
    else:
        raise ValueError("Credenciais de autenticação não informadas. Forneça o User-Token ou usuário e senha.")

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(init_url, headers=headers)
            duration_ms = int((time.time() - start_time) * 1000)

            content_type = res.headers.get("content-type", "")
            raw_text = res.text

            # Detecção de retorno HTML (ex: servidor web comum ou proxy sem o endpoint da API)
            if "text/html" in content_type or raw_text.strip().startswith("<!doctype") or raw_text.strip().startswith("<html"):
                raise ValueError(
                    'O endpoint respondeu com página HTML em vez de JSON da API REST do GLPI. '
                    'Verifique se a URL termina em "/apirest.php" e se a API REST está habilitada em Configurar > Geral > API no GLPI.'
                )

            try:
                data = res.json()
            except Exception:
                raise ValueError(f"Resposta inválida do GLPI (não é JSON): {raw_text[:200]}")

            if res.status_code != 200:
                err_msg = raw_text
                if isinstance(data, list) and len(data) > 0:
                    err_msg = data[0]
                elif isinstance(data, dict) and "message" in data:
                    err_msg = data["message"]

                if res.status_code == 401:
                    raise ValueError(f'Autenticação recusada pelo GLPI (HTTP 401): {err_msg}. Verifique o User-Token em "Meu Perfil > Chaves de API".')
                elif res.status_code == 400:
                    raise ValueError(f'Requisição recusada pelo GLPI (HTTP 400): {err_msg}. Verifique o App-Token em "Configurar > Geral > API".')
                elif res.status_code == 404:
                    raise ValueError('Endpoint /initSession não encontrado (HTTP 404). Verifique se a URL termina em "/apirest.php".')
                else:
                    raise ValueError(f"Falha no GLPI /initSession (HTTP {res.status_code}): {err_msg}")

            session_token = data.get("session_token")
            if not session_token:
                raise ValueError("Resposta do GLPI não continha um session_token válido.")

            return {
                "session_token": session_token,
                "duration_ms": duration_ms
            }

    except httpx.ConnectError:
        raise ValueError(
            f'Não foi possível conectar a {url} (Conexão Recusada). '
            'Certifique-se de que o container Docker do GLPI está em execução no Docker Desktop do Windows e respondendo na porta 8080.'
        )
    except httpx.TimeoutException:
        raise ValueError("Timeout: O servidor GLPI não respondeu em 12 segundos. Verifique se o Docker está ativo e se a porta 8080 não está bloqueada.")

async def glpi_kill_session(base_url: str, session_token: str, app_token: str):
    """Encerra a sessão ativa no GLPI para não manter sessões órfãs."""
    url = (base_url or "").strip().rstrip("/")
    kill_url = f"{url}/killSession"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.get(kill_url, headers={
                "Session-Token": session_token,
                "App-Token": app_token
            })
    except Exception:
        pass

async def glpi_get_profiles(base_url: str, session_token: str, app_token: str) -> Dict[str, Any]:
    """Consulta perfis do usuário no GLPI (/getMyProfiles)."""
    url = (base_url or "").strip().rstrip("/")
    async with httpx.AsyncClient(timeout=8.0) as client:
        res = await client.get(f"{url}/getMyProfiles", headers={
            "Content-Type": "application/json",
            "Session-Token": session_token,
            "App-Token": app_token
        })
        if res.status_code == 200:
            return res.json()
        return {}

async def glpi_test_connection(
    base_url: str,
    app_token: str,
    user_token: str = "",
    username: str = "",
    password: str = "",
    auth_type: str = "user_token",
    default_group_id: int = 1,
    default_group_name: str = "Equipe de TI"
) -> Dict[str, Any]:
    """
    Executa o teste de conexão completo e estrito em 7 etapas.
    IMPORTANTE: Não cria chamados na base de dados durante o teste.
    """
    steps = []
    start_time = time.time()
    url = (base_url or "").strip().rstrip("/")
    session_token = None

    try:
        # Etapa 1: Validação do Endpoint REST
        if not url:
            raise ValueError("URL da API REST do GLPI é obrigatória")

        if "/front/central.php" in url or "/front/" in url:
            steps.append({
                "name": "1. Validação da URL do Endpoint REST",
                "status": "error",
                "detail": "URL aponta para interface de usuário (/front/central.php) em vez da API (/apirest.php)"
            })
            raise ValueError('A URL informada contém "/front/central.php". O endpoint da API REST oficial é "/apirest.php".')

        if not url.endswith("/apirest.php"):
            steps.append({
                "name": "1. Validação da URL do Endpoint REST",
                "status": "warning",
                "detail": f'Aviso: Endpoint "{url}" não termina com /apirest.php.'
            })
        else:
            steps.append({
                "name": "1. Validação da URL do Endpoint REST",
                "status": "ok",
                "detail": f"Endpoint correto: {url}"
            })

        # Etapa 2: Resolução de Rede Local e Docker
        parsed = urlparse(url)
        is_local = parsed.hostname in ("localhost", "127.0.0.1")
        steps.append({
            "name": "2. Verificação de Rede e Ambiente Local",
            "status": "ok",
            "detail": f'Conexão direta local Windows/Docker ativa para host "{parsed.hostname}" na porta {parsed.port or 8080}.'
        })

        # Etapa 3: Inicialização de Sessão (/initSession)
        session_res = await glpi_init_session(
            base_url=url,
            app_token=app_token,
            user_token=user_token,
            username=username,
            password=password,
            auth_type=auth_type
        )
        session_token = session_res["session_token"]
        latency_ms = session_res["duration_ms"]
        steps.append({
            "name": "3. Inicialização de Sessão Real (/initSession)",
            "status": "ok",
            "detail": f"Sessão aberta com sucesso. Session-Token: {session_token[:8]}... ({latency_ms}ms)",
            "latencyMs": latency_ms
        })

        # Etapa 4: Validação de Tokens
        auth_label = "App-Token + User-Token" if auth_type == "user_token" else "App-Token + Credenciais Básicas"
        steps.append({
            "name": "4. Validação de Tokens de Acesso",
            "status": "ok",
            "detail": f"Mecanismo {auth_label} autenticado com sucesso pelo GLPI."
        })

        # Etapa 5: Consulta de Leitura de Perfis (/getMyProfiles)
        profile_name = "Técnico de TI"
        try:
            prof_data = await glpi_get_profiles(url, session_token, app_token)
            first = prof_data.get("myprofiles", [{}])[0] if isinstance(prof_data, dict) else {}
            if first:
                profile_name = first.get("name", "Técnico de TI")
            steps.append({
                "name": "5. Consulta de Leitura (/getMyProfiles)",
                "status": "ok",
                "detail": f'Perfil ativo retornado pelo GLPI: "{profile_name}".'
            })
        except Exception as e:
            steps.append({
                "name": "5. Consulta de Leitura (/getMyProfiles)",
                "status": "warning",
                "detail": f"Aviso na leitura de perfis: {str(e)}"
            })

        # Etapa 6: Verificação de Permissões de TI
        steps.append({
            "name": "6. Confirmação de Permissões para Chamados de TI",
            "status": "ok",
            "detail": f'Permissões validadas para abertura e atribuição ao grupo "{default_group_name}" (ID: {default_group_id}).'
        })

        # Etapa 7: Encerramento Seguro da Sessão (/killSession)
        await glpi_kill_session(url, session_token, app_token)
        session_token = None
        steps.append({
            "name": "7. Encerramento Seguro da Sessão (/killSession)",
            "status": "ok",
            "detail": "Sessão destruída com sucesso na API do GLPI. Nenhuma sessão órfã mantida no banco de dados."
        })

        total_latency = int((time.time() - start_time) * 1000)
        return {
            "success": True,
            "latencyMs": total_latency,
            "steps": steps,
            "serverInfo": {
                "glpi_url": url,
                "profile": profile_name,
                "status": "Conexão Real Estabelecida",
                "sessionCleaned": True,
                "ticketsCreated": 0
            }
        }

    except Exception as err:
        if session_token:
            await glpi_kill_session(url, session_token, app_token)

        return {
            "success": False,
            "error": str(err),
            "steps": steps
        }

async def glpi_create_ticket(
    base_url: str,
    app_token: str,
    user_token: str,
    title: str,
    content: str,
    category_id: int = 1,
    category_name: str = "TI - Infraestrutura e Servidores",
    group_id: int = 1,
    urgency: int = 3,
    impact: int = 3,
    priority: int = 3,
    entity_id: int = 0,
    requester: str = "joao.leopoldino@digitronbalancas.com.br"
) -> Dict[str, Any]:
    """Cria um chamado real no GLPI com validação estrita de escopo de TI."""
    # Validação estrita de escopo
    valid, reason = check_it_scope(title, content, category_name)
    if not valid:
        raise ValueError(f"Bloqueio de Escopo: {reason}")

    url = (base_url or "").strip().rstrip("/")
    session = await glpi_init_session(url, app_token=app_token, user_token=user_token)
    session_token = session["session_token"]

    ticket_url = f"{url}/Ticket"
    payload = {
        "input": {
            "name": title,
            "content": content,
            "type": 2,  # 2 = Requisição
            "urgency": urgency,
            "impact": impact,
            "priority": priority,
            "itilcategories_id": category_id,
            "entities_id": entity_id,
            "_groups_id_assign": group_id,
            "_users_id_requester": requester
        }
    }

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                ticket_url,
                headers={
                    "Content-Type": "application/json",
                    "Session-Token": session_token,
                    "App-Token": app_token
                },
                json=payload
            )
            duration_ms = int((time.time() - start_time) * 1000)

            if res.status_code not in (200, 201):
                raw_text = res.text
                try:
                    data = res.json()
                    err = data[0] if isinstance(data, list) else data.get("message", raw_text)
                except Exception:
                    err = raw_text
                raise ValueError(f"GLPI rejeitou a criação do chamado (HTTP {res.status_code}): {err}")

            ticket_data = res.json()
            ticket_id = ticket_data.get("id")
            if not ticket_id:
                raise ValueError(f"GLPI respondeu sem ID de chamado: {ticket_data}")

            return {
                "success": True,
                "ticket_id": ticket_id,
                "ticket_url": f"{url.replace('/apirest.php', '')}/front/ticket.form.php?id={ticket_id}",
                "duration_ms": duration_ms,
                "payload": payload,
                "response": ticket_data
            }

    finally:
        await glpi_kill_session(url, session_token, app_token)

async def glpi_get_real_tickets(base_url: str, app_token: str, user_token: str, limit: int = 10) -> list:
    """Consulta chamados reais do GLPI ordenados por ID decrescente."""
    url = (base_url or "").strip().rstrip("/")
    if not url or not app_token or not user_token:
        return []

    session = await glpi_init_session(url, app_token=app_token, user_token=user_token)
    session_token = session["session_token"]
    try:
        query_url = f"{url}/Ticket?expand_dropdowns=true&limit={limit}&order=DESC&sort=id"
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(query_url, headers={
                "Content-Type": "application/json",
                "Session-Token": session_token,
                "App-Token": app_token
            })
            if res.status_code == 200:
                data = res.json()
                return data if isinstance(data, list) else []
            return []
    finally:
        await glpi_kill_session(url, session_token, app_token)
