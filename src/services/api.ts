import { 
  DashboardStats, 
  ExecutionLog, 
  GlpiConfig, 
  RoutineSchedule, 
  User, 
  GlpiRealTicket, 
  RuntimeEnvironment, 
  ConnectionTestResponse,
  GlpiReferenceData,
  GlpiTicketFull,
  CreateGlpiTicketPayload,
  TicketConferenceReport,
  GlpiLocation,
  GlpiRequestType
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const api = {
  // GLPI Reference Data (Users, Categories, Groups, Technicians, Entities, Locations, RequestTypes)
  async getReferenceData(): Promise<GlpiReferenceData> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/reference-data`);
    if (!res.ok) throw new Error('Erro ao carregar dados de referência do GLPI');
    return res.json();
  },

  async refreshReferenceData(): Promise<GlpiReferenceData> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/reference-data/refresh`, { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao atualizar dados de referência do GLPI');
    return res.json();
  },

  async getLocations(): Promise<GlpiLocation[]> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/locations`);
    if (!res.ok) throw new Error('Erro ao listar localizações do GLPI');
    return res.json();
  },

  async getRequestTypes(): Promise<GlpiRequestType[]> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/request-types`);
    if (!res.ok) throw new Error('Erro ao listar tipos de solicitação do GLPI');
    return res.json();
  },

  // GLPI Real Tickets
  async getGlpiTickets(params?: { search?: string; status?: number; limit?: number }): Promise<GlpiTicketFull[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', String(params.status));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `${API_BASE_URL}/api/glpi/tickets${query.toString() ? '?' + query.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao consultar chamados no GLPI');
    return res.json();
  },

  async createGlpiTicket(payload: CreateGlpiTicketPayload): Promise<{ 
    success: boolean; 
    ticketId: number; 
    ticketUrl: string; 
    message: string;
    report?: TicketConferenceReport;
    warnings?: string[];
  }> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao criar chamado no GLPI');
    return data;
  },

  // Test Ticket with Conference Report
  async testTicket(payload: Partial<CreateGlpiTicketPayload> & {
    title?: string;
    description?: string;
    content?: string;
    requesterUserId?: number;
    requesterGroupId?: number;
    assignedUserId?: number;
    assignedGroupId?: number;
    observerUserId?: number;
    observerGroupId?: number;
    locationId?: number;
    requestTypeId?: number;
    statusId?: number;
    extraFields?: string;
    equipment?: string;
  }): Promise<TicketConferenceReport> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/test-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Falha no teste de criação de chamado no GLPI');
    return data;
  },

  // Authentication
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Falha ao autenticar');
    return data;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao carregar usuário');
    return data;
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; recoveryCode: string; email: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao solicitar recuperação de senha');
    return data;
  },

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao redefinir senha');
    return data;
  },

  // Routines
  async getRoutines(): Promise<RoutineSchedule[]> {
    const res = await fetch(`${API_BASE_URL}/api/routines`);
    if (!res.ok) throw new Error('Erro ao listar rotinas');
    return res.json();
  },

  async createRoutine(routine: Partial<RoutineSchedule>): Promise<RoutineSchedule> {
    const res = await fetch(`${API_BASE_URL}/api/routines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(routine)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao criar rotina');
    return data;
  },

  async updateRoutine(id: string, updates: Partial<RoutineSchedule>): Promise<RoutineSchedule> {
    const res = await fetch(`${API_BASE_URL}/api/routines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao atualizar rotina');
    return data;
  },

  async deleteRoutine(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/routines/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao excluir rotina');
    return data;
  },

  async toggleRoutine(id: string): Promise<RoutineSchedule> {
    const res = await fetch(`${API_BASE_URL}/api/routines/${id}/toggle`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao alterar status');
    return data;
  },

  async triggerRoutine(id: string): Promise<{ success: boolean; log: ExecutionLog; ticketId?: number; error?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/routines/${id}/trigger`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao disparar rotina');
    return data;
  },

  // GLPI Configuration & Diagnostics
  async getEnvironment(): Promise<{ environment: RuntimeEnvironment }> {
    const res = await fetch(`${API_BASE_URL}/api/environment`);
    if (!res.ok) throw new Error('Erro ao verificar ambiente de execução');
    return res.json();
  },

  async getGlpiConfig(): Promise<GlpiConfig & { environment?: RuntimeEnvironment }> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/config`);
    if (!res.ok) throw new Error('Erro ao obter configuração GLPI');
    return res.json();
  },

  async updateGlpiConfig(updates: Partial<GlpiConfig>): Promise<GlpiConfig> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao salvar configuração GLPI');
    return data;
  },

  async testGlpiConnection(config?: Partial<GlpiConfig>): Promise<ConnectionTestResponse> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config || {})
    });
    const data = await res.json();
    if (!res.ok && !data.steps) throw new Error(data.detail || data.error || 'Falha no teste de conexão GLPI');
    return data;
  },

  async testCreateRealTicket(title?: string, description?: string): Promise<{ success: boolean; ticketId: number; message: string; ticketUrl?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/test-create-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'Erro ao criar chamado de teste no GLPI');
    return data;
  },

  async getRealTickets(): Promise<GlpiRealTicket[]> {
    const res = await fetch(`${API_BASE_URL}/api/glpi/real-tickets`);
    if (!res.ok) throw new Error('Erro ao consultar chamados no GLPI');
    return res.json();
  },

  // Logs & History
  async getLogs(): Promise<ExecutionLog[]> {
    const res = await fetch(`${API_BASE_URL}/api/logs`);
    if (!res.ok) throw new Error('Erro ao carregar histórico');
    return res.json();
  },

  async clearLogs(): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/api/logs`, { method: 'DELETE' });
    return res.json();
  },

  // Dashboard Stats
  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE_URL}/api/stats`);
    if (!res.ok) throw new Error('Erro ao carregar métricas');
    return res.json();
  }
};
