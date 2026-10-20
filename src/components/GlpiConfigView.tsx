import React, { useState, useEffect } from 'react';
import { GlpiConfig, RuntimeEnvironment, ConnectionTestResponse } from '../types';
import { api } from '../services/api';
import { 
  Server, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Link, 
  Check,
  Terminal,
  Network,
  Users,
  Cloud,
  Laptop,
  Box,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';

interface GlpiConfigViewProps {
  config: GlpiConfig;
  onUpdateConfig: (updated: Partial<GlpiConfig>) => Promise<void>;
}

export const GlpiConfigView: React.FC<GlpiConfigViewProps> = ({ config, onUpdateConfig }) => {
  const [url, setUrl] = useState(config.url || 'http://localhost:8080/apirest.php');
  const [authType, setAuthType] = useState<'user_token' | 'credentials'>(config.authType || 'user_token');
  const [appToken, setAppToken] = useState(config.appToken || '');
  const [userToken, setUserToken] = useState(config.userToken || '');
  const [username, setUsername] = useState(config.username || 'joao.leopoldino');
  const [password, setPassword] = useState(config.password || '');
  const [entityId, setEntityId] = useState(config.entityId ?? 0);
  const [defaultItGroupName, setDefaultItGroupName] = useState(config.defaultItGroupName || 'Equipe de TI');
  const [defaultItGroupId, setDefaultItGroupId] = useState(config.defaultItGroupId ?? 1);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [environment, setEnvironment] = useState<RuntimeEnvironment | null>(null);

  const [showTestTicketModal, setShowTestTicketModal] = useState(false);
  const [creatingTestTicket, setCreatingTestTicket] = useState(false);
  const [testTicketResult, setTestTicketResult] = useState<{ ticketId: number; message: string; ticketUrl?: string } | null>(null);
  const [testTicketError, setTestTicketError] = useState<string | null>(null);

  const handleCreateTestTicket = async () => {
    setCreatingTestTicket(true);
    setTestTicketError(null);
    setTestTicketResult(null);
    try {
      const res = await api.testCreateRealTicket();
      setTestTicketResult(res);
    } catch (err: any) {
      setTestTicketError(err.message || 'Falha ao criar chamado de teste no GLPI');
    } finally {
      setCreatingTestTicket(false);
    }
  };

  useEffect(() => {
    api.getEnvironment().then(res => {
      if (res && res.environment) {
        setEnvironment(res.environment);
      }
    }).catch(err => {
      console.warn('Não foi possível obter diagnóstico do ambiente:', err);
    });
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleFixCentralPhp = () => {
    const fixed = url.replace(/\/front\/central\.php.*$/, '/apirest.php').replace(/\/front\/.*$/, '/apirest.php');
    setUrl(fixed.endsWith('/apirest.php') ? fixed : `${fixed.replace(/\/+$/, '')}/apirest.php`);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateConfig({
        url,
        authType,
        appToken,
        userToken,
        username,
        password,
        entityId: Number(entityId),
        defaultItGroupName,
        defaultItGroupId: Number(defaultItGroupId)
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await api.testGlpiConnection({
        url,
        authType,
        appToken,
        userToken,
        username,
        password,
        entityId: Number(entityId),
        defaultItGroupName,
        defaultItGroupId: Number(defaultItGroupId)
      });
      setTestResult(res);
      if (res.environment) {
        setEnvironment(res.environment);
      }
      if (!res.success && res.error) {
        setTestError(res.error);
      }
    } catch (err: any) {
      setTestError(err.message || 'Falha ao conectar com o GLPI');
    } finally {
      setTesting(false);
    }
  };

  const isConnected = config.connectionStatus === 'connected';
  const hasCentralPhp = url.toLowerCase().includes('/front/central.php') || url.toLowerCase().includes('/front/');
  const isLocalhostTarget = url.includes('localhost') || url.includes('127.0.0.1');

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Server className="w-6 h-6 text-cyan-400" />
            Parâmetros de Conexão com o GLPI Local da TI
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Configuração da API REST oficial (<code>/apirest.php</code>), porta 8080, credenciais e diagnóstico de rede.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> : <RefreshCw className="w-4 h-4 text-cyan-400" />}
            <span>Testar Conexão Real (Leitura)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTestTicketResult(null);
              setTestTicketError(null);
              setShowTestTicketModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold border border-cyan-700/60 transition-colors cursor-pointer shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Testar Criação de Chamado</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'Salvo com Sucesso!' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </div>

      {/* Backend Runtime Environment Diagnostic Card */}
      {environment && (
        <div className={`p-4 sm:p-5 rounded-2xl border text-xs space-y-3 transition-all ${
          environment.isCloud
            ? 'bg-sky-950/30 border-sky-800/60 text-sky-200'
            : environment.isDocker
            ? 'bg-purple-950/30 border-purple-800/60 text-purple-200'
            : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              {environment.isCloud ? (
                <Cloud className="w-5 h-5 text-sky-400 shrink-0" />
              ) : environment.isDocker ? (
                <Box className="w-5 h-5 text-purple-400 shrink-0" />
              ) : (
                <Laptop className="w-5 h-5 text-emerald-400 shrink-0" />
              )}
              <span>Onde o Backend está Executando: {environment.title}</span>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 w-fit ${
              environment.isCloud
                ? 'bg-sky-900/60 text-sky-300 border border-sky-700/60'
                : environment.isDocker
                ? 'bg-purple-900/60 text-purple-300 border border-purple-700/60'
                : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
            }`}>
              Plataforma: {environment.platform} ({environment.serviceName})
            </span>
          </div>

          <p className="text-slate-300 leading-relaxed">
            {environment.description}
          </p>

          {/* Special guidance when running on cloud and targeting localhost */}
          {environment.isCloud && isLocalhostTarget && (
            <div className="mt-2 p-3 rounded-xl bg-slate-950/70 border border-sky-800/40 space-y-2 text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-sky-300 text-[11px]">
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Como conectar o GLPI local (porta 8080 do seu Windows) com este ambiente em nuvem:</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="font-bold text-white text-[11px] block">Opção A: Executar o Projeto Localmente</span>
                  <p className="text-[10px] text-slate-400">
                    Ao rodar o agendador no mesmo computador do GLPI, <code>http://localhost:8080/apirest.php</code> funciona direto e sem túnel.
                  </p>
                  <div className="flex items-center justify-between bg-black/60 px-2 py-1 rounded font-mono text-[10px] text-cyan-300">
                    <span>npm run dev</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('npm run dev', 'cmd_dev')}
                      className="text-slate-400 hover:text-white"
                      title="Copiar comando"
                    >
                      {copiedText === 'cmd_dev' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="font-bold text-white text-[11px] block">Opção B: Túnel Seguro com Cloudflare ou ngrok</span>
                  <p className="text-[10px] text-slate-400">
                    Abra o terminal no Windows onde o GLPI está na porta 8080 e execute:
                  </p>
                  <div className="flex items-center justify-between bg-black/60 px-2 py-1 rounded font-mono text-[10px] text-amber-300">
                    <span>cloudflared tunnel --url http://localhost:8080</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('cloudflared tunnel --url http://localhost:8080', 'cmd_tunnel')}
                      className="text-slate-400 hover:text-white"
                      title="Copiar comando"
                    >
                      {copiedText === 'cmd_tunnel' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">Cole a URL pública gerada no campo abaixo (com <code>/apirest.php</code>).</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection Status Banner */}
      <div className={`p-5 rounded-3xl border shadow-xl flex items-center justify-between gap-4 ${
        isConnected
          ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-300'
          : config.connectionStatus === 'pending_configuration'
          ? 'bg-amber-950/20 border-amber-700/40 text-amber-300'
          : 'bg-rose-950/20 border-rose-700/40 text-rose-300'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            isConnected
              ? 'bg-emerald-500/20 text-emerald-400'
              : config.connectionStatus === 'pending_configuration'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-rose-500/20 text-rose-400'
          }`}>
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">
                {isConnected
                  ? 'Conexão Real Estabelecida com o GLPI'
                  : config.connectionStatus === 'pending_configuration'
                  ? 'Configuração Pendente de Preenchimento'
                  : 'GLPI Não Acessível / Desconectado'}
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isConnected
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : config.connectionStatus === 'pending_configuration'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {isConnected ? 'Verificado' : config.connectionStatus === 'pending_configuration' ? 'Pendente' : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {isConnected
                ? `Autenticação validada no GLPI. Perfil ativo: ${config.activeProfile || 'Técnico TI'}. Sessões criadas e encerradas com integridade.`
                : config.connectionStatus === 'pending_configuration'
                ? 'Insira o App-Token e User-Token abaixo e clique em "Testar Conexão Real".'
                : config.lastErrorMessage || 'O servidor GLPI não respondeu à solicitação. Verifique se o endereço é acessível e se os tokens estão corretos.'}
            </p>
          </div>
        </div>

        {config.lastCheck && (
          <div className="text-right text-[11px] text-slate-400 shrink-0 hidden md:block">
            <span>Última verificação:</span>
            <div className="font-mono text-slate-300">{new Date(config.lastCheck).toLocaleString('pt-BR')}</div>
          </div>
        )}
      </div>

      {/* Real Step-by-Step Diagnostic Result Box */}
      {(testResult || testError) && (
        <div className={`p-5 rounded-2xl border shadow-xl space-y-4 animate-fade-in ${
          testResult?.success
            ? 'bg-slate-900 border-emerald-800/60'
            : 'bg-slate-900 border-rose-800/60'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              {testResult?.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300">Diagnóstico de Conexão Real: Sucesso Completo!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span className="text-rose-300">Diagnóstico de Conexão Real: Erro na Verificação</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                Chamados Criados: 0 (Diagnóstico Seguro)
              </span>
              {testResult?.latencyMs !== undefined && (
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/40">
                  Latência: {testResult.latencyMs}ms
                </span>
              )}
            </div>
          </div>

          {/* Diagnostic Steps List */}
          {testResult?.steps && testResult.steps.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Etapas Executadas no Teste Real:
              </span>
              {testResult.steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    step.status === 'ok'
                      ? 'bg-slate-950/80 border-slate-800'
                      : step.status === 'warning'
                      ? 'bg-amber-950/20 border-amber-800/40'
                      : 'bg-rose-950/30 border-rose-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {step.status === 'ok' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : step.status === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-200">{step.name}</span>
                  </div>
                  <span className={`font-mono text-[11px] max-w-md ${
                    step.status === 'ok'
                      ? 'text-slate-400'
                      : step.status === 'warning'
                      ? 'text-amber-300'
                      : 'text-rose-300'
                  }`}>
                    {step.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error Message Details */}
          {testError && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs space-y-1">
              <strong className="block text-rose-200">Motivo da Falha:</strong>
              <p className="leading-relaxed">{testError}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        
        {/* URL Endpoint Field with Central.php Guard & Presets */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-cyan-400" />
              URL Base da API REST do GLPI (Porta 8080)
            </span>
            <span className="text-[10px] text-cyan-400 font-normal">
              Endpoint REST oficial: <code>/apirest.php</code>
            </span>
          </label>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="http://localhost:8080/apirest.php"
            className={`w-full px-4 py-2.5 bg-slate-950 border rounded-xl text-sm text-white placeholder-slate-500 font-mono focus:outline-none ${
              hasCentralPhp ? 'border-amber-500 focus:border-amber-400' : 'border-slate-700/80 focus:border-cyan-500'
            }`}
          />

          {/* Interactive Central.php Guard Warning */}
          {hasCentralPhp && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Você digitou <code>/front/central.php</code> (interface web). A API REST requer <code>/apirest.php</code>.
                </span>
              </div>
              <button
                type="button"
                onClick={handleFixCentralPhp}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-colors"
              >
                Corrigir para /apirest.php
              </button>
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-500 mr-1">Atalhos de Endereço:</span>
            <button
              type="button"
              onClick={() => setUrl('http://localhost:8080/apirest.php')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition-colors"
            >
              http://localhost:8080/apirest.php (Local)
            </button>
            <button
              type="button"
              onClick={() => setUrl('http://host.docker.internal:8080/apirest.php')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition-colors"
            >
              host.docker.internal:8080 (Docker)
            </button>
            <button
              type="button"
              onClick={() => setUrl('http://192.168.1.100:8080/apirest.php')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono border border-slate-700 transition-colors"
            >
              IP LAN Exemplo
            </button>
          </div>
        </div>

        {/* Group and Entity Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              Grupo Técnico de TI
            </label>
            <input
              type="text"
              value={defaultItGroupName}
              onChange={(e) => setDefaultItGroupName(e.target.value)}
              placeholder="Equipe de TI"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Nome do grupo no GLPI</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              ID do Grupo no GLPI (_groups_id_assign)
            </label>
            <input
              type="number"
              min={1}
              value={defaultItGroupId}
              onChange={(e) => setDefaultItGroupId(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">ID numérico do grupo TI</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              Entidade GLPI (entities_id)
            </label>
            <input
              type="number"
              min={0}
              value={entityId}
              onChange={(e) => setEntityId(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">0 = Entidade Raiz</span>
          </div>
        </div>

        {/* Auth Method Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            Mecanismo de Autenticação no GLPI
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAuthType('user_token')}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                authType === 'user_token'
                  ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">App-Token + User-Token (Recomendado)</span>
                {authType === 'user_token' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Padrão oficial da API GLPI. Utiliza o token da aplicação e o token de acesso remoto do técnico.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAuthType('credentials')}
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                authType === 'credentials'
                  ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">App-Token + Usuário e Senha</span>
                {authType === 'credentials' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Autentica via Basic Auth HTTP no endpoint <code>/initSession</code> do GLPI.
              </p>
            </button>
          </div>
        </div>

        {/* Token Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
              <span>App-Token (Token da Aplicação)</span>
              <span className="text-[10px] text-slate-500 font-normal">Configurar &gt; Geral &gt; API</span>
            </label>
            <input
              type="password"
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
              placeholder="Insira o App-Token gerado no GLPI"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {authType === 'user_token' ? (
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>User-Token (Chave de Acesso Remoto)</span>
                <span className="text-[10px] text-slate-500 font-normal">Meu Perfil &gt; Chaves de API</span>
              </label>
              <input
                type="password"
                value={userToken}
                onChange={(e) => setUserToken(e.target.value)}
                placeholder="Insira o User-Token do técnico de TI"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Usuário GLPI
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="joao.leopoldino"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-200 mb-1">
                  Senha GLPI
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>

      </form>

      {/* Security & Env Variables Reference Box */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Variáveis de Ambiente Recomendadas para Produção Local
        </h4>

        <p className="text-xs text-slate-400 leading-relaxed">
          Para persistência segura no servidor local ou container da Digi-Tron, você pode configurar as variáveis no arquivo <code>.env</code>:
        </p>

        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-cyan-300 space-y-1">
          <div>GLPI_URL="http://localhost:8080/apirest.php"</div>
          <div>GLPI_APP_TOKEN="seu_app_token_producao"</div>
          <div>GLPI_USER_TOKEN="seu_user_token_producao"</div>
          <div>GLPI_ENTITY_ID="0"</div>
        </div>
      </div>

      {/* Modal de Confirmação Explícita para Teste de Criação de Chamado Real */}
      {showTestTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <span>Confirmação: Abertura de Chamado de Teste no GLPI</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTestTicketModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-700/50 text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Atenção: Ação com escrita real no banco de dados</span>
                </div>
                <p className="text-[11px] text-amber-300/90">
                  Diferente do teste de conexão (que é estritamente somente leitura), esta operação enviará uma requisição <code>POST /Ticket</code> para a API do GLPI configurada.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                <div><strong className="text-slate-400">Endpoint Alvo:</strong> <span className="text-cyan-300">{url}</span></div>
                <div><strong className="text-slate-400">Categoria:</strong> <span className="text-slate-200">TI - Infraestrutura e Servidores</span></div>
                <div><strong className="text-slate-400">Grupo Responsável:</strong> <span className="text-slate-200">{defaultItGroupName} (ID: {defaultItGroupId})</span></div>
                <div><strong className="text-slate-400">Tipo:</strong> <span className="text-slate-200">Requisição de TI</span></div>
              </div>

              {testTicketResult && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Chamado #{testTicketResult.ticketId} Criado com Sucesso!</span>
                  </div>
                  <p>{testTicketResult.message}</p>
                  {testTicketResult.ticketUrl && (
                    <a
                      href={testTicketResult.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-cyan-300 hover:underline font-mono text-[11px]"
                    >
                      <span>Abrir chamado no GLPI</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {testTicketError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs space-y-1">
                  <strong className="block text-rose-200">Falha ao Criar Chamado:</strong>
                  <p>{testTicketError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTestTicketModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                {testTicketResult ? 'Fechar' : 'Cancelar'}
              </button>

              {!testTicketResult && (
                <button
                  type="button"
                  onClick={handleCreateTestTicket}
                  disabled={creatingTestTicket}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {creatingTestTicket ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{creatingTestTicket ? 'Criando Chamado...' : 'Confirmar e Criar no GLPI'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
