import React, { useState, useEffect } from 'react';
import { 
  GlpiReferenceData, 
  CreateGlpiTicketPayload,
  TicketConferenceReport 
} from '../types';
import { SearchableSelect, SelectOption } from './SearchableSelect';
import { ConferenceReportModal } from './ConferenceReportModal';
import { replaceMacroVariables } from '../utils/scheduler';
import { 
  Ticket, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  Cpu, 
  FileText, 
  Layers, 
  Send, 
  RefreshCw,
  HardDrive,
  FileCheck
} from 'lucide-react';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceData: GlpiReferenceData | null;
  onTicketCreated?: (ticketId: number, ticketUrl: string) => void;
  onSubmitTicket: (payload: CreateGlpiTicketPayload) => Promise<{ 
    success: boolean; 
    ticketId: number; 
    ticketUrl: string; 
    message: string;
    report?: TicketConferenceReport;
    warnings?: string[];
  }>;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  referenceData,
  onTicketCreated,
  onSubmitTicket
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [requesterId, setRequesterId] = useState<number>(2);
  const [groupId, setGroupId] = useState<number>(1);
  const [technicianId, setTechnicianId] = useState<number | undefined>(undefined);
  const [entityId, setEntityId] = useState<number>(0);
  const [type, setType] = useState<1 | 2>(2); // 2 = Requisição
  const [urgency, setUrgency] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [impact, setImpact] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [locationId, setLocationId] = useState<number | undefined>(undefined);
  const [requestTypeId, setRequestTypeId] = useState<number>(6);
  const [equipment, setEquipment] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<{ id: number; url: string; msg: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [conferenceReport, setConferenceReport] = useState<TicketConferenceReport | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Initialize defaults from referenceData
  useEffect(() => {
    if (referenceData) {
      if (referenceData.categories.length > 0 && !categoryId) {
        setCategoryId(referenceData.categories[0].id);
      }
      if (referenceData.users.length > 0 && !requesterId) {
        setRequesterId(referenceData.users[0].id);
      }
      if (referenceData.groups.length > 0 && !groupId) {
        setGroupId(referenceData.groups[0].id);
      }
    }
  }, [referenceData]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setTitle('[TI] Verificação Preventiva de Infraestrutura ({data})');
      setDescription(
        `## 🛠️ Chamado de TI — Digi-Tron Balanças\n` +
        `**Data de Abertura:** {data} às {hora}\n` +
        `**Responsável Técnico:** Equipe de Tecnologia da Informação\n\n` +
        `### Descrição da Demanda:\n` +
        `- [ ] Verificação de conectividade e status dos links de rede.\n` +
        `- [ ] Conferência de integridade dos serviços do ERP Factory OS.\n` +
        `- [ ] Validação de rotinas preventivas de TI.`
      );
      setError(null);
      setCreatedSuccess(null);
      setShowConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Options formatting
  const requesterOptions: SelectOption[] = (referenceData?.users || []).map((u) => ({
    value: u.id,
    label: `${u.firstname ? `${u.firstname} ${u.realname}` : u.name} (#${u.id})`,
    subLabel: u.email || `${u.name}@digitronbalancas.com.br`,
    badge: u.name
  }));

  const categoryOptions: SelectOption[] = (referenceData?.categories || []).map((c) => ({
    value: c.id,
    label: c.completeName || c.name,
    badge: `ID: ${c.id}`
  }));

  const groupOptions: SelectOption[] = (referenceData?.groups || []).map((g) => ({
    value: g.id,
    label: g.name,
    subLabel: g.completeName !== g.name ? g.completeName : undefined,
    badge: `ID: ${g.id}`
  }));

  const technicianOptions: SelectOption[] = [
    { value: '', label: 'Sem técnico atribuído imediatamente' },
    ...(referenceData?.technicians || []).map((t) => ({
      value: t.id,
      label: `${t.firstname ? `${t.firstname} ${t.realname}` : t.name} (Técnico TI)`,
      subLabel: t.email,
      badge: `ID: ${t.id}`
    }))
  ];

  const entityOptions: SelectOption[] = (referenceData?.entities || []).map((e) => ({
    value: e.id,
    label: e.completeName || e.name,
    badge: `Entidade ${e.id}`
  }));

  const locationOptions: SelectOption[] = [
    { value: '', label: 'Nenhuma / Padrão da Entidade' },
    ...(referenceData?.locations || []).map((l) => ({
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
  ]).map((rt) => ({
    value: rt.id,
    label: rt.name,
    badge: `ID: ${rt.id}`
  }));

  const handleInsertMacro = (macro: string) => {
    setTitle((prev) => prev + ' ' + macro);
  };

  const handleValidateAndOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const renderedTitle = replaceMacroVariables(title);
    const renderedDesc = replaceMacroVariables(description);

    if (!renderedTitle.trim() || !renderedDesc.trim()) {
      setError('Título e descrição do chamado de TI são obrigatórios.');
      return;
    }

    // Strict IT scope validation
    const forbidden = [
      'balança', 'balanca', 'calibração', 'calibracao', 'pesos padrão',
      'célula de carga', 'celula de carga', 'rodoviária', 'metrologia'
    ];
    const combined = `${renderedTitle} ${renderedDesc}`.toLowerCase();
    for (const term of forbidden) {
      if (combined.includes(term)) {
        setError(`Atenção: O sistema é restrito à Tecnologia da Informação (TI). Termo proibido detectado: "${term}".`);
        return;
      }
    }

    setShowConfirm(true);
  };

  const handleExecuteCreation = async () => {
    setLoading(true);
    setError(null);

    const selectedCategory = referenceData?.categories.find((c) => c.id === categoryId);
    const selectedRequester = referenceData?.users.find((u) => u.id === requesterId);
    const selectedGroup = referenceData?.groups.find((g) => g.id === groupId);
    const selectedTech = referenceData?.technicians.find((t) => t.id === technicianId);

    const payload: CreateGlpiTicketPayload = {
      title: replaceMacroVariables(title),
      description: replaceMacroVariables(description),
      categoryId,
      categoryName: selectedCategory?.name || 'TI - Infraestrutura e Servidores',
      requesterId,
      requesterName: selectedRequester?.name,
      groupId,
      groupName: selectedGroup?.name || 'Equipe de TI',
      technicianId: technicianId || undefined,
      technicianName: selectedTech?.name,
      entityId,
      type,
      urgency,
      impact,
      priority,
      locationId,
      requestTypeId,
      equipment: equipment.trim() || undefined
    };

    try {
      const res = await onSubmitTicket(payload);
      if (res.success) {
        if (res.report) {
          setConferenceReport(res.report);
        }
        setCreatedSuccess({
          id: res.ticketId,
          url: res.ticketUrl,
          msg: res.message
        });
        if (onTicketCreated) {
          onTicketCreated(res.ticketId, res.ticketUrl);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar chamado no GLPI');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-fade-in">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Abertura de Chamado Real no GLPI
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {referenceData?.isLive ? 'GLPI Ao Vivo' : 'Catálogo TI'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lançamento manual com seleção de Requerente, Categoria e Grupos oficiais do GLPI
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {createdSuccess ? (
            /* Success confirmation screen */
            <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-700/50 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Chamado de TI #{createdSuccess.id} Criado com Sucesso!
                </h4>
                <p className="text-xs text-emerald-300/80 mt-1">
                  O chamado foi validado, persistido no banco de dados do GLPI e atribuído ao grupo de TI.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {conferenceReport && (
                  <button
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    className="px-4 py-2 rounded-xl bg-violet-600/30 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Ver Relatório de Conferência</span>
                  </button>
                )}
                <a
                  href={createdSuccess.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-500/20"
                >
                  <span>Abrir Chamado no GLPI</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setCreatedSuccess(null);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : (
            <form id="create-ticket-form" onSubmit={handleValidateAndOpenConfirm} className="space-y-4">
              
              {/* Row 1: Requester & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SearchableSelect
                  label="Requerente Oficial no GLPI"
                  required
                  placeholder="Pesquise o usuário por nome, login ou e-mail..."
                  searchPlaceholder="Digite o nome, login ou e-mail do requerente..."
                  options={requesterOptions}
                  value={requesterId}
                  onChange={(val) => setRequesterId(Number(val))}
                />

                <SearchableSelect
                  label="Categoria de TI no GLPI"
                  required
                  placeholder="Pesquise a categoria no catálogo de TI..."
                  searchPlaceholder="Ex: Infraestrutura, Backups, Redes, ERP..."
                  options={categoryOptions}
                  value={categoryId}
                  onChange={(val) => setCategoryId(Number(val))}
                />
              </div>

              {/* Row 2: Group, Technician & Entity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SearchableSelect
                  label="Grupo Técnico Atribuído"
                  required
                  options={groupOptions}
                  value={groupId}
                  onChange={(val) => setGroupId(Number(val))}
                />

                <SearchableSelect
                  label="Técnico Responsável (Opcional)"
                  options={technicianOptions}
                  value={technicianId}
                  onChange={(val) => setTechnicianId(val ? Number(val) : undefined)}
                />

                {entityOptions.length > 1 ? (
                  <SearchableSelect
                    label="Entidade GLPI"
                    options={entityOptions}
                    value={entityId}
                    onChange={(val) => setEntityId(Number(val))}
                  />
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Entidade
                    </label>
                    <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono">
                      Digi-Tron Matriz (ID: 0)
                    </div>
                  </div>
                )}
              </div>

              {/* Row 2.5: Location & Request Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SearchableSelect
                  label="Localização Física (/Location)"
                  options={locationOptions}
                  value={locationId ?? ''}
                  onChange={(val) => setLocationId(val ? Number(val) : undefined)}
                />

                <SearchableSelect
                  label="Origem da Solicitação (/RequestType)"
                  options={requestTypeOptions}
                  value={requestTypeId}
                  onChange={(val) => setRequestTypeId(Number(val))}
                />
              </div>

              {/* Row 3: ITIL Fields (Type, Priority, Urgency, Impact) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Tipo de Chamado
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(Number(e.target.value) as 1 | 2)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    <option value={2}>Requisição (Rotina TI)</option>
                    <option value={1}>Incidente (Falha / Corretiva)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Urgência
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
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
                    onChange={(e) => setImpact(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
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
                    onChange={(e) => setPriority(Number(e.target.value) as any)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-amber-300 font-semibold"
                  >
                    <option value={1}>1 - Muito Baixa</option>
                    <option value={2}>2 - Baixa</option>
                    <option value={3}>3 - Média</option>
                    <option value={4}>4 - Alta</option>
                    <option value={5}>5 - Muito Alta</option>
                  </select>
                </div>
              </div>

              {/* Title with Macro helper */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Título do Chamado <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: [TI] Manutenção e Verificação Preventiva ({data})"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />

                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" /> Variáveis dinâmicas:
                  </span>
                  {['{data}', '{hora}', '{mes_ano}', '{dia_semana}'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleInsertMacro(m)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Content */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descrição Detalhada & Procedimentos <span className="text-cyan-400">*</span>
                </label>
                <textarea
                  rows={5}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva detalhadamente a solicitação ou manutenção técnica de TI..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              {/* Optional Equipment / IT Asset */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  Equipamento / Ativo de TI Associado (Opcional)
                </label>
                <input
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Ex: Servidor SRV-PROD-01 / Storage NAS-02 / Switch SW-CORE"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Footer Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Validação estrita de escopo restrita ao setor de TI
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Revisar e Criar no GLPI</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirmar Abertura de Chamado</h3>
                  <p className="text-xs text-slate-400">Ambiente GLPI Digi-Tron TI</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Título</span>
                  <p className="font-semibold text-white">{replaceMacroVariables(title)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Categoria</span>
                    <span className="text-cyan-300 font-medium">
                      {referenceData?.categories.find((c) => c.id === categoryId)?.name || 'TI'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Requerente</span>
                    <span className="text-slate-200 font-medium">
                      {referenceData?.users.find((u) => u.id === requesterId)?.name || 'TI'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Este chamado será registrado na API REST do GLPI usando os identificadores numéricos oficiais. Confirmar envio?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Voltar e Editar
                </button>

                <button
                  type="button"
                  onClick={handleExecuteCreation}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Registrando no GLPI...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmar Abertura</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Conference Report Modal */}
      <ConferenceReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        report={conferenceReport}
      />
    </div>
  );
};
