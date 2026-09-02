import React from 'react';
import {
  LayoutDashboard,
  Calculator,
  Receipt,
  Calendar as CalendarIcon,
  ShoppingBag,
  Truck,
  Settings,
  LogOut,
  X,
  Users,
  ShieldCheck,
  Building,
  KeyRound,
  Clock,
} from 'lucide-react';
import { AuthSession, CompanyProfile, NavigationRoute } from '../types';
import { SUPER_ADMIN_EMAIL } from '../services/firebase';
import { formatDateBR } from '../services/storage';

interface SidebarProps {
  currentRoute: NavigationRoute;
  isOpen: boolean;
  session: AuthSession;
  profile: CompanyProfile;
  collaboratorsCount: number;
  onClose: () => void;
  onNavigate: (route: NavigationRoute) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  isOpen,
  session,
  profile,
  collaboratorsCount,
  onClose,
  onNavigate,
  onLogout,
}) => {
  const isSuperAdmin = session.email === SUPER_ADMIN_EMAIL || session.isSuperAdmin || session.role === 'master' || session.isMaster;

  const navGroups = [
    ...(isSuperAdmin
      ? [
          {
            label: 'Controle Master',
            items: [
              {
                id: 'master-dashboard' as NavigationRoute,
                label: 'Painel Master',
                icon: ShieldCheck,
                badge: 'Central',
              },
              {
                id: 'master-lojas' as NavigationRoute,
                label: 'Gerenciar Lojas',
                icon: Building,
              },
              {
                id: 'master-usuarios' as NavigationRoute,
                label: 'Usuários Globais',
                icon: Users,
              },
              {
                id: 'master-atividades' as NavigationRoute,
                label: 'Trilha de Auditoria',
                icon: Clock,
              },
              {
                id: 'licencas-admin' as NavigationRoute,
                label: 'Gestão de Licenças',
                icon: KeyRound,
              },
            ],
          },
        ]
      : []),
    {
      label: isSuperAdmin ? 'Módulos da Loja Ativa' : 'Visão Geral',
      items: [
        { id: 'dashboard' as NavigationRoute, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'simulador' as NavigationRoute, label: 'Simulador v1.5', icon: Calculator, badge: 'Prazos' },
      ],
    },
    {
      label: 'Financeiro',
      items: [
        { id: 'contas' as NavigationRoute, label: 'Contas a Pagar', icon: Receipt },
        { id: 'calendario' as NavigationRoute, label: 'Calendário', icon: CalendarIcon },
        { id: 'compras-lista' as NavigationRoute, label: 'Histórico Compras', icon: ShoppingBag },
      ],
    },
    {
      label: 'Gestão',
      items: [
        { id: 'fornecedores' as NavigationRoute, label: 'Fornecedores', icon: Truck },
        { id: 'config' as NavigationRoute, label: 'Configurações & Equipe', icon: Settings, badge: `${collaboratorsCount}` },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 sm:w-72 bg-[#0f172a] border-r border-white/[0.08] flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.logo ? (
              <img
                src={profile.logo}
                alt={profile.name}
                className="w-10 h-10 rounded-xl object-cover border border-teal-500/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-slate-950 font-extrabold text-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                F
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  FLUXO
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px]">
                {profile.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database / Company Info Card */}
        <div className="px-4 pt-4">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/[0.06] text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 text-[11px]">
                <Building className="w-3.5 h-3.5 text-teal-400" />
                Banco na Nuvem
              </span>
              <span className="font-mono text-[10px] text-teal-300/80">
                ID: {profile.id.substring(0, 10)}...
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
              <span>{collaboratorsCount} {collaboratorsCount === 1 ? 'usuário conectado' : 'usuários na equipe'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* License status indicator */}
            {!isSuperAdmin && session.expiresAt && (
              <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-400" />
                  Validade:
                </span>
                <span className="font-semibold text-purple-300">
                  {formatDateBR(session.expiresAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentRoute === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                          isActive
                            ? 'bg-teal-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400 border border-white/[0.06]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer with user info and logout */}
        <div className="p-4 border-t border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                <span>{session.name}</span>
                {isSuperAdmin && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    MASTER
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {session.email}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Encerrar Sessão</span>
          </button>
        </div>
      </aside>
    </>
  );
};
