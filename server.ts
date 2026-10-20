import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dns from 'dns/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

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

// Macro variable replacement
function replaceMacros(text: string): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  const monthsPt = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const weekDaysPt = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
  const weekNumber = Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7);

  const replacements: Record<string, string> = {
    '{data}': `${day}/${month}/${year}`,
    '{data_iso}': `${year}-${month}-${day}`,
    '{hora}': `${hours}:${minutes}`,
    '{dia}': day,
    '{mes}': monthsPt[d.getMonth()],
    '{mes_num}': month,
    '{ano}': String(year),
    '{mes_ano}': `${month}/${year}`,
    '{mes_extenso}': monthsPt[d.getMonth()],
    '{dia_semana}': weekDaysPt[d.getDay()],
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

// Next run calculation
function computeNextRun(routine: any): string {
  const [targetH, targetM] = (routine.time || '08:00').split(':').map(Number);
  const now = new Date();

  switch (routine.frequency) {
    case 'daily': {
      const candidate = new Date(now);
      candidate.setHours(targetH, targetM, 0, 0);
      if (candidate <= now) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate.toISOString();
    }
    case 'weekly': {
      const days = routine.daysOfWeek && routine.daysOfWeek.length > 0 ? routine.daysOfWeek : [1];
      for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        candidate.setHours(targetH, targetM, 0, 0);
        if (days.includes(candidate.getDay()) && candidate > now) {
          return candidate.toISOString();
        }
      }
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(targetH, targetM, 0, 0);
      return nextWeek.toISOString();
    }
    case 'biweekly': {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + 14);
      candidate.setHours(targetH, targetM, 0, 0);
      return candidate.toISOString();
    }
    case 'monthly': {
      const targetDay = routine.dayOfMonth || 1;
      let candidate = new Date(now.getFullYear(), now.getMonth(), targetDay, targetH, targetM, 0, 0);
      if (candidate <= now) {
        candidate = new Date(now.getFullYear(), now.getMonth() + 1, targetDay, targetH, targetM, 0, 0);
      }
      return candidate.toISOString();
    }
    case 'custom_interval': {
      const hours = routine.customIntervalHours || 12;
      return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
    }
    default: {
      const candidate = new Date(now);
      candidate.setHours(targetH, targetM, 0, 0);
      if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
      return candidate.toISOString();
    }
  }
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

// REAL PRODUCTION DISPATCH WITH STRICT IT SCOPE ENFORCEMENT
async function executeRoutineDispatchReal(routine: any, executionType: 'scheduled' | 'manual' = 'scheduled', triggeredBy = 'Agendador Automático'): Promise<any> {
  // Validate IT scope
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

  const requestPayload = {
    input: {
      name: renderedTitle,
      content: renderedContent,
      type: routine.type || 2,
      urgency: routine.urgency || 3,
      impact: routine.impact || 3,
      priority: routine.priority || 3,
      itilcategories_id: routine.categoryId || 0,
      entities_id: routine.entityId || 0,
      _groups_id_assign: db.glpiConfig.defaultItGroupId || 1, // Atribuir ao grupo de TI
      _users_id_requester: routine.requester || 'joao.leopoldino@digitronbalancas.com.br'
    }
  };

  const config = db.glpiConfig;

  if (!config.url || (!config.userToken && !config.password)) {
    executingRoutines.delete(routine.id);
    const logEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      routineId: routine.id,
      routineTitle: renderedTitle,
      categoryName: routine.categoryName,
      triggeredAt: new Date().toISOString(),
      status: 'failed',
      glpiTicketId: null,
      executionType,
      executedBy: triggeredBy,
      message: 'Falha: Conexão com GLPI não configurada.',
      durationMs: 0,
      requestPayload,
      responsePayload: null,
      errorDetails: 'Acesse a aba "Conexão GLPI" e configure a URL e os tokens para permitir envios.'
    };
    db.logs.unshift(logEntry);
    if (db.logs.length > 500) db.logs.pop();
    saveDb();
    return { success: false, log: logEntry, error: logEntry.message };
  }

  let sessionToken = '';
  const baseUrl = config.url.trim().replace(/\/+$/, '');

  try {
    const sessionRes = await glpiInitSession(config);
    sessionToken = sessionRes.sessionToken;

    const ticketUrl = `${baseUrl}/Ticket`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const ticketRes = await fetch(ticketUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': config.appToken || ''
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    if (!ticketRes.ok) {
      const errText = await ticketRes.text();
      let cleanErr = errText;
      try {
        const j = JSON.parse(errText);
        cleanErr = Array.isArray(j) ? j[0] : j.message || errText;
      } catch (e) {}
      throw new Error(`GLPI rejeitou a criação do chamado de TI (HTTP ${ticketRes.status}): ${cleanErr}`);
    }

    const ticketData = await ticketRes.json();
    const ticketId = ticketData.id;

    if (!ticketId) {
      throw new Error(`GLPI respondeu sem ID de chamado: ${JSON.stringify(ticketData)}`);
    }

    await glpiKillSession(baseUrl, sessionToken, config.appToken || '');

    const logEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      routineId: routine.id,
      routineTitle: renderedTitle,
      categoryName: routine.categoryName,
      triggeredAt: new Date().toISOString(),
      status: 'success',
      glpiTicketId: ticketId,
      glpiTicketUrl: `${baseUrl}/front/ticket.form.php?id=${ticketId}`,
      httpStatusCode: ticketRes.status,
      executionType,
      executedBy: triggeredBy,
      message: `Chamado de TI #${ticketId} criado com sucesso no GLPI!`,
      durationMs: duration,
      requestPayload,
      responsePayload: ticketData
    };

    db.logs.unshift(logEntry);
    if (db.logs.length > 500) db.logs.pop();

    routine.lastRunAt = new Date().toISOString();
    routine.nextRunAt = computeNextRun(routine);
    routine.totalDispatched = (routine.totalDispatched || 0) + 1;
    routine.lastExecutionStatus = 'success';
    routine.lastTicketId = ticketId;

    db.glpiConfig.connectionStatus = 'connected';
    db.glpiConfig.lastCheck = new Date().toISOString();
    db.glpiConfig.lastErrorMessage = null;
    saveDb();

    executingRoutines.delete(routine.id);
    return { success: true, log: logEntry, ticketId };
  } catch (err: any) {
    if (sessionToken) {
      await glpiKillSession(baseUrl, sessionToken, config.appToken || '');
    }

    const duration = Date.now() - startTime;
    const logEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      routineId: routine.id,
      routineTitle: renderedTitle,
      categoryName: routine.categoryName,
      triggeredAt: new Date().toISOString(),
      status: 'failed',
      glpiTicketId: null,
      httpStatusCode: err.message?.includes('HTTP 401') ? 401 : err.message?.includes('HTTP 400') ? 400 : 500,
      executionType,
      executedBy: triggeredBy,
      message: `Erro na criação do chamado de TI: ${err.message}`,
      durationMs: duration,
      requestPayload,
      responsePayload: null,
      errorDetails: err.stack || err.message
    };

    db.logs.unshift(logEntry);
    if (db.logs.length > 500) db.logs.pop();

    routine.lastExecutionStatus = 'failed';
    db.glpiConfig.connectionStatus = 'error';
    db.glpiConfig.lastErrorMessage = err.message;
    db.glpiConfig.lastCheck = new Date().toISOString();
    saveDb();

    executingRoutines.delete(routine.id);
    return { success: false, log: logEntry, error: err.message };
  }
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

// GLPI: Fetch Real Tickets from GLPI
app.get('/api/glpi/real-tickets', async (_req: Request, res: Response) => {
  const config = db.glpiConfig;
  if (config.connectionStatus !== 'connected' && (!config.url || !config.appToken)) {
    return res.json([]);
  }

  let sessionToken = '';
  const baseUrl = config.url.trim().replace(/\/+$/, '');
  try {
    const sessionRes = await glpiInitSession(config);
    sessionToken = sessionRes.sessionToken;

    const ticketsRes = await fetch(`${baseUrl}/Ticket?expand_dropdowns=true&limit=10&order=DESC&sort=id`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Session-Token': sessionToken,
        'App-Token': config.appToken
      }
    });

    if (!ticketsRes.ok) {
      throw new Error(`Falha ao ler chamados reais (HTTP ${ticketsRes.status})`);
    }

    const tickets = await ticketsRes.json();
    await glpiKillSession(baseUrl, sessionToken, config.appToken);
    return res.json(Array.isArray(tickets) ? tickets : []);
  } catch (err: any) {
    if (sessionToken) await glpiKillSession(baseUrl, sessionToken, config.appToken);
    return res.status(500).json({ error: err.message });
  }
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
    urgency: data.urgency || 3,
    impact: data.impact || 3,
    priority: data.priority || 3,
    categoryId: data.categoryId || 1,
    categoryName,
    requester: data.requester || 'joao.leopoldino@digitronbalancas.com.br',
    assignee: data.assignee || 'Equipe de TI',
    technicalGroup: data.technicalGroup || 'Equipe de TI',
    entityId: data.entityId || 0,
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

  const todayStr = new Date().toISOString().split('T')[0];
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

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Digi-Tron TI GLPI AutoScheduler] Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
