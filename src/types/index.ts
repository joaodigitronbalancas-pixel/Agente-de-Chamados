export type UserRole = 'admin' | 'tecnico';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: 'TI';
  company: 'Digitron Balanças' | 'Digi-Tron';
  avatarUrl?: string;
  createdAt: string;
}

export type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom_interval' | 'cron';

export type ItCategory = 
  | 'TI - Infraestrutura e Servidores'
  | 'TI - Backups e Armazenamento'
  | 'TI - Redes e Conectividade'
  | 'TI - Sistemas e ERP Factory OS'
  | 'TI - Suporte a Usuários e Estações'
  | 'TI - Segurança da Informação'
  | 'TI - Bancos de Dados'
  | 'TI - Periféricos e Impressão';

export const IT_CATEGORIES: ItCategory[] = [
  'TI - Infraestrutura e Servidores',
  'TI - Backups e Armazenamento',
  'TI - Redes e Conectividade',
  'TI - Sistemas e ERP Factory OS',
  'TI - Suporte a Usuários e Estações',
  'TI - Segurança da Informação',
  'TI - Bancos de Dados',
  'TI - Periféricos e Impressão'
];

export interface RoutineSchedule {
  id: string;
  title: string;
  content: string;
  frequency: RecurrenceType;
  time: string; // "HH:MM", e.g. "08:30"
  daysOfWeek: number[]; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  dayOfMonth: number; // 1-31
  customIntervalHours: number; // e.g. 12
  cronExpression?: string;
  isActive: boolean;
  type: 1 | 2; // 1 = Incidente, 2 = Requisição
  urgency: 1 | 2 | 3 | 4 | 5; // 1: Muito Baixa ... 5: Muito Alta
  impact: 1 | 2 | 3 | 4 | 5;
  priority: 1 | 2 | 3 | 4 | 5;
  categoryId?: number;
  categoryName: ItCategory;
  requester?: string;
  assignee?: string;
  technicalGroup?: string; // e.g. "Equipe de TI"
  entityId: number;
  tags: string[];
  lastRunAt: string | null;
  nextRunAt: string;
  totalDispatched: number;
  lastExecutionStatus?: 'success' | 'failed' | null;
  lastTicketId?: number | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionLog {
  id: string;
  routineId: string;
  routineTitle: string;
  categoryName: string;
  triggeredAt: string;
  status: 'success' | 'failed' | 'pending';
  glpiTicketId?: number | null;
  glpiTicketUrl?: string | null;
  httpStatusCode?: number | null;
  executionType: 'scheduled' | 'manual';
  executedBy?: string; // User who triggered
  message: string;
  durationMs: number;
  requestPayload?: any;
  responsePayload?: any;
  errorDetails?: string | null;
  retryCount?: number;
}

export interface GlpiConfig {
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
}

export interface DashboardStats {
  activeRoutines: number;
  totalRoutines: number;
  dispatchedToday: number;
  dispatchedTotal: number;
  successRate: number;
  nextRunAt: string | null;
  glpiConnected: boolean;
  glpiStatus: 'connected' | 'disconnected' | 'error' | 'pending_configuration';
  schedulerRunning: boolean;
  totalErrors: number;
}

export interface RoutineTemplate {
  id: string;
  category: 'infra' | 'backups' | 'redes' | 'erp' | 'estacoes' | 'seguranca';
  title: string;
  description: string;
  content: string;
  frequency: RecurrenceType;
  time: string;
  daysOfWeek: number[];
  dayOfMonth: number;
  type: 1 | 2;
  urgency: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  priority: 1 | 2 | 3 | 4 | 5;
  categoryName: ItCategory;
  tags: string[];
}

export interface GlpiRealTicket {
  id: number;
  name: string;
  date: string;
  status: number;
  urgency: number;
  priority: number;
  content?: string;
}

export interface RuntimeEnvironment {
  type: 'cloud_container' | 'docker_container' | 'local_machine';
  title: string;
  description: string;
  isCloud: boolean;
  isDocker: boolean;
  platform: string;
  hostname: string;
  serviceName: string;
  nodeVersion: string;
}

export interface ConnectionTestStep {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'info';
  detail: string;
  latencyMs?: number;
}

export interface ConnectionTestResponse {
  success: boolean;
  error?: string;
  latencyMs?: number;
  environment?: RuntimeEnvironment;
  steps: ConnectionTestStep[];
  serverInfo?: {
    glpi_url: string;
    profile?: string;
    status: string;
    sessionCleaned: boolean;
    ticketsCreated: number;
  };
}

// GLPI Reference Data & Entities
export interface GlpiUser {
  id: number;
  name: string; // login / username
  realname?: string;
  firstname?: string;
  email?: string;
  active?: number;
  entityId?: number;
  isTechnician?: boolean;
}

export interface GlpiCategory {
  id: number;
  name: string;
  completeName: string;
  parentId?: number;
  entityId?: number;
  isIt: boolean;
}

export interface GlpiGroup {
  id: number;
  name: string;
  completeName: string;
  entityId?: number;
  canAssign?: boolean;
}

export interface GlpiTechnician {
  id: number;
  name: string;
  realname?: string;
  firstname?: string;
  email?: string;
  groupId?: number;
}

export interface GlpiEntity {
  id: number;
  name: string;
  completeName: string;
}

export interface GlpiFieldOption {
  id: number;
  label: string;
  color?: string;
}

export interface GlpiReferenceData {
  isLive: boolean;
  lastSyncedAt: string;
  users: GlpiUser[];
  categories: GlpiCategory[];
  groups: GlpiGroup[];
  technicians: GlpiTechnician[];
  entities: GlpiEntity[];
  statusOptions: GlpiFieldOption[];
  priorityOptions: GlpiFieldOption[];
  urgencyOptions: GlpiFieldOption[];
  impactOptions: GlpiFieldOption[];
  typeOptions: GlpiFieldOption[];
}

export interface GlpiTicketFull {
  id: number;
  name: string;
  content?: string;
  status: number;
  statusName: string;
  urgency: number;
  priority: number;
  impact: number;
  type: number;
  typeName: string;
  categoryId?: number;
  categoryName?: string;
  entityId?: number;
  entityName?: string;
  requesterId?: number;
  requesterName?: string;
  requesterEmail?: string;
  technicianId?: number;
  technicianName?: string;
  groupId?: number;
  groupName?: string;
  dateCreation: string;
  dateMod: string;
  solvedDate?: string;
  closedDate?: string;
}

export interface CreateGlpiTicketPayload {
  title: string;
  description: string;
  categoryId: number;
  categoryName?: string;
  requesterId?: number;
  requesterName?: string;
  groupId?: number;
  groupName?: string;
  technicianId?: number;
  technicianName?: string;
  entityId?: number;
  type: 1 | 2; // 1 = Incidente, 2 = Requisição
  urgency: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  priority: 1 | 2 | 3 | 4 | 5;
  equipment?: string;
}

