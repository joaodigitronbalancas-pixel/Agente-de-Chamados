import { GlpiConfig, RoutineSchedule, RoutineTemplate, User, ExecutionLog } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-1',
    name: 'João Leopoldino',
    email: 'joao.leopoldino@digitronbalancas.com.br',
    role: 'admin',
    department: 'TI',
    company: 'Digitron Balanças',
    createdAt: '2026-01-15T08:00:00.000Z'
  },
  {
    id: 'usr-tech-2',
    name: 'Suporte TI Digi-Tron',
    email: 'suporte.ti@digitronbalancas.com.br',
    role: 'tecnico',
    department: 'TI',
    company: 'Digitron Balanças',
    createdAt: '2026-02-01T08:00:00.000Z'
  }
];

export const INITIAL_USER: User = INITIAL_USERS[0];

export const INITIAL_GLPI_CONFIG: GlpiConfig = {
  url: 'http://localhost:8080/apirest.php',
  authType: 'user_token',
  appToken: '',
  userToken: '',
  username: 'joao.leopoldino',
  password: '',
  entityId: 0,
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
};

// 10 EXCLUSIVE, REUSABLE IT ROUTINE TEMPLATES FOR DIGI-TRON
export const DEFAULT_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'tmpl-it-1',
    category: 'backups',
    title: '[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})',
    description: 'Rotina diária para auditoria e teste de consistência dos dumps do ERP Factory OS, banco de dados e imagens no storage NAS.',
    categoryName: 'TI - Backups e Armazenamento',
    frequency: 'daily',
    time: '06:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    dayOfMonth: 1,
    type: 2, // Requisição
    urgency: 4,
    impact: 4,
    priority: 4,
    tags: ['Backup', 'ERP Factory OS', 'Storage NAS', 'PostgreSQL'],
    content: `## 💾 Verificação Diária de Backups — Tecnologia da Informação
**Data Programada:** {data} às {hora}  
**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron  
**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.

### 📋 Checklist Técnico de Execução:
- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.
- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados principal.
- [ ] Conferir replicação segura dos snapshots para o storage NAS secundário e nuvem.
- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.
- [ ] Realizar teste de montagem e restauração amostral em ambiente sandbox de homologação.
- [ ] Registrar evidências e anexar print do relatório no chamado antes do encerramento.`
  },
  {
    id: 'tmpl-it-2',
    category: 'infra',
    title: '[TI] Verificação de Disponibilidade e Saúde dos Servidores Físicos e Virtuais ({data})',
    description: 'Conferência diária de hardware dos servidores centrais, hipervisores (Hyper-V/Proxmox), temperatura e logs de erro.',
    categoryName: 'TI - Infraestrutura e Servidores',
    frequency: 'daily',
    time: '07:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    dayOfMonth: 1,
    type: 2,
    urgency: 3,
    impact: 4,
    priority: 4,
    tags: ['Servidores', 'Hyper-V', 'Linux', 'Windows Server', 'Hardware'],
    content: `## 🖥️ Inspeção de Saúde dos Servidores — Equipe de TI
**Data Programada:** {data} às {hora}  
**Ambiente:** Datacenter e Servidores Virtuais Digi-Tron  
**Atenção:** Este chamado solicita a inspeção técnica preventiva dos servidores listados.

### 📋 Checklist Técnico de Execução:
- [ ] Analisar alertas de hardware e painel iDRAC/iLO dos servidores físicos.
- [ ] Verificar saúde das controladoras RAID e status SMART de todos os discos rígidos e SSDs.
- [ ] Checar uso de memória RAM e carga de CPU nas máquinas virtuais críticas.
- [ ] Conferir temperatura operacional e alertas nos nobreaks (UPS) do rack central.
- [ ] Revisar logs do Visualizador de Eventos (Event Viewer / syslog) em busca de erros críticos.
- [ ] Validar sincronização de horário via protocolo NTP em todos os nós do domínio.`
  },
  {
    id: 'tmpl-it-3',
    category: 'infra',
    title: '[TI] Monitoramento e Análise de Espaço em Disco dos Storages e Servidores ({mes_ano})',
    description: 'Auditoria semanal de volumetria, crescimento de dados, limpeza de arquivos temporários e expurgo planejado.',
    categoryName: 'TI - Infraestrutura e Servidores',
    frequency: 'weekly',
    time: '08:00',
    daysOfWeek: [1], // Segundas
    dayOfMonth: 1,
    type: 2,
    urgency: 3,
    impact: 3,
    priority: 3,
    tags: ['Storage', 'Capacidade', 'Discos', 'Infraestrutura'],
    content: `## 📊 Auditoria de Capacidade de Disco e Storage — TI
**Data Programada:** {data} às {hora}  
**Setor:** Infraestrutura de Armazenamento Digi-Tron  
**Atenção:** Realizar a medição e saneamento dos volumes corporativos.

### 📋 Checklist Técnico de Execução:
- [ ] Mapear porcentagem de espaço livre em cada partição (C:, D:, /var, /data).
- [ ] Garantir que nenhum volume de produção esteja acima de 85% de ocupação.
- [ ] Limpar logs obsoletos de transações e arquivos temporários de sistemas.
- [ ] Analisar pastas de rede compartilhadas e notificar responsáveis por arquivos de grande porte desnecessários.
- [ ] Atualizar curva de crescimento mensal para provisionamento futuro de storage.`
  },
  {
    id: 'tmpl-it-4',
    category: 'redes',
    title: '[TI] Verificação de Conectividade de Rede, Links de Internet e Wi-Fi ({data})',
    description: 'Teste semanal de latência, failover de operadoras de internet, switches core e cobertura de Wi-Fi corporativo.',
    categoryName: 'TI - Redes e Conectividade',
    frequency: 'weekly',
    time: '07:45',
    daysOfWeek: [2], // Terças
    dayOfMonth: 1,
    type: 2,
    urgency: 3,
    impact: 3,
    priority: 3,
    tags: ['Redes', 'Firewall', 'Wi-Fi', 'Switches', 'Internet'],
    content: `## 🌐 Manutenção Preventiva de Redes e Telecom — TI
**Data Programada:** {data} às {hora}  
**Setor:** Redes & Comunicações Digi-Tron  
**Atenção:** Solicitação para teste de integridade da infraestrutura cabeada e sem fio.

### 📋 Checklist Técnico de Execução:
- [ ] Testar redundância e failover entre o link principal e link de contingência da Digi-Tron.
- [ ] Medir latência (ping / jitter) e perda de pacotes para o gateway e DNS corporativo.
- [ ] Vistoriar logs de erros de portas nos switches gerenciáveis dos racks 1 e 2.
- [ ] Validar cobertura e roaming dos Access Points (AP) nos setores administrativos e galpões.
- [ ] Verificar temperatura e ventilação do switch core e do roteador de borda.
- [ ] Confirmar que o túnel VPN de acesso remoto seguro está ativo e sem falhas de handshake.`
  },
  {
    id: 'tmpl-it-5',
    category: 'erp',
    title: '[TI] Conferência de Funcionamento e Desempenho do ERP Factory OS ({data})',
    description: 'Verificação periódica dos serviços do ERP Factory OS, filas de processamento, APIs internas e travas de banco.',
    categoryName: 'TI - Sistemas e ERP Factory OS',
    frequency: 'weekly',
    time: '08:30',
    daysOfWeek: [3], // Quartas
    dayOfMonth: 1,
    type: 2,
    urgency: 4,
    impact: 4,
    priority: 4,
    tags: ['ERP Factory OS', 'Sistemas', 'Desempenho', 'Banco de Dados'],
    content: `## ⚙️ Avaliação Operacional do ERP Factory OS — TI
**Data Programada:** {data} às {hora}  
**Aplicação:** ERP Factory OS & Sistemas Satélites Digi-Tron  
**Atenção:** Inspeção técnica dos microsserviços e integridade transacional.

### 📋 Checklist Técnico de Execução:
- [ ] Confirmar status dos serviços de background e workers do ERP Factory OS.
- [ ] Verificar se existem filas de emissão de NF-e / SPED represadas ou travadas.
- [ ] Monitorar queries lentas (slow query log) e deadlocks no banco de dados do ERP.
- [ ] Testar tempo de resposta da tela de login e consultas de faturamento.
- [ ] Checar sincronização das APIs de integração entre o ERP e sistemas internos.
- [ ] Liberar eventuais sessões fantasmas ou conexões ociosas excedentes no banco.`
  },
  {
    id: 'tmpl-it-6',
    category: 'seguranca',
    title: '[TI] Verificação de Alertas de Segurança, Antivírus/EDR e Firewall ({data})',
    description: 'Conferência semanal do console central de antivírus/EDR, regras de firewall e tentativas de intrusão.',
    categoryName: 'TI - Segurança da Informação',
    frequency: 'weekly',
    time: '09:00',
    daysOfWeek: [4], // Quintas
    dayOfMonth: 1,
    type: 2,
    urgency: 4,
    impact: 4,
    priority: 4,
    tags: ['Segurança', 'Antivírus', 'EDR', 'Firewall', 'Ameaças'],
    content: `## 🛡️ Auditoria de Segurança da Informação — TI
**Data Programada:** {data} às {hora}  
**Setor:** Segurança da Informação Digi-Tron  
**Atenção:** Análise obrigatória de vetores de risco e proteção de endpoints.

### 📋 Checklist Técnico de Execução:
- [ ] Acessar o console central de Antivírus/EDR e verificar taxa de máquinas atualizadas (>98%).
- [ ] Investigar e remediar endpoints com alertas de malwares ou comportamento anômalo.
- [ ] Revisar relatório de bloqueios e tráfego rejeitado no firewall perimetral.
- [ ] Validar status das assinaturas de IPS/IDS e filtros de conteúdo web.
- [ ] Conferir se existem servidores ou estações com vulnerabilidades críticas pendentes de patch.
- [ ] Registrar parecer técnico da equipe de segurança no encerramento deste chamado.`
  },
  {
    id: 'tmpl-it-7',
    category: 'estacoes',
    title: '[TI] Manutenção Preventiva, Atualizações de SO e Otimização de Computadores ({mes_ano})',
    description: 'Rotina quinzenal de atualização de pacotes de segurança do Windows/Linux e limpeza de arquivos em estações.',
    categoryName: 'TI - Suporte a Usuários e Estações',
    frequency: 'biweekly',
    time: '14:00',
    daysOfWeek: [5], // Sextas
    dayOfMonth: 1,
    type: 2,
    urgency: 2,
    impact: 3,
    priority: 3,
    tags: ['Estações', 'Windows Update', 'Manutenção', 'Otimização'],
    content: `## 💻 Manutenção Preventiva de Computadores — Suporte TI
**Data Programada:** {data} às {hora}  
**Setor:** Atendimento a Usuários & Estações Digi-Tron  
**Atenção:** Execução de rotina de otimização no lote agendado de máquinas de trabalho.

### 📋 Checklist Técnico de Execução:
- [ ] Aprovar e implantar patches cumulativos de segurança do Windows Update via WSUS/Intune.
- [ ] Executar limpeza de disco (pastas temporárias %temp%, cache de navegadores e logs).
- [ ] Verificar saúde do disco (SSD health / CrystalDisk / SMART) nas estações do lote.
- [ ] Atualizar navegadores corporativos e softwares homologados (Office, ERP client, Java).
- [ ] Conferir fixação de cabos e ventilação das CPUs sob as bancadas.`
  },
  {
    id: 'tmpl-it-8',
    category: 'seguranca',
    title: '[TI] Revisão Periódica de Contas, Acessos e Usuários Inativos no AD e GLPI ({mes_extenso}/{ano})',
    description: 'Auditoria mensal obrigatória de permissões de acesso corporativo, desligamentos de pessoal e grupos administrativos.',
    categoryName: 'TI - Segurança da Informação',
    frequency: 'monthly',
    time: '10:00',
    daysOfWeek: [],
    dayOfMonth: 1,
    type: 2,
    urgency: 4,
    impact: 4,
    priority: 4,
    tags: ['Active Directory', 'GLPI', 'Contas', 'Acessos', 'LGPD'],
    content: `## 👥 Revisão de Acessos e Usuários — Governança de TI
**Período:** {mes_extenso} de {ano}  
**Setor:** Administração de Contas & Diretório Digi-Tron  
**Atenção:** Verificação periódica de conformidade e controle de acesso a sistemas.

### 📋 Checklist Técnico de Execução:
- [ ] Cruzar lista de colaboradores desligados com o Active Directory e desativar contas pendentes.
- [ ] Desativar ou revogar perfis inativos no GLPI e no ERP Factory OS.
- [ ] Revisar membros dos grupos de Domain Admins, Administradores Locais e TI no AD.
- [ ] Validar que nenhum usuário comum possui privilégios de administrador de estação.
- [ ] Auditar contas de serviço e renovar senhas de rotinas automatizadas se aplicável.
- [ ] Emitir laudo sumário de conformidade para a gerência de TI.`
  },
  {
    id: 'tmpl-it-9',
    category: 'estacoes',
    title: '[TI] Manutenção Preventiva de Impressoras de Rede e Periféricos de Informática ({mes_ano})',
    description: 'Verificação mensal de filas de impressão em rede, nível de suprimentos, firmware e limpeza de sensores de TI.',
    categoryName: 'TI - Periféricos e Impressão',
    frequency: 'monthly',
    time: '11:00',
    daysOfWeek: [],
    dayOfMonth: 10,
    type: 2,
    urgency: 2,
    impact: 2,
    priority: 2,
    tags: ['Impressoras', 'Periféricos', 'Print Server', 'Rede'],
    content: `## 🖨️ Revisão de Impressoras e Periféricos de TI — Suporte N1
**Data Programada:** {data} às {hora}  
**Setor:** Parque de Impressão e Periféricos de Escritório  
**Atenção:** Solicitação para teste de operação dos dispositivos de rede corporativos.

### 📋 Checklist Técnico de Execução:
- [ ] Checar status do Print Server e limpar eventuais jobs de impressão corrompidos ou travados.
- [ ] Conferir níveis de toner e kits de manutenção preventiva das impressoras de rede.
- [ ] Atualizar firmware das impressoras departamentais se houver versão de segurança pendente.
- [ ] Testar impressão de página de diagnóstico em cada equipamento de rede.
- [ ] Vistoriar leitores biométricos e scanners de mesa corporativos.`
  },
  {
    id: 'tmpl-it-10',
    category: 'infra',
    title: '[TI] Verificação Mensal de Infraestrutura de TI, Nobreaks e Ar Condicionado do Datacenter ({mes_ano})',
    description: 'Vistoria física mensal do rack de servidores, autonomia de baterias de nobreaks e climatização do CPD.',
    categoryName: 'TI - Infraestrutura e Servidores',
    frequency: 'monthly',
    time: '15:00',
    daysOfWeek: [],
    dayOfMonth: 15,
    type: 2,
    urgency: 4,
    impact: 4,
    priority: 4,
    tags: ['Datacenter', 'Nobreak', 'CPD', 'Climatização', 'Infraestrutura'],
    content: `## 🏢 Inspeção do Datacenter e Infraestrutura de TI — Mensal
**Período:** {mes_extenso} de {ano}  
**Local:** CPD / Datacenter Central Digi-Tron  
**Atenção:** Vistoria preventiva das condições ambientais e elétricas de suporte aos servidores.

### 📋 Checklist Técnico de Execução:
- [ ] Realizar teste de bateria e autoteste dos nobreaks senoidais do rack principal.
- [ ] Medir tensão de entrada/saída (V) e carga percentual suportada pelos nobreaks.
- [ ] Conferir temperatura ambiente do CPD (ideal: entre 18°C e 22°C) e limpeza dos filtros do ar-condicionado.
- [ ] Vistoriar organizadores de cabos (cable management) e integridade dos patch panels.
- [ ] Verificar sistema de detecção precoce de fumaça e estanqueidade da sala do servidor.
- [ ] Registrar medições na planilha de controle físico do Datacenter.`
  }
];

// EXCLUSIVE IT ROUTINES INITIALIZED FOR DIGI-TRON
export const INITIAL_ROUTINES: RoutineSchedule[] = [
  {
    id: 'rot-it-101',
    title: '[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})',
    content: `## 💾 Verificação Diária de Backups — Tecnologia da Informação
**Data Programada:** {data} às {hora}
**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron
**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.

### 📋 Checklist Técnico de Execução:
- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.
- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados principal.
- [ ] Conferir replicação segura dos snapshots para o storage NAS secundário e nuvem.
- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.
- [ ] Realizar teste de montagem e restauração amostral em ambiente sandbox de homologação.
- [ ] Registrar evidências e anexar print do relatório no chamado antes do encerramento.`,
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
    content: `## 🖥️ Inspeção de Saúde dos Servidores — Equipe de TI
**Data Programada:** {data} às {hora}
**Ambiente:** Datacenter e Servidores Virtuais Digi-Tron
**Atenção:** Este chamado solicita a inspeção técnica preventiva dos servidores listados.

### 📋 Checklist Técnico de Execução:
- [ ] Analisar alertas de hardware e painel iDRAC/iLO dos servidores físicos.
- [ ] Verificar saúde das controladoras RAID e status SMART de todos os discos rígidos e SSDs.
- [ ] Checar uso de memória RAM e carga de CPU nas máquinas virtuais críticas.
- [ ] Conferir temperatura operacional e alertas nos nobreaks (UPS) do rack central.
- [ ] Revisar logs do Visualizador de Eventos (Event Viewer / syslog) em busca de erros críticos.
- [ ] Validar sincronização de horário via protocolo NTP em todos os nós do domínio.`,
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
    content: `## 🌐 Manutenção Preventiva de Redes e Telecom — TI
**Data Programada:** {data} às {hora}
**Setor:** Redes & Comunicações Digi-Tron
**Atenção:** Solicitação para teste de integridade da infraestrutura cabeada e sem fio.

### 📋 Checklist Técnico de Execução:
- [ ] Testar redundância e failover entre o link principal e link de contingência da Digi-Tron.
- [ ] Medir latência (ping / jitter) e perda de pacotes para o gateway e DNS corporativo.
- [ ] Vistoriar logs de erros de portas nos switches gerenciáveis dos racks 1 e 2.
- [ ] Validar cobertura e roaming dos Access Points (AP) nos setores administrativos e galpões.
- [ ] Verificar temperatura e ventilação do switch core e do roteador de borda.
- [ ] Confirmar que o túnel VPN de acesso remoto seguro está ativo e sem falhas de handshake.`,
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
    content: `## 👥 Revisão de Acessos e Usuários — Governança de TI
**Período:** {mes_extenso} de {ano}
**Setor:** Administração de Contas & Diretório Digi-Tron
**Atenção:** Verificação periódica de conformidade e controle de acesso a sistemas.

### 📋 Checklist Técnico de Execução:
- [ ] Cruzar lista de colaboradores desligados com o Active Directory e desativar contas pendentes.
- [ ] Desativar ou revogar perfis inativos no GLPI e no ERP Factory OS.
- [ ] Revisar membros dos grupos de Domain Admins, Administradores Locais e TI no AD.
- [ ] Validar que nenhum usuário comum possui privilégios de administrador de estação.
- [ ] Auditar contas de serviço e renovar senhas de rotinas automatizadas se aplicável.
- [ ] Emitir laudo sumário de conformidade para a gerência de TI.`,
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
];

export const INITIAL_LOGS: ExecutionLog[] = [];
