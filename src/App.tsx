import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, 
  RoutineSchedule, 
  ExecutionLog, 
  GlpiConfig, 
  DashboardStats, 
  RoutineTemplate,
  GlpiReferenceData,
  CreateGlpiTicketPayload
} from './types';
import { api } from './services/api';
import { INITIAL_USER } from './data/initialData';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { RoutinesView } from './components/RoutinesView';
import { TicketsView } from './components/TicketsView';
import { GlpiConfigView } from './components/GlpiConfigView';
import { HistoryView } from './components/HistoryView';
import { TemplatesView } from './components/TemplatesView';
import { RoutineModal } from './components/RoutineModal';
import { CreateTicketModal } from './components/CreateTicketModal';
import { CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';


export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('glpi_scheduler_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'routines' | 'tickets' | 'glpi' | 'history' | 'templates'>('dashboard');

  // Core Data States
  const [routines, setRoutines] = useState<RoutineSchedule[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [glpiConfig, setGlpiConfig] = useState<GlpiConfig | null>(null);
  const [referenceData, setReferenceData] = useState<GlpiReferenceData | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & UI States
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineSchedule | null>(null);
  const [isCreateTicketModalOpen, setIsCreateTicketModalOpen] = useState(false);

  // Toast Notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Fetch all applet data from backend
  const fetchData = useCallback(async () => {
    try {
      const [routinesData, logsData, configData, statsData, refData] = await Promise.all([
        api.getRoutines(),
        api.getLogs(),
        api.getGlpiConfig(),
        api.getStats(),
        api.getReferenceData().catch(() => null)
      ]);
      setRoutines(routinesData);
      setLogs(logsData);
      setGlpiConfig(configData);
      setStats(statsData);
      if (refData) setReferenceData(refData);
    } catch (err: any) {
      console.error('Error fetching GLPI scheduler data:', err);
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auth handlers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('glpi_scheduler_user', JSON.stringify(user));
    showToast(`Bem-vindo, ${user.name}! Painel da TI conectado.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('glpi_scheduler_user');
  };

  // Routine operations
  const handleSaveRoutine = async (data: Partial<RoutineSchedule>) => {
    try {
      if (editingRoutine) {
        await api.updateRoutine(editingRoutine.id, data);
        showToast('Rotina de TI atualizada com sucesso!');
      } else {
        await api.createRoutine({
          ...data,
          createdBy: currentUser?.name || 'Equipe de TI'
        });
        showToast('Nova rotina de TI cadastrada com sucesso!');
      }
      setIsRoutineModalOpen(false);
      setEditingRoutine(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar rotina', 'error');
      throw err;
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta rotina de TI?')) return;
    try {
      await api.deleteRoutine(id);
      showToast('Rotina de TI excluída com sucesso!');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir rotina', 'error');
    }
  };

  const handleToggleRoutine = async (id: string) => {
    try {
      const updated = await api.toggleRoutine(id);
      showToast(`Rotina de TI ${updated.isActive ? 'ativada' : 'pausada'} com sucesso!`);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar status', 'error');
    }
  };

  const handleTriggerRoutine = async (id: string) => {
    try {
      const res = await api.triggerRoutine(id);
      if (res.success) {
        showToast(`Chamado de TI #${res.ticketId || res.log?.glpiTicketId || ''} criado com sucesso no GLPI!`, 'success');
      } else {
        showToast(`Falha no envio ao GLPI: ${res.error || 'Erro de comunicação'}`, 'error');
      }
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Falha ao disparar chamado', 'error');
    }
  };

  const handleDuplicateRoutine = async (routine: RoutineSchedule) => {
    try {
      const duplicateData: Partial<RoutineSchedule> = {
        title: `${routine.title} (Cópia)`,
        content: routine.content,
        frequency: routine.frequency,
        time: routine.time,
        daysOfWeek: routine.daysOfWeek,
        dayOfMonth: routine.dayOfMonth,
        customIntervalHours: routine.customIntervalHours,
        isActive: false,
        type: routine.type,
        urgency: routine.urgency,
        impact: routine.impact,
        priority: routine.priority,
        categoryName: routine.categoryName,
        requester: routine.requester,
        assignee: routine.assignee,
        technicalGroup: routine.technicalGroup,
        entityId: routine.entityId,
        tags: routine.tags,
        createdBy: currentUser?.name || 'Equipe de TI'
      };
      await api.createRoutine(duplicateData);
      showToast('Rotina de TI duplicada com sucesso!');
      fetchData();
    } catch (err: any) {
      showToast('Erro ao duplicar rotina', 'error');
    }
  };

  const handleImportTemplate = async (template: RoutineTemplate) => {
    try {
      await api.createRoutine({
        title: template.title,
        content: template.content,
        frequency: template.frequency,
        time: template.time,
        daysOfWeek: template.daysOfWeek,
        dayOfMonth: template.dayOfMonth,
        customIntervalHours: 24,
        isActive: true,
        type: template.type,
        urgency: template.urgency,
        impact: template.impact,
        priority: template.priority,
        categoryName: template.categoryName,
        requester: currentUser?.email || 'joao.leopoldino@digitronbalancas.com.br',
        assignee: 'Equipe de TI',
        technicalGroup: 'Equipe de TI',
        entityId: 0,
        tags: template.tags,
        createdBy: currentUser?.name || 'Equipe de TI'
      });
      showToast(`Modelo de TI "${template.title.slice(0, 30)}..." importado e ativado!`);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao importar modelo', 'error');
    }
  };

  // GLPI Config operations
  const handleUpdateGlpiConfig = async (updated: Partial<GlpiConfig>) => {
    try {
      const res = await api.updateGlpiConfig(updated);
      setGlpiConfig(res);
      showToast('Parâmetros GLPI da TI salvos com sucesso!');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar configuração', 'error');
    }
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (!window.confirm('Deseja realmente limpar todo o histórico de auditoria de TI?')) return;
    try {
      await api.clearLogs();
      showToast('Histórico de auditoria limpo');
      fetchData();
    } catch (err: any) {
      showToast('Erro ao limpar histórico', 'error');
    }
  };

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-xl ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : toast.type === 'info'
              ? 'bg-cyan-950/90 border-cyan-800 text-cyan-200'
              : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Top Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        glpiConfig={glpiConfig}
        onQuickTest={() => setCurrentTab('glpi')}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Carregando painel de TI do GLPI AutoScheduler...</p>
          </div>
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                routines={routines}
                logs={logs}
                glpiConfig={glpiConfig}
                onNavigateTab={setCurrentTab}
                onOpenNewRoutine={() => {
                  setEditingRoutine(null);
                  setIsRoutineModalOpen(true);
                }}
                onTriggerRoutine={handleTriggerRoutine}
                onInspectLog={(log) => {
                  setCurrentTab('history');
                }}
                onRefresh={fetchData}
              />
            )}

            {currentTab === 'routines' && (
              <RoutinesView
                routines={routines}
                onOpenNew={() => {
                  setEditingRoutine(null);
                  setIsRoutineModalOpen(true);
                }}
                onEdit={(r) => {
                  setEditingRoutine(r);
                  setIsRoutineModalOpen(true);
                }}
                onDelete={handleDeleteRoutine}
                onToggle={handleToggleRoutine}
                onTrigger={handleTriggerRoutine}
                onDuplicate={handleDuplicateRoutine}
              />
            )}

            {currentTab === 'tickets' && (
              <TicketsView
                glpiConfig={glpiConfig}
                referenceData={referenceData}
                onOpenCreateTicket={() => setIsCreateTicketModalOpen(true)}
                onRefreshReferenceData={fetchData}
              />
            )}

            {currentTab === 'glpi' && glpiConfig && (
              <GlpiConfigView
                config={glpiConfig}
                onUpdateConfig={handleUpdateGlpiConfig}
              />
            )}

            {currentTab === 'history' && (
              <HistoryView
                logs={logs}
                onClearLogs={handleClearLogs}
                onRefresh={fetchData}
              />
            )}

            {currentTab === 'templates' && (
              <TemplatesView
                onImportTemplate={handleImportTemplate}
              />
            )}
          </>
        )}

      </main>

      {/* Routine Configuration Modal */}
      <RoutineModal
        isOpen={isRoutineModalOpen}
        onClose={() => {
          setIsRoutineModalOpen(false);
          setEditingRoutine(null);
        }}
        onSave={handleSaveRoutine}
        initialData={editingRoutine}
        referenceData={referenceData}
      />

      {/* Real GLPI Ticket Creation Modal */}
      <CreateTicketModal
        isOpen={isCreateTicketModalOpen}
        onClose={() => setIsCreateTicketModalOpen(false)}
        referenceData={referenceData}
        onSubmitTicket={async (payload) => {
          const res = await api.createGlpiTicket(payload);
          showToast(res.message);
          fetchData();
          return res;
        }}
        onTicketCreated={() => {
          fetchData();
        }}
      />


      {/* System Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>
          Digi-Tron • Setor de Tecnologia da Informação • GLPI AutoScheduler • Gestão Autônoma de Infraestrutura
        </p>
      </footer>

    </div>
  );
}
