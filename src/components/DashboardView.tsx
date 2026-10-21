import React, { useState, useEffect } from 'react';
import { DashboardStats, ExecutionLog, GlpiConfig, RoutineSchedule } from '../types';

import { formatRelativeCountdown, getFrequencyLabel } from '../utils/scheduler';
import { formatDateTime, formatTimeOnly } from '../utils/dateTime';

import { 
  CalendarClock, 
  CheckCircle2, 
  Clock, 
  Play, 
  Server, 
  ShieldCheck, 
  TrendingUp, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  Eye, 
  Layers, 
  Sparkles,
  AlertCircle,
  Radio,
  Cpu,
  Terminal
} from 'lucide-react';

interface DashboardViewProps {
  stats: DashboardStats | null;
  routines: RoutineSchedule[];
  logs: ExecutionLog[];
  glpiConfig: GlpiConfig | null;
  onNavigateTab: (tab: 'dashboard' | 'routines' | 'glpi' | 'history' | 'templates') => void;
  onOpenNewRoutine: () => void;
  onTriggerRoutine: (routineId: string) => Promise<void>;
  onInspectLog: (log: ExecutionLog) => void;
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  routines,
  logs,
  glpiConfig,
  onNavigateTab,
  onOpenNewRoutine,
  onTriggerRoutine,
  onInspectLog,
  onRefresh
}) => {
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [confirmRoutine, setConfirmRoutine] = useState<RoutineSchedule | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      if (stats?.nextRunAt) {
        setCountdown(formatRelativeCountdown(stats.nextRunAt));
      } else {
        setCountdown('Sem agendamento ativo');
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);
    return () => clearInterval(interval);
  }, [stats?.nextRunAt]);

  const handleConfirmAndTrigger = async () => {
    if (!confirmRoutine) return;
    const routineId = confirmRoutine.id;
    setConfirmRoutine(null);
    setTriggeringId(routineId);
    try {
      await onTriggerRoutine(routineId);
    } finally {
      setTriggeringId(null);
    }
  };

  const activeRoutines = routines.filter(r => r.isActive);
  const sortedUpcoming = [...activeRoutines].sort((a, b) => {
    return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
  }).slice(0, 4);

  const recentLogs = logs.slice(0, 6);
  const connectionStatus = glpiConfig?.connectionStatus || 'pending_configuration';

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Painel de Automação de Chamados de TI
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              Digi-Tron TI
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gerenciamento e agendamento automático de chamados preventivos e operacionais de Tecnologia da Informação.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            title="Sincronizar Dados"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigateTab('templates')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Modelos de TI
          </button>

          <button
            onClick={onOpenNewRoutine}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Rotina de TI
          </button>
        </div>
      </div>

      {/* 4 Real Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Active IT Routines */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Rotinas de TI Ativas</span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {stats?.activeRoutines ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              de {stats?.totalRoutines ?? 0} programadas
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-cyan-300">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>Verificação contínua no servidor</span>
          </div>
        </div>

        {/* Card 2: Dispatched Today */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Chamados de TI Criados</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">
              {stats?.dispatchedTotal ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {stats?.dispatchedToday ?? 0} hoje
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Confirmados pelo endpoint GLPI</span>
          </div>
        </div>

        {/* Card 3: Success Rate */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Taxa de Sucesso</span>
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">
              {stats?.dispatchedTotal === 0 && (stats?.totalErrors ?? 0) === 0 ? '100%' : `${stats?.successRate ?? 100}%`}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {stats?.totalErrors ?? 0} falhas registradas
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auditoria persistida em disco</span>
          </div>
        </div>

        {/* Card 4: Next Scheduled Run */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Próximo Disparo de TI</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white truncate max-w-[190px]">
              {countdown}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 truncate">
            {stats?.nextRunAt ? formatDateTime(stats.nextRunAt) : 'Sem rotinas ativas'}
          </div>

        </div>

      </div>

      {/* Real GLPI Status Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        connectionStatus === 'connected'
          ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-200'
          : connectionStatus === 'pending_configuration'
          ? 'bg-amber-950/20 border-amber-700/40 text-amber-200'
          : 'bg-rose-950/20 border-rose-700/40 text-rose-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            connectionStatus === 'connected'
              ? 'bg-emerald-500/20 text-emerald-300'
              : connectionStatus === 'pending_configuration'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-rose-500/20 text-rose-300'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                {connectionStatus === 'connected'
                  ? 'GLPI Conectado e Validado'
                  : connectionStatus === 'pending_configuration'
                  ? 'Configuração da Conexão GLPI Pendente'
                  : 'GLPI Desconectado / Erro de Comunicação'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-black/40 font-mono text-slate-300">
                {glpiConfig?.url || 'URL não informada'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {connectionStatus === 'connected'
                ? `Sessão de TI autenticada no GLPI. Perfil ativo: ${glpiConfig?.activeProfile || 'Técnico TI'}.`
                : connectionStatus === 'pending_configuration'
                ? 'Informe o App-Token e User-Token na tela de configuração para permitir a autenticação real.'
                : glpiConfig?.lastErrorMessage || 'Não foi possível estabelecer contato com a API REST do GLPI.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('glpi')}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 text-xs font-semibold text-white border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          {connectionStatus === 'connected' ? 'Ver Parâmetros' : 'Configurar Conexão'}
        </button>
      </div>

      {/* Main Grid: Upcoming Scheduled Routines & Real Execution Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Upcoming Scheduled Routines */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Próximos Chamados de TI na Fila</h3>
              </div>
              <button
                onClick={() => onNavigateTab('routines')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Todas as Rotinas de TI ({routines.length}) <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {sortedUpcoming.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-400">Nenhuma rotina de TI ativa agendada no momento.</p>
                <button
                  onClick={onOpenNewRoutine}
                  className="mt-3 text-xs text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  + Criar nova rotina de TI
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedUpcoming.map((routine) => (
                  <div
                    key={routine.id}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/50 shrink-0">
                          {routine.type === 1 ? 'Incidente' : 'Requisição'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                          {routine.title}
                        </h4>
                      </div>
                      
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          {getFrequencyLabel(routine)}
                        </span>
                        <span>•</span>
                        <span className="text-amber-400 font-medium">
                          {formatRelativeCountdown(routine.nextRunAt)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setConfirmRoutine(routine)}
                      disabled={triggeringId === routine.id}
                      title="Disparar criação real no GLPI agora"
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {triggeringId === routine.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Lançar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Agendador de TI operando em segundo plano no servidor
            </span>
            <span className="text-slate-500">Sem dependência do navegador</span>
          </div>
        </div>

        {/* Right Column: Real Execution Logs */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Últimos Chamados de TI Lançados</h3>
              </div>
              <button
                onClick={() => onNavigateTab('history')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Histórico Completo ({logs.length}) <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {recentLogs.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-400">Nenhum chamado de TI disparado ainda.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Os chamados de infraestrutura criados pelo agendador de TI serão listados aqui com seus IDs reais do GLPI.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {log.glpiTicketId ? (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                            #{log.glpiTicketId}
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 shrink-0">
                            FALHA
                          </span>
                        )}
                        <h4 className="text-xs font-semibold text-slate-200 truncate">
                          {log.routineTitle}
                        </h4>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{formatTimeOnly(log.triggeredAt)}</span>
                        <span>•</span>

                        <span className={log.status === 'failed' ? 'text-rose-400 font-medium' : 'text-emerald-400 font-medium'}>
                          {log.status === 'success' ? 'Criado no GLPI' : 'Erro no Envio'}
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">{log.executionType === 'scheduled' ? 'Automático' : 'Manual'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onInspectLog(log)}
                      title="Ver Detalhes do Envio & Resposta GLPI"
                      className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800 transition-colors shrink-0 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Sessões GLPI encerradas via /killSession</span>
            <span className="text-emerald-400 font-medium">Escopo restrito a TI</span>
          </div>
        </div>

      </div>

      {/* Confirmation Modal before Real Ticket Creation */}
      {confirmRoutine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmar Lançamento de Chamado de TI</h3>
                <p className="text-xs text-slate-400">Ambiente de Produção Digi-Tron TI</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <span className="font-semibold text-white block">{confirmRoutine.title}</span>
              <p className="text-[11px] text-slate-400">
                Categoria: {confirmRoutine.categoryName} • Grupo: {confirmRoutine.technicalGroup || 'Equipe de TI'}
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              O chamado será registrado no GLPI e atribuído ao grupo de suporte de TI. Deseja prosseguir com o disparo?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRoutine(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAndTrigger}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                Sim, Criar Chamado no GLPI
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
