import React, { useState } from 'react';
import { RoutineTemplate } from '../types';
import { DEFAULT_TEMPLATES } from '../data/initialData';
import { 
  BookTemplate, 
  Plus, 
  Server, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Sparkles,
  HardDrive,
  Network,
  Cpu,
  Monitor
} from 'lucide-react';

interface TemplatesViewProps {
  onImportTemplate: (template: RoutineTemplate) => Promise<void>;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ onImportTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<string[]>([]);

  const handleImport = async (tmpl: RoutineTemplate) => {
    setImportingId(tmpl.id);
    try {
      await onImportTemplate(tmpl);
      setImportedIds(prev => [...prev, tmpl.id]);
    } finally {
      setImportingId(null);
    }
  };

  const filteredTemplates = DEFAULT_TEMPLATES.filter(t => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookTemplate className="w-6 h-6 text-cyan-400" />
            Modelos de Rotinas de TI — Digi-Tron
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Procedimentos preventivos padronizados para infraestrutura, servidores, redes, backups e ERP Factory OS.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center flex-wrap gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shadow-md">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'backups', label: 'Backups & Storage' },
            { id: 'infra', label: 'Servidores & Datacenter' },
            { id: 'redes', label: 'Redes & Wi-Fi' },
            { id: 'erp', label: 'ERP Factory OS' },
            { id: 'seguranca', label: 'Segurança & AD' },
            { id: 'estacoes', label: 'Estações & Periféricos' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTemplates.map((template) => {
          const isImported = importedIds.includes(template.id);
          const isImporting = importingId === template.id;

          return (
            <div
              key={template.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-6 shadow-xl flex flex-col justify-between group transition-all"
            >
              <div className="space-y-3">
                
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                    {template.categoryName}
                  </span>

                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {template.frequency === 'daily'
                      ? 'Diário'
                      : template.frequency === 'weekly'
                      ? 'Semanal'
                      : template.frequency === 'biweekly'
                      ? 'Quinzenal'
                      : 'Mensal'}{' '}
                    às {template.time}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {template.title}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {template.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {template.tags.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      #{t}
                    </span>
                  ))}
                </div>

                {/* Checklist Preview */}
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800/70 text-[11px] text-slate-300 font-mono line-clamp-3">
                  {template.content.replace(/## /g, '').slice(0, 160)}...
                </div>

              </div>

              {/* Action */}
              <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Prioridade ITIL: <strong className="text-amber-400">{template.priority}/5</strong>
                </span>

                <button
                  onClick={() => handleImport(template)}
                  disabled={isImporting || isImported}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    isImported
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                  }`}
                >
                  {isImported ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Adicionado às Rotinas de TI!</span>
                    </>
                  ) : isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Importando...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ativar nesta Rotina</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
