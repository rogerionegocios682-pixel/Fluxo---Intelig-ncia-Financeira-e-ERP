import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Building2,
  Tag,
  Receipt,
  ArrowRight,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Database,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CompanyDatabase, Supplier } from '../types';
import { formatMoney } from '../services/storage';
import { FirebaseService, db } from '../services/firebase';

interface SuppliersViewProps {
  data: CompanyDatabase;
  onRefreshData?: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  data,
  onRefreshData,
}) => {
  const companyId = data?.profile?.id && data.profile.id !== 'master' && data.profile.id !== 'master_default'
    ? data.profile.id
    : 'master_control';

  const [realtimeSuppliers, setRealtimeSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Alimentos & Bebidas');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Directly subscribe to Firestore suppliers subcollection for real-time persistence
  useEffect(() => {
    if (!companyId) return;

    const unsub = onSnapshot(
      collection(db, 'companies', companyId, 'suppliers'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Supplier));
        setRealtimeSuppliers(list);
      },
      (error) => {
        console.warn('Realtime suppliers sync notice in SuppliersView:', error);
      }
    );

    return () => unsub();
  }, [companyId]);

  // Prioritize direct real-time snapshot list; fallback to data.suppliers if initial query is syncing
  const activeSuppliersList = realtimeSuppliers.length > 0 || data.suppliers.length === 0
    ? realtimeSuppliers
    : data.suppliers;

  const filteredSuppliers = activeSuppliersList.filter((s) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q)) ||
      (s.cnpj && s.cnpj.includes(q))
    );
  });

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      await FirebaseService.addSupplier(companyId, {
        name: name.trim(),
        cnpj: cnpj.trim(),
        phone: phone.trim(),
        category: category.trim(),
      });

      setIsNewSupplierOpen(false);
      setName('');
      setCnpj('');
      setPhone('');
      setSuccessMsg('Fornecedor salvo com sucesso no banco de dados Firestore!');
      setTimeout(() => setSuccessMsg(null), 4000);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao salvar fornecedor no banco de dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    if (!window.confirm(`Deseja realmente remover o fornecedor "${supplierName}" do banco de dados?`)) {
      return;
    }

    try {
      await FirebaseService.deleteSupplier(companyId, supplierId);
      setSuccessMsg(`Fornecedor "${supplierName}" removido do banco de dados.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      alert('Erro ao excluir fornecedor do Firestore.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs sm:text-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs sm:text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
              Cadastro de Fornecedores
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              <Database className="w-3 h-3 text-teal-400" />
              <span>{activeSuppliersList.length} {activeSuppliersList.length === 1 ? 'salvo' : 'salvos'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Gerencie parceiros comerciais integrados e sincronizados em tempo real no banco de dados Firestore
          </p>
        </div>

        <button
          onClick={() => setIsNewSupplierOpen(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Fornecedor</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, categoria ou CNPJ..."
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum fornecedor encontrado</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum fornecedor corresponde aos termos da pesquisa digitada.'
              : 'Nenhum fornecedor cadastrado no banco de dados. Cadastre parceiros para sincronizar compras e prazos.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsNewSupplierOpen(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-teal-400 text-slate-950 rounded-xl text-xs font-bold hover:bg-teal-300 transition-all cursor-pointer shadow-lg shadow-teal-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Primeiro Fornecedor</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredSuppliers.map((supplier) => {
            // Calculate stats for this supplier
            const supplierBills = data.bills.filter(
              (b) => b.supplierName.toLowerCase() === supplier.name.toLowerCase()
            );
            const totalSpent = supplierBills.reduce((s, b) => s + b.amount, 0);
            const pendingBills = supplierBills.filter((b) => b.status === 'Pendente');

            return (
              <div
                key={supplier.id}
                className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 hover:border-teal-500/30 transition-all space-y-4 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">{supplier.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-white/10">
                          {supplier.category || 'Geral'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                      title="Excluir fornecedor do banco de dados"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    {supplier.cnpj && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{supplier.cnpj}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block">Total Comprado</span>
                    <span className="font-mono font-bold text-white">{formatMoney(totalSpent)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase text-slate-400 block">Boletos Pendentes</span>
                    <span className="font-mono font-bold text-amber-300">
                      {pendingBills.length} {pendingBills.length === 1 ? 'título' : 'títulos'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Supplier */}
      {isNewSupplierOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-teal-400" />
                <h3 className="font-display font-bold text-base text-white">
                  Cadastrar Fornecedor no Banco de Dados
                </h3>
              </div>
              <button
                onClick={() => setIsNewSupplierOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome / Razão Social do Fornecedor
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: JBS Alimentos S.A."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Categoria
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Carnes, Bebidas, Limpeza"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Salvando no Banco...' : 'Salvar no Banco de Dados'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
