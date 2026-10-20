import React from 'react';
import { User, GlpiConfig } from '../types';
import { 
  Terminal, 
  CalendarClock, 
  Settings2, 
  History, 
  LayoutDashboard, 
  BookTemplate, 
  LogOut, 
  ShieldCheck, 
  Wrench, 
  Server,
  Radio,
  Cpu
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'routines' | 'glpi' | 'history' | 'templates';
  onSelectTab: (tab: 'dashboard' | 'routines' | 'glpi' | 'history' | 'templates') => void;
  currentUser: User | null;
  onLogout: () => void;
  glpiConfig: GlpiConfig | null;
  onQuickTest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  glpiConfig,
  onQuickTest
}) => {
  const connectionStatus = glpiConfig?.connectionStatus || 'pending_configuration';

  const statusLabel = 
    connectionStatus === 'connected' ? 'GLPI Conectado' :
    connectionStatus === 'pending_configuration' ? 'Configuração Pendente' :
    'GLPI Desconectado';

  const statusColor = 
    connectionStatus === 'connected' ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/40' :
    connectionStatus === 'pending_configuration' ? 'bg-amber-950/80 border-amber-600/50 text-amber-300 hover:bg-amber-900/40' :
    'bg-rose-950/80 border-rose-600/50 text-rose-300 hover:bg-rose-900/40';

  const pulseColor = 
    connectionStatus === 'connected' ? 'bg-emerald-400' :
    connectionStatus === 'pending_configuration' ? 'bg-amber-400' :
    'bg-rose-400';

  const isRoleAdmin = currentUser?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand - Digi-Tron TI */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-lg font-sans">
                  Digi-Tron <span className="text-cyan-400 font-normal">TI</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-cyan-950/90 text-cyan-300 border border-cyan-800/80 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  Setor de TI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                GLPI AutoScheduler • Automação Exclusiva de Chamados de TI
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Painel
            </button>

            <button
              onClick={() => onSelectTab('routines')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'routines'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              Rotinas de TI
            </button>

            <button
              onClick={() => onSelectTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'templates'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookTemplate className="w-4 h-4" />
              Modelos de TI
            </button>

            <button
              onClick={() => onSelectTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'history'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <History className="w-4 h-4" />
              Histórico
            </button>

            <button
              onClick={() => onSelectTab('glpi')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'glpi'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Conexão GLPI
            </button>
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            
            {/* Real GLPI Status Pill */}
            <button
              onClick={onQuickTest}
              title="Clique para testar e verificar conexão real com GLPI"
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${statusColor}`}
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${pulseColor}`} />
              <Server className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{statusLabel}</span>
            </button>

            {/* Backend Scheduler Heartbeat Status */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 font-medium">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>Agendador de TI Ativo</span>
            </div>

            {/* User Profile Info & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-cyan-700/40 border border-cyan-500/40 flex items-center justify-center text-cyan-200 text-xs font-bold">
                  {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-cyan-400 flex items-center gap-1">
                    {isRoleAdmin ? (
                      <>
                        <ShieldCheck className="w-3 h-3 inline text-emerald-400" />
                        <span>Administrador de TI</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3 h-3 inline text-cyan-400" />
                        <span>Técnico de TI</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  title="Sair da Conta de TI"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-2 border-t border-slate-800/60 no-scrollbar">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'dashboard' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Painel TI
          </button>
          <button
            onClick={() => onSelectTab('routines')}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'routines' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Rotinas TI
          </button>
          <button
            onClick={() => onSelectTab('templates')}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'templates' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Modelos TI
          </button>
          <button
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'history' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Auditoria
          </button>
          <button
            onClick={() => onSelectTab('glpi')}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium ${
              currentTab === 'glpi' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
            }`}
          >
            GLPI API
          </button>
        </div>

      </div>
    </header>
  );
};
