import React, { useState, useEffect } from 'react';
import { RoutineSchedule, RecurrenceType, IT_CATEGORIES, ItCategory, GlpiReferenceData } from '../types';
import { replaceMacroVariables } from '../utils/scheduler';
import { SearchableSelect, SelectOption } from './SearchableSelect';
import { 
  CalendarClock, 
  Sparkles, 
  Tag, 
  Clock, 
  FileText, 
  Sliders, 
  Save, 
  Eye, 
  X,
  AlertCircle,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface RoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (routineData: Partial<RoutineSchedule>) => Promise<void>;
  initialData?: RoutineSchedule | null;
  referenceData?: GlpiReferenceData | null;
}

export const RoutineModal: React.FC<RoutineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  referenceData
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceType>('daily');
  const [time, setTime] = useState('07:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(24);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [type, setType] = useState<1 | 2>(2); // Requisição
  const [urgency, setUrgency] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [impact, setImpact] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [categoryName, setCategoryName] = useState<ItCategory>('TI - Infraestrutura e Servidores');
  const [requester, setRequester] = useState('joao.leopoldino@digitronbalancas.com.br');
  const [assignee, setAssignee] = useState('Equipe de TI');
  const [technicalGroup, setTechnicalGroup] = useState('Equipe de TI');
  const [tagsInput, setTagsInput] = useState('TI, Servidores, Infraestrutura');
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setContent(initialData.content);
      setFrequency(initialData.frequency);
      setTime(initialData.time || '07:00');
      setDaysOfWeek(initialData.daysOfWeek || [1]);
      setDayOfMonth(initialData.dayOfMonth || 1);
      setCustomIntervalHours(initialData.customIntervalHours || 24);
      setIsActive(initialData.isActive);
      setType(initialData.type);
      setUrgency(initialData.urgency);
      setImpact(initialData.impact);
      setPriority(initialData.priority);
      setCategoryName(initialData.categoryName || 'TI - Infraestrutura e Servidores');
      setRequester(initialData.requester || 'joao.leopoldino@digitronbalancas.com.br');
      setAssignee(initialData.assignee || 'Equipe de TI');
      setTechnicalGroup(initialData.technicalGroup || 'Equipe de TI');
      setTagsInput((initialData.tags || []).join(', '));
    } else {
      setTitle('[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})');
      setContent(`## 💾 Verificação Diária de Backups — Tecnologia da Informação\n**Data Programada:** {data} às {hora}\n**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron\n**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.\n- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados.\n- [ ] Conferir replicação dos snapshots para o storage NAS secundário.\n- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.`);
      setFrequency('daily');
      setTime('06:30');
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setDayOfMonth(1);
      setCustomIntervalHours(24);
      setIsActive(true);
      setType(2);
      setUrgency(3);
      setImpact(3);
      setPriority(3);
      setCategoryName('TI - Backups e Armazenamento');
      setRequester('joao.leopoldino@digitronbalancas.com.br');
      setAssignee('Equipe de TI');
      setTechnicalGroup('Equipe de TI');
      setTagsInput('Backup, ERP Factory OS, Storage NAS');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const toggleDayOfWeek = (day: number) => {
    if (daysOfWeek.includes(day)) {
      if (daysOfWeek.length > 1) {
        setDaysOfWeek(daysOfWeek.filter(d => d !== day));
      }
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const insertMacro = (macro: string, target: 'title' | 'content') => {
    if (target === 'title') {
      setTitle(prev => prev + ' ' + macro);
    } else {
      setContent(prev => prev + ' ' + macro);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !content.trim()) {
      setError('Título e descrição do chamado de TI são obrigatórios');
      return;
    }

    // Front validation: scope restriction check
    const forbidden = ['balança', 'balanca', 'calibração', 'calibracao', 'pesos padrão', 'célula de carga', 'rodoviária'];
    const combined = `${title} ${content}`.toLowerCase();
    for (const term of forbidden) {
      if (combined.includes(term)) {
        setError(`Atenção: O sistema é de uso exclusivo da TI. Não são permitidos chamados de "${term}".`);
        return;
      }
    }

    setLoading(true);

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      await onSave({
        title,
        content,
        frequency,
        time,
        daysOfWeek,
        dayOfMonth: Number(dayOfMonth),
        customIntervalHours: Number(customIntervalHours),
        isActive,
        type,
        urgency,
        impact,
        priority,
        categoryId,
        categoryName,
        requester,
        assignee,
        technicalGroup,
        entityId: 0,
        tags
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar rotina de TI');
    } finally {
      setLoading(false);
    }
  };

  const weekDayLabels = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
  ];

  const macros = [
    { label: '{data}', desc: 'Ex: 20/10/2026' },
    { label: '{hora}', desc: 'Ex: 08:30' },
    { label: '{mes_ano}', desc: 'Ex: 10/2026' },
    { label: '{mes_extenso}', desc: 'Ex: Outubro' },
    { label: '{dia_semana}', desc: 'Ex: Terça-feira' },
    { label: '{semana_ano}', desc: 'Ex: Semana 43' },
    { label: '{empresa}', desc: 'Digi-Tron Balanças' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {initialData ? 'Editar Rotina de TI' : 'Nova Rotina de TI Programada'}
              </h3>
              <p className="text-xs text-slate-400">
                Lançamento autônomo restrito ao setor de Tecnologia da Informação
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Toggle between Editor and Live Preview */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPreviewTab('editor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewTab === 'editor'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Configurar Rotina
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewTab === 'preview'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Prévia com Variáveis Renderizadas
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <span>Rotina Ativa (Lançamentos Habilitados)</span>
            </label>
          </div>

          {previewTab === 'preview' ? (
            /* Live Render Preview */
            <div className="space-y-4 p-5 rounded-2xl bg-slate-950 border border-cyan-800/40">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Título que será enviado ao GLPI:
                </span>
                <h2 className="text-base font-bold text-white mt-1">
                  {replaceMacroVariables(title)}
                </h2>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                  Descrição & Checklist de TI:
                </span>
                <div className="mt-2 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
                  {replaceMacroVariables(content)}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Tipo</span>
                  <span className="font-semibold text-white">{type === 1 ? 'Incidente' : 'Requisição'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Prioridade</span>
                  <span className="font-semibold text-amber-400">{priority} de 5</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Categoria de TI</span>
                  <span className="font-semibold text-cyan-300 truncate block">{categoryName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Grupo Técnico</span>
                  <span className="font-semibold text-slate-300">{technicalGroup}</span>
                </div>
              </div>
            </div>
          ) : (
            <form id="routine-form" onSubmit={handleSubmit} className="space-y-5">
              
              {/* Routine Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Título do Chamado de TI no GLPI
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex: [TI] Verificação Diária de Backups e Integridade ({data})"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Inserir variável:
                  </span>
                  {macros.slice(0, 4).map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => insertMacro(m.label, 'title')}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurrence Settings Section */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Programação de Recorrência
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'daily', label: 'Diário' },
                    { id: 'weekly', label: 'Semanal' },
                    { id: 'biweekly', label: 'Quinzenal' },
                    { id: 'monthly', label: 'Mensal' },
                    { id: 'custom_interval', label: 'Intervalo (h)' }
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setFrequency(freq.id as RecurrenceType)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        frequency === freq.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Horário do Disparo (HH:MM)
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    />
                  </div>

                  {frequency === 'weekly' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Dias da Semana
                      </label>
                      <div className="flex items-center gap-1">
                        {weekDayLabels.map((d) => {
                          const isSelected = daysOfWeek.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => toggleDayOfWeek(d.id)}
                              className={`w-7 h-7 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {frequency === 'monthly' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Dia do Mês (1 - 31)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {frequency === 'custom_interval' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        A cada quantas horas
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={customIntervalHours}
                        onChange={(e) => setCustomIntervalHours(parseInt(e.target.value) || 12)}
                        className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Routine Content / Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Conteúdo do Chamado & Checklist Técnico de TI
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    {macros.map((m) => (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => insertMacro(m.label, 'content')}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 hover:bg-slate-700 cursor-pointer"
                        title={m.desc}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  placeholder="Escreva a descrição e procedimentos técnicos do chamado de TI..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              {/* GLPI Fields Configuration - Restricted to IT Catalog */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Parâmetros e Catálogo de TI (GLPI)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {referenceData && referenceData.categories.length > 0 ? (
                    <SearchableSelect
                      label="Categoria de TI no GLPI"
                      options={referenceData.categories.map(c => ({
                        value: c.id,
                        label: c.completeName || c.name,
                        badge: `ID: ${c.id}`
                      }))}
                      value={categoryId}
                      onChange={(val, opt) => {
                        setCategoryId(Number(val));
                        if (opt) setCategoryName(opt.label as any);
                      }}
                    />
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Categoria Exclusiva de TI
                      </label>
                      <select
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value as ItCategory)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-500"
                      >
                        {IT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {referenceData && referenceData.groups.length > 0 ? (
                    <SearchableSelect
                      label="Grupo Técnico Responsável"
                      options={referenceData.groups.map(g => ({
                        value: g.name,
                        label: g.name,
                        subLabel: g.completeName,
                        badge: `ID: ${g.id}`
                      }))}
                      value={technicalGroup}
                      onChange={(val) => setTechnicalGroup(String(val))}
                    />
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Grupo Técnico no GLPI
                      </label>
                      <input
                        type="text"
                        value={technicalGroup}
                        onChange={(e) => setTechnicalGroup(e.target.value)}
                        placeholder="Equipe de TI"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Tipo de Chamado
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(parseInt(e.target.value) as 1 | 2)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value={2}>Requisição (Rotina Preventiva TI)</option>
                      <option value={1}>Incidente (Falha / Corretiva)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Urgência
                    </label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(parseInt(e.target.value) as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value={1}>1 - Muito Baixa</option>
                      <option value={2}>2 - Baixa</option>
                      <option value={3}>3 - Média</option>
                      <option value={4}>4 - Alta</option>
                      <option value={5}>5 - Muito Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Prioridade
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(parseInt(e.target.value) as any)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value={1}>1 - Muito Baixa</option>
                      <option value={2}>2 - Baixa</option>
                      <option value={3}>3 - Média</option>
                      <option value={4}>4 - Alta</option>
                      <option value={5}>5 - Muito Alta</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {referenceData && referenceData.users.length > 0 ? (
                    <SearchableSelect
                      label="Requerente Oficial no GLPI"
                      options={referenceData.users.map(u => ({
                        value: u.email || u.name,
                        label: `${u.firstname ? `${u.firstname} ${u.realname}` : u.name} (#${u.id})`,
                        subLabel: u.email || `${u.name}@digitronbalancas.com.br`,
                        badge: u.name
                      }))}
                      value={requester}
                      onChange={(val) => setRequester(String(val))}
                    />
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Requerente de TI
                      </label>
                      <input
                        type="text"
                        value={requester}
                        onChange={(e) => setRequester(e.target.value)}
                        placeholder="joao.leopoldino@digitronbalancas.com.br"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}

                  {referenceData && referenceData.technicians.length > 0 ? (
                    <SearchableSelect
                      label="Técnico Atribuído (GLPI)"
                      options={[
                        { value: 'Equipe de TI', label: 'Equipe de TI (Pool)' },
                        ...referenceData.technicians.map(t => ({
                          value: t.firstname ? `${t.firstname} ${t.realname}` : t.name,
                          label: `${t.firstname ? `${t.firstname} ${t.realname}` : t.name} (Técnico TI)`,
                          subLabel: t.email,
                          badge: `ID: ${t.id}`
                        }))
                      ]}
                      value={assignee}
                      onChange={(val) => setAssignee(String(val))}
                    />
                  ) : (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Técnico Atribuído
                      </label>
                      <input
                        type="text"
                        value={assignee}
                        onChange={(e) => setAssignee(e.target.value)}
                        placeholder="Equipe de TI"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  )}
                </div>


                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Tags de TI (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Backup, Servidores, ERP Factory OS"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{initialData ? 'Salvar Alterações na Rotina' : 'Criar Rotina de TI'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
