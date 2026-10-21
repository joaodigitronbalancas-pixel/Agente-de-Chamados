import React, { useState } from 'react';
import { RoutineSchedule, RecurrenceType } from '../types';
import { formatRelativeCountdown, getFrequencyLabel } from '../utils/scheduler';
import { formatDateTime } from '../utils/dateTime';

import { 
  CalendarClock, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Copy, 
  Search, 
  Plus, 
  Tag, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Radio
} from 'lucide-react';

interface RoutinesViewProps {
  routines: RoutineSchedule[];
  onOpenNew: () => void;
  onEdit: (routine: RoutineSchedule) => void;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
  onTrigger: (id: string) => Promise<void>;
  onDuplicate: (routine: RoutineSchedule) => Promise<void>;
}

export const RoutinesView: React.FC<RoutinesViewProps> = ({
  routines,
  onOpenNew,
  onEdit,
  onDelete,
  onToggle,
  onTrigger,
  onDuplicate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [freqFilter, setFreqFilter] = useState<string>('all');
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [routineToConfirm, setRoutineToConfirm] = useState<RoutineSchedule | null>(null);

  const handleConfirmTrigger = async () => {
    if (!routineToConfirm) return;
    const routineId = routineToConfirm.id;
    setRoutineToConfirm(null);
    setTriggeringId(routineId);
    try {
      await onTrigger(routineId);
    } finally {
      setTriggeringId(null);
    }
  };

  const filteredRoutines = routines.filter((r) => {
    const matchesSearch = 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.tags || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'all' ? true :
      statusFilter === 'active' ? r.isActive :
      !r.isActive;

    const matchesFreq = 
      freqFilter === 'all' ? true : r.frequency === freqFilter;

    return matchesSearch && matchesStatus && matchesFreq;
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-cyan-400" />
            Rotinas Programadas em Produção
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Chamados que o servidor cria de forma autônoma e registra diretamente no GLPI.
          </p>
        </div>

        <button
          onClick={onOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Rotina Recorrente
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, categoria, balanças ou tags..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({routines.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ativas ({routines.filter(r => r.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('paused')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'paused'
                ? 'bg-cyan-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pausadas ({routines.filter(r => !r.isActive).length})
          </button>
        </div>

        {/* Frequency Dropdown */}
        <div className="shrink-0">
          <select
            value={freqFilter}
            onChange={(e) => setFreqFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Frequência: Todas</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quinzenal</option>
            <option value="monthly">Mensal</option>
            <option value="custom_interval">Intervalo de Horas</option>
          </select>
        </div>
      </div>

      {/* Routine Cards Grid */}
      {filteredRoutines.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
          <CalendarClock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Nenhuma rotina cadastrada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Ajuste os filtros de busca ou crie uma nova rotina programada para a infraestrutura da Digi-Tron.
          </p>
          <button
            onClick={onOpenNew}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-colors cursor-pointer"
          >
            + Criar Nova Rotina
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRoutines.map((routine) => {
            const isTriggering = triggeringId === routine.id;

            return (
              <div
                key={routine.id}
                className={`p-5 rounded-2xl border transition-all ${
                  routine.isActive
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
                    : 'bg-slate-900/40 border-slate-850 opacity-75'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left Column: Routine Info */}
                  <div className="space-y-2 flex-1">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        routine.isActive
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {routine.isActive ? 'Ativa' : 'Pausada'}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                        {routine.type === 1 ? 'Incidente' : 'Requisição'}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {routine.categoryName || 'Geral'}
                      </span>

                      {/* Tag badges */}
                      {(routine.tags || []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-950 border border-slate-800 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-cyan-400" />
                          {tag}
                        </span>
                      ))}
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight">
                      {routine.title}
                    </h3>

                    {/* Recurrence & Timing details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{getFrequencyLabel(routine)}</span>
                      </div>

                      <span>•</span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Próxima Execução:</span>
                        <span className="text-amber-400 font-semibold font-mono">
                          {routine.isActive
                            ? `${formatRelativeCountdown(routine.nextRunAt)} (${formatDateTime(routine.nextRunAt)})`
                            : 'Pausada'}
                        </span>

                      </div>

                      <span>•</span>

                      <div className="flex items-center gap-1 text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{routine.totalDispatched || 0} chamados confirmados</span>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Action Buttons */}
                  <div className="flex items-center flex-wrap gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    
                    {/* Disparar Agora */}
                    <button
                      onClick={() => setRoutineToConfirm(routine)}
                      disabled={isTriggering}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                      title="Forçar envio real deste chamado ao GLPI"
                    >
                      {isTriggering ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current text-cyan-400" />
                      )}
                      <span>Disparar Agora</span>
                    </button>

                    {/* Toggle Active / Pause */}
                    <button
                      onClick={() => onToggle(routine.id)}
                      className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                        routine.isActive
                          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                          : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                      }`}
                      title={routine.isActive ? 'Pausar agendamento' : 'Ativar agendamento'}
                    >
                      {routine.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onEdit(routine)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Editar rotina"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Duplicate */}
                    <button
                      onClick={() => onDuplicate(routine)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                      title="Duplicar rotina"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(routine.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 transition-colors cursor-pointer"
                      title="Excluir rotina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {routineToConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Disparo Real de Chamado</h3>
                <p className="text-xs text-slate-400">Ambiente de Produção Digi-Tron</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="font-semibold text-white block mb-1">{routineToConfirm.title}</span>
              <p className="text-[11px] text-slate-400">
                Esta ação enviará a requisição HTTP POST ao endpoint <code>/Ticket</code> do seu GLPI real.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoutineToConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmTrigger}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                Confirmar e Disparar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
