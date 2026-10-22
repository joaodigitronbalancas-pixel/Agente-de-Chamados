import React from 'react';
import { TicketConferenceReport } from '../types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  X, 
  Clock, 
  Users, 
  Sliders, 
  Layers,
  FileCheck
} from 'lucide-react';

interface ConferenceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: TicketConferenceReport | null;
}

export const ConferenceReportModal: React.FC<ConferenceReportModalProps> = ({
  isOpen,
  onClose,
  report
}) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              report.success ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
            }`}>
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Relatório de Conferência — Chamado #{report.ticketId}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  report.success ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {report.success ? 'Validado 100%' : 'Com Alertas'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoria de integridade em etapas: campos escalares, atores e fuso horário
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report.ticketUrl && (
              <a
                href={report.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition-colors"
              >
                <span>Abrir no GLPI</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Data de Abertura Gravada</span>
              </div>
              <div className="text-sm font-bold text-white font-mono">
                {report.recordedDate || 'N/A'}
              </div>
              <div className="text-[10px] text-cyan-400 mt-0.5">
                America/Sao_Paulo (Horário Oficial GLPI)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Campos Escalares</span>
              </div>
              <div className="text-sm font-bold text-white">
                {report.scalarComparison.filter(c => c.matches).length} de {report.scalarComparison.length} idênticos
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                Categoria, Localização, Tipo, Prioridade
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Users className="w-3.5 h-3.5 text-violet-400" />
                <span>Sincronização de Atores</span>
              </div>
              <div className="text-sm font-bold text-white">
                {report.actors.length} vínculos auditados
              </div>
              <div className="text-[10px] text-violet-400 mt-0.5">
                Token excluído, Requerente & Técnico vinculados
              </div>
            </div>
          </div>

          {/* Warnings if any */}
          {report.warnings && report.warnings.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-800/80 text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Avisos de Mapeamento ou Resolução:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-amber-200/90 font-mono">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Step-by-Step Flow Execution */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Etapas de Execução do Protocolo GLPI</span>
            </div>

            <div className="space-y-2">
              {report.steps.map((st, i) => {
                const isSuccess = st.status === 'success';
                const isWarning = st.status === 'warning';
                const isSkipped = st.status === 'skipped';

                return (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs">
                    <span className="mt-0.5">
                      {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      {isSkipped && <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block text-[9px] text-center leading-3 text-slate-400">-</span>}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-200">{st.step}</div>
                      <div className="text-[11px] text-slate-400">{st.details}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scalar Comparison Table */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Conferência de Campos Escalares (Enviado x Gravado)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                GET /Ticket/{report.ticketId}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Campo GLPI</th>
                    <th className="py-2.5 px-3">Valor Solicitado (Enviado)</th>
                    <th className="py-2.5 px-3">Gravado Efetivo no GLPI</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {report.scalarComparison.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 font-semibold text-white">{item.field}</td>
                      <td className="py-2 px-3 text-slate-300">{String(item.sentValue ?? '—')}</td>
                      <td className="py-2 px-3 text-cyan-300">{String(item.recordedValue ?? '—')}</td>
                      <td className="py-2 px-3 text-center">
                        {item.matches ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" /> Divergente
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actors Table */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Users className="w-4 h-4 text-violet-400" />
                <span>Atores Sincronizados (Ticket_User / Group_Ticket)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Tipos: 1=Requerente | 2=Atribuído | 3=Observador
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Papel no Chamado</th>
                    <th className="py-2.5 px-3">Identificador / Nome</th>
                    <th className="py-2.5 px-3">Tipo de Vínculo</th>
                    <th className="py-2.5 px-3 text-center">Ação Realizada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {report.actors.map((actor, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 font-semibold text-white">{actor.role}</td>
                      <td className="py-2 px-3 text-slate-200">
                        {actor.name} <span className="text-slate-500">(ID {actor.id})</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">{actor.targetType}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          actor.action === 'added' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          actor.action === 'removed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {actor.action === 'added' ? 'Vinculado' : actor.action === 'removed' ? 'Removido Token GLPI' : 'Confirmado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Tempo total de auditoria e validação: {report.durationMs}ms
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar Relatório
          </button>
        </div>

      </div>
    </div>
  );
};
