import React, { useState } from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Database,
  Cloud,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Phone,
  KeyRound,
  Loader2,
  AlertCircle,
  HelpCircle,
  Clock,
  Send,
  MessageSquare,
  LogOut,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { FirebaseService, SUPER_ADMIN_EMAIL, auth } from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { UserAccount } from '../types';

interface AuthViewProps {
  onAuthSuccess: (user: FirebaseUser, companyId: string, profile?: UserAccount) => void;
}

type AuthTab = 'login' | 'signup' | 'forgot' | 'company_setup' | 'master_login';

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccount | null>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Master Login Form
  const [masterEmail, setMasterEmail] = useState('rogerionegocios682@gmail.com');
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // Reset Password Form
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Company Setup Form (if needed)
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [joinCompanyId, setJoinCompanyId] = useState('');
  const [companyMode, setCompanyMode] = useState<'create' | 'join'>('create');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phone mask helper
  const formatPhone = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw.length > 0 ? `(${raw}` : '';
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  // 1. EMAIL & PASSWORD LOGIN (LOJA / PADRÃO)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Direct master check if logging in with master credentials in standard form
      if (FirebaseService.isMasterEmail(loginEmail)) {
        try {
          const { user, profile } = await FirebaseService.authenticateMaster(loginPassword, loginEmail);
          setCurrentUser(user);
          setUserProfile(profile);
          onAuthSuccess(user, 'master', profile);
          return;
        } catch {
          // fallback to regular login flow below
        }
      }

      const user = await FirebaseService.loginWithEmail(loginEmail, loginPassword);
      setCurrentUser(user);

      // Master user bypass
      const isMaster = FirebaseService.isMasterEmail(user.email);

      // Check profile in Firestore with email fallback
      let profile = await FirebaseService.getUserProfile(user.uid, user.email || loginEmail);

      // If profile is missing or lacks companyId, search company by email to auto-link
      if ((!profile || !profile.companyId) && !isMaster) {
        const comp = await FirebaseService.findCompanyByEmail(user.email || loginEmail);
        if (comp) {
          profile = {
            uid: user.uid,
            email: user.email || loginEmail.trim().toLowerCase(),
            name: comp.managerName || comp.name,
            companyId: comp.id,
            companyName: comp.name,
            phone: comp.phone,
            role: 'admin',
            department: 'Diretoria',
            status: comp.status === 'BLOQUEADA' ? 'BLOQUEADO' : 'ATIVO',
            approvalStatus: 'approved',
            licenseDays: 365,
            expiresAt: '2099-12-31',
            createdAt: comp.createdAt || new Date().toISOString(),
            lastAccessAt: new Date().toISOString(),
          };
          try {
            await FirebaseService.saveUserProfile(user.uid, profile);
          } catch {}
        }
      }

      if (profile) {
        setUserProfile(profile);

        if (!isMaster) {
          // Check user access status
          if (profile.status === 'BLOQUEADO' || profile.approvalStatus === 'rejected') {
            setError('O seu acesso de usuário está temporariamente bloqueado. Entre em contato com o administrador.');
            setLoading(false);
            return;
          }

          // Check store status
          if (profile.companyId) {
            const companyDoc = await FirebaseService.getCompanyProfile(profile.companyId);
            if (companyDoc) {
              if (companyDoc.status === 'BLOQUEADA') {
                setError('O acesso desta loja está temporariamente bloqueado. Entre em contato com o administrador.');
                setLoading(false);
                return;
              }
            }
          }
        }

        if (profile.companyId || isMaster) {
          onAuthSuccess(user, profile.companyId || 'master', profile);
          return;
        }
      }

      // If master with no company
      if (isMaster) {
        onAuthSuccess(user, 'master', profile || undefined);
        return;
      }

      // If no company linked, transition to company setup
      setActiveTab('company_setup');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas sem sucesso. Aguarde alguns instantes.');
      } else {
        setError(err.message || 'Falha ao autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 1.1 MASTER LOGIN (DISCRETO)
  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user, profile } = await FirebaseService.authenticateMaster(
        masterPassword,
        masterEmail
      );

      setCurrentUser(user);
      setUserProfile(profile);
      onAuthSuccess(user, profile.companyId || 'master');
    } catch (err: any) {
      console.error('Master login error:', err);
      setError('Usuário ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  // 2. EMAIL & PASSWORD REGISTRATION
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    if (!regCompanyName.trim()) {
      setError('Informe o nome da sua empresa.');
      return;
    }

    setLoading(true);
    try {
      // Create Firebase Auth / Database user
      const user = await FirebaseService.registerWithEmail(
        regEmail,
        regPassword,
        regCompanyName.trim(),
        regCompanyName.trim(),
        regPhone.trim()
      );
      setCurrentUser(user);

      // Create company and access request
      const { companyId } = await FirebaseService.createCompanyOnCloud(
        regCompanyName.trim(),
        user,
        regPhone.trim(),
        regPassword,
        regCompanyName.trim()
      );

      // Fetch newly created profile
      const profile = await FirebaseService.getUserProfile(user.uid);
      if (profile) {
        setUserProfile(profile);
      }

      setSuccessMsg(`Cadastro realizado com sucesso! Conectado ao banco de dados.`);
      onAuthSuccess(user, companyId);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Faça login ou recupere sua senha.');
      } else {
        setError(err.message || 'Erro ao realizar cadastro.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. GOOGLE SIGN IN
  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await FirebaseService.loginWithGoogle();
      setCurrentUser(user);

      // Direct master check for Google auth
      if (FirebaseService.isMasterEmail(user.email)) {
        let masterProf = await FirebaseService.getUserProfile(user.uid);
        if (!masterProf) {
          masterProf = {
            uid: user.uid,
            email: SUPER_ADMIN_EMAIL,
            name: user.displayName || 'Administrador Master',
            companyId: 'master',
            companyName: 'Painel Central Master',
            role: 'master',
            department: 'Administração Geral',
            status: 'ATIVO',
            approvalStatus: 'approved',
            licenseDays: 365,
            expiresAt: '2099-12-31',
            createdAt: new Date().toISOString(),
            lastAccessAt: new Date().toISOString(),
          };
          await FirebaseService.saveUserProfile(user.uid, masterProf);
        }
        setUserProfile(masterProf);
        onAuthSuccess(user, 'master');
        return;
      }

      const profile = await FirebaseService.getUserProfile(user.uid);
      if (profile && profile.companyId) {
        setUserProfile(profile);
        onAuthSuccess(user, profile.companyId);
        return;
      }

      // If no company linked, prompt to create
      setActiveTab('company_setup');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao autenticar com o Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 4. PASSWORD RESET
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError('Informe o seu e-mail para recuperação.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await FirebaseService.resetPassword(resetEmail.trim());
      setResetSent(true);
      setSuccessMsg(`Link de redefinição de senha enviado para ${resetEmail}. Verifique sua caixa de entrada.`);
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível enviar o e-mail de recuperação. Verifique o endereço digitado.');
    } finally {
      setLoading(false);
    }
  };

  // 5. COMPANY CREATION (Post-Google or existing user setup)
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!companyName.trim()) {
      setError('Informe o nome da sua empresa.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await FirebaseService.createCompanyOnCloud(companyName.trim(), currentUser, companyPhone);
      const profile = await FirebaseService.getUserProfile(currentUser.uid);
      if (profile) setUserProfile(profile);
      onAuthSuccess(currentUser, res.companyId);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar banco de dados da empresa no Firestore.');
    } finally {
      setLoading(false);
    }
  };

  // 6. JOIN COMPANY VIA ID
  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!joinCompanyId.trim()) {
      setError('Informe o ID da empresa para ingressar.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const cleanId = joinCompanyId.trim();
      await FirebaseService.saveUserProfile(currentUser.uid, {
        uid: currentUser.uid,
        email: currentUser.email || '',
        name: currentUser.displayName || 'Colaborador',
        companyId: cleanId,
        role: 'collaborator',
        department: 'Operações',
        approvalStatus: currentUser.email === SUPER_ADMIN_EMAIL ? 'approved' : 'pending',
        createdAt: new Date().toISOString(),
      });

      await FirebaseService.addCollaborator(cleanId, {
        email: currentUser.email || '',
        name: currentUser.displayName || 'Colaborador',
        role: 'collaborator',
        department: 'Operações',
      });

      const profile = await FirebaseService.getUserProfile(currentUser.uid);
      if (profile) setUserProfile(profile);

      onAuthSuccess(currentUser, cleanId);
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível conectar à empresa informada. Verifique o ID digitado.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await FirebaseService.logout();
    setCurrentUser(null);
    setUserProfile(null);
    setActiveTab('login');
  };

  // Check if current user is waiting for approval
  const isPendingApproval = userProfile && userProfile.approvalStatus === 'pending' && userProfile.email !== SUPER_ADMIN_EMAIL;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#050810] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-400 to-teal-600 text-slate-950 shadow-xl shadow-teal-500/20 mb-3 font-black text-2xl">
            F
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            FLUXO <span className="text-teal-400 text-lg font-mono">ERP</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            Inteligência Financeira, Gestão de Prazos e Contas a Pagar
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0f172a]/95 border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-5">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SCREEN: PENDING LICENSE APPROVAL */}
          {isPendingApproval ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Cadastro em Análise de Licença
                </h3>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  AGUARDANDO LIBERAÇÃO
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 text-left text-xs space-y-2 text-slate-300">
                <p className="leading-relaxed">
                  Sua solicitação de cadastro foi registrada e enviada para o administrador{' '}
                  <strong className="text-teal-400 font-mono">{SUPER_ADMIN_EMAIL}</strong> para liberação da validade de uso (<strong>30, 90, 180 ou 365 dias</strong>).
                </p>
                <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 space-y-1">
                  <div><strong>E-mail:</strong> {userProfile?.email}</div>
                  <div><strong>Empresa:</strong> {userProfile?.companyName || 'Empresa Cadastrada'}</div>
                  <div><strong>Status:</strong> Pendente de autorização do administrador</div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`https://wa.me/5511999999999?text=${encodeURIComponent(`Olá Rogério, acabei de me cadastrar no Fluxo ERP com o e-mail ${userProfile?.email} para a empresa ${userProfile?.companyName || ''}. Gostaria de solicitar a liberação do meu acesso.`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Falar com o Administrador via WhatsApp</span>
                </a>

                <a
                  href={`mailto:${SUPER_ADMIN_EMAIL}?subject=${encodeURIComponent(`Solicitação de Liberação de Licença - Fluxo ERP (${userProfile?.companyName || userProfile?.email})`)}&body=${encodeURIComponent(`Olá Rogério,\n\nSolicito a aprovação e liberação do acesso ao Fluxo ERP para:\nE-mail: ${userProfile?.email}\nNome: ${userProfile?.name}\nEmpresa: ${userProfile?.companyName}\nTelefone: ${userProfile?.phone}\n\nObrigado!`)}`}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                >
                  <Send className="w-4 h-4 text-teal-400" />
                  <span>Enviar E-mail para {SUPER_ADMIN_EMAIL}</span>
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true);
                    if (currentUser) {
                      const updated = await FirebaseService.getUserProfile(currentUser.uid);
                      if (updated) {
                        setUserProfile(updated);
                        if (updated.approvalStatus === 'approved' && updated.companyId) {
                          onAuthSuccess(currentUser, updated.companyId);
                        } else {
                          setError('Seu acesso ainda está pendente de liberação pelo administrador.');
                        }
                      }
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Verificar se Já Fui Liberado</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer pt-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair desta conta</span>
                </button>
              </div>
            </div>
          ) : activeTab === 'company_setup' ? (
            /* SCREEN: COMPANY SETUP (Post-auth) */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span>Conectado como: <strong>{currentUser?.email}</strong></span>
              </div>

              {/* Tabs: Create vs Join */}
              <div className="flex rounded-xl bg-slate-900 p-1 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyMode('create');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    companyMode === 'create'
                      ? 'bg-teal-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cadastrar Minha Empresa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompanyMode('join');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    companyMode === 'join'
                      ? 'bg-teal-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar com Código ID
                </button>
              </div>

              {companyMode === 'create' ? (
                <form onSubmit={handleCreateCompany} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Razão Social / Nome da Empresa
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Comercial Maré Ltda"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Telefone / WhatsApp de Contato
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(formatPhone(e.target.value))}
                        placeholder="(11) 98765-4321"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20"
                  >
                    <span>{loading ? 'Criando banco na nuvem...' : 'Criar Empresa & Acessar'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoinCompany} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Código ID da Empresa (fornecido pelo Administrador)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={joinCompanyId}
                        onChange={(e) => setJoinCompanyId(e.target.value)}
                        placeholder="Ex: emp_123456_abcde"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-purple-500 text-white hover:bg-purple-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-purple-500/20"
                  >
                    <span>{loading ? 'Conectando...' : 'Conectar à Empresa'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* SCREEN: AUTH NAVIGATION (Login, Signup, Forgot) */
            <div className="space-y-4">
              {/* Header Navigation Tabs */}
              <div className="flex rounded-xl bg-slate-900 p-1 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'login'
                      ? 'bg-teal-400 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'signup'
                      ? 'bg-teal-400 text-slate-950 font-bold shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Novo Cadastro
                </button>
              </div>

              {/* TAB 1: LOGIN (EMAIL & PASSWORD) */}
              {activeTab === 'login' && (
                <form onSubmit={handleEmailLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      E-mail de Acesso
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="seuemail@empresa.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('forgot');
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] text-teal-400 hover:underline cursor-pointer"
                      >
                        Esqueci a senha
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20 active:scale-[0.99]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Entrando...' : 'Entrar no Sistema'}</span>
                  </button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-[#0f172a] px-2 text-slate-400 font-bold">ou continue com</span>
                    </div>
                  </div>

                  {/* Google Login Fast Button */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-900 border border-white/10 text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                    </svg>
                    <span>Entrar com Conta Google</span>
                  </button>
                </form>
              )}

              {/* TAB 2: SIGN UP (NOVO CADASTRO) */}
              {activeTab === 'signup' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Nome Completo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      E-mail Corporativo
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="seuemail@empresa.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Nome da Empresa
                      </label>
                      <input
                        type="text"
                        required
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        placeholder="Ex: Maré Distribuidora"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(formatPhone(e.target.value))}
                        placeholder="(11) 98765-4321"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Senha
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 dígitos"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Confirmar Senha
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  {/* Notice about email verification and validity */}
                  <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-[11px] text-purple-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-purple-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                      <span>Liberação de Validade de Licença</span>
                    </div>
                    <p className="leading-tight">
                      Ao criar sua conta, seus dados são enviados para <strong>{SUPER_ADMIN_EMAIL}</strong> para concessão da licença de 30, 90, 180 ou 365 dias de uso.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl font-bold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20 active:scale-[0.99]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Criando Conta...' : 'Cadastrar e Solicitar Acesso'}</span>
                  </button>

                  {/* Google Fast Signup Alternative */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-slate-900 border border-white/10 text-white hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z" />
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                      </svg>
                      <span>Cadastrar Rápido com Google</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: FORGOT PASSWORD (ESQUECI A SENHA) */}
              {activeTab === 'forgot' && (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-base text-white">
                      Recuperação de Senha
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Informe o e-mail cadastrado para receber as instruções de redefinição de senha.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      E-mail Cadastrado
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="seuemail@empresa.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('login');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-white/10"
                    >
                      Voltar ao Login
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-teal-500/20"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>{loading ? 'Enviando...' : 'Enviar Link de Recuperação'}</span>
                    </button>
                  </div>
                </form>
              )}
              {/* TAB 4: MASTER LOGIN (ACESSO ADMINISTRATIVO DISCRETO) */}
              {activeTab === 'master_login' && (
                <form onSubmit={handleMasterLogin} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs">
                    <div className="flex items-center gap-2 font-bold text-purple-200">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>Acesso Administrativo Master</span>
                    </div>
                    <p className="text-[11px] text-purple-300/80 mt-1">
                      Área restrita de controle centralizado de lojas, usuários e auditoria.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Usuário / E-mail Master
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={masterEmail}
                        onChange={(e) => setMasterEmail(e.target.value)}
                        placeholder="Identificação Master"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Senha Master
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showMasterPassword ? 'text' : 'password'}
                        required
                        value={masterPassword}
                        onChange={(e) => setMasterPassword(e.target.value)}
                        placeholder="Digite a senha Master (@eRro404)"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMasterPassword(!showMasterPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        title={showMasterPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showMasterPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('login');
                        setError(null);
                        setSuccessMsg(null);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-white/10 cursor-pointer"
                    >
                      Voltar
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-purple-500 text-white hover:bg-purple-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-purple-500/20"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                      <span>{loading ? 'Validando...' : 'Acessar Painel Master'}</span>
                    </button>
                  </div>

                  {/* Option for Google Master Sign In */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Entrar como Master com Google</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Discrete Master Access Footer Link */}
        {activeTab !== 'master_login' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setActiveTab('master_login');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-[11px] text-slate-500 hover:text-purple-300 transition-colors inline-flex items-center gap-1 cursor-pointer opacity-70 hover:opacity-100"
            >
              <KeyRound className="w-3 h-3" />
              <span>Acesso administrativo</span>
            </button>
          </div>
        )}

        {/* Feature badge */}
        <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-teal-400" />
            Firestore Cloud DB
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Controle de Licenças (30 a 365 dias)
          </span>
        </div>
      </div>
    </div>
  );
};
