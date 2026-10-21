import React, { useState, useEffect, useCallback } from 'react';
import { GlpiTicketFull, GlpiReferenceData, GlpiConfig } from '../types';
import { api } from '../services/api';
import { formatDateTime } from '../utils/dateTime';
import { 
  Ticket, 
  Search, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  Plus, 
  Eye, 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Server,
  Layers,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

interface TicketsViewProps {
  glpiConfig: GlpiConfig | null;
  referenceData: GlpiReferenceData | null;
  onOpenCreateTicket: () => void;
  onRefreshReferenceData: () => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  glpiConfig,
  referenceData,
  onOpenCreateTicket,
  onRefreshReferenceData
}) => {
  const [tickets, setTickets] = useState<GlpiTicketFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<number | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<number | 'all'>('all');
  const [selectedTicket, setSelectedTicket] = useState<GlpiTicketFull | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGlpiTickets({ limit: 100 });
      setTickets(data);
    } catch (err) {
      console.error('Erro ao consultar chamados no GLPI:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const filteredTickets = tickets.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.requesterName || '').toLowerCase().includes(q) ||
      (t.categoryName || '').toLowerCase().includes(q);

    const matchesStatus = selectedStatus === 'all' ? true : t.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' ? true : t.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: number, name?: string) => {
    switch (status) {
      case 1:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-950 text-blue-300 border border-blue-800/60">
            {name || 'Novo'}
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800/60">
            {name || 'Em Atendimento'}
          </span>
        );
      case 3:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-950 text-purple-300 border border-purple-800/60">
            {name || 'Planejado'}
          </span>
        );
      case 4:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-orange-950 text-orange-300 border border-orange-800/60">
            {name || 'Pendente'}
          </span>
        );
      case 5:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/60">
            {name || 'Solucionado'}
          </span>
        );
      case 6:
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
            {name || 'Fechado'}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: number) => {
    switch (priority) {
      case 5:
        return <span className="text-rose-400 font-bold">5 - Muito Alta</span>;
      case 4:
        return <span className="text-amber-400 font-bold">4 - Alta</span>;
      case 3:
        return <span className="text-cyan-300 font-medium">3 - Média</span>;
      case 2:
        return <span className="text-slate-300 font-medium">2 - Baixa</span>;
      case 1:
      default:
        return <span className="text-slate-400">1 - Muito Baixa</span>;
    }
  };

  const isConnected = glpiConfig?.connectionStatus === 'connected';

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Ticket className="w-6 h-6 text-cyan-400" />
              Chamados GLPI — Tecnologia da Informação
            </h2>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
              isConnected
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800/70'
                : 'bg-amber-950 text-amber-300 border-amber-800/70'
            }`}>
              {isConnected ? 'Sincronizado GLPI' : 'Modo Offline / Logs Locais'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Consulta em tempo real aos registros e atendimentos de TI diretamente na base do GLPI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchTickets();
              onRefreshReferenceData();
            }}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            title="Sincronizar Chamados do GLPI"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            onClick={onOpenCreateTicket}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Abrir Novo Chamado de TI</span>
          </button>
        </div>
      </div>

      {/* Metric summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-slate-400">Total de Chamados</span>
          <div className="text-2xl font-black text-white mt-0.5">{tickets.length}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-blue-400">Novos</span>
          <div className="text-2xl font-black text-blue-300 mt-0.5">
            {tickets.filter((t) => t.status === 1).length}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-amber-400">Em Atendimento</span>
          <div className="text-2xl font-black text-amber-300 mt-0.5">
            {tickets.filter((t) => t.status === 2 || t.status === 3).length}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] font-bold uppercase text-emerald-400">Solucionados / Fechados</span>
          <div className="text-2xl font-black text-emerald-300 mt-0.5">
            {tickets.filter((t) => t.status === 5 || t.status === 6).length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar por ID (#), título do chamado, requerente ou categoria..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300"
          >
            <option value="all">Todos os Status</option>
            <option value="1">1 - Novo</option>
            <option value="2">2 - Em atendimento</option>
            <option value="4">4 - Pendente</option>
            <option value="5">5 - Solucionado</option>
            <option value="6">6 - Fechado</option>
          </select>

          {/* Priority filter */}
          <select
            value={selectedPriority}
            onChange={(e) => {
              setSelectedPriority(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300"
          >
            <option value="all">Todas as Prioridades</option>
            <option value="5">5 - Muito Alta</option>
            <option value="4">4 - Alta</option>
            <option value="3">3 - Média</option>
            <option value="2">2 - Baixa</option>
            <option value="1">1 - Muito Baixa</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-400">Consultando chamados reais no endpoint GLPI...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
          <Ticket className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Nenhum chamado encontrado</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || selectedStatus !== 'all' || selectedPriority !== 'all'
              ? 'Nenhum chamado de TI corresponde aos filtros selecionados.'
              : 'Nenhum chamado registrado no GLPI. Clique em "Abrir Novo Chamado de TI" para criar um registro.'}
          </p>
          <button
            onClick={onOpenCreateTicket}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Primeiro Chamado de TI
          </button>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">ID & Status</th>
                  <th className="py-3.5 px-4">Título do Chamado</th>
                  <th className="py-3.5 px-4">Requerente & Grupo</th>
                  <th className="py-3.5 px-4">Categoria TI</th>
                  <th className="py-3.5 px-4">Prioridade</th>
                  <th className="py-3.5 px-4">Abertura (SP)</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {paginatedTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-850/50 transition-colors">
                    
                    {/* ID & Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-xs bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          #{ticket.id}
                        </span>
                        {getStatusBadge(ticket.status, ticket.statusName)}
                      </div>
                    </td>

                    {/* Title & Type */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="truncate font-semibold text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
                        {ticket.name}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-950 text-slate-400">
                          {ticket.typeName || (ticket.type === 1 ? 'Incidente' : 'Requisição')}
                        </span>
                        {ticket.entityName && (
                          <span>• {ticket.entityName}</span>
                        )}
                      </div>
                    </td>

                    {/* Requester & Group */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <User className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{ticket.requesterName || 'Equipe TI'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                        <Users className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[140px]">{ticket.groupName || 'Equipe de TI'}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="truncate max-w-[180px] block font-medium text-cyan-300">
                        {ticket.categoryName || 'TI - Geral'}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getPriorityBadge(ticket.priority)}
                    </td>

                    {/* Date (Curitiba / America/Sao_Paulo) */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      <div>{formatDateTime(ticket.dateCreation)}</div>
                      {ticket.dateMod && ticket.dateMod !== ticket.dateCreation && (
                        <div className="text-[10px] text-slate-500">
                          Mod: {formatDateTime(ticket.dateMod)}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTicket(ticket)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Ver Detalhes do Chamado"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {glpiConfig?.url && (
                          <a
                            href={`${glpiConfig.url.replace('/apirest.php', '')}/front/ticket.form.php?id=${ticket.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Abrir diretamente na interface do GLPI"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
              <span>
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
                {Math.min(currentPage * itemsPerPage, filteredTickets.length)} de{' '}
                {filteredTickets.length} chamados
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-xs font-semibold text-white">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ticket Details Inspector Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold">
                  #{selectedTicket.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedTicket.name}
                    </h3>
                    {getStatusBadge(selectedTicket.status, selectedTicket.statusName)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Categoria: {selectedTicket.categoryName} • Prioridade: {selectedTicket.priority} de 5
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Requerente</span>
                <span className="text-slate-200 font-medium">{selectedTicket.requesterName || 'TI'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Grupo Atribuído</span>
                <span className="text-slate-200 font-medium">{selectedTicket.groupName || 'Equipe de TI'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Técnico</span>
                <span className="text-slate-200 font-medium">{selectedTicket.technicianName || 'Equipe de TI'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Data de Abertura</span>
                <span className="text-cyan-300 font-mono">{formatDateTime(selectedTicket.dateCreation)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Última Modificação</span>
                <span className="text-slate-400 font-mono">{formatDateTime(selectedTicket.dateMod)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Tipo</span>
                <span className="text-slate-200 font-medium">{selectedTicket.typeName}</span>
              </div>
            </div>

            {/* Content body */}
            <div>
              <span className="text-xs font-bold text-slate-300 block mb-1.5">
                Conteúdo & Descrição do Chamado:
              </span>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {selectedTicket.content || 'Sem descrição cadastrada'}
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Horários exibidos no fuso operacional de São Paulo (UTC-3)
              </span>

              <div className="flex items-center gap-2">
                {glpiConfig?.url && (
                  <a
                    href={`${glpiConfig.url.replace('/apirest.php', '')}/front/ticket.form.php?id=${selectedTicket.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <span>Abrir no GLPI Web</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
