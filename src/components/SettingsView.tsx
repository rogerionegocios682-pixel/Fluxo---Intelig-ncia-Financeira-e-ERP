import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Users,
  Upload,
  Trash2,
  Database,
  CheckCircle2,
  UserPlus,
  Image as ImageIcon,
  Copy,
  Check,
  Phone,
  FileText,
  MapPin,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { AuthSession, CompanyDatabase, UserRole } from '../types';
import { FirebaseService } from '../services/firebase';

interface SettingsViewProps {
  data: CompanyDatabase;
  session: AuthSession;
  onRefreshData?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  session,
}) => {
  // Company Profile state
  const [name, setName] = useState(data.profile.name || '');
  const [tradeName, setTradeName] = useState(data.profile.tradeName || '');
  const [cnpj, setCnpj] = useState(data.profile.cnpj || '');
  const [phone, setPhone] = useState(data.profile.phone || '');
  const [address, setAddress] = useState(data.profile.address || '');
  const [city, setCity] = useState(data.profile.city || '');
  const [state, setState] = useState(data.profile.state || '');
  const [dailyLimit, setDailyLimit] = useState<number | ''>(data.profile.dailyLimit || 15000);
  const [protectedDay, setProtectedDay] = useState<number | ''>(data.profile.protectedDay || 20);
  const [logoBase64, setLogoBase64] = useState<string>(data.profile.logo || '');

  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collaborator form state
  const [newColabName, setNewColabName] = useState('');
  const [newColabEmail, setNewColabEmail] = useState('');
  const [newColabDept, setNewColabDept] = useState('Contas a Pagar');
  const [newColabRole, setNewColabRole] = useState<UserRole>('collaborator');
  const [teamMsg, setTeamMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAddingColab, setIsAddingColab] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearDataMsg, setClearDataMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(data.profile.name || '');
    setTradeName(data.profile.tradeName || '');
    setCnpj(data.profile.cnpj || '');
    setPhone(data.profile.phone || '');
    setAddress(data.profile.address || '');
    setCity(data.profile.city || '');
    setState(data.profile.state || '');
    setDailyLimit(data.profile.dailyLimit || 15000);
    setProtectedDay(data.profile.protectedDay || 20);
    setLogoBase64(data.profile.logo || '');
  }, [data.profile]);

  // Format CNPJ as 00.000.000/0000-00
  const formatCNPJ = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 2) return raw;
    if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
    if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
  };

  // Format Phone as (00) 00000-0000 or (00) 0000-0000
  const formatPhone = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11);
    if (raw.length <= 2) return raw.length > 0 ? `(${raw}` : '';
    if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  };

  // Handle Logo file upload (resizes/compresses if needed for Firestore)
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setProfileErrorMsg('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setProfileErrorMsg('A imagem é muito pesada. Escolha uma imagem de até 1.5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.src = event.target.result as string;
        img.onload = () => {
          // Scale down if image is huge to optimize Firestore document size
          const canvas = document.createElement('canvas');
          const maxDimension = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setLogoBase64(optimizedBase64);
            setProfileErrorMsg(null);
          }
        };
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(data.profile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    const dLim = typeof dailyLimit === 'number' ? dailyLimit : parseFloat(dailyLimit) || 15000;
    const pDay = typeof protectedDay === 'number' ? protectedDay : parseInt(protectedDay, 10) || 20;

    try {
      await FirebaseService.updateCompanyProfile(data.profile.id, {
        name: name.trim() || 'Minha Empresa',
        tradeName: tradeName.trim(),
        cnpj: cnpj.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        dailyLimit: dLim,
        protectedDay: pDay,
        logo: logoBase64,
      });

      setProfileSuccessMsg('Logomarca, CNPJ, telefone e perfil atualizados no Firestore com sucesso!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      setProfileErrorMsg('Erro ao atualizar informações no Firestore. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamMsg(null);

    if (!newColabName.trim() || !newColabEmail.trim()) {
      setTeamMsg({ type: 'error', text: 'Preencha o nome e e-mail do colaborador.' });
      return;
    }

    setIsAddingColab(true);
    try {
      await FirebaseService.addCollaborator(data.profile.id, {
        name: newColabName.trim(),
        email: newColabEmail.trim(),
        department: newColabDept.trim() || 'Geral',
        role: newColabRole,
      });

      setTeamMsg({
        type: 'success',
        text: `Colaborador ${newColabName} adicionado à equipe no Firestore! Ele pode acessar utilizando a conta Google e o ID da empresa.`,
      });
      setNewColabName('');
      setNewColabEmail('');
    } catch (err: any) {
      console.error(err);
      setTeamMsg({ type: 'error', text: 'Erro ao cadastrar colaborador no Firestore.' });
    } finally {
      setIsAddingColab(false);
    }
  };

  const handleRemoveCollaborator = async (colabId: string, colabName: string) => {
    if (confirm(`Deseja revogar o acesso de "${colabName}" nesta empresa?`)) {
      try {
        await FirebaseService.removeCollaborator(data.profile.id, colabId);
        setTeamMsg({ type: 'success', text: 'Acesso do colaborador revogado com sucesso.' });
      } catch (err: any) {
        console.error(err);
        setTeamMsg({ type: 'error', text: 'Erro ao remover colaborador.' });
      }
    }
  };

  const handleClearAllData = async () => {
    const confirmation = window.confirm(
      'Tem certeza que deseja ZERAR todos os dados desta empresa?\n\nIsso apagará permanentemente todas as contas a pagar, compras e fornecedores, deixando o sistema completamente limpo (com valores zerados).'
    );
    if (!confirmation) return;

    setIsClearingData(true);
    setClearDataMsg(null);
    try {
      await FirebaseService.clearAllCompanyData(data.profile.id);
      setClearDataMsg('Todos os dados foram zerados com sucesso! O sistema está limpo para novos cadastros.');
      setTimeout(() => setClearDataMsg(null), 5000);
    } catch (err: any) {
      console.error('Erro ao limpar dados:', err);
      alert('Ocorreu um erro ao zerar os dados.');
    } finally {
      setIsClearingData(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
          Configurações da Empresa & Gestão de Equipe
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          CNPJ, telefone, logotipo da empresa, limites operacionais e controle de acessos no Firebase Firestore
        </p>
      </div>

      {/* Cloud DB Connection Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-purple-950/40 border border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-white">Banco em Nuvem (Firestore)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-400 text-slate-950">
                SINCRONIZAÇÃO ATIVA
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-300">Código ID da Empresa:</span>
              <code className="font-mono text-xs text-teal-300 bg-slate-950/60 px-2 py-0.5 rounded border border-white/10 select-all">
                {data.profile.id}
              </code>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 rounded text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                title="Copiar ID para convidar colaboradores"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <div className="text-xs font-bold text-slate-300">
            {data.collaborators.length} {data.collaborators.length === 1 ? 'Membro Conectado' : 'Membros Conectados'}
          </div>
          <div className="text-[11px] text-teal-400 font-medium flex items-center gap-1.5 justify-start sm:justify-end">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multi-Dispositivo em Tempo Real</span>
          </div>
        </div>
      </div>

      {/* Grid: Profile Form & Limits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Company Profile (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-teal-400" />
              1. Identidade, CNPJ e Logomarca
            </h3>
            <span className="text-[11px] text-slate-400">Documento Firestore</span>
          </div>

          {profileSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <span className="shrink-0">⚠️</span>
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Logomarca Upload Section */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Logomarca da Empresa</span>
                </label>
                {logoBase64 && (
                  <span className="text-[10px] text-teal-400 font-medium">Logomarca Carregada</span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Logo Preview box */}
                <div className="relative group shrink-0">
                  {logoBase64 ? (
                    <div className="relative">
                      <img
                        src={logoBase64}
                        alt="Logomarca"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-teal-500/40 shadow-lg bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoBase64('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute -top-2 -right-2 p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-md text-xs transition-transform active:scale-90 cursor-pointer"
                        title="Remover logomarca"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 gap-1">
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                      <span className="text-[9px] font-semibold">Sem Logo</span>
                    </div>
                  )}
                </div>

                {/* Upload Button and Dropzone instructions */}
                <div className="flex-1 w-full space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="company-logo-file"
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="company-logo-file"
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10 hover:border-teal-400 text-teal-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-center"
                  >
                    <Upload className="w-4 h-4 text-teal-400" />
                    <span>{logoBase64 ? 'Alterar Logomarca' : 'Carregar Imagem da Logomarca'}</span>
                  </label>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Formatos suportados: PNG, JPG ou WebP. A logomarca será exibida no menu lateral e cabeçalho.
                  </p>
                </div>
              </div>
            </div>

            {/* CNPJ and Phone row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  CNPJ da Empresa
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    maxLength={18}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>
            </div>

            {/* Names row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Razão Social
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome empresarial oficial"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  placeholder="Ex: Comercial Maré Ltda"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Endereço da Empresa
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Avenida, Rua, Número, Bairro"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Estado (UF)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white uppercase focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
            </div>

            {/* Financial Risk & Alerts */}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <h4 className="font-semibold text-xs text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Parâmetros de Risco e Alertas</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Limite Diário Sugerido (R$)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={dailyLimit}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setDailyLimit(val);
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-sm font-bold text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Dia Protegido do Mês (1 a 31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={protectedDay}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      setProtectedDay(val);
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-sm font-bold text-purple-300 focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-xl font-bold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando no Firestore...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Dados da Empresa no Firestore</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Gestão de Equipe / Colaboradores (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-white/[0.06] pb-3">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                2. Gestão de Equipe & Acessos
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Adicione colaboradores para sincronizar em tempo real no banco Firestore desta empresa.
              </p>
            </div>

            {teamMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  teamMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                <span>{teamMsg.text}</span>
              </div>
            )}

            {/* Add Colaborador Form */}
            <form onSubmit={handleAddCollaborator} className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/20 space-y-3">
              <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                <span>Adicionar Colaborador à Equipe</span>
              </div>

              <div>
                <input
                  type="text"
                  required
                  value={newColabName}
                  onChange={(e) => setNewColabName(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <input
                  type="email"
                  required
                  value={newColabEmail}
                  onChange={(e) => setNewColabEmail(e.target.value)}
                  placeholder="E-mail Google do colaborador"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newColabDept}
                  onChange={(e) => setNewColabDept(e.target.value)}
                  placeholder="Departamento"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                />
                <select
                  value={newColabRole}
                  onChange={(e) => setNewColabRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="collaborator">Colaborador</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="compras">Compras</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isAddingColab}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-500 text-white hover:bg-purple-400 transition-all cursor-pointer shadow-md shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isAddingColab ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>+ Adicionar à Empresa na Nuvem</span>
              </button>
            </form>

            {/* List of active collaborators */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Colaboradores na Nuvem ({data.collaborators.length})
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.collaborators.map((colab) => (
                  <div
                    key={colab.id}
                    className="p-3 rounded-xl bg-slate-900 border border-white/[0.06] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-1.5">
                        <span>{colab.name}</span>
                        {colab.role === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 text-[9px] font-bold">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {colab.email} • {colab.department}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveCollaborator(colab.id, colab.name)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                      title="Remover Colaborador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone: Clear/Wipe Data to Start Clean with 0 Values */}
      <div className="bg-[#0f172a] border border-rose-500/30 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <h3 className="font-display font-bold text-base text-rose-200">
                Zerar Todos os Dados da Empresa (Começar do Zero)
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Exclui permanentemente todos os boletos, simulações de compras e fornecedores desta empresa. A empresa iniciará 100% limpa, sem nenhum valor fictício, pronta para você cadastrar seus dados reais.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearAllData}
            disabled={isClearingData}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isClearingData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{isClearingData ? 'Limpando Dados...' : 'Zerar e Limpar Todos os Dados'}</span>
          </button>
        </div>

        {clearDataMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{clearDataMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
