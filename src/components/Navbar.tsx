import React, { useState, useEffect } from 'react';
import {
  Menu,
  Plus,
  ShieldCheck,
  Building2,
  Bell,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AuthSession, CompanyProfile, NavigationRoute } from '../types';
import { SUPER_ADMIN_EMAIL } from '../services/firebase';

interface NavbarProps {
  currentRoute: NavigationRoute;
  session: AuthSession;
  profile: CompanyProfile;
  onToggleSidebar: () => void;
  onNavigate: (route: NavigationRoute) => void;
  onOpenQuickPurchase: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  session,
  profile,
  onToggleSidebar,
  onNavigate,
  onOpenQuickPurchase,
}) => {
  const isSuperAdmin = session.email === SUPER_ADMIN_EMAIL || session.isSuperAdmin;
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'reconnecting' | 'offline'>(
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'
  );

  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      setTimeout(() => {
        setConnectionStatus('online');
      }, 1200);
    };

    const handleOffline = () => {
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getPageInfo = (route: NavigationRoute) => {
    switch (route) {
      case 'dashboard':
        return { title: 'Dashboard Financeiro', sub: 'Visão geral e saúde do fluxo de caixa' };
      case 'simulador':
        return { title: 'Simulador de Prazos', sub: 'Projeção de vencimentos antes de fechar compras' };
      case 'contas':
        return { title: 'Contas a Pagar', sub: 'Gestão e baixa de boletos e compromissos' };
      case 'calendario':
        return { title: 'Calendário Financeiro', sub: 'Visualização de saídas diárias, semanais e mensais' };
      case 'compras-lista':
        return { title: 'Histórico de Compras', sub: 'Registros de pedidos, parcelamentos e fornecedores' };
      case 'fornecedores':
        return { title: 'Fornecedores', sub: 'Cadastro de parceiros e acompanhamento de volume' };
      case 'config':
        return { title: 'Configurações & Equipe', sub: 'Dados da empresa, logotipo e gestão de acessos' };
      case 'licencas-admin':
        return { title: 'Painel Master de Licenças', sub: `Liberação de 30, 90, 180 ou 365 dias para usuários` };
      default:
        return { title: 'Fluxo ERP', sub: 'Inteligência Financeira' };
    }
  };

  const pageInfo = getPageInfo(currentRoute);

  const getRoleBadge = () => {
    if (isSuperAdmin) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">MASTER</span>;
    }
    switch (session.role) {
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">ADMIN</span>;
      case 'financeiro':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">FINANCEIRO</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">EQUIPE</span>;
    }
  };

  return (
    <header className="h-18 lg:h-20 px-4 sm:px-6 lg:px-8 border-b border-white/[0.08] sticky top-0 bg-[#050810]/85 backdrop-blur-md z-30 flex items-center justify-between transition-all">
      {/* Left: Mobile toggle + Page Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Abrir menu de navegação"
          className="lg:hidden p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 hover:text-teal-400 hover:border-teal-500/30 transition-all focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-bold text-base sm:text-lg lg:text-xl text-white truncate tracking-tight">
              {pageInfo.title}
            </h1>
            {/* Realtime Connection Status Pill */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                connectionStatus === 'online'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
              title={
                connectionStatus === 'online'
                  ? 'Sincronização em tempo real ativa'
                  : connectionStatus === 'reconnecting'
                  ? 'Reconectando ao banco de dados...'
                  : 'Sem conexão com a internet'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'online'
                    ? 'bg-emerald-400'
                    : connectionStatus === 'reconnecting'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span>
                {connectionStatus === 'online'
                  ? 'Online'
                  : connectionStatus === 'reconnecting'
                  ? 'Reconectando...'
                  : 'Offline'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block truncate">
            {pageInfo.sub}
          </p>
        </div>
      </div>

      {/* Right: Quick actions + Company / User pill */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Nova Compra Fast Action */}
        <button
          onClick={onOpenQuickPurchase}
          className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all shadow-lg shadow-teal-500/10 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Compra</span>
          <span className="sm:hidden">Comprar</span>
        </button>

        {/* User / Company Badge */}
        <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-white/10">
          <div className="text-right hidden md:block">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-bold text-slate-200 truncate max-w-[140px]">
                {profile.name}
              </span>
              {getRoleBadge()}
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
              {session.name}
            </div>
          </div>

          {/* Logo or Avatar */}
          <div className="relative group cursor-pointer" onClick={() => onNavigate('config')}>
            {profile.logo ? (
              <img
                src={profile.logo}
                alt={profile.name}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-teal-500/30 ring-2 ring-teal-500/20"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-700 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center shadow-inner">
                {profile.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#050810] ${
                connectionStatus === 'online'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
