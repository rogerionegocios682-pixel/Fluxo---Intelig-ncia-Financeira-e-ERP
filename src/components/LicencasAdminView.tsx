import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Search,
  Building2,
  Mail,
  Phone,
  User,
  ExternalLink,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Send,
  Loader2,
} from 'lucide-react';
import { AccessRequest, AuthSession } from '../types';
import { FirebaseService, SUPER_ADMIN_EMAIL } from '../services/firebase';
import { formatDateBR } from '../services/storage';

interface LicencasAdminViewProps {
  session: AuthSession;
}

export const LicencasAdminView: React.FC<LicencasAdminViewProps> = ({
  session,
}) => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const unsub = FirebaseService.subscribeToAccessRequests(
      (list) => {
        setRequests(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching access requests:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleApprove = async (
    req: AccessRequest,
    days: 30 | 90 | 180 | 365
  ) => {
    setActionLoadingId(req.id);
    setFeedbackMsg(null);
    try {
      await FirebaseService.approveUserLicense(req.userId, req.id, days);
      setFeedbackMsg({
        type: 'success',
        text: `Licença de ${days} dias aprovada com sucesso para ${req.name} (${req.email})!`,
      });

      // Prepare confirmation mailto
      const mailSubject = encodeURIComponent(`Sua licença do Fluxo ERP foi APROVADA (${days} dias)`);
      const mailBody = encodeURIComponent(
        `Olá ${req.name},\n\nSua solicitação de acesso ao Fluxo ERP para a empresa ${req.companyName} foi APROVADA por ${days} dias!\n\nVocê já pode acessar o sistema normalmente através do link da aplicação.\n\nAtenciosamente,\nRogério | Fluxo ERP`
      );
      window.open(`mailto:${req.email}?subject=${mailSubject}&body=${mailBody}`, '_blank');
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'Erro ao aprovar licença no Firestore.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (req: AccessRequest) => {
    if (!confirm(`Deseja rejeitar ou suspender o acesso de ${req.name}?`)) return;
    setActionLoadingId(req.id);
    try {
      await FirebaseService.rejectUserLicense(req.userId, req.id);
      setFeedbackMsg({
        type: 'success',
        text: `Acesso do usuário ${req.name} foi revogado/rejeitado.`,
      });
    } catch (err: any) {
      console.error(err);
      setFeedbackMsg({ type: 'error', text: 'Erro ao rejeitar licença.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.phone.includes(q)
      );
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
              Painel do Administrador Geral
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              SUPER ADMIN
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Gestão de novos cadastros e concessão de licenças (30, 90, 180 ou 365 dias)
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300 flex items-center gap-2">
          <Mail className="w-4 h-4 text-teal-400" />
          <span>E-mail Master: <strong>{SUPER_ADMIN_EMAIL}</strong></span>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Solicitações Pendentes</span>
            <div className="font-mono font-extrabold text-2xl text-amber-400 mt-1">
              {pendingCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Licenças Ativas</span>
            <div className="font-mono font-extrabold text-2xl text-emerald-400 mt-1">
              {approvedCount}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de Cadastros</span>
            <div className="font-mono font-extrabold text-2xl text-white mt-1">
              {requests.length}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todos os Cadastros' },
              { id: 'pending', label: `Pendentes (${pendingCount})` },
              { id: 'approved', label: 'Aprovados' },
              { id: 'rejected', label: 'Rejeitados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-teal-400 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, email ou empresa..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              <span>Carregando solicitações de licença do Firestore...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Nenhuma solicitação encontrada para o filtro selecionado.
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isActionLoading = actionLoadingId === req.id;
              const cleanPhone = (req.phone || '').replace(/\D/g, '');

              return (
                <div
                  key={req.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/[0.08] hover:border-teal-500/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: User & Company Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{req.name}</span>
                      {req.status === 'pending' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          PENDENTE
                        </span>
                      ) : req.status === 'approved' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          APROVADO ({req.licenseDays || 30} DIAS)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          REJEITADO
                        </span>
                      )}
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

                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Cadastrado em: {new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                      {req.expiresAt && (
                        <span className="text-purple-300 font-semibold">
                          Expira em: {formatDateBR(req.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions & Direct Contacts */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
                    {/* WhatsApp Quick Action */}
                    {cleanPhone && (
                      <a
                        href={`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá ${req.name}, sou o Rogério do Fluxo ERP. Vi seu cadastro para a empresa ${req.companyName}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Conversar no WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    )}

                    {/* Email Quick Action */}
                    <a
                      href={`mailto:${req.email}?subject=${encodeURIComponent(`Acesso Fluxo ERP - ${req.companyName}`)}`}
                      className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5"
                      title="Enviar e-mail"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">E-mail</span>
                    </a>

                    {/* 1-Click License Days Buttons */}
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10">
                      <span className="text-[10px] font-bold text-slate-400 px-1.5 uppercase">Liberar:</span>
                      {([30, 90, 180, 365] as const).map((days) => (
                        <button
                          key={days}
                          onClick={() => handleApprove(req, days)}
                          disabled={isActionLoading}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-400/10 hover:bg-teal-400 hover:text-slate-950 text-teal-300 border border-teal-500/30 transition-all cursor-pointer disabled:opacity-50"
                          title={`Liberar validade de ${days} dias`}
                        >
                          {days === 365 ? '1 Ano' : `${days}d`}
                        </button>
                      ))}
                    </div>

                    {/* Reject button */}
                    {req.status !== 'rejected' && (
                      <button
                        onClick={() => handleReject(req)}
                        disabled={isActionLoading}
                        className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 text-xs transition-colors cursor-pointer"
                        title="Rejeitar / Revogar Acesso"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
