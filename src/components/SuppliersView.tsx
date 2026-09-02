import React, { useState } from 'react';
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
} from 'lucide-react';
import { CompanyDatabase, Supplier } from '../types';
import { formatMoney } from '../services/storage';
import { FirebaseService } from '../services/firebase';

interface SuppliersViewProps {
  data: CompanyDatabase;
  onRefreshData?: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  data,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewSupplierOpen, setIsNewSupplierOpen] = useState(false);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Alimentos & Bebidas');
  const [loading, setLoading] = useState(false);

  const filteredSuppliers = data.suppliers.filter((s) => {
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
    try {
      await FirebaseService.addSupplier(data.profile.id, {
        name: name.trim(),
        cnpj: cnpj.trim(),
        phone: phone.trim(),
        category: category.trim(),
      });

      setIsNewSupplierOpen(false);
      setName('');
      setCnpj('');
      setPhone('');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar fornecedor no Firestore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
            Cadastro de Fornecedores
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Gerencie parceiros comerciais e acompanhe o histórico de compras em tempo real
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
              className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 hover:border-teal-500/30 transition-all space-y-4 flex flex-col justify-between"
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

      {/* Modal: New Supplier */}
      {isNewSupplierOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-base text-white">
                Cadastrar Fornecedor no Firestore
              </h3>
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
                  {loading ? 'Salvando...' : 'Salvar no Firestore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
