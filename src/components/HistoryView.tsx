import React, { useState } from 'react';
import { ExecutionLog } from '../types';
import { formatDateTime } from '../utils/dateTime';

import { 
  History, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  ExternalLink, 
  Clock, 
  FileCode, 
  X, 
  RefreshCw, 
  Copy, 
  Check,
  Server
} from 'lucide-react';

interface HistoryViewProps {
  logs: ExecutionLog[];
  onClearLogs: () => Promise<void>;
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ logs, onClearLogs, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.routineTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(log.glpiTicketId || '').includes(searchTerm) ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCopyPayload = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            Histórico Real de Execuções e Auditoria
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Registro de auditoria com os chamados efetivamente criados no GLPI e eventuais falhas tratadas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Atualizar Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Auditoria
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por chamado, ID GLPI ou mensagem de erro..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({logs.length})
          </button>
          <button
            onClick={() => setStatusFilter('success')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'success' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Criados no GLPI ({logs.filter(l => l.status === 'success').length})
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              statusFilter === 'failed' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            Falhas ({logs.filter(l => l.status === 'failed').length})
          </button>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
          <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">Nenhum registro de auditoria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Quando as rotinas forem executadas no GLPI, o histórico registrará data, ID do chamado, duração e payload retornado.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Status & ID GLPI</th>
                  <th className="py-3.5 px-4">Chamado / Rotina</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4">Data e Hora</th>
                  <th className="py-3.5 px-4">Latência</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    
                    {/* Status & Ticket ID */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {log.status === 'failed' ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}

                        {log.glpiTicketId ? (
                          <span className="font-mono font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            #{log.glpiTicketId}
                          </span>
                        ) : (
                          <span className="text-rose-400 font-mono text-[11px] font-semibold">SEM ID</span>
                        )}

                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'failed'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}>
                          {log.status === 'success' ? 'Criado no GLPI' : 'Falha'}
                        </span>
                      </div>
                    </td>

                    {/* Routine Title */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white max-w-md truncate">
                        {log.routineTitle}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                        {log.message}
                      </div>
                    </td>

                    {/* Execution Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-medium text-slate-300">
                        {log.executionType === 'scheduled' ? 'Automático' : 'Manual'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                      {formatDateTime(log.triggeredAt)}
                    </td>


                    {/* Latency */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {log.durationMs}ms
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ver Detalhes</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Auditoria do Chamado GLPI</h3>
                  <p className="text-xs text-slate-400">
                    {selectedLog.glpiTicketId ? `Chamado #${selectedLog.glpiTicketId}` : 'Tentativa de Envio'} • {formatDateTime(selectedLog.triggeredAt)}
                  </p>

                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              
              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Mensagem Registrada:
                </span>
                <p className="text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                  {selectedLog.message}
                </p>
              </div>

              {selectedLog.requestPayload && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">
                      Payload Enviado ao endpoint <code>POST /Ticket</code>:
                    </span>
                    <button
                      onClick={() => handleCopyPayload(selectedLog.requestPayload)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copiar JSON
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 font-mono overflow-x-auto leading-relaxed max-h-48">
                    {JSON.stringify(selectedLog.requestPayload, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.responsePayload && (
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Resposta Retornada pelo Servidor GLPI:
                  </span>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-emerald-300 font-mono overflow-x-auto leading-relaxed max-h-48">
                    {JSON.stringify(selectedLog.responsePayload, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.errorDetails && (
                <div>
                  <span className="text-xs font-semibold text-rose-300 block mb-1.5">
                    Detalhes do Erro Técnico:
                  </span>
                  <pre className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 font-mono overflow-x-auto">
                    {selectedLog.errorDetails}
                  </pre>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-right shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
