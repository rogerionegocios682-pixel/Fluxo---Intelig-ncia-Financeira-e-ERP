import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  FileText,
  Activity,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Sparkles,
  MapPin,
  TrendingUp,
  DollarSign,
  ChevronRight,
  X,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import {
  AccessRequest,
  AuthSession,
  CompanyProfile,
  MasterAuditLog,
  StoreStatus,
  UserAccessStatus,
  UserAccount,
} from '../types';
import { FirebaseService, SUPER_ADMIN_EMAIL } from '../services/firebase';
import { formatDateBR, formatMoney } from '../services/storage';

interface MasterPanelViewProps {
  session: AuthSession;
  initialTab?: 'dashboard' | 'lojas' | 'usuarios' | 'atividades' | 'solicitacoes';
  onInspectStore?: (storeId: string) => void;
}

export const MasterPanelView: React.FC<MasterPanelViewProps> = ({
  session,
  initialTab = 'dashboard',
  onInspectStore,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'lojas' | 'usuarios' | 'atividades' | 'solicitacoes'>(initialTab);
  
  // Data states
  const [stores, setStores] = useState<CompanyProfile[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<MasterAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [storeSearch, setStoreSearch] = useState('');
  const [storeStatusFilter, setStoreStatusFilter] = useState<'all' | StoreStatus>('all');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | UserAccessStatus>('all');

  // Selected Store Modal
  const [selectedStore, setSelectedStore] = useState<CompanyProfile | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Store Modal State
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [newStoreForm, setNewStoreForm] = useState({
    storeName: '',
    email: '',
    password: '',
    cnpj: '',
    phone: '',
    managerName: '',
    licenseDays: 365 as 30 | 90 | 180 | 365,
    status: 'ATIVA' as StoreStatus,
  });
  const [creatingStore, setCreatingStore] = useState(false);

  const handleCreateStoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreForm.email.trim() || !newStoreForm.storeName.trim()) {
      setFeedback({ type: 'error', text: 'Preencha o nome da loja e o e-mail.' });
      return;
    }

    setCreatingStore(true);
    setFeedback(null);
    try {
      await FirebaseService.registerStoreDirectly({
        storeName: newStoreForm.storeName.trim(),
        email: newStoreForm.email.trim(),
        password: newStoreForm.password.trim(),
        cnpj: newStoreForm.cnpj.trim(),
        phone: newStoreForm.phone.trim(),
        managerName: newStoreForm.managerName.trim(),
        licenseDays: newStoreForm.licenseDays,
        status: newStoreForm.status,
      });

      setFeedback({
        type: 'success',
        text: `Loja "${newStoreForm.storeName}" cadastrada com sucesso! Login: ${newStoreForm.email}`,
      });
      setIsNewStoreModalOpen(false);
      setNewStoreForm({
        storeName: '',
        email: '',
        password: '',
        cnpj: '',
        phone: '',
        managerName: '',
        licenseDays: 365,
        status: 'ATIVA',
      });
    } catch (err: any) {
      console.error('Error creating store:', err);
      let msg = 'Erro ao cadastrar loja.';
      if (typeof err?.message === 'string') {
        try {
          const parsed = JSON.parse(err.message);
          msg = parsed.error || err.message;
        } catch {
          msg = err.message;
        }
      }
      setFeedback({ type: 'error', text: msg });
    } finally {
      setCreatingStore(false);
    }
  };

  // Sync Master data in real-time
  useEffect(() => {
    setLoading(true);

    const unsubStores = FirebaseService.subscribeToAllStores(
      (list) => {
        setStores(list);
        setLoading(false);
      },
      (err) => console.error('Master stores sync error:', err)
    );

    const unsubUsers = FirebaseService.subscribeToAllUsers(
      (list) => setUsers(list),
      (err) => console.error('Master users sync error:', err)
    );

    const unsubReqs = FirebaseService.subscribeToAccessRequests(
      (list) => setRequests(list),
      (err) => console.error('Master requests sync error:', err)
    );

    const unsubAudit = FirebaseService.subscribeToAuditLogs(
      (list) => setAuditLogs(list),
      (err) => console.warn('Master audit sync error:', err)
    );

    return () => {
      unsubStores();
      unsubUsers();
      unsubReqs();
      unsubAudit();
    };
  }, []);

  // Compute users count per store
  const storeUserCountMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => {
      if (u.companyId) {
        map[u.companyId] = (map[u.companyId] || 0) + 1;
      }
    });
    return map;
  }, [users]);

  // Derived statistics
  const totalStores = stores.length;
  const activeStores = stores.filter((s) => s.status === 'ATIVA' || !s.status).length;
  const blockedStores = stores.filter((s) => s.status === 'BLOQUEADA').length;
  const pendingStores = stores.filter((s) => s.status === 'PENDENTE').length;

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'ATIVO' || !u.status).length;
  const blockedUsers = users.filter((u) => u.status === 'BLOQUEADO').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  // Actions: Store Activation with duration
  const handleActivateStore = async (store: CompanyProfile, days: 30 | 90 | 180 | 365) => {
    setActionLoadingId(store.id);
    setFeedback(null);
    try {
      await FirebaseService.activateStoreWithLicense(store.id, days, store.name);
      setFeedback({
        type: 'success',
        text: `Loja "${store.name}" ativada com sucesso! Licença de ${days} dias concedida.`,
      });
      if (selectedStore?.id === store.id) {
        setSelectedStore({ ...selectedStore, status: 'ATIVA' });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao ativar loja no Firestore.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions: Store Block
  const handleBlockStore = async (store: CompanyProfile) => {
    if (!confirm(`Deseja realmente BLOQUEAR o acesso da loja "${store.name}"? Os usuários desta loja não conseguirão entrar até nova liberação.`)) {
      return;
    }
    setActionLoadingId(store.id);
    setFeedback(null);
    try {
      await FirebaseService.updateStoreStatus(store.id, 'BLOQUEADA', store.name, 'Bloqueio administrativo realizado pelo Master');
      setFeedback({
        type: 'success',
        text: `Loja "${store.name}" foi BLOQUEADA com sucesso.`,
      });
      if (selectedStore?.id === store.id) {
        setSelectedStore({ ...selectedStore, status: 'BLOQUEADA' });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao bloquear loja no Firestore.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions: Store Unblock to Pending or Ativa
  const handleSetStorePending = async (store: CompanyProfile) => {
    setActionLoadingId(store.id);
    setFeedback(null);
    try {
      await FirebaseService.updateStoreStatus(store.id, 'PENDENTE', store.name, 'Status definido como pendente pelo Master');
      setFeedback({
        type: 'success',
        text: `Loja "${store.name}" alterada para PENDENTE de ativação.`,
      });
      if (selectedStore?.id === store.id) {
        setSelectedStore({ ...selectedStore, status: 'PENDENTE' });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao atualizar status da loja.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Actions: User Status Change
  const handleToggleUserStatus = async (user: UserAccount, newStatus: UserAccessStatus) => {
    if (!user.uid) return;
    setActionLoadingId(user.uid);
    setFeedback(null);
    try {
      await FirebaseService.updateUserAccessStatus(user.uid, newStatus, user.name, user.companyId);
      setFeedback({
        type: 'success',
        text: `Status do usuário "${user.name}" atualizado para ${newStatus}.`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Erro ao atualizar status do usuário.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered stores
  const filteredStores = stores.filter((s) => {
    const status = s.status || 'ATIVA';
    if (storeStatusFilter !== 'all' && status !== storeStatusFilter) return false;
    if (storeSearch.trim()) {
      const q = storeSearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.cnpj && s.cnpj.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.managerName && s.managerName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const status = u.status || 'ATIVO';
    if (userStatusFilter !== 'all' && status !== userStatusFilter) return false;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.companyName && u.companyName.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* MASTER TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 font-black text-xs">
              MASTER
            </div>
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white">
              Painel Central Master
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
              Controle Global de Lojas
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestão centralizada de lojas, usuários, ativações, bloqueios e auditoria em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-slate-400 font-medium">Banco:</span>
            <span className="font-mono text-[11px] text-teal-300 font-semibold">Conectado ao Firestore</span>
          </div>

          <button
            onClick={() => setIsNewStoreModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-950 hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/25 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Cadastrar Nova Loja</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* MASTER TOP NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
        {[
          { id: 'dashboard', label: 'Resumo Master', icon: Activity, count: null },
          { id: 'lojas', label: 'Lojas Cadastradas', icon: Building2, count: totalStores },
          { id: 'usuarios', label: 'Usuários das Lojas', icon: Users, count: totalUsers },
          { id: 'solicitacoes', label: 'Novas Solicitações', icon: ShieldCheck, count: pendingRequestsCount, alert: pendingRequestsCount > 0 },
          { id: 'atividades', label: 'Auditoria & Logs', icon: FileText, count: auditLogs.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-teal-400 text-slate-950 font-bold shadow-lg shadow-teal-500/20'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white border border-white/[0.06] hover:border-white/20'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-teal-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    tab.alert
                      ? 'bg-amber-500 text-slate-950 animate-pulse'
                      : isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MASTER DASHBOARD (RESUMO GLOBAL) */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI CARDS RESUMO */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de Lojas</span>
                <div className="font-mono font-extrabold text-2xl sm:text-3xl text-white mt-1">
                  {totalStores}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <span>Todas cadastradas</span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Lojas Ativas</span>
                <div className="font-mono font-extrabold text-2xl sm:text-3xl text-emerald-400 mt-1">
                  {activeStores}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {totalStores > 0 ? `${Math.round((activeStores / totalStores) * 100)}% operacionais` : '0%'}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Lojas Pendentes</span>
                <div className="font-mono font-extrabold text-2xl sm:text-3xl text-amber-400 mt-1">
                  {pendingStores + pendingRequestsCount}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Aguardando ativação
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Lojas Bloqueadas</span>
                <div className="font-mono font-extrabold text-2xl sm:text-3xl text-rose-400 mt-1">
                  {blockedStores}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Acesso suspenso
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400">
                <Lock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* SECONDARY ROW: USERS SUMMARY & QUICK STATS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lojas Recentes com Ações Rápidas */}
            <div className="lg:col-span-2 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    Lojas Recentes
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('lojas')}
                  className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas as lojas ({totalStores})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {stores.slice(0, 5).map((st) => {
                  const status = st.status || 'ATIVA';
                  const usersInStore = storeUserCountMap[st.id] || 1;
                  return (
                    <div
                      key={st.id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] hover:border-teal-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{st.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              status === 'ATIVA'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : status === 'BLOQUEADA'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          {st.cnpj && <span>CNPJ: {st.cnpj}</span>}
                          {st.phone && <span>Tel: {st.phone}</span>}
                          <span>{usersInStore} {usersInStore === 1 ? 'usuário' : 'usuários'}</span>
                          <span>Cadastrada em {new Date(st.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setSelectedStore(st)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-teal-400" />
                          <span>Visualizar</span>
                        </button>

                        {status !== 'ATIVA' ? (
                          <button
                            onClick={() => handleActivateStore(st, 30)}
                            disabled={actionLoadingId === st.id}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Ativar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBlockStore(st)}
                            disabled={actionLoadingId === st.id}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-all cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5 inline mr-1" />
                            Bloquear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auditoria & Últimas Atividades */}
            <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    Últimas Atividades
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('atividades')}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Nenhuma atividade registrada até o momento.
                  </div>
                ) : (
                  auditLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.04] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{log.action}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {log.targetStoreName && (
                        <div className="text-[11px] text-teal-300">
                          Loja: <strong>{log.targetStoreName}</strong>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleDateString('pt-BR')} • por {log.userEmail}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GERENCIAMENTO DE LOJAS */}
      {/* ========================================================================= */}
      {activeTab === 'lojas' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `Todas (${totalStores})` },
                { id: 'ATIVA', label: `Ativas (${activeStores})` },
                { id: 'PENDENTE', label: `Pendentes (${pendingStores})` },
                { id: 'BLOQUEADA', label: `Bloqueadas (${blockedStores})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStoreStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    storeStatusFilter === tab.id
                      ? 'bg-teal-400 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  placeholder="Buscar por nome, CNPJ, telefone, cidade..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                />
              </div>
              <button
                onClick={() => setIsNewStoreModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-teal-500/20 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Cadastrar Loja</span>
              </button>
            </div>
          </div>

          {/* Stores Table */}
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Loja / Empresa</th>
                    <th className="py-3 px-4">CNPJ & Contato</th>
                    <th className="py-3 px-4">Cidade / Local</th>
                    <th className="py-3 px-4">Usuários</th>
                    <th className="py-3 px-4">Data Cadastro</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredStores.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Nenhuma loja encontrada para o filtro informado.
                      </td>
                    </tr>
                  ) : (
                    filteredStores.map((store) => {
                      const status = store.status || 'ATIVA';
                      const usersCount = storeUserCountMap[store.id] || 1;
                      const cleanPhone = (store.phone || '').replace(/\D/g, '');

                      return (
                        <tr key={store.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* Store info */}
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                                {store.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-white text-xs sm:text-sm">{store.name}</div>
                                <div className="text-[10px] font-mono text-slate-400">ID: {store.id}</div>
                              </div>
                            </div>
                          </td>

                          {/* CNPJ & Phone */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <div>{store.cnpj || 'CNPJ não informado'}</div>
                            {store.phone && (
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                                <Phone className="w-3 h-3 text-teal-400" />
                                <span>{store.phone}</span>
                              </div>
                            )}
                          </td>

                          {/* City / State */}
                          <td className="py-3.5 px-4 text-slate-400">
                            {store.city ? `${store.city} / ${store.state || 'UF'}` : 'Não informado'}
                          </td>

                          {/* Users count */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-bold text-slate-200">
                              <Users className="w-3 h-3 text-teal-400" />
                              {usersCount}
                            </span>
                          </td>

                          {/* Created at */}
                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {new Date(store.createdAt).toLocaleDateString('pt-BR')}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                status === 'ATIVA'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : status === 'BLOQUEADA'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {status === 'ATIVA' && <CheckCircle2 className="w-3 h-3" />}
                              {status === 'BLOQUEADA' && <Lock className="w-3 h-3" />}
                              {status === 'PENDENTE' && <Clock className="w-3 h-3" />}
                              <span>{status}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedStore(store)}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 cursor-pointer"
                                title="Visualizar detalhes da loja"
                              >
                                <Eye className="w-3.5 h-3.5 text-teal-400" />
                              </button>

                              {/* Activation dropdown or buttons */}
                              {status !== 'ATIVA' ? (
                                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-white/10">
                                  {([30, 90, 365] as const).map((days) => (
                                    <button
                                      key={days}
                                      onClick={() => handleActivateStore(store, days)}
                                      disabled={actionLoadingId === store.id}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 border border-emerald-500/20 transition-all cursor-pointer"
                                      title={`Ativar por ${days} dias`}
                                    >
                                      {days === 365 ? '1a' : `${days}d`}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleBlockStore(store)}
                                  disabled={actionLoadingId === store.id}
                                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold cursor-pointer"
                                  title="Bloquear Loja"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GERENCIAMENTO DE USUÁRIOS DAS LOJAS */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: `Todos (${totalUsers})` },
                { id: 'ATIVO', label: `Ativos (${activeUsers})` },
                { id: 'BLOQUEADO', label: `Bloqueados (${blockedUsers})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setUserStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    userStatusFilter === tab.id
                      ? 'bg-teal-400 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar usuário, email, cargo ou empresa..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Nome do Usuário</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Loja Vinculada</th>
                    <th className="py-3 px-4">Perfil / Cargo</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Validade Licença</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Nenhum usuário encontrado para o filtro informado.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const userStatus = user.status || (user.approvalStatus === 'rejected' ? 'BLOQUEADO' : 'ATIVO');
                      const isMaster = user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

                      return (
                        <tr key={user.uid || user.email} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{user.name || 'Sem nome'}</span>
                              {isMaster && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                                  MASTER
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300 text-xs">
                            {user.email}
                          </td>

                          <td className="py-3.5 px-4 text-teal-300 font-semibold">
                            {user.companyName || user.companyId || 'Não vinculada'}
                          </td>

                          <td className="py-3.5 px-4 text-slate-300 capitalize">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[11px]">
                              {user.role}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                userStatus === 'ATIVO'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : userStatus === 'BLOQUEADO'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {userStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {user.expiresAt ? formatDateBR(user.expiresAt) : 'Sem validade'}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {!isMaster && (
                              <div className="inline-flex items-center gap-1.5">
                                {userStatus === 'ATIVO' ? (
                                  <button
                                    onClick={() => handleToggleUserStatus(user, 'BLOQUEADO')}
                                    disabled={actionLoadingId === user.uid}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                                  >
                                    Bloquear
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleUserStatus(user, 'ATIVO')}
                                    disabled={actionLoadingId === user.uid}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20 cursor-pointer"
                                  >
                                    Ativar
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: NOVAS SOLICITAÇÕES / LICENÇAS */}
      {/* ========================================================================= */}
      {activeTab === 'solicitacoes' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <span>
                Solicitações de novos registros de empresas recebidas em tempo real para liberação pelo Master.
              </span>
            </div>
            <span className="font-bold text-teal-300 font-mono">
              {pendingRequestsCount} pendentes
            </span>
          </div>

          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-[#0f172a] rounded-2xl border border-white/[0.08]">
                Nenhuma solicitação de acesso registrada no momento.
              </div>
            ) : (
              requests.map((req) => {
                const isPending = req.status === 'pending';
                const cleanPhone = (req.phone || '').replace(/\D/g, '');

                return (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 rounded-2xl bg-[#0f172a] border border-white/[0.08] hover:border-teal-500/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{req.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {req.status === 'pending'
                            ? 'PENDENTE'
                            : req.status === 'approved'
                            ? `APROVADO (${req.licenseDays || 30} DIAS)`
                            : 'REJEITADO'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1 text-teal-300">
                          <Building2 className="w-3.5 h-3.5" />
                          {req.companyName}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-300">
                          <Mail className="w-3.5 h-3.5" />
                          {req.email}
                        </span>
                        {req.phone && (
                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Phone className="w-3.5 h-3.5" />
                            {req.phone}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Recebido em: {new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                        {req.expiresAt && <span>Expira em: {formatDateBR(req.expiresAt)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${req.name}, recebemos seu cadastro para a empresa ${req.companyName} no Fluxo ERP.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Liberar:</span>
                        {([30, 90, 180, 365] as const).map((days) => (
                          <button
                            key={days}
                            onClick={async () => {
                              setActionLoadingId(req.id);
                              await FirebaseService.approveUserLicense(req.userId, req.id, days);
                              setActionLoadingId(null);
                              setFeedback({
                                type: 'success',
                                text: `Licença de ${days} dias aprovada com sucesso para ${req.name}!`,
                              });
                            }}
                            disabled={actionLoadingId === req.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-400/10 hover:bg-teal-400 hover:text-slate-950 text-teal-300 border border-teal-500/30 transition-all cursor-pointer"
                          >
                            {days === 365 ? '1 Ano' : `${days}d`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDITORIA & REGISTROS */}
      {/* ========================================================================= */}
      {activeTab === 'atividades' && (
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="font-display font-bold text-base text-white">
                Trilha de Auditoria Master
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico cronológico de todas as ativações, bloqueios e alterações realizadas no sistema
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono text-slate-300">
              {auditLogs.length} registros
            </span>
          </div>

          <div className="space-y-2.5">
            {auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhuma ação de auditoria registrada até o momento.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-900/70 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs sm:text-sm">{log.action}</span>
                      {log.targetStoreName && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          {log.targetStoreName}
                        </span>
                      )}
                    </div>
                    {log.details && (
                      <p className="text-xs text-slate-400">{log.details}</p>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 shrink-0 font-mono text-right">
                    <div>{new Date(log.createdAt).toLocaleDateString('pt-BR')} às {new Date(log.createdAt).toLocaleTimeString('pt-BR')}</div>
                    <div className="text-slate-400">Master: {log.userEmail}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETALHADO DA LOJA SELECIONADA */}
      {/* ========================================================================= */}
      {selectedStore && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 font-extrabold text-lg flex items-center justify-center">
                  {selectedStore.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    {selectedStore.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    ID da Loja: {selectedStore.id}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedStore(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Store details info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">CNPJ</span>
                <div className="text-xs font-mono text-slate-200 font-semibold">{selectedStore.cnpj || 'Não cadastrado'}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Telefone / WhatsApp</span>
                <div className="text-xs font-mono text-slate-200 font-semibold">{selectedStore.phone || 'Não informado'}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Endereço & Cidade</span>
                <div className="text-xs text-slate-200">{selectedStore.address || selectedStore.city ? `${selectedStore.address || ''} - ${selectedStore.city || ''}` : 'Não informado'}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Status Atual</span>
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      (selectedStore.status || 'ATIVA') === 'ATIVA'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : (selectedStore.status || 'ATIVA') === 'BLOQUEADA'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {selectedStore.status || 'ATIVA'}
                  </span>
                </div>
              </div>
            </div>

            {/* Master Action Controls for this Store */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-3">
              <div className="font-bold text-xs text-white uppercase tracking-wider">
                Ações de Controle Master
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Ativar Licença:</span>
                  {([30, 90, 180, 365] as const).map((days) => (
                    <button
                      key={days}
                      onClick={() => handleActivateStore(selectedStore, days)}
                      disabled={actionLoadingId === selectedStore.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-all cursor-pointer"
                    >
                      {days === 365 ? '1 Ano' : `${days} dias`}
                    </button>
                  ))}
                </div>

                {(selectedStore.status || 'ATIVA') !== 'BLOQUEADA' ? (
                  <button
                    onClick={() => handleBlockStore(selectedStore)}
                    disabled={actionLoadingId === selectedStore.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-300 hover:bg-rose-500 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 inline mr-1" />
                    Bloquear Acesso
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivateStore(selectedStore, 30)}
                    disabled={actionLoadingId === selectedStore.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 inline mr-1" />
                    Desbloquear Loja
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
              <button
                onClick={() => setSelectedStore(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-white/10 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR NOVA LOJA (MASTER) */}
      {/* ========================================================================= */}
      {isNewStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-white/10 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-400" />
                <h3 className="font-display font-bold text-base text-white">
                  Cadastrar Nova Loja
                </h3>
              </div>
              <button
                onClick={() => setIsNewStoreModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStoreSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Loja / Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStoreForm.storeName}
                    onChange={(e) => setNewStoreForm({ ...newStoreForm, storeName: e.target.value })}
                    placeholder="Ex: Leandra Modas / Loja Exemplo"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      E-mail de Login *
                    </label>
                    <input
                      type="email"
                      required
                      value={newStoreForm.email}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, email: e.target.value })}
                      placeholder="email@dominio.com"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Senha de Acesso
                    </label>
                    <input
                      type="text"
                      value={newStoreForm.password}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, password: e.target.value })}
                      placeholder="Senha da loja"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      CNPJ (opcional)
                    </label>
                    <input
                      type="text"
                      value={newStoreForm.cnpj}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, cnpj: e.target.value })}
                      placeholder="40.615.107/0001-69"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Telefone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={newStoreForm.phone}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Responsável / Gerente
                    </label>
                    <input
                      type="text"
                      value={newStoreForm.managerName}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, managerName: e.target.value })}
                      placeholder="Nome do responsável"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Licença Inicial
                    </label>
                    <select
                      value={newStoreForm.licenseDays}
                      onChange={(e) => setNewStoreForm({ ...newStoreForm, licenseDays: Number(e.target.value) as any })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-400 cursor-pointer"
                    >
                      <option value={30}>30 Dias (Período Teste)</option>
                      <option value={90}>90 Dias (Trimestral)</option>
                      <option value={180}>180 Dias (Semestral)</option>
                      <option value={365}>365 Dias (1 Ano - Padrão)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  onClick={() => setIsNewStoreModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-white/10 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingStore}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creatingStore ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Conectando e Salvando no Banco...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Cadastrar e Conectar ao Banco</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
