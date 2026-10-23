import React, { useState, useEffect } from 'react';
import { 
  RoutineSchedule, 
  RecurrenceType, 
  IT_CATEGORIES, 
  ItCategory, 
  GlpiReferenceData, 
  TicketConferenceReport 
} from '../types';
import { replaceMacroVariables } from '../utils/scheduler';
import { SearchableSelect, SelectOption } from './SearchableSelect';
import { ConferenceReportModal } from './ConferenceReportModal';
import { api } from '../services/api';
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
  Cpu,
  RefreshCw,
  Play,
  MapPin,
  Building,
  CheckCircle2,
  Users,
  Settings
} from 'lucide-react';

interface RoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (routineData: Partial<RoutineSchedule>) => Promise<void>;
  initialData?: RoutineSchedule | null;
  referenceData?: GlpiReferenceData | null;
  onRefreshReferenceData?: () => Promise<void>;
}

export const RoutineModal: React.FC<RoutineModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  referenceData,
  onRefreshReferenceData
}) => {
  // Main form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceType>('daily');
  const [time, setTime] = useState('07:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [customIntervalHours, setCustomIntervalHours] = useState<number>(24);
  const [isActive, setIsActive] = useState<boolean>(true);

  // Classification & Scalar Fields
  const [type, setType] = useState<1 | 2>(2); // 1 = Incidente, 2 = Requisição
  const [statusId, setStatusId] = useState<number>(1); // 1 = Novo
  const [requestTypeId, setRequestTypeId] = useState<number>(6); // 6 = Outro / Agendador
  const [urgency, setUrgency] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [impact, setImpact] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [categoryId, setCategoryId] = useState<number>(1);
  const [categoryName, setCategoryName] = useState<ItCategory>('TI - Infraestrutura e Servidores');
  const [entityId, setEntityId] = useState<number>(0);
  const [locationId, setLocationId] = useState<number | undefined>(undefined);
  const [locationName, setLocationName] = useState<string>('');
  const [equipment, setEquipment] = useState<string>('');

  // Actors
  const [requesterUserId, setRequesterUserId] = useState<number | undefined>(undefined);
  const [requesterGroupId, setRequesterGroupId] = useState<number | undefined>(undefined);
  const [assignedUserId, setAssignedUserId] = useState<number | undefined>(undefined);
  const [assignedGroupId, setAssignedGroupId] = useState<number | undefined>(undefined);
  const [observerUserId, setObserverUserId] = useState<number | undefined>(undefined);
  const [observerGroupId, setObserverGroupId] = useState<number | undefined>(undefined);

  // Legacy fallback strings
  const [requester, setRequester] = useState('joao.leopoldino@digitronbalancas.com.br');
  const [assignee, setAssignee] = useState('Equipe de TI');
  const [technicalGroup, setTechnicalGroup] = useState('Equipe de TI');

  // Advanced / Extras
  const [openingDate, setOpeningDate] = useState<string>('');
  const [extraFields, setExtraFields] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('TI, Servidores, Infraestrutura');

  // UI States
  const [previewTab, setPreviewTab] = useState<'editor' | 'preview'>('editor');
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conferenceReport, setConferenceReport] = useState<TicketConferenceReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setContent(initialData.content || '');
      setFrequency(initialData.frequency || 'daily');
      setTime(initialData.time || '07:00');
      setDaysOfWeek(initialData.daysOfWeek || [1]);
      setDayOfMonth(initialData.dayOfMonth || 1);
      setCustomIntervalHours(initialData.customIntervalHours || 24);
      setIsActive(initialData.isActive !== false);
      setType(initialData.type || 2);
      setStatusId(initialData.statusId || 1);
      setRequestTypeId(initialData.requestTypeId || 6);
      setUrgency(initialData.urgency || 3);
      setImpact(initialData.impact || 3);
      setPriority(initialData.priority || 3);
      setCategoryId(initialData.categoryId || 1);
      setCategoryName(initialData.categoryName || 'TI - Infraestrutura e Servidores');
      setEntityId(initialData.entityId !== undefined ? initialData.entityId : 0);
      setLocationId(initialData.locationId);
      setLocationName(initialData.locationName || '');
      setEquipment(initialData.equipment || '');
      setRequesterUserId(initialData.requesterUserId);
      setRequesterGroupId(initialData.requesterGroupId);
      setAssignedUserId(initialData.assignedUserId);
      setAssignedGroupId(initialData.assignedGroupId);
      setObserverUserId(initialData.observerUserId);
      setObserverGroupId(initialData.observerGroupId);
      setRequester(initialData.requester || 'joao.leopoldino@digitronbalancas.com.br');
      setAssignee(initialData.assignee || 'Equipe de TI');
      setTechnicalGroup(initialData.technicalGroup || 'Equipe de TI');
      setExtraFields(initialData.extraFields || '');
      setOpeningDate(initialData.openingDate || '');
      setTagsInput((initialData.tags || []).join(', '));
    } else {
      setOpeningDate('');
      setTitle('[TI] Verificação Diária de Backups e Integridade do ERP Factory OS ({data})');
      setContent(`## 💾 Verificação Diária de Backups — Tecnologia da Informação\n**Data Programada:** {data} às {hora}\n**Setor Responsável:** Equipe de Infraestrutura e TI Digi-Tron\n**Atenção:** Este chamado solicita que o técnico realize a verificação descrita no checklist abaixo.\n\n### 📋 Checklist Técnico de Execução:\n- [ ] Conferir status de conclusão dos jobs de backup do ERP Factory OS.\n- [ ] Verificar integridade e checksum SHA-256 do dump diário do banco de dados.\n- [ ] Conferir replicação dos snapshots para o storage NAS secundário.\n- [ ] Validar que o volume de backup possui no mínimo 25% de espaço livre.`);
      setFrequency('daily');
      setTime('06:30');
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setDayOfMonth(1);
      setCustomIntervalHours(24);
      setIsActive(true);
      setType(2);
      setStatusId(1);
      setRequestTypeId(6);
      setUrgency(3);
      setImpact(3);
      setPriority(3);
      setCategoryId(1);
      setCategoryName('TI - Backups e Armazenamento');
      setEntityId(0);
      setLocationId(undefined);
      setLocationName('');
      setEquipment('Storage NAS Digi-Tron');
      setRequesterUserId(2);
      setRequesterGroupId(undefined);
      setAssignedUserId(undefined);
      setAssignedGroupId(1);
      setObserverUserId(undefined);
      setObserverGroupId(undefined);
      setRequester('joao.leopoldino@digitronbalancas.com.br');
      setAssignee('Equipe de TI');
      setTechnicalGroup('Equipe de TI');
      setExtraFields('');
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

  const handleRefresh = async () => {
    setRefreshLoading(true);
    setError(null);
    try {
      if (onRefreshReferenceData) {
        await onRefreshReferenceData();
      } else {
        await api.refreshReferenceData();
      }
    } catch (err: any) {
      setError(`Erro ao atualizar listas do GLPI: ${err.message}`);
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleTestTicket = async () => {
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError('Preencha o título e o conteúdo antes de testar a criação no GLPI.');
      return;
    }

    setTestLoading(true);
    try {
      const report = await api.testTicket({
        title,
        description: content,
        content,
        categoryId,
        categoryName,
        entityId,
        type,
        statusId,
        urgency,
        impact,
        priority,
        locationId,
        requestTypeId,
        requesterUserId,
        requesterGroupId,
        assignedUserId,
        assignedGroupId,
        observerUserId,
        observerGroupId,
        extraFields,
        equipment,
        openingDate: openingDate || undefined
      });

      setConferenceReport(report);
      setShowReportModal(true);
    } catch (err: any) {
      setError(`Falha no teste de criação de chamado: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !content.trim()) {
      setError('Título e descrição do chamado de TI são obrigatórios');
      return;
    }

    // Validação estrita de IDs numéricos contra o GLPI ao vivo
    if (referenceData && referenceData.isLive) {
      if (categoryId && !referenceData.categories.some(c => c.id === Number(categoryId))) {
        setError(`O campo Categoria com ID [${categoryId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (locationId && !referenceData.locations.some(l => l.id === Number(locationId))) {
        setError(`O campo Localização com ID [${locationId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (requesterUserId && !referenceData.users.some(u => u.id === Number(requesterUserId))) {
        setError(`O campo Requerente (Usuário) com ID [${requesterUserId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (assignedUserId && !referenceData.users.some(u => u.id === Number(assignedUserId))) {
        setError(`O campo Técnico Atribuído com ID [${assignedUserId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (assignedGroupId && !referenceData.groups.some(g => g.id === Number(assignedGroupId))) {
        setError(`O campo Grupo Atribuído com ID [${assignedGroupId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (requesterGroupId && !referenceData.groups.some(g => g.id === Number(requesterGroupId))) {
        setError(`O campo Grupo Requerente com ID [${requesterGroupId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (observerUserId && !referenceData.users.some(u => u.id === Number(observerUserId))) {
        setError(`O campo Observador (Usuário) com ID [${observerUserId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
      if (observerGroupId && !referenceData.groups.some(g => g.id === Number(observerGroupId))) {
        setError(`O campo Observador (Grupo) com ID [${observerGroupId}] não existe no GLPI. Clique em "Atualizar Listas GLPI".`);
        return;
      }
    }

    // Anti-slop / Scope restriction
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
        statusId,
        requestTypeId,
        urgency,
        impact,
        priority,
        categoryId,
        categoryName,
        entityId,
        locationId,
        locationName,
        equipment,
        requesterUserId,
        requesterGroupId,
        assignedUserId,
        assignedGroupId,
        observerUserId,
        observerGroupId,
        requester,
        assignee,
        technicalGroup,
        extraFields,
        openingDate: openingDate || undefined,
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

  // Options prepared for SearchableSelect
  const entityOptions: SelectOption[] = (referenceData?.entities || [
    { id: 0, name: 'Entidade Raiz', completeName: 'Entidade Raiz' }
  ]).map(e => ({
    value: e.id,
    label: e.completeName || e.completename || e.name,
    badge: `ID: ${e.id}`
  }));

  // Categories filtered or badged by type
  const categoryOptions: SelectOption[] = (referenceData?.categories || []).map(c => {
    const isApplicable = (type === 1 && (c.isIncident ?? c.is_incident !== 0)) || (type === 2 && (c.isRequest ?? c.is_request !== 0));
    return {
      value: c.id,
      label: c.completeName || c.completename || c.name,
      subLabel: isApplicable ? (type === 1 ? 'Aplicável para Incidentes' : 'Aplicável para Requisições') : 'Geral',
      badge: `ID: ${c.id}`
    };
  });

  const locationOptions: SelectOption[] = [
    { value: '', label: 'Nenhuma / Padrão da Entidade' },
    ...(referenceData?.locations || []).map(l => ({
      value: l.id,
      label: l.completeName || l.completename || l.name,
      badge: `ID: ${l.id}`
    }))
  ];

  const requestTypeOptions: SelectOption[] = (referenceData?.requestTypes || [
    { id: 1, name: 'Helpdesk' },
    { id: 2, name: 'E-mail' },
    { id: 3, name: 'Telefone' },
    { id: 4, name: 'Direta' },
    { id: 5, name: 'Escrita' },
    { id: 6, name: 'Outro (Agendador Automático)' }
  ]).map(rt => ({
    value: rt.id,
    label: rt.name,
    badge: `ID: ${rt.id}`
  }));

  const userOptions: SelectOption[] = [
    { value: '', label: 'Nenhum / Não atribuir' },
    ...(referenceData?.users || []).map(u => ({
      value: u.id,
      label: `${u.firstname ? `${u.firstname} ${u.realname}` : u.name} (${u.name}) - #${u.id}`,
      subLabel: u.email || `${u.name}@digitronbalancas.com.br`,
      badge: `ID: ${u.id}`
    }))
  ];

  const groupOptions: SelectOption[] = [
    { value: '', label: 'Nenhum / Não atribuir' },
    ...(referenceData?.groups || []).map(g => ({
      value: g.id,
      label: `${g.completeName || g.completename || g.name} - #${g.id}`,
      badge: `ID: ${g.id}`
    }))
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
          
          {/* Modal Header */}
          <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {initialData ? 'Editar Rotina de TI Recorrente' : 'Nova Rotina de TI Programada'}
                </h3>
                <p className="text-xs text-slate-400">
                  Criação no GLPI via API REST com IDs numéricos reais e validação em etapas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                title="Atualizar listas de Usuários, Categorias, Grupos e Localizações do GLPI"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshLoading ? 'animate-spin text-cyan-400' : ''}`} />
                <span className="hidden sm:inline">Atualizar Listas GLPI</span>
              </button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Editor da Rotina
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    previewTab === 'preview'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Pré-visualização Dinâmica
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-900 cursor-pointer"
                  />
                  <span>Rotina Ativa (Auto-Disparo)</span>
                </label>
              </div>
            </div>

            {previewTab === 'preview' ? (
              <div className="space-y-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Chamado Resolvido como Chegará ao GLPI:</span>
                </div>
                
                <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-4 space-y-3 font-sans">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Título</span>
                    <h4 className="text-sm font-bold text-white mt-0.5">
                      {replaceMacroVariables(title)}
                    </h4>
                  </div>
                  
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Descrição Formatada</span>
                    <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-950/80 p-3 rounded-lg border border-slate-800 mt-1 leading-relaxed">
                      {replaceMacroVariables(content)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Tipo:</span>
                      <span className="text-white font-medium">{type === 1 ? 'Incidente' : 'Requisição'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status:</span>
                      <span className="text-white font-medium">Novo (ID {statusId})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Origem:</span>
                      <span className="text-white font-medium">ID {requestTypeId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Entidade / Fuso:</span>
                      <span className="text-cyan-400 font-medium">ID {entityId} (SP UTC-3)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Routine Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Título do Chamado no GLPI *
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Macros:</span>
                      {macros.slice(0, 4).map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          onClick={() => insertMacro(m.label, 'title')}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-300 hover:bg-slate-700 cursor-pointer"
                          title={m.desc}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Ex: [TI] Backup Diário do ERP Factory OS ({data})"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* 2. Recurrence Configuration */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Agendamento & Frequência de Execução
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Periodicidade
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as RecurrenceType)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="custom_interval">Intervalo de Horas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Horário do Disparo (HH:MM - SP)
                      </label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>

                    {frequency === 'weekly' && (
                      <div className="sm:col-span-2">
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
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
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
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Data e hora de abertura específica / programada */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Data e hora de abertura (Opcional)
                    </label>
                    <input
                      type="datetime-local"
                      value={openingDate}
                      onChange={(e) => setOpeningDate(e.target.value)}
                      className="w-full sm:w-80 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Se vazio, usa a hora programada da rotina (agendada) ou a hora atual (execução manual).
                    </p>
                  </div>
                </div>

                {/* 3. Routine Content / Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Conteúdo do Chamado & Checklist Técnico de TI *
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
                    rows={5}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    placeholder="Escreva a descrição e procedimentos técnicos do chamado de TI..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
                  />
                </div>

                {/* 4. Classification & Location (GLPI Entities, Categories, Locations) */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Classificação, Entidade & Localização no GLPI
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      IDs numéricos reais validados
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <SearchableSelect
                      label="Entidade GLPI (/Entity)"
                      options={entityOptions}
                      value={entityId}
                      onChange={(val) => setEntityId(Number(val))}
                    />

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Tipo de Chamado
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(parseInt(e.target.value) as 1 | 2)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value={2}>2 - Requisição (Rotina Preventiva TI)</option>
                        <option value={1}>1 - Incidente (Falha / Corretiva)</option>
                      </select>
                    </div>

                    <SearchableSelect
                      label="Categoria ITIL (/ITILCategory)"
                      options={categoryOptions}
                      value={categoryId}
                      onChange={(val, opt) => {
                        setCategoryId(Number(val));
                        if (opt) setCategoryName(opt.label as any);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Status do Chamado
                      </label>
                      <select
                        value={statusId}
                        onChange={(e) => setStatusId(parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value={1}>1 - Novo</option>
                        <option value={2}>2 - Em atendimento (atribuído)</option>
                        <option value={3}>3 - Planejado</option>
                        <option value={4}>4 - Pendente</option>
                        <option value={5}>5 - Solucionado</option>
                        <option value={6}>6 - Fechado</option>
                      </select>
                    </div>

                    <SearchableSelect
                      label="Origem da Requisição (/RequestType)"
                      options={requestTypeOptions}
                      value={requestTypeId}
                      onChange={(val) => setRequestTypeId(Number(val))}
                    />

                    <SearchableSelect
                      label="Localização Física (/Location)"
                      options={locationOptions}
                      value={locationId ?? ''}
                      onChange={(val, opt) => {
                        setLocationId(val ? Number(val) : undefined);
                        if (opt) setLocationName(opt.label);
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        Impacto
                      </label>
                      <select
                        value={impact}
                        onChange={(e) => setImpact(parseInt(e.target.value) as any)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value={1}>1 - Muito Baixo</option>
                        <option value={2}>2 - Baixo</option>
                        <option value={3}>3 - Médio</option>
                        <option value={4}>4 - Alto</option>
                        <option value={5}>5 - Muito Alto</option>
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

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Equipamento / Ativo de TI
                    </label>
                    <input
                      type="text"
                      value={equipment}
                      onChange={(e) => setEquipment(e.target.value)}
                      placeholder="Ex: Servidor SRV-PROD-01 / Storage NAS / Roteador Core"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                {/* 5. Actors (Ticket_User / Group_Ticket Sync) */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-violet-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Atores do Chamado (Requerente, Atribuído & Observador)
                      </h4>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Garante remoção automática do dono do token
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableSelect
                      label="Requerente Usuário (/User - Tipo 1)"
                      options={userOptions}
                      value={requesterUserId ?? ''}
                      onChange={(val) => setRequesterUserId(val ? Number(val) : undefined)}
                    />

                    <SearchableSelect
                      label="Requerente Grupo (/Group - Tipo 1)"
                      options={groupOptions}
                      value={requesterGroupId ?? ''}
                      onChange={(val) => setRequesterGroupId(val ? Number(val) : undefined)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableSelect
                      label="Técnico Atribuído (/User - Tipo 2)"
                      options={userOptions}
                      value={assignedUserId ?? ''}
                      onChange={(val) => setAssignedUserId(val ? Number(val) : undefined)}
                    />

                    <SearchableSelect
                      label="Grupo Atribuído (/Group - Tipo 2)"
                      options={groupOptions}
                      value={assignedGroupId ?? ''}
                      onChange={(val) => setAssignedGroupId(val ? Number(val) : undefined)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SearchableSelect
                      label="Observador Usuário (/User - Tipo 3)"
                      options={userOptions}
                      value={observerUserId ?? ''}
                      onChange={(val) => setObserverUserId(val ? Number(val) : undefined)}
                    />

                    <SearchableSelect
                      label="Observador Grupo (/Group - Tipo 3)"
                      options={groupOptions}
                      value={observerGroupId ?? ''}
                      onChange={(val) => setObserverGroupId(val ? Number(val) : undefined)}
                    />
                  </div>
                </div>

                {/* 6. Extra Fields & Tags */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Campos Extras & Tags de TI
                    </h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Campos Extras do GLPI (formato chave=valor, um por linha)
                    </label>
                    <textarea
                      rows={2}
                      value={extraFields}
                      onChange={(e) => setExtraFields(e.target.value)}
                      placeholder="time_to_resolve=2026-12-31 18:00:00&#10;sla_id=2"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Tags de Identificação (separadas por vírgula)
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
          <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleTestTicket}
                disabled={testLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                title="Cria um chamado de teste no GLPI e abre o relatório de conferência"
              >
                {testLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Testar Chamado</span>
              </button>
            </div>

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

      {/* Conference Report Modal */}
      <ConferenceReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        report={conferenceReport}
      />
    </>
  );
};
