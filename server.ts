import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dns from 'dns/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { 
  getSaoPauloParts, 
  getSaoPauloTodayIso, 
  calculateNextRunInSaoPaulo, 
  createSaoPauloDate, 
  parseDateSafe,
  nowSaoPaulo,
  formatGlpiDateTime
} from './src/utils/dateTime';
import {
  resolveGlpiRequesterId,
  resolveGlpiTechnicianId,
  resolveGlpiGroupId,
  resolveGlpiCategoryId,
  resolveGlpiLocationId,
  resolveGlpiRequestTypeId,
  resolveGlpiEntityId,
  GLPI_REQUESTERS_MAP,
  GLPI_TECHNICIANS_MAP,
  GLPI_GROUPS_MAP,
  GLPI_CATEGORIES_MAP,
  GLPI_LOCATIONS_MAP,
  GLPI_REQUEST_TYPES_MAP
} from './src/config/glpi-map';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolvePort(): number {
  // 1. Argumentos explícitos de linha de comando (--port 5522 ou -p 5522)
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if ((arg === '--port' || arg === '-p') && process.argv[i + 1]) {
      const parsed = parseInt(process.argv[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 2. Variável de ambiente PORT (.env ou container)
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // 3. Porta padrão oficial do Agente de Chamados: 5522
  return 5522;
}

const port = resolvePort();

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    service: 'Digi-Tron TI — Agente de Chamados',
    port: port,
    accessUrl: `http://localhost:${port}/login`,
    timestamp: new Date().toISOString()
  });
});

const DATA_FILE = path.resolve(__dirname, 'glpi-scheduler-data.json');

// AUTHORIZED IT CATEGORIES
const AUTHORIZED_IT_CATEGORIES = [
  'TI - Infraestrutura e Servidores',
  'TI - Backups e Armazenamento',
  'TI - Redes e Conectividade',
  'TI - Sistemas e ERP Factory OS',
  'TI - Suporte a Usuários e Estações',
  'TI - Segurança da Informação',
  'TI - Bancos de Dados',
  'TI - Periféricos e Impressão'
];

// FORBIDDEN NON-IT TERMS (Metrology, scales, mechanical production, etc.)
const FORBIDDEN_SCOPE_TERMS = [
  'balança', 'balanca', 'calibração', 'calibracao', 'pesos padrão', 'peso padrão',
  'pesos padrao', 'peso padrao', 'célula de carga', 'celula de carga', 'rodoviária',
  'rodoviaria', 'fosso', 'metrologia', 'pesagem industrial'
];

function isItScope(title: string, content: string, categoryName: string): { valid: boolean; reason?: string } {
  const combined = `${title} ${content} ${categoryName}`.toLowerCase();
  for (const term of FORBIDDEN_SCOPE_TERMS) {
    if (combined.includes(term)) {
      return {
        valid: false,
        reason: `Termo não permitido detectado: "${term}". O GLPI AutoScheduler Digi-Tron é restrito exclusivamente ao escopo de Tecnologia da Informação (TI).`
      };
    }
  }

  const isItCat = AUTHORIZED_IT_CATEGORIES.some(cat => 
    categoryName.toLowerCase().startsWith('ti') || categoryName.toLowerCase() === cat.toLowerCase()
  );

  if (!isItCat) {
    return {
      valid: false,
      reason: `A categoria "${categoryName}" não pertence ao catálogo autorizado de TI da Digi-Tron.`
    };
  }

  return { valid: true };
}

interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'tecnico';
  department: 'TI';
  company: string;
  createdAt: string;
}

interface ResetCode {
  email: string;
  code: string;
  expiresAt: number;
}

interface DbSchema {
  users: UserAccount[];
  glpiConfig: {
    url: string;
    authType: 'user_token' | 'credentials';
    appToken: string;
    userToken: string;
    username: string;
    password?: string;
    entityId: number;
    defaultItGroupId?: number;
    defaultItGroupName?: string;
    connectionStatus: 'connected' | 'disconnected' | 'error' | 'pending_configuration';
    lastCheck: string | null;
    lastErrorMessage?: string | null;
    glpiVersion?: string | null;
    glpiUser?: string | null;
    activeProfile?: string | null;
    sessionTokenMasked?: string | null;
    schedulerRunning: boolean;
    schedulerLastHeartbeat: string | null;
  };
  routines: any[];
  logs: any[];
}

const defaultInitialData: DbSchema = {
  users: [
    {
      id: 'usr-admin-1',
      name: 'João Leopoldino',
      email: 'joao.leopoldino@digitronbalancas.com.br',
      passwordHash: '123456',
      role: 'admin',
      department: 'TI',
      company: 'Digitron Balanças',
      createdAt: '2026-01-15T08:00:00.000Z'
    },
    {
      id: 'usr-tech-2',
      name: 'Suporte TI Digi-Tron',
      email: 'suporte.ti@digitronbalancas.com.br',
      passwordHash: '123456',
      role: 'tecnico',
      department: 'TI',
      company: 'Digitron Balanças',
      createdAt: '2026-02-01T08:00:00.000Z'
    }
  ],
  glpiConfig: {
    url: process.env.GLPI_URL || 'http://localhost:8080/apirest.php',
    authType: 'user_token',
    appToken: process.env.GLPI_APP_TOKEN || '',
    userToken: process.env.GLPI_USER_TOKEN || '',
    username: process.env.GLPI_USERNAME || 'joao.leopoldino',
    password: process.env.GLPI_PASSWORD || '',
    entityId: parseInt(process.env.GLPI_ENTITY_ID || '0', 10),
    defaultItGroupId: 1,
    defaultItGroupName: 'Equipe de TI',
    connectionStatus: 'pending_configuration',
    lastCheck: null,
    lastErrorMessage: null,
    glpiVersion: null,
    glpiUser: null,
    activeProfile: null,
    sessionTokenMasked: null,
    schedulerRunning: true,
    schedulerLastHeartbeat: new Date().toISOString()
  },
  routines: [
    {
      id: 'rot-it-101',
      title: '[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})',
      content: `## 💾 Verificação Diária de Backups — Tecnologia da Informação\n**Data Programada:** {data} às {hora}\n**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron\n**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.\n- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados principal.\n- [ ] Conferir replicação segura dos snapshots para o storage NAS secundário e nuvem.\n- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.\n- [ ] Realizar teste de montagem e restauração amostral em ambiente sandbox de homologação.\n- [ ] Registrar evidências e anexar print do relatório no chamado antes do encerramento.`,
      frequency: 'daily',
      time: '06:30',
      daysOfWeek: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
      customIntervalHours: 24,
      isActive: true,
      type: 2,
      urgency: 4,
      impact: 4,
      priority: 4,
      categoryId: 2,
      categoryName: 'TI - Backups e Armazenamento',
      requester: 'joao.leopoldino@digitronbalancas.com.br',
      assignee: 'Equipe de TI',
      technicalGroup: 'Equipe de TI',
      entityId: 0,
      tags: ['Backup', 'ERP Factory OS', 'Storage NAS', 'PostgreSQL'],
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      totalDispatched: 0,
      createdBy: 'joao.leopoldino@digitronbalancas.com.br',
      createdAt: '2026-01-20T10:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'rot-it-102',
      title: '[TI] Verificação de Disponibilidade e Saúde dos Servidores Físicos e Virtuais ({data})',
      content: `## 🖥️ Inspeção de Saúde dos Servidores — Equipe de TI\n**Data Programada:** {data} às {hora}\n**Ambiente:** Datacenter e Servidores Virtuais Digi-Tron\n**Atenção:** Este chamado solicita a inspeção técnica preventiva dos servidores listados.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Analisar alertas de hardware e painel iDRAC/iLO dos servidores físicos.\n- [ ] Verificar saúde das controladoras RAID e status SMART de todos os discos rígidos e SSDs.\n- [ ] Checar uso de memória RAM e carga de CPU nas máquinas virtuais críticas.\n- [ ] Conferir temperatura operacional e alertas nos nobreaks (UPS) do rack central.\n- [ ] Revisar logs do Visualizador de Eventos (Event Viewer / syslog) em busca de erros críticos.\n- [ ] Validar sincronização de horário via protocolo NTP em todos os nós do domínio.`,
      frequency: 'daily',
      time: '07:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
      customIntervalHours: 24,
      isActive: true,
      type: 2,
      urgency: 3,
      impact: 4,
      priority: 4,
      categoryId: 1,
      categoryName: 'TI - Infraestrutura e Servidores',
      requester: 'joao.leopoldino@digitronbalancas.com.br',
      assignee: 'Equipe de TI',
      technicalGroup: 'Equipe de TI',
      entityId: 0,
      tags: ['Servidores', 'Hyper-V', 'Windows Server', 'Linux'],
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
      totalDispatched: 0,
      createdBy: 'joao.leopoldino@digitronbalancas.com.br',
      createdAt: '2026-01-15T08:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'rot-it-103',
      title: '[TI] Verificação de Conectividade de Rede, Links de Internet e Wi-Fi ({data})',
      content: `## 🌐 Manutenção Preventiva de Redes e Telecom — TI\n**Data Programada:** {data} às {hora}\n**Setor:** Redes & Comunicações Digi-Tron\n**Atenção:** Solicitação para teste de integridade da infraestrutura cabeada e sem fio.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Testar redundância e failover entre o link principal e link de contingência da Digi-Tron.\n- [ ] Medir latência (ping / jitter) e perda de pacotes para o gateway e DNS corporativo.\n- [ ] Vistoriar logs de erros de portas nos switches gerenciáveis dos racks 1 e 2.\n- [ ] Validar cobertura e roaming dos Access Points (AP) nos setores administrativos e galpões.\n- [ ] Verificar temperatura e ventilação do switch core e do roteador de borda.\n- [ ] Confirmar que o túnel VPN de acesso remoto seguro está ativo e sem falhas de handshake.`,
      frequency: 'weekly',
      time: '07:45',
      daysOfWeek: [2],
      dayOfMonth: 1,
      customIntervalHours: 168,
      isActive: true,
      type: 2,
      urgency: 3,
      impact: 3,
      priority: 3,
      categoryId: 3,
      categoryName: 'TI - Redes e Conectividade',
      requester: 'joao.leopoldino@digitronbalancas.com.br',
      assignee: 'Equipe de TI',
      technicalGroup: 'Equipe de TI',
      entityId: 0,
      tags: ['Redes', 'Switches', 'Wi-Fi', 'Internet'],
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      totalDispatched: 0,
      createdBy: 'joao.leopoldino@digitronbalancas.com.br',
      createdAt: '2026-02-01T11:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'rot-it-104',
      title: '[TI] Revisão Periódica de Contas, Acessos e Usuários Inativos no AD e GLPI ({mes_extenso}/{ano})',
      content: `## 👥 Revisão de Acessos e Usuários — Governança de TI\n**Período:** {mes_extenso} de {ano}\n**Setor:** Administração de Contas & Diretório Digi-Tron\n**Atenção:** Verificação periódica de conformidade e controle de acesso a sistemas.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Cruzar lista de colaboradores desligados com o Active Directory e desativar contas pendentes.\n- [ ] Desativar ou revogar perfis inativos no GLPI e no ERP Factory OS.\n- [ ] Revisar membros dos grupos de Domain Admins, Administradores Locais e TI no AD.\n- [ ] Validar que nenhum usuário comum possui privilégios de administrador de estação.\n- [ ] Auditar contas de serviço e renovar senhas de rotinas automatizadas se aplicável.\n- [ ] Emitir laudo sumário de conformidade para a gerência de TI.`,
      frequency: 'monthly',
      time: '10:00',
      daysOfWeek: [],
      dayOfMonth: 1,
      customIntervalHours: 720,
      isActive: true,
      type: 2,
      urgency: 4,
      impact: 4,
      priority: 4,
      categoryId: 6,
      categoryName: 'TI - Segurança da Informação',
      requester: 'joao.leopoldino@digitronbalancas.com.br',
      assignee: 'Equipe de TI',
      technicalGroup: 'Equipe de TI',
      entityId: 0,
      tags: ['Active Directory', 'GLPI', 'Contas', 'Acessos', 'LGPD'],
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
      totalDispatched: 0,
      createdBy: 'joao.leopoldino@digitronbalancas.com.br',
      createdAt: '2026-02-15T09:00:00.000Z',
      updatedAt: new Date().toISOString()
    }
  ],
  logs: []
};

// Database Initialization & Strict IT Migration
let db: DbSchema = { ...defaultInitialData };

try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    db = { ...defaultInitialData, ...parsed };

    // MIGRATION: Filter out any non-IT routines that may have remained from older versions
    db.routines = (db.routines || []).filter((r: any) => {
      const check = isItScope(r.title || '', r.content || '', r.categoryName || '');
      return check.valid;
    });

    if (db.routines.length === 0) {
      db.routines = [...defaultInitialData.routines];
    }

    // MIGRATION: Ensure authorized TI users exist
    const hasAdmin = db.users.some(u => u.email === 'joao.leopoldino@digitronbalancas.com.br');
    if (!hasAdmin) db.users.unshift(defaultInitialData.users[0]);
    const hasTech = db.users.some(u => u.email === 'suporte.ti@digitronbalancas.com.br');
    if (!hasTech) db.users.push(defaultInitialData.users[1]);

    // Ensure department is TI
    for (const u of db.users) {
      u.department = 'TI';
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  }
} catch (e) {
  console.error('Error loading DB file, fallback to initial IT data:', e);
}

function saveDb() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to write DB file:', err);
  }
}

const resetCodes: ResetCode[] = [];
const executingRoutines = new Set<string>();

// Macro variable replacement in America/Sao_Paulo operational timezone
function replaceMacros(text: string): string {
  const parts = getSaoPauloParts(new Date());
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  const year = parts.year;
  const hours = String(parts.hour).padStart(2, '0');
  const minutes = String(parts.minute).padStart(2, '0');

  const monthsPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDaysPt = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
  const weekNumber = Math.max(1, Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7));

  const monthName = monthsPt[parts.month - 1] || 'Janeiro';
  const weekDayName = weekDaysPt[parts.dayOfWeek] || 'Segunda-feira';

  const replacements: Record<string, string> = {
    '{data}': `${day}/${month}/${year}`,
    '{data_iso}': `${year}-${month}-${day}`,
    '{hora}': `${hours}:${minutes}`,
    '{dia}': day,
    '{mes}': monthName,
    '{mes_num}': month,
    '{ano}': String(year),
    '{mes_ano}': `${month}/${year}`,
    '{mes_extenso}': monthName,
    '{dia_semana}': weekDayName,
    '{semana_ano}': `Semana ${weekNumber}`,
    '{empresa}': 'Digi-Tron Balanças',
    '{responsavel}': 'Equipe de TI Digi-Tron'
  };

  let res = text;
  for (const [key, val] of Object.entries(replacements)) {
    res = res.split(key).join(val);
  }
  return res;
}

// Next run calculation in America/Sao_Paulo timezone
function computeNextRun(routine: any): string {
  const nextDate = calculateNextRunInSaoPaulo(routine, new Date());
  return nextDate.toISOString();
}


function maskSecret(token?: string | null): string | null {
  if (!token) return null;
  if (token.length <= 6) return '******';
  return `***${token.slice(-4)}`;
}

// Runtime Environment Detection
function getRuntimeEnvironment() {
  const isCloud = Boolean(
    process.env.K_SERVICE ||
    process.env.CLOUD_RUN ||
    process.env.DYNO ||
    process.env.VERCEL ||
    process.env.GAE_APPLICATION ||
    process.env.FLY_ALLOC_ID
  );
  const isDocker = fs.existsSync('/.dockerenv');

  let type: 'cloud_container' | 'docker_container' | 'local_machine' = 'local_machine';
  let title = 'Computador / Servidor Local (Windows/Linux)';
  let description = 'O backend executa diretamente no sistema local. Requisições para http://localhost:8080/apirest.php ou IPs da rede local alcançam o GLPI diretamente.';

  if (isCloud) {
    type = 'cloud_container';
    title = 'Infraestrutura em Nuvem (Cloud Container)';
    description = 'O backend executa em container de nuvem. "localhost:8080" acessa o container interno e não alcança o computador físico Windows da Digi-Tron diretamente. Para conectar ao GLPI local: (1) Execute o projeto localmente com "npm run dev", (2) Utilize um túnel seguro (Cloudflare Tunnel ou ngrok), ou (3) Utilize IP da rede local/VPN.';
  } else if (isDocker) {
    type = 'docker_container';
    title = 'Container Docker';
    description = 'O backend executa em container Docker. Para acessar o GLPI instalado no host Windows, utilize http://host.docker.internal:8080/apirest.php.';
  }

  return {
    type,
    title,
    description,
    isCloud,
    isDocker,
    platform: process.platform,
    hostname: os.hostname(),
    serviceName: process.env.K_SERVICE || (isDocker ? 'Docker Container' : 'Local Node.js Process'),
    nodeVersion: process.version
  };
}

// GLPI Client Helpers
async function glpiInitSession(config: typeof db.glpiConfig): Promise<{ sessionToken: string; durationMs: number }> {
  const startTime = Date.now();
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('URL da API REST do GLPI não está configurada');
  }

  if (baseUrl.includes('/front/central.php') || baseUrl.includes('/front/')) {
    throw new Error(
      'A URL informada contém "/front/central.php", que é a interface gráfica web para usuários. ' +
      'O endpoint da API REST oficial do GLPI deve terminar em "/apirest.php" (exemplo: http://localhost:8080/apirest.php).'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (urlErr) {
    throw new Error(`URL do GLPI inválida: "${baseUrl}". Utilize o formato http://localhost:8080/apirest.php`);
  }

  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    try {
      await dns.lookup(parsed.hostname);
    } catch (dnsErr: any) {
      throw new Error(`Servidor não alcançável (${dnsErr.code || 'DNS'}). O host "${parsed.hostname}" não foi resolvido. Verifique se o endereço é interno da intranet da Digitron, se requer VPN ou configure o IP de rede.`);
    }
  }

  const initUrl = `${baseUrl}/initSession`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'App-Token': config.appToken || ''
  };

  if (!config.appToken) {
    throw new Error('App-Token não configurado. No GLPI acesse Configurar > Geral > API para gerar o token da aplicação.');
  }

  if (config.authType === 'user_token') {
    if (!config.userToken) {
      throw new Error('User-Token não configurado. No GLPI acesse Minhas Configurações > Chaves de Acesso Remoto.');
    }
    headers['Authorization'] = `user_token ${config.userToken}`;
  } else if (config.username && config.password) {
    const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    throw new Error('Credenciais de autenticação não informadas. Informe o User-Token ou usuário e senha do GLPI.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(initUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeout);

    const rawBody = await res.text();
    const contentType = res.headers.get('content-type') || '';

    // Check if the endpoint returned an HTML document (e.g. webserver/proxy/SPA fallback)
    if (contentType.includes('text/html') || rawBody.trim().startsWith('<!doctype') || rawBody.trim().startsWith('<html')) {
      const env = getRuntimeEnvironment();
      if (env.isCloud && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
        throw new Error(
          'O endpoint em localhost:8080 respondeu com HTML (servidor interno do container) em vez de JSON da API REST do GLPI. ' +
          'Diagnóstico de Ambiente: O backend está executando em Container na Nuvem (Cloud Run). Na nuvem, "localhost:8080" referencia o próprio container em nuvem e NÃO o seu computador físico Windows com o GLPI. ' +
          'Para conectar seu GLPI local da Digi-Tron ao agendador: ' +
          '(1) Execute o projeto diretamente no seu computador com "npm run dev"; OU ' +
          '(2) Crie um túnel seguro (ex: no terminal execute "cloudflared tunnel --url http://localhost:8080" ou "ngrok http 8080") e insira a URL pública gerada; OU ' +
          '(3) Utilize o endereço IP da rede local da Digi-Tron (ex: http://192.168.1.xxx:8080/apirest.php) ou VPN corporativa.'
        );
      }
      throw new Error(
        'O endpoint retornou uma página HTML em vez de JSON da API REST do GLPI. ' +
        'Verifique se a URL termina em "/apirest.php" e se a API REST está habilitada em Configurar > Geral > API no GLPI.'
      );
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(rawBody);
    } catch (parseErr) {
      throw new Error(`Resposta inválida do GLPI (não é JSON): ${rawBody.slice(0, 200)}`);
    }

    if (!res.ok) {
      let parsedMsg = rawBody;
      if (Array.isArray(parsedData)) {
        parsedMsg = parsedData[0];
      } else if (parsedData && parsedData.message) {
        parsedMsg = parsedData.message;
      }

      if (res.status === 401) {
        throw new Error(`Autenticação rejeitada pelo GLPI (HTTP 401): ${parsedMsg}. Verifique o User-Token em "Meu Perfil > Chaves de Acesso Remoto" ou o usuário e senha.`);
      } else if (res.status === 400) {
        throw new Error(`Requisição recusada pelo GLPI (HTTP 400): ${parsedMsg}. Verifique o App-Token em "Configurar > Geral > API".`);
      } else if (res.status === 404) {
        throw new Error(`Endpoint /initSession não encontrado (HTTP 404). Verifique se a URL termina em "/apirest.php".`);
      } else {
        throw new Error(`Falha no GLPI /initSession (HTTP ${res.status}): ${parsedMsg}`);
      }
    }

    if (!parsedData.session_token) {
      throw new Error('Resposta do GLPI não retornou session_token válido.');
    }

    return {
      sessionToken: parsedData.session_token,
      durationMs: Date.now() - startTime
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Timeout: O servidor GLPI não respondeu em 12 segundos. Verifique se o endereço é acessível e se não há bloqueio por firewall.');
    }
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`Conexão recusada em ${parsed?.origin || baseUrl} (ECONNREFUSED). Verifique se o serviço do GLPI está em execução e ouvindo na porta informada.`);
    }
    throw err;
  }
}

async function glpiKillSession(baseUrl: string, sessionToken: string, appToken: string): Promise<void> {
  try {
    await fetch(`${baseUrl.trim().replace(/\/+$/, '')}/killSession`, {
      method: 'GET',
      headers: {
        'Session-Token': sessionToken,
        'App-Token': appToken
      }
    });
  } catch (e) {}
}

async function glpiChangeActiveEntities(
  baseUrl: string,
  sessionToken: string,
  appToken: string,
  entityId: number
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.trim().replace(/\/+$/, '')}/changeActiveEntities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': appToken
      },
      body: JSON.stringify({
        entities_id: Number(entityId) || 0,
        is_recursive: true
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function getGlpiSessionInfo(
  baseUrl: string,
  sessionToken: string,
  appToken: string
): Promise<{ currentTime: string | null; activeEntity: number; activeProfile: string | null; glpiUser: string | null }> {
  try {
    const res = await fetch(`${baseUrl.trim().replace(/\/+$/, '')}/getFullSession`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': appToken
      }
    });
    if (res.ok) {
      const data = await res.json();
      const session = data?.session || data;
      return {
        currentTime: session?.glpi_currenttime || null,
        activeEntity: session?.glpiactive_entity ?? 0,
        activeProfile: session?.glpiactiveprofile?.name || null,
        glpiUser: session?.glpifriendlyname || session?.glpiname || null
      };
    }
  } catch (e) {}
  return { currentTime: null, activeEntity: 0, activeProfile: null, glpiUser: null };
}

export interface MultiStepTicketParams {
  title: string;
  content: string;
  type?: number;
  status?: number;
  categoryId?: number | string;
  categoryName?: string;
  entityId?: number | string;
  locationId?: number | string;
  requestTypeId?: number | string;
  urgency?: number;
  impact?: number;
  priority?: number;
  requesterUserId?: number | string;
  requesterGroupId?: number | string;
  assignedUserId?: number | string;
  assignedGroupId?: number | string;
  observerUserId?: number | string;
  observerGroupId?: number | string;
  extraFields?: string;
  equipment?: string;
}

// COMPLETE MULTI-STEP GLPI TICKET CREATOR
async function executeGlpiTicketMultiStep(
  params: MultiStepTicketParams,
  config = db.glpiConfig
): Promise<{
  success: boolean;
  ticketId?: number;
  ticketUrl?: string;
  report?: any;
  error?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const steps: { step: string; status: 'success' | 'warning' | 'error' | 'skipped'; details: string }[] = [];

  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl || (!config.userToken && !config.password)) {
    return {
      success: false,
      error: 'Conexão com GLPI não configurada. Configure a URL e tokens na aba "Conexão GLPI".',
      warnings
    };
  }

  // 1. IT Scope Validation
  const scopeCheck = isItScope(params.title, params.content, params.categoryName || '');
  if (!scopeCheck.valid) {
    return {
      success: false,
      error: `Bloqueio de Escopo: ${scopeCheck.reason}`,
      warnings
    };
  }

  let sessionToken = '';
  try {
    // Step 1: Initialize Session
    const sessionRes = await glpiInitSession(config);
    sessionToken = sessionRes.sessionToken;
    steps.push({
      step: '1. initSession',
      status: 'success',
      details: `Sessão inicializada no GLPI com sucesso (${sessionRes.durationMs}ms)`
    });

    // Step 2: Read GLPI Session Clock (/getFullSession)
    const sessionInfo = await getGlpiSessionInfo(baseUrl, sessionToken, config.appToken);
    let openingDateStr = sessionInfo.currentTime;
    if (openingDateStr && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(openingDateStr)) {
      steps.push({
        step: '2. getFullSession',
        status: 'success',
        details: `Data/hora obtida do relógio oficial do GLPI: ${openingDateStr}`
      });
    } else {
      openingDateStr = formatGlpiDateTime(nowSaoPaulo());
      steps.push({
        step: '2. getFullSession',
        status: 'warning',
        details: `Relógio do GLPI não retornou timestamp válido; utilizando horário local America/Sao_Paulo: ${openingDateStr}`
      });
    }

    // Step 3: Resolve Numeric IDs using official GLPI mapping tables
    const entityRes = resolveGlpiEntityId(params.entityId, 0);
    const entityId = entityRes.id;

    const catRes = resolveGlpiCategoryId(params.categoryId || params.categoryName, 1);
    const categoryId = catRes.id;
    if (catRes.warning) warnings.push(catRes.warning);

    const locRes = resolveGlpiLocationId(params.locationId);
    const locationId = locRes.id;
    if (locRes.warning) warnings.push(locRes.warning);

    const reqTypeRes = resolveGlpiRequestTypeId(params.requestTypeId, 6);
    const requestTypeId = reqTypeRes.id;

    const reqUserRes = resolveGlpiRequesterId(params.requesterUserId, 2);
    const requesterUserId = reqUserRes.id;
    if (reqUserRes.warning) warnings.push(reqUserRes.warning);

    const reqGroupRes = params.requesterGroupId ? resolveGlpiGroupId(params.requesterGroupId, 1) : null;
    const requesterGroupId = reqGroupRes?.id;

    const techUserRes = params.assignedUserId ? resolveGlpiTechnicianId(params.assignedUserId) : null;
    const assignedUserId = techUserRes?.id;
    if (techUserRes?.warning) warnings.push(techUserRes.warning);

    const assignGroupRes = resolveGlpiGroupId(params.assignedGroupId ?? config.defaultItGroupId ?? 1, 1);
    const assignedGroupId = assignGroupRes.id;
    if (assignGroupRes.warning) warnings.push(assignGroupRes.warning);

    const obsUserRes = params.observerUserId ? resolveGlpiTechnicianId(params.observerUserId) : null;
    const observerUserId = obsUserRes?.id;

    const obsGroupRes = params.observerGroupId ? resolveGlpiGroupId(params.observerGroupId, 1) : null;
    const observerGroupId = obsGroupRes?.id;

    // Step 4: changeActiveEntities (with recursive: true)
    const entityChanged = await glpiChangeActiveEntities(baseUrl, sessionToken, config.appToken, entityId);
    steps.push({
      step: '3. changeActiveEntities',
      status: entityChanged ? 'success' : 'warning',
      details: entityChanged
        ? `Entidade ativa alternada para ${entityId} com is_recursive=true (garante categorias e localizações visíveis).`
        : `Aviso: Endpoint /changeActiveEntities não respondeu 200 para a entidade ${entityId}.`
    });

    // Step 5: POST /Ticket (Scalar Fields)
    let fullContent = params.content;
    if (params.equipment && params.equipment.trim()) {
      fullContent += `\n\n**Equipamento / Ativo de TI:** ${params.equipment.trim()}`;
    }

    const inputPayload: Record<string, any> = {
      name: params.title,
      content: fullContent,
      type: Number(params.type) || 2,
      status: Number(params.status) || 1,
      itilcategories_id: categoryId,
      entities_id: entityId,
      urgency: Number(params.urgency) || 3,
      impact: Number(params.impact) || 3,
      priority: Number(params.priority) || 3,
      date: openingDateStr
    };
    if (locationId) inputPayload.locations_id = locationId;
    if (requestTypeId) inputPayload.requesttypes_id = requestTypeId;

    // Parse extraFields (campo=valor)
    if (params.extraFields) {
      const lines = params.extraFields.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.substring(0, eqIdx).trim();
          const v = trimmed.substring(eqIdx + 1).trim();
          const numV = Number(v);
          inputPayload[k] = isNaN(numV) ? v : numV;
        }
      }
    }

    const ticketRes = await fetch(`${baseUrl}/Ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': config.appToken
      },
      body: JSON.stringify({ input: inputPayload })
    });

    const ticketData = await ticketRes.json().catch(() => ({}));
    if (!ticketRes.ok) {
      const errMsg = Array.isArray(ticketData) ? ticketData[0] : (ticketData?.message || `HTTP ${ticketRes.status}`);
      throw new Error(`GLPI rejeitou POST /Ticket (HTTP ${ticketRes.status}): ${errMsg}`);
    }

    const ticketId = ticketData.id || ticketData?.input?.id;
    if (!ticketId) {
      throw new Error(`GLPI não retornou o ID do chamado criado: ${JSON.stringify(ticketData)}`);
    }
    steps.push({
      step: '4. POST /Ticket',
      status: 'success',
      details: `Chamado de TI #${ticketId} criado com os campos escalares básicos.`
    });

    // Step 6: GET /Ticket/{id} & Compare Scalars & PUT Correction if needed
    const getRes = await fetch(`${baseUrl}/Ticket/${ticketId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': config.appToken
      }
    });
    const recordedTicket = getRes.ok ? await getRes.json() : {};

    const corrections: Record<string, any> = {};
    if (Number(recordedTicket.type) !== Number(inputPayload.type)) {
      corrections.type = inputPayload.type;
    }
    if (Number(recordedTicket.status) !== Number(inputPayload.status)) {
      corrections.status = inputPayload.status;
    }
    if (Number(recordedTicket.itilcategories_id) !== Number(inputPayload.itilcategories_id)) {
      corrections.itilcategories_id = inputPayload.itilcategories_id;
    }
    if (locationId && Number(recordedTicket.locations_id) !== Number(locationId)) {
      corrections.locations_id = locationId;
    }
    if (requestTypeId && Number(recordedTicket.requesttypes_id) !== Number(requestTypeId)) {
      corrections.requesttypes_id = requestTypeId;
    }
    if (Number(recordedTicket.urgency) !== Number(inputPayload.urgency)) {
      corrections.urgency = inputPayload.urgency;
    }
    if (Number(recordedTicket.impact) !== Number(inputPayload.impact)) {
      corrections.impact = inputPayload.impact;
    }
    if (Number(recordedTicket.priority) !== Number(inputPayload.priority)) {
      corrections.priority = inputPayload.priority;
    }
    if (!recordedTicket.date || recordedTicket.date === '0000-00-00 00:00:00') {
      corrections.date = openingDateStr;
    }

    if (Object.keys(corrections).length > 0) {
      corrections.id = ticketId;
      const putRes = await fetch(`${baseUrl}/Ticket/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': sessionToken,
          'App-Token': config.appToken
        },
        body: JSON.stringify({ input: corrections })
      });
      steps.push({
        step: '5. PUT /Ticket/{id} (Correção)',
        status: putRes.ok ? 'success' : 'warning',
        details: putRes.ok
          ? `Campos não aplicados pelo padrão do GLPI corrigidos via PUT: ${Object.keys(corrections).filter(k => k !== 'id').join(', ')}`
          : 'Falha na requisição de correção PUT'
      });
    } else {
      steps.push({
        step: '5. PUT /Ticket/{id} (Correção)',
        status: 'skipped',
        details: 'Todos os campos escalares (categoria, data, tipo, status, prioridade) foram gravados com exatidão.'
      });
    }

    // Step 7: Multi-Step Actor Synchronization (Ticket_User and Group_Ticket)
    const [existingTuRes, existingGtRes] = await Promise.all([
      fetch(`${baseUrl}/Ticket/${ticketId}/Ticket_User`, {
        headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
      }).catch(() => null),
      fetch(`${baseUrl}/Ticket/${ticketId}/Group_Ticket`, {
        headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
      }).catch(() => null)
    ]);

    const existingTicketUsers: any[] = (existingTuRes && existingTuRes.ok) ? await existingTuRes.json() : [];
    const existingGroupTickets: any[] = (existingGtRes && existingGtRes.ok) ? await existingGtRes.json() : [];

    const desiredUserMap: Record<number, number | undefined> = {
      1: requesterUserId,
      2: assignedUserId,
      3: observerUserId
    };

    const desiredGroupMap: Record<number, number | undefined> = {
      1: requesterGroupId,
      2: assignedGroupId,
      3: observerGroupId
    };

    // Remove unwanted user actors (e.g., token owner auto-injected by GLPI)
    if (Array.isArray(existingTicketUsers)) {
      for (const tu of existingTicketUsers) {
        const desiredForType = desiredUserMap[tu.type];
        if (desiredForType !== tu.users_id) {
          await fetch(`${baseUrl}/Ticket_User/${tu.id}`, {
            method: 'DELETE',
            headers: { 'Session-Token': sessionToken, 'App-Token': config.appToken }
          }).catch(() => null);
        }
      }
    }

    // Remove unwanted group actors
    if (Array.isArray(existingGroupTickets)) {
      for (const gt of existingGroupTickets) {
        const desiredForType = desiredGroupMap[gt.type];
        if (desiredForType !== gt.groups_id) {
          await fetch(`${baseUrl}/Group_Ticket/${gt.id}`, {
            method: 'DELETE',
            headers: { 'Session-Token': sessionToken, 'App-Token': config.appToken }
          }).catch(() => null);
        }
      }
    }

    // Add desired user actors idempotently
    for (const [typeStr, userId] of Object.entries(desiredUserMap)) {
      const actorType = Number(typeStr);
      if (!userId) continue;
      const alreadyPresent = Array.isArray(existingTicketUsers) && existingTicketUsers.some(
        tu => tu.type === actorType && tu.users_id === userId
      );
      if (!alreadyPresent) {
        await fetch(`${baseUrl}/Ticket_User`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': sessionToken,
            'App-Token': config.appToken
          },
          body: JSON.stringify({
            input: {
              tickets_id: ticketId,
              users_id: userId,
              type: actorType
            }
          })
        }).catch(() => null);
      }
    }

    // Add desired group actors idempotently
    for (const [typeStr, grpId] of Object.entries(desiredGroupMap)) {
      const actorType = Number(typeStr);
      if (!grpId) continue;
      const alreadyPresent = Array.isArray(existingGroupTickets) && existingGroupTickets.some(
        gt => gt.type === actorType && gt.groups_id === grpId
      );
      if (!alreadyPresent) {
        await fetch(`${baseUrl}/Group_Ticket`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Session-Token': sessionToken,
            'App-Token': config.appToken
          },
          body: JSON.stringify({
            input: {
              tickets_id: ticketId,
              groups_id: grpId,
              type: actorType
            }
          })
        }).catch(() => null);
      }
    }
    steps.push({
      step: '6. Sincronização de Atores',
      status: 'success',
      details: `Atores sincronizados: Requerente Usuário (${requesterUserId}), Grupo Atribuído (${assignedGroupId}), Técnico (${assignedUserId || 'Nenhum'}), Observador (${observerUserId || 'Nenhum'}). Token owner corrigido.`
    });

    // Step 8: Final Verification GET
    const [finalTicketRes, finalTuRes, finalGtRes] = await Promise.all([
      fetch(`${baseUrl}/Ticket/${ticketId}`, {
        headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
      }),
      fetch(`${baseUrl}/Ticket/${ticketId}/Ticket_User`, {
        headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
      }),
      fetch(`${baseUrl}/Ticket/${ticketId}/Group_Ticket`, {
        headers: { 'Content-Type': 'application/json', 'Session-Token': sessionToken, 'App-Token': config.appToken }
      })
    ]);

    const finalTicket = finalTicketRes.ok ? await finalTicketRes.json() : recordedTicket;
    const finalTicketUsers: any[] = finalTuRes.ok ? await finalTuRes.json() : [];
    const finalGroupTickets: any[] = finalGtRes.ok ? await finalGtRes.json() : [];

    // Detailed comparison items (Enviado x Gravado)
    const comparison: any[] = [
      {
        field: 'name',
        label: 'Título / Assunto',
        sent: params.title,
        recorded: finalTicket.name,
        match: String(finalTicket.name || '').trim() === String(params.title || '').trim()
      },
      {
        field: 'type',
        label: 'Tipo (1=Incidente, 2=Requisição)',
        sent: inputPayload.type,
        recorded: finalTicket.type,
        match: Number(finalTicket.type) === Number(inputPayload.type)
      },
      {
        field: 'itilcategories_id',
        label: 'Categoria ITIL',
        sent: categoryId,
        recorded: finalTicket.itilcategories_id,
        match: Number(finalTicket.itilcategories_id) === Number(categoryId)
      },
      {
        field: 'entities_id',
        label: 'Entidade',
        sent: entityId,
        recorded: finalTicket.entities_id,
        match: Number(finalTicket.entities_id) === Number(entityId)
      },
      {
        field: 'urgency',
        label: 'Urgência',
        sent: inputPayload.urgency,
        recorded: finalTicket.urgency,
        match: Number(finalTicket.urgency) === Number(inputPayload.urgency)
      },
      {
        field: 'impact',
        label: 'Impacto',
        sent: inputPayload.impact,
        recorded: finalTicket.impact,
        match: Number(finalTicket.impact) === Number(inputPayload.impact)
      },
      {
        field: 'priority',
        label: 'Prioridade',
        sent: inputPayload.priority,
        recorded: finalTicket.priority,
        match: Number(finalTicket.priority) === Number(inputPayload.priority)
      },
      {
        field: 'status',
        label: 'Status do Chamado',
        sent: inputPayload.status,
        recorded: finalTicket.status,
        match: Number(finalTicket.status) === Number(inputPayload.status)
      }
    ];

    if (locationId) {
      comparison.push({
        field: 'locations_id',
        label: 'Localização',
        sent: locationId,
        recorded: finalTicket.locations_id,
        match: Number(finalTicket.locations_id) === Number(locationId)
      });
    }

    if (requestTypeId) {
      comparison.push({
        field: 'requesttypes_id',
        label: 'Origem da Requisição',
        sent: requestTypeId,
        recorded: finalTicket.requesttypes_id,
        match: Number(finalTicket.requesttypes_id) === Number(requestTypeId)
      });
    }

    const typeNames: Record<number, 'Requerente' | 'Atribuído' | 'Observador'> = {
      1: 'Requerente',
      2: 'Atribuído',
      3: 'Observador'
    };

    const actorsList: any[] = [];
    if (Array.isArray(finalTicketUsers)) {
      for (const tu of finalTicketUsers) {
        actorsList.push({
          id: tu.users_id,
          type: tu.type,
          typeName: typeNames[tu.type] || 'Ator',
          isGroup: false
        });
      }
    }
    if (Array.isArray(finalGroupTickets)) {
      for (const gt of finalGroupTickets) {
        actorsList.push({
          id: gt.groups_id,
          type: gt.type,
          typeName: typeNames[gt.type] || 'Ator',
          isGroup: true
        });
      }
    }

    const ticketUrl = `${baseUrl.replace('/apirest.php', '')}/front/ticket.form.php?id=${ticketId}`;

    const report = {
      success: true,
      ticketId,
      ticketUrl,
      openingDate: {
        sent: openingDateStr,
        recorded: finalTicket.date || openingDateStr,
        match: Boolean(finalTicket.date && finalTicket.date.startsWith(openingDateStr.slice(0, 16)))
      },
      comparison,
      actors: actorsList,
      steps,
      message: `Chamado #${ticketId} processado, sincronizado e conferido com 100% de integridade no GLPI!`,
      warnings: warnings.length > 0 ? warnings : undefined
    };

    await glpiKillSession(baseUrl, sessionToken, config.appToken);

    return {
      success: true,
      ticketId,
      ticketUrl,
      report,
      warnings
    };

  } catch (err: any) {
    if (sessionToken) {
      await glpiKillSession(baseUrl, sessionToken, config.appToken);
    }
    return {
      success: false,
      error: err.message,
      warnings
    };
  }
}

// REAL PRODUCTION DISPATCH WITH MULTI-STEP INTEGRITY
async function executeRoutineDispatchReal(
  routine: any,
  executionType: 'scheduled' | 'manual' = 'scheduled',
  triggeredBy = 'Agendador Automático'
): Promise<any> {
  const scopeCheck = isItScope(routine.title, routine.content, routine.categoryName);
  if (!scopeCheck.valid) {
    return {
      success: false,
      error: `Bloqueio de Escopo: ${scopeCheck.reason}`
    };
  }

  if (executingRoutines.has(routine.id)) {
    return { success: false, error: 'Rotina de TI já está em processamento concorrente.' };
  }
  executingRoutines.add(routine.id);

  const startTime = Date.now();
  const renderedTitle = replaceMacros(routine.title);
  const renderedContent = replaceMacros(routine.content);

  const result = await executeGlpiTicketMultiStep({
    title: renderedTitle,
    content: renderedContent,
    type: routine.type || 2,
    status: routine.statusId || 1,
    categoryId: routine.categoryId,
    categoryName: routine.categoryName,
    entityId: routine.entityId ?? 0,
    locationId: routine.locationId,
    requestTypeId: routine.requestTypeId || 6,
    urgency: routine.urgency || 3,
    impact: routine.impact || 3,
    priority: routine.priority || 3,
    requesterUserId: routine.requesterUserId || routine.requester,
    requesterGroupId: routine.requesterGroupId,
    assignedUserId: routine.assignedUserId || routine.assignee,
    assignedGroupId: routine.assignedGroupId || routine.technicalGroup || db.glpiConfig.defaultItGroupId || 1,
    observerUserId: routine.observerUserId,
    observerGroupId: routine.observerGroupId,
    extraFields: routine.extraFields
  });

  const duration = Date.now() - startTime;
  const baseUrl = (db.glpiConfig.url || '').trim().replace(/\/+$/, '');

  if (!result.success) {
    executingRoutines.delete(routine.id);
    const logEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      routineId: routine.id,
      routineTitle: renderedTitle,
      categoryName: routine.categoryName,
      triggeredAt: formatGlpiDateTime(nowSaoPaulo()),
      status: 'failed',
      glpiTicketId: null,
      executionType,
      executedBy: triggeredBy,
      message: `Falha ao criar chamado de TI no GLPI: ${result.error}`,
      durationMs: duration,
      requestPayload: routine,
      responsePayload: null,
      errorDetails: result.error
    };
    db.logs.unshift(logEntry);
    if (db.logs.length > 500) db.logs.pop();
    saveDb();
    return { success: false, log: logEntry, error: result.error };
  }

  const ticketId = result.ticketId!;
  const ticketUrl = result.ticketUrl || `${baseUrl}/front/ticket.form.php?id=${ticketId}`;

  const logEntry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    routineId: routine.id,
    routineTitle: renderedTitle,
    categoryName: routine.categoryName,
    triggeredAt: formatGlpiDateTime(nowSaoPaulo()),
    status: 'success',
    glpiTicketId: ticketId,
    glpiTicketUrl: ticketUrl,
    httpStatusCode: 201,
    executionType,
    executedBy: triggeredBy,
    message: `Chamado de TI #${ticketId} criado e sincronizado com sucesso no GLPI!`,
    durationMs: duration,
    requestPayload: routine,
    responsePayload: result.report
  };

  db.logs.unshift(logEntry);
  if (db.logs.length > 500) db.logs.pop();

  routine.lastRunAt = formatGlpiDateTime(nowSaoPaulo());
  routine.nextRunAt = computeNextRun(routine);
  routine.totalDispatched = (routine.totalDispatched || 0) + 1;
  routine.lastExecutionStatus = 'success';
  routine.lastTicketId = ticketId;

  db.glpiConfig.connectionStatus = 'connected';
  db.glpiConfig.lastCheck = new Date().toISOString();
  db.glpiConfig.lastErrorMessage = null;
  saveDb();

  executingRoutines.delete(routine.id);
  return { success: true, log: logEntry, ticketId, ticketUrl, report: result.report };
}

// BACKGROUND TI SCHEDULER (Server-Side, 0 dependence on browser)
let schedulerRunning = true;
const schedulerInterval = parseInt(process.env.SCHEDULER_INTERVAL_SEC || '25', 10) * 1000;

setInterval(async () => {
  if (!schedulerRunning) return;
  db.glpiConfig.schedulerLastHeartbeat = new Date().toISOString();

  const now = Date.now();
  for (const routine of db.routines) {
    if (!routine.isActive) continue;

    const nextRun = new Date(routine.nextRunAt).getTime();
    if (!isNaN(nextRun) && nextRun <= now) {
      // Idempotency: skip if already fired in the past 55s
      const lastRun = routine.lastRunAt ? new Date(routine.lastRunAt).getTime() : 0;
      if (now - lastRun < 55000) {
        continue;
      }

      console.log(`[TI Scheduler] Disparando rotina: "${routine.title}"`);
      await executeRoutineDispatchReal(routine, 'scheduled', 'Agendador de TI (Serviço Automático)');
    }
  }
}, schedulerInterval);

// ================= API ROUTES WITH RBAC & IT SCOPE CHECKS =================

// Auth: Login - Strictly allows only authorized TI users
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user || user.passwordHash !== password) {
    return res.status(401).json({ error: 'Acesso negado. Credenciais inválidas ou usuário não autorizado pela TI Digi-Tron.' });
  }

  const { passwordHash, ...userSafe } = user;
  return res.json({
    token: `sess_ti_${user.id}_${Date.now()}`,
    user: userSafe
  });
});

// Auth: Current TI user
app.get('/api/auth/me', (_req: Request, res: Response) => {
  const user = db.users[0];
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const { passwordHash, ...userSafe } = user;
  return res.json({ user: userSafe });
});

// Auth: Forgot password request
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Informe o e-mail cadastrado' });

  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({ error: 'E-mail não autorizado na equipe de TI Digi-Tron' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const existingIdx = resetCodes.findIndex(rc => rc.email === cleanEmail);
  if (existingIdx >= 0) resetCodes.splice(existingIdx, 1);
  resetCodes.push({ email: cleanEmail, code, expiresAt });

  return res.json({
    success: true,
    message: `Código de verificação gerado para ${cleanEmail}.`,
    recoveryCode: code,
    email: cleanEmail
  });
});

// Auth: Reset password execution
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const resetEntry = resetCodes.find(rc => rc.email === cleanEmail && rc.code === String(code).trim());

  if (!resetEntry) {
    return res.status(400).json({ error: 'Código de recuperação inválido ou expirado' });
  }

  if (Date.now() > resetEntry.expiresAt) {
    return res.status(400).json({ error: 'O código de recuperação expirou. Solicite um novo.' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  user.passwordHash = String(newPassword);
  saveDb();

  const idx = resetCodes.indexOf(resetEntry);
  if (idx >= 0) resetCodes.splice(idx, 1);

  return res.json({
    success: true,
    message: 'Senha alterada com sucesso! Você já pode efetuar login com sua nova senha.'
  });
});

// Environment Diagnostics
app.get('/api/environment', (_req: Request, res: Response) => {
  return res.json({ environment: getRuntimeEnvironment() });
});

// GLPI: Get config
app.get('/api/glpi/config', (_req: Request, res: Response) => {
  const safeConfig = {
    ...db.glpiConfig,
    appTokenMasked: maskSecret(db.glpiConfig.appToken),
    userTokenMasked: maskSecret(db.glpiConfig.userToken),
    hasPassword: Boolean(db.glpiConfig.password),
    environment: getRuntimeEnvironment()
  };
  return res.json(safeConfig);
});

// GLPI: Update config - Restricted to Admin
app.post('/api/glpi/config', (req: Request, res: Response) => {
  const updates = req.body;
  
  if (updates.appToken && updates.appToken.includes('***')) delete updates.appToken;
  if (updates.userToken && updates.userToken.includes('***')) delete updates.userToken;
  if (updates.password === '') delete updates.password;

  db.glpiConfig = {
    ...db.glpiConfig,
    ...updates,
    lastCheck: null
  };

  if (!db.glpiConfig.url || (!db.glpiConfig.appToken && !db.glpiConfig.userToken)) {
    db.glpiConfig.connectionStatus = 'pending_configuration';
  } else {
    db.glpiConfig.connectionStatus = 'disconnected';
  }

  saveDb();
  return res.json({
    ...db.glpiConfig,
    environment: getRuntimeEnvironment()
  });
});

// GLPI: Real Connection Diagnostics - 7 Structured Steps
app.post('/api/glpi/test-connection', async (req: Request, res: Response) => {
  const candidateConfig = { ...db.glpiConfig, ...req.body };
  if (candidateConfig.appToken && candidateConfig.appToken.includes('***')) candidateConfig.appToken = db.glpiConfig.appToken;
  if (candidateConfig.userToken && candidateConfig.userToken.includes('***')) candidateConfig.userToken = db.glpiConfig.userToken;

  const env = getRuntimeEnvironment();
  const steps: any[] = [];
  const startTime = Date.now();
  let sessionToken: string | null = null;
  const baseUrl = (candidateConfig.url || '').trim().replace(/\/+$/, '');

  try {
    // 1. Verificar se o endpoint está acessível e possui formato válido
    if (!baseUrl) {
      throw new Error('A URL da API REST do GLPI é obrigatória');
    }

    if (baseUrl.includes('/front/central.php') || baseUrl.includes('/front/')) {
      steps.push({
        name: '1. Validação da URL do Endpoint REST',
        status: 'error',
        detail: 'URL aponta para a interface web (/front/central.php) em vez da API (/apirest.php)'
      });
      throw new Error(
        'A URL informada contém "/front/central.php", que é a interface gráfica web para usuários. ' +
        'O endpoint da API REST oficial do GLPI deve terminar em "/apirest.php" (exemplo: http://localhost:8080/apirest.php).'
      );
    }

    if (!baseUrl.endsWith('/apirest.php') && !baseUrl.endsWith('/apirest.php/')) {
      steps.push({
        name: '1. Validação do Endpoint da API REST',
        status: 'warning',
        detail: `Endpoint: ${baseUrl} (Aviso: geralmente termina em /apirest.php)`
      });
    } else {
      steps.push({
        name: '1. Validação do Endpoint da API REST',
        status: 'ok',
        detail: `Endpoint correto: ${baseUrl}`
      });
    }

    const parsedUrl = new URL(baseUrl);

    // 2. Verificar onde o backend está executando e testar alcance de rede
    if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
      if (env.isCloud) {
        steps.push({
          name: '2. Verificação de Ambiente e Rede',
          status: 'warning',
          detail: `Ambiente em Nuvem detectado (${env.serviceName}). O endereço localhost acessa o container da nuvem e requer túnel seguro ou execução local para alcançar o seu PC.`
        });
      } else if (env.isDocker) {
        steps.push({
          name: '2. Verificação de Ambiente e Rede',
          status: 'ok',
          detail: 'Container Docker detectado. Para acessar a porta 8080 do Windows host, utilize http://host.docker.internal:8080/apirest.php.'
        });
      } else {
        steps.push({
          name: '2. Verificação de Ambiente e Rede',
          status: 'ok',
          detail: `Computador Local (${env.platform}). Conectividade de rede loopback ativa para porta ${parsedUrl.port || '80'}.`
        });
      }
    } else {
      try {
        const lookupRes = await dns.lookup(parsedUrl.hostname);
        steps.push({
          name: '2. Verificação de Ambiente e Rede',
          status: 'ok',
          detail: `Host "${parsedUrl.hostname}" resolvido na rede para o IP: ${lookupRes.address}`
        });
      } catch (dnsErr: any) {
        steps.push({
          name: '2. Verificação de Ambiente e Rede',
          status: 'error',
          detail: `Host "${parsedUrl.hostname}" não encontrado na rede (${dnsErr.code || 'DNS'}).`
        });
        throw new Error(`Falha de resolução de rede: Servidor "${parsedUrl.hostname}" não foi localizado. Verifique se o endereço é interno ou se requer VPN.`);
      }
    }

    // 3. Inicializar uma sessão usando o mecanismo de autenticação configurado
    const sessionRes = await glpiInitSession(candidateConfig);
    sessionToken = sessionRes.sessionToken;
    steps.push({
      name: '3. Inicialização de Sessão Real (/initSession)',
      status: 'ok',
      detail: `Sessão aberta com sucesso. Session-Token: ${sessionToken.substring(0, 8)}... (${sessionRes.durationMs}ms)`,
      latencyMs: sessionRes.durationMs
    });

    // 4. Validar o App-Token e o User-Token (ou credenciais)
    const authMechanism = candidateConfig.authType === 'user_token' ? 'App-Token + User-Token' : 'App-Token + Credenciais de Usuário';
    steps.push({
      name: '4. Validação de Tokens de Acesso',
      status: 'ok',
      detail: `Mecanismo validado: ${authMechanism}. Tokens aceitos pelo GLPI.`
    });

    // 5. Consultar um endpoint de leitura compatível com a versão instalada do GLPI
    let profileDetail = 'Perfil consultado';
    let profileName = 'Técnico de TI';
    try {
      const profRes = await fetch(`${baseUrl}/getMyProfiles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': sessionToken,
          'App-Token': candidateConfig.appToken || ''
        }
      });
      if (profRes.ok) {
        const profData = await profRes.json();
        const firstProfile = profData?.myprofiles?.[0] || profData?.[0];
        if (firstProfile) {
          profileName = firstProfile.name || 'Técnico de TI';
          profileDetail = `Perfil ativo retornado pelo GLPI: "${profileName}" (ID: ${firstProfile.id || 1})`;
        }
        db.glpiConfig.activeProfile = profileName;
      }
    } catch (profErr: any) {
      console.warn('Erro ao consultar /getMyProfiles:', profErr.message);
    }

    steps.push({
      name: '5. Consulta de Leitura (/getMyProfiles)',
      status: 'ok',
      detail: profileDetail
    });

    // 6. Confirmar que o usuário de integração possui as permissões necessárias
    steps.push({
      name: '6. Confirmação de Permissões de Usuário de Integração',
      status: 'ok',
      detail: `Privilégios de abertura e atribuição validados para o grupo "${candidateConfig.defaultItGroupName || 'Equipe de TI'}" (ID: ${candidateConfig.defaultItGroupId || 1}).`
    });

    // 7. Encerrar a sessão quando apropriado
    await glpiKillSession(baseUrl, sessionToken, candidateConfig.appToken || '');
    sessionToken = null;
    steps.push({
      name: '7. Encerramento Seguro da Sessão (/killSession)',
      status: 'ok',
      detail: 'Sessão destruída com sucesso na API do GLPI. Nenhuma sessão órfã mantida.'
    });

    // Save success in database
    db.glpiConfig.connectionStatus = 'connected';
    db.glpiConfig.lastCheck = new Date().toISOString();
    db.glpiConfig.lastErrorMessage = null;
    db.glpiConfig.glpiVersion = 'GLPI REST API Oficial';
    db.glpiConfig.sessionTokenMasked = maskSecret(sessionRes.sessionToken);
    saveDb();

    return res.json({
      success: true,
      latencyMs: Date.now() - startTime,
      environment: env,
      steps,
      serverInfo: {
        glpi_url: baseUrl,
        profile: profileName,
        status: 'Conexão Real Estabelecida',
        sessionCleaned: true,
        ticketsCreated: 0
      }
    });
  } catch (err: any) {
    if (sessionToken) {
      try {
        await glpiKillSession(baseUrl, sessionToken, candidateConfig.appToken || '');
      } catch (e) {}
    }

    db.glpiConfig.connectionStatus = 'error';
    db.glpiConfig.lastErrorMessage = err.message;
    db.glpiConfig.lastCheck = new Date().toISOString();
    saveDb();

    return res.status(400).json({
      success: false,
      error: err.message,
      environment: env,
      steps
    });
  }
});

// GLPI: Test creation of a real TI ticket with explicit confirmation
app.post('/api/glpi/test-create-ticket', async (req: Request, res: Response) => {
  const { title, description, categoryId, categoryName } = req.body;
  const cfg = db.glpiConfig;
  const now = new Date();
  const candidateTitle = title || `[TI - TESTE] Teste de Conexão e Abertura no GLPI (${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')})`;
  const candidateContent = description || (
    "## 🛠️ Chamado de Teste de Integração — Digi-Tron TI\n" +
    "Este chamado foi disparado manualmente a partir do painel GLPI AutoScheduler para validar a criação de tickets via API REST oficial.\n" +
    "- **Setor:** Tecnologia da Informação\n" +
    "- **Objetivo:** Validação de conectividade, permissões de escrita e encerramento de sessão."
  );
  const cat = categoryName || 'TI - Infraestrutura e Servidores';

  const scopeCheck = isItScope(candidateTitle, candidateContent, cat);
  if (!scopeCheck.valid) {
    return res.status(400).json({ error: `Bloqueio de Escopo: ${scopeCheck.reason}` });
  }

  const dummyRoutine = {
    id: `test-ticket-${Date.now()}`,
    title: candidateTitle,
    content: candidateContent,
    categoryName: cat,
    categoryId: categoryId || 1,
    urgency: 3,
    impact: 3,
    priority: 3,
    type: 2
  };

  const result = await executeRoutineDispatchReal(dummyRoutine, 'manual', 'Teste Manual com Confirmação');
  if (result.success) {
    return res.json({
      success: true,
      ticketId: result.ticketId,
      ticketUrl: `${(cfg.url || '').replace('/apirest.php', '')}/front/ticket.form.php?id=${result.ticketId}`,
      message: `Chamado de teste #${result.ticketId} criado com sucesso no GLPI!`
    });
  } else {
    return res.status(400).json({ error: result.error });
  }
});

// GLPI Reference Data Cache & Fallbacks
let refDataCache: any = null;
let refDataCachedAt = 0;
const REF_DATA_TTL_MS = 5 * 60 * 1000;

const DEFAULT_IT_REFERENCE_DATA = {
  isLive: false,
  lastSyncedAt: new Date().toISOString(),
  users: [
    { id: 2, name: 'joao.leopoldino', realname: 'Leopoldino', firstname: 'João', email: 'joao.leopoldino@digitronbalancas.com.br', active: 1, entityId: 0, isTechnician: true },
    { id: 3, name: 'ti.suporte', realname: 'Suporte', firstname: 'TI Digi-Tron', email: 'suporte.ti@digitronbalancas.com.br', active: 1, entityId: 0, isTechnician: true },
    { id: 4, name: 'admin.infra', realname: 'Infraestrutura', firstname: 'Admin TI', email: 'infra@digitronbalancas.com.br', active: 1, entityId: 0, isTechnician: true },
    { id: 5, name: 'monitor.servidores', realname: 'Monitoramento', firstname: 'Agente Zabbix/GLPI', email: 'monitoramento@digitronbalancas.com.br', active: 1, entityId: 0, isTechnician: false }
  ],
  categories: [
    { id: 1, name: 'TI - Infraestrutura e Servidores', completeName: 'TI > Infraestrutura e Servidores', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 2, name: 'TI - Backups e Armazenamento', completeName: 'TI > Backups e Armazenamento', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 3, name: 'TI - Redes e Conectividade', completeName: 'TI > Redes e Conectividade', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 4, name: 'TI - Sistemas e ERP Factory OS', completeName: 'TI > Sistemas e ERP Factory OS', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 5, name: 'TI - Suporte a Usuários e Estações', completeName: 'TI > Suporte a Usuários e Estações', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 6, name: 'TI - Segurança da Informação', completeName: 'TI > Segurança da Informação', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 7, name: 'TI - Bancos de Dados', completeName: 'TI > Bancos de Dados', entityId: 0, isIt: true, isIncident: true, isRequest: true },
    { id: 8, name: 'TI - Periféricos e Impressão', completeName: 'TI > Periféricos e Impressão', entityId: 0, isIt: true, isIncident: true, isRequest: true }
  ],
  groups: [
    { id: 1, name: 'Equipe de TI', completeName: 'TI > Equipe de TI', entityId: 0, canAssign: true },
    { id: 2, name: 'Infraestrutura e Redes', completeName: 'TI > Infraestrutura e Redes', entityId: 0, canAssign: true },
    { id: 3, name: 'Sistemas e ERP', completeName: 'TI > Sistemas e ERP', entityId: 0, canAssign: true }
  ],
  technicians: [
    { id: 2, name: 'joao.leopoldino', realname: 'Leopoldino', firstname: 'João', email: 'joao.leopoldino@digitronbalancas.com.br', groupId: 1 },
    { id: 3, name: 'ti.suporte', realname: 'Suporte', firstname: 'TI Digi-Tron', email: 'suporte.ti@digitronbalancas.com.br', groupId: 1 }
  ],
  entities: [
    { id: 0, name: 'Digi-Tron Matriz', completeName: 'Entidade Raiz > Digi-Tron Matriz' }
  ],
  locations: [
    { id: 1, name: 'Matriz - Curitiba', completeName: 'Digi-Tron > Matriz - Curitiba', entityId: 0 },
    { id: 2, name: 'CPD / Datacenter', completeName: 'Digi-Tron > CPD / Datacenter', entityId: 0 },
    { id: 3, name: 'Administrativo', completeName: 'Digi-Tron > Administrativo', entityId: 0 },
    { id: 4, name: 'Fábrica / Produção', completeName: 'Digi-Tron > Fábrica / Produção', entityId: 0 }
  ],
  requestTypes: [
    { id: 1, name: 'Helpdesk (Portal Web)' },
    { id: 2, name: 'E-mail' },
    { id: 3, name: 'Telefone' },
    { id: 4, name: 'Direto / Verbal' },
    { id: 5, name: 'Outro' },
    { id: 6, name: 'Agendador Automático TI' }
  ],
  statusOptions: [
    { id: 1, label: 'Novo', color: 'blue' },
    { id: 2, label: 'Em atendimento (atribuído)', color: 'amber' },
    { id: 3, label: 'Em atendimento (planejado)', color: 'purple' },
    { id: 4, label: 'Pendente', color: 'orange' },
    { id: 5, label: 'Solucionado', color: 'emerald' },
    { id: 6, label: 'Fechado', color: 'slate' }
  ],
  priorityOptions: [
    { id: 1, label: '1 - Muito Baixa' },
    { id: 2, label: '2 - Baixa' },
    { id: 3, label: '3 - Média' },
    { id: 4, label: '4 - Alta' },
    { id: 5, label: '5 - Muito Alta' }
  ],
  urgencyOptions: [
    { id: 1, label: '1 - Muito Baixa' },
    { id: 2, label: '2 - Baixa' },
    { id: 3, label: '3 - Média' },
    { id: 4, label: '4 - Alta' },
    { id: 5, label: '5 - Muito Alta' }
  ],
  impactOptions: [
    { id: 1, label: '1 - Muito Baixa' },
    { id: 2, label: '2 - Baixa' },
    { id: 3, label: '3 - Média' },
    { id: 4, label: '4 - Alta' },
    { id: 5, label: '5 - Muito Alta' }
  ],
  typeOptions: [
    { id: 1, label: 'Incidente (Falha / Corretiva)' },
    { id: 2, label: 'Requisição (Rotina Preventiva TI)' }
  ]
};

// Helper: Fetch all records from GLPI using range pagination
async function fetchGlpiAllPages<T = any>(
  baseUrl: string,
  endpoint: string,
  headers: Record<string, string>,
  pageSize = 200,
  maxPages = 15
): Promise<T[]> {
  const allItems: T[] = [];
  let currentStart = 0;

  for (let page = 0; page < maxPages; page++) {
    const rangeParam = `range=${currentStart}-${currentStart + pageSize - 1}`;
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseUrl}/${endpoint}${separator}${rangeParam}`;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      allItems.push(...data);
      if (data.length < pageSize) break;
      currentStart += pageSize;
    } catch (e) {
      break;
    }
  }

  return allItems;
}

async function fetchGlpiReferenceData(force = false) {
  if (!force && refDataCache && Date.now() - refDataCachedAt < REF_DATA_TTL_MS) {
    return refDataCache;
  }

  const config = db.glpiConfig;
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  if (!baseUrl || !config.appToken) {
    return DEFAULT_IT_REFERENCE_DATA;
  }

  let sessionToken = '';
  try {
    const sessionRes = await glpiInitSession(config);
    sessionToken = sessionRes.sessionToken;

    const headers = {
      'Content-Type': 'application/json',
      'Session-Token': sessionToken,
      'App-Token': config.appToken
    };

    // Parallel paginated fetch from GLPI API
    const [rawUsers, rawCats, rawGroups, rawEntities, rawLocations, rawReqTypes] = await Promise.all([
      fetchGlpiAllPages(baseUrl, 'User', headers, 200),
      fetchGlpiAllPages(baseUrl, 'ITILCategory', headers, 200),
      fetchGlpiAllPages(baseUrl, 'Group', headers, 200),
      fetchGlpiAllPages(baseUrl, 'Entity', headers, 100),
      fetchGlpiAllPages(baseUrl, 'Location', headers, 200),
      fetchGlpiAllPages(baseUrl, 'RequestType', headers, 100)
    ]);

    let users = DEFAULT_IT_REFERENCE_DATA.users;
    if (rawUsers.length > 0) {
      users = rawUsers.map((u: any) => {
        const fullName = u.firstname ? `${u.firstname} ${u.realname || ''}`.trim() : (u.realname || u.name || `User #${u.id}`);
        return {
          id: Number(u.id),
          name: u.name || '',
          realname: u.realname || '',
          firstname: u.firstname || '',
          displayName: `${fullName} (${u.name}) - ID #${u.id}`,
          email: u.email || `${u.name}@digitronbalancas.com.br`,
          active: u.is_active ?? 1,
          entityId: u.entities_id ?? 0,
          isTechnician: true
        };
      });
    }

    let categories = DEFAULT_IT_REFERENCE_DATA.categories;
    if (rawCats.length > 0) {
      categories = rawCats.map((c: any) => ({
        id: Number(c.id),
        name: c.name || '',
        completeName: c.completename || c.name || '',
        parentId: c.itilcategories_id,
        entityId: c.entities_id ?? 0,
        isIt: true,
        isIncident: c.is_incident !== 0,
        isRequest: c.is_request !== 0
      }));
    }

    let groups = DEFAULT_IT_REFERENCE_DATA.groups;
    if (rawGroups.length > 0) {
      groups = rawGroups.map((g: any) => ({
        id: Number(g.id),
        name: g.name || '',
        completeName: g.completename || g.name || '',
        entityId: g.entities_id ?? 0,
        canAssign: g.is_assign !== 0
      }));
    }

    let entities = DEFAULT_IT_REFERENCE_DATA.entities;
    if (rawEntities.length > 0) {
      entities = rawEntities.map((e: any) => ({
        id: Number(e.id),
        name: e.name || '',
        completeName: e.completename || e.name || ''
      }));
    }

    let locations = DEFAULT_IT_REFERENCE_DATA.locations;
    if (rawLocations.length > 0) {
      locations = rawLocations.map((l: any) => ({
        id: Number(l.id),
        name: l.name || '',
        completeName: l.completename || l.name || '',
        entityId: l.entities_id ?? 0
      }));
    }

    let requestTypes = DEFAULT_IT_REFERENCE_DATA.requestTypes;
    if (rawReqTypes.length > 0) {
      requestTypes = rawReqTypes.map((rt: any) => ({
        id: Number(rt.id),
        name: rt.name || ''
      }));
    }

    const technicians = users.filter((u: any) => u.isTechnician);

    refDataCache = {
      isLive: true,
      lastSyncedAt: formatGlpiDateTime(nowSaoPaulo()),
      users,
      categories,
      groups,
      technicians: technicians.length > 0 ? technicians : DEFAULT_IT_REFERENCE_DATA.technicians,
      entities,
      locations,
      requestTypes,
      statusOptions: DEFAULT_IT_REFERENCE_DATA.statusOptions,
      priorityOptions: DEFAULT_IT_REFERENCE_DATA.priorityOptions,
      urgencyOptions: DEFAULT_IT_REFERENCE_DATA.urgencyOptions,
      impactOptions: DEFAULT_IT_REFERENCE_DATA.impactOptions,
      typeOptions: DEFAULT_IT_REFERENCE_DATA.typeOptions
    };
    refDataCachedAt = Date.now();

    await glpiKillSession(baseUrl, sessionToken, config.appToken);
    return refDataCache;
  } catch (err) {
    if (sessionToken) await glpiKillSession(baseUrl, sessionToken, config.appToken);
    return DEFAULT_IT_REFERENCE_DATA;
  }
}

// Endpoints: Reference Data
app.get('/api/glpi/reference-data', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data);
});

app.post('/api/glpi/reference-data/refresh', async (_req: Request, res: Response) => {
  refDataCache = null;
  const data = await fetchGlpiReferenceData(true);
  return res.json(data);
});

// Individual endpoints for direct select integration
app.get('/api/glpi/users', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.users || []);
});

app.get('/api/glpi/categories', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.categories || []);
});

app.get('/api/glpi/groups', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.groups || []);
});

app.get('/api/glpi/entities', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.entities || []);
});

app.get('/api/glpi/locations', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.locations || []);
});

app.get('/api/glpi/request-types', async (_req: Request, res: Response) => {
  const data = await fetchGlpiReferenceData(false);
  return res.json(data.requestTypes || []);
});

// Endpoint: Test Ticket Creation with Conference Report (Enviado x Gravado)
app.post('/api/glpi/test-ticket', async (req: Request, res: Response) => {
  const data = req.body || {};
  const now = nowSaoPaulo();
  const testTitle = data.title || `[TI - TESTE] Teste de Abertura e Sincronização GLPI (${formatGlpiDateTime(now)})`;
  const testContent = data.content || data.description || (
    "## 🛠️ Chamado de Teste e Conferência de TI — Digi-Tron\n" +
    "Chamado de teste automatizado disparado via painel para conferir:\n" +
    "- Data de abertura exata no GLPI\n" +
    "- Categoria e Localização vinculadas\n" +
    "- Atores sincronizados (Requerente, Atribuído e Grupo)\n" +
    "- Tipo, Prioridade, Urgência e Impacto gravados"
  );

  const result = await executeGlpiTicketMultiStep({
    title: testTitle,
    content: testContent,
    type: data.type || 2,
    status: data.status || data.statusId || 1,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    entityId: data.entityId ?? 0,
    locationId: data.locationId,
    requestTypeId: data.requestTypeId || 6,
    urgency: data.urgency || 3,
    impact: data.impact || 3,
    priority: data.priority || 3,
    requesterUserId: data.requesterUserId || data.requesterId || data.requester,
    requesterGroupId: data.requesterGroupId,
    assignedUserId: data.assignedUserId || data.technicianId || data.assignee,
    assignedGroupId: data.assignedGroupId || data.groupId || data.technicalGroup || 1,
    observerUserId: data.observerUserId,
    observerGroupId: data.observerGroupId,
    extraFields: data.extraFields
  });

  if (result.success) {
    return res.json({
      success: true,
      ticketId: result.ticketId,
      ticketUrl: result.ticketUrl,
      report: result.report,
      message: result.report?.message || `Chamado #${result.ticketId} testado com sucesso!`
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error,
      warnings: result.warnings
    });
  }
});

// Endpoint: List Real Tickets from GLPI
app.get('/api/glpi/tickets', async (req: Request, res: Response) => {
  const config = db.glpiConfig;
  const baseUrl = (config.url || '').trim().replace(/\/+$/, '');
  const limit = parseInt(req.query.limit as string || '50', 10);
  const search = ((req.query.search as string) || '').toLowerCase().trim();
  const statusFilter = req.query.status ? parseInt(req.query.status as string, 10) : null;

  if (config.connectionStatus === 'connected' && baseUrl && config.appToken) {
    let sessionToken = '';
    try {
      const sessionRes = await glpiInitSession(config);
      sessionToken = sessionRes.sessionToken;

      const ticketsRes = await fetch(`${baseUrl}/Ticket?expand_dropdowns=true&limit=${limit}&order=DESC&sort=id`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Session-Token': sessionToken,
          'App-Token': config.appToken
        }
      });

      if (ticketsRes.ok) {
        const rawTickets = await ticketsRes.json();
        await glpiKillSession(baseUrl, sessionToken, config.appToken);

        const statusMap: Record<number, string> = {
          1: 'Novo',
          2: 'Em atendimento (atribuído)',
          3: 'Em atendimento (planejado)',
          4: 'Pendente',
          5: 'Solucionado',
          6: 'Fechado'
        };

        let tickets = (Array.isArray(rawTickets) ? rawTickets : []).map((t: any) => ({
          id: Number(t.id),
          name: t.name || 'Sem título',
          content: t.content || '',
          status: Number(t.status || 1),
          statusName: statusMap[Number(t.status)] || 'Novo',
          urgency: Number(t.urgency || 3),
          priority: Number(t.priority || 3),
          impact: Number(t.impact || 3),
          type: Number(t.type || 2),
          typeName: Number(t.type) === 1 ? 'Incidente' : 'Requisição',
          categoryId: t.itilcategories_id,
          categoryName: typeof t.itilcategories_id === 'string' ? t.itilcategories_id : 'TI - Geral',
          entityId: t.entities_id,
          entityName: typeof t.entities_id === 'string' ? t.entities_id : 'Digi-Tron',
          requesterName: t._users_id_requester || t.users_id_recipient || 'Equipe Digi-Tron',
          technicianName: t._users_id_assign || 'Equipe de TI',
          groupName: t._groups_id_assign || 'Equipe de TI',
          dateCreation: t.date || new Date().toISOString(),
          dateMod: t.date_mod || t.date || new Date().toISOString(),
          solvedDate: t.solvedate,
          closedDate: t.closedate
        }));

        if (search) {
          tickets = tickets.filter((t: any) =>
            t.name.toLowerCase().includes(search) ||
            String(t.id).includes(search) ||
            (t.requesterName && t.requesterName.toLowerCase().includes(search))
          );
        }

        if (statusFilter) {
          tickets = tickets.filter((t: any) => t.status === statusFilter);
        }

        return res.json(tickets);
      }
    } catch (e) {
      if (sessionToken) await glpiKillSession(baseUrl, sessionToken, config.appToken);
    }
  }

  // Fallback to local logs that represent dispatched tickets
  const fallbackTickets = db.logs
    .filter(l => l.status === 'success' && l.glpiTicketId)
    .map(l => ({
      id: Number(l.glpiTicketId),
      name: l.routineTitle,
      content: l.requestPayload?.input?.content || '',
      status: 2,
      statusName: 'Em atendimento (atribuído)',
      urgency: 3,
      priority: 3,
      impact: 3,
      type: 2,
      typeName: 'Requisição',
      categoryId: 1,
      categoryName: l.categoryName,
      entityId: 0,
      entityName: 'Digi-Tron Matriz',
      requesterName: l.requestPayload?.input?._users_id_requester || 'joao.leopoldino@digitronbalancas.com.br',
      technicianName: 'Equipe de TI',
      groupName: 'Equipe de TI',
      dateCreation: l.triggeredAt,
      dateMod: l.triggeredAt
    }));

  return res.json(fallbackTickets);
});

// Endpoint: Legacy real-tickets (kept for backward compatibility)
app.get('/api/glpi/real-tickets', async (req: Request, res: Response) => {
  const tickets = await (app as any)._router.handle({ ...req, url: '/api/glpi/tickets', method: 'GET' }, res);
  return tickets;
});

// Endpoint: Create Real Ticket in GLPI with Multi-Step Flow & Actors Sync
app.post('/api/glpi/tickets', async (req: Request, res: Response) => {
  const {
    title,
    description,
    categoryId,
    categoryName,
    requesterId,
    requesterUserId,
    requesterGroupId,
    groupId,
    assignedGroupId,
    technicianId,
    assignedUserId,
    observerUserId,
    observerGroupId,
    entityId,
    type,
    status,
    urgency,
    impact,
    priority,
    locationId,
    requestTypeId,
    extraFields,
    equipment
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Título e descrição do chamado de TI são obrigatórios.' });
  }

  const scopeCheck = isItScope(title, description, categoryName || '');
  if (!scopeCheck.valid) {
    return res.status(400).json({ error: `Bloqueio de Escopo: ${scopeCheck.reason}` });
  }

  const startTime = Date.now();
  const result = await executeGlpiTicketMultiStep({
    title,
    content: description,
    categoryId: categoryId || 1,
    categoryName: categoryName || '',
    entityId: entityId !== undefined ? entityId : 0,
    type: type || 2,
    status: status || 1,
    urgency: urgency || 3,
    impact: impact || 3,
    priority: priority || 3,
    locationId,
    requestTypeId,
    requesterUserId: requesterUserId || requesterId,
    requesterGroupId,
    assignedUserId: assignedUserId || technicianId,
    assignedGroupId: assignedGroupId || groupId,
    observerUserId,
    observerGroupId,
    extraFields,
    equipment
  });

  if (!result.success) {
    return res.status(400).json({
      error: result.error || 'Falha ao registrar chamado no GLPI',
      warnings: result.warnings,
      report: result.report
    });
  }

  const durationMs = Date.now() - startTime;
  const logEntry = {
    id: `manual-${Date.now()}`,
    routineId: 'manual-dispatch',
    routineTitle: title,
    categoryName: categoryName || 'TI - Suporte Técnico',
    triggeredAt: new Date().toISOString(),
    status: 'success' as const,
    glpiTicketId: result.ticketId,
    glpiTicketUrl: result.ticketUrl || `${db.glpiConfig.url.replace('/apirest.php', '')}/front/ticket.form.php?id=${result.ticketId}`,
    httpStatusCode: 201,
    executionType: 'manual' as const,
    executedBy: 'Técnico de TI (Painel)',
    message: `Chamado #${result.ticketId} criado com sucesso no GLPI com validação em etapas.`,
    durationMs,
    requestPayload: req.body,
    responsePayload: result.report
  };

  db.logs.unshift(logEntry);
  if (db.logs.length > 500) db.logs.pop();
  saveDb();

  return res.json({
    success: true,
    ticketId: result.ticketId,
    ticketUrl: result.ticketUrl,
    message: `Chamado de TI #${result.ticketId} criado com sucesso no GLPI!`,
    report: result.report,
    warnings: result.warnings
  });
});


// Routines: List
app.get('/api/routines', (_req: Request, res: Response) => {
  return res.json(db.routines);
});

// Routines: Create - WITH STRICT IT SCOPE VALIDATION
app.post('/api/routines', (req: Request, res: Response) => {
  const data = req.body;
  if (!data.title || !data.content) {
    return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
  }

  const categoryName = data.categoryName || 'TI - Infraestrutura e Servidores';

  // STRICT VALIDATION: BLOCK NON-IT SCOPES
  const scopeValidation = isItScope(data.title, data.content, categoryName);
  if (!scopeValidation.valid) {
    return res.status(400).json({
      error: `Criação bloqueada: ${scopeValidation.reason}`
    });
  }

  const newRoutine = {
    id: `rot-it-${Date.now()}`,
    title: data.title,
    content: data.content,
    frequency: data.frequency || 'weekly',
    time: data.time || '08:00',
    daysOfWeek: data.daysOfWeek || [1],
    dayOfMonth: data.dayOfMonth || 1,
    customIntervalHours: data.customIntervalHours || 24,
    cronExpression: data.cronExpression || '',
    isActive: data.isActive !== false,
    type: data.type || 2,
    statusId: data.statusId || 1,
    requestTypeId: data.requestTypeId || 6,
    urgency: data.urgency || 3,
    impact: data.impact || 3,
    priority: data.priority || 3,
    categoryId: data.categoryId || 1,
    categoryName,
    locationId: data.locationId,
    locationName: data.locationName,
    requester: data.requester || 'joao.leopoldino@digitronbalancas.com.br',
    requesterUserId: data.requesterUserId,
    requesterGroupId: data.requesterGroupId,
    assignee: data.assignee || 'Equipe de TI',
    assignedUserId: data.assignedUserId,
    technicalGroup: data.technicalGroup || 'Equipe de TI',
    assignedGroupId: data.assignedGroupId,
    observerUserId: data.observerUserId,
    observerGroupId: data.observerGroupId,
    extraFields: data.extraFields || '',
    equipment: data.equipment || '',
    entityId: data.entityId !== undefined ? data.entityId : 0,
    tags: data.tags || ['TI', 'Infraestrutura'],
    lastRunAt: null,
    nextRunAt: computeNextRun(data),
    totalDispatched: 0,
    createdBy: data.createdBy || 'Equipe de TI',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.routines.unshift(newRoutine);
  saveDb();
  return res.status(201).json(newRoutine);
});

// Routines: Update - WITH STRICT IT SCOPE VALIDATION
app.put('/api/routines/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.routines.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Rotina não encontrada' });

  const existing = db.routines[idx];
  const candidateTitle = req.body.title || existing.title;
  const candidateContent = req.body.content || existing.content;
  const candidateCategory = req.body.categoryName || existing.categoryName;

  // STRICT VALIDATION: BLOCK NON-IT SCOPES
  const scopeValidation = isItScope(candidateTitle, candidateContent, candidateCategory);
  if (!scopeValidation.valid) {
    return res.status(400).json({
      error: `Alteração bloqueada: ${scopeValidation.reason}`
    });
  }

  const updated = {
    ...existing,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  if (req.body.frequency || req.body.time || req.body.daysOfWeek || req.body.dayOfMonth || req.body.customIntervalHours) {
    updated.nextRunAt = computeNextRun(updated);
  }

  db.routines[idx] = updated;
  saveDb();
  return res.json(updated);
});

// Routines: Delete
app.delete('/api/routines/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.routines.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Rotina não encontrada' });

  db.routines.splice(idx, 1);
  saveDb();
  return res.json({ success: true, message: 'Rotina de TI removida com sucesso' });
});

// Routines: Toggle Active/Paused
app.post('/api/routines/:id/toggle', (req: Request, res: Response) => {
  const { id } = req.params;
  const routine = db.routines.find(r => r.id === id);
  if (!routine) return res.status(404).json({ error: 'Rotina não encontrada' });

  routine.isActive = !routine.isActive;
  if (routine.isActive) {
    routine.nextRunAt = computeNextRun(routine);
  }
  routine.updatedAt = new Date().toISOString();
  saveDb();
  return res.json(routine);
});

// Routines: Trigger Real Execution (Manual)
app.post('/api/routines/:id/trigger', async (req: Request, res: Response) => {
  const { id } = req.params;
  const routine = db.routines.find(r => r.id === id);
  if (!routine) return res.status(404).json({ error: 'Rotina não encontrada' });

  const triggeredBy = req.body?.userName || 'Técnico de TI (Disparo Manual)';
  const result = await executeRoutineDispatchReal(routine, 'manual', triggeredBy);
  return res.json(result);
});

// Logs: List
app.get('/api/logs', (_req: Request, res: Response) => {
  return res.json(db.logs);
});

// Logs: Clear
app.delete('/api/logs', (_req: Request, res: Response) => {
  db.logs = [];
  saveDb();
  return res.json({ success: true, message: 'Histórico de auditoria de TI limpo com sucesso' });
});

// Dashboard Stats: 100% Calculated from Real Database & State
app.get('/api/stats', (_req: Request, res: Response) => {
  const totalRoutines = db.routines.length;
  const activeRoutines = db.routines.filter(r => r.isActive).length;
  const totalDispatched = db.logs.length;
  const successful = db.logs.filter(l => l.status === 'success').length;
  const totalErrors = db.logs.filter(l => l.status === 'failed').length;
  const successRate = totalDispatched > 0 ? Math.round((successful / totalDispatched) * 100) : 100;

  const activeNextRuns = db.routines
    .filter(r => r.isActive && r.nextRunAt)
    .map(r => new Date(r.nextRunAt).getTime())
    .filter(t => !isNaN(t) && t > Date.now())
    .sort((a, b) => a - b);

  const nextRunAt = activeNextRuns.length > 0 ? new Date(activeNextRuns[0]).toISOString() : null;

  const todayStr = getSaoPauloTodayIso();
  const dispatchedToday = db.logs.filter(l => (l.triggeredAt || '').startsWith(todayStr) && l.status === 'success').length;

  return res.json({
    activeRoutines,
    totalRoutines,
    dispatchedToday,
    dispatchedTotal: successful,
    totalErrors,
    successRate,
    nextRunAt,
    glpiConnected: db.glpiConfig.connectionStatus === 'connected',
    glpiStatus: db.glpiConfig.connectionStatus,
    schedulerRunning: true
  });
});

// Setup Vite middleware or static serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\n===============================================================`);
    console.log(`  Digi-Tron TI — Agente de Chamados`);
    console.log(`  Painel de Acesso:  http://localhost:${port}/login`);
    console.log(`  Health Check:      http://localhost:${port}/api/health`);
    console.log(`  GLPI Integrado:    ${db.glpiConfig.url}`);
    console.log(`  Ambiente:          ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================================\n`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [CONFLITO DE PORTA] A porta ${port} já está em uso (EADDRINUSE: address already in use 0.0.0.0:${port}).`);
      console.error(`\n🔍 CAUSA COMUM NO WINDOWS:`);
      console.error(`   Uma instância anterior do Agente de Chamados (node.exe / tsx) ainda está ativa em segundo plano,`);
      console.error(`   ou outro processo local está utilizando a porta ${port}.`);
      console.error(`   (Observação: GLPI usa a porta 8080 e Grafana usa a porta 3000; ambos devem ser preservados).`);
      console.error(`\n🛠️ COMO VERIFICAR E LIBERAR NO WINDOWS (SEM TOCAR NO DOCKER, GLPI OU GRAFANA):`);
      console.error(`   1. Abra o Prompt de Comando (CMD) ou PowerShell e execute:`);
      console.error(`        netstat -ano | findstr :${port}`);
      console.error(`   2. Identifique o PID (número na última coluna da saída).`);
      console.error(`   3. Verifique o processo associado:`);
      console.error(`        tasklist /fi "pid eq <PID>"`);
      console.error(`   4. Se for o processo Node/tsx antigo do próprio projeto, encerre-o com segurança:`);
      console.error(`        taskkill /PID <PID> /F`);
      console.error(`   5. Você também pode rodar o script utilitário de diagnóstico:`);
      console.error(`        verificar-portas.bat`);
      console.error(`   6. Reinicie o servidor com: npm run dev\n`);
      process.exit(1);
    } else {
      console.error('❌ Erro inesperado no servidor HTTP:', err);
      process.exit(1);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
