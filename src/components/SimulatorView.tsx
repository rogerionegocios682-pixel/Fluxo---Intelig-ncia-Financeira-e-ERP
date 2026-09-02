import React, { useState } from 'react';
import {
  Calculator,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Plus,
  ArrowRight,
  Sparkles,
  Info,
  DollarSign,
  Building2,
  FileText,
} from 'lucide-react';
import { CompanyDatabase, NavigationRoute, Supplier } from '../types';
import { formatMoney, formatDateBR, getTodayISO, addDaysToISO } from '../services/storage';
import { FirebaseService } from '../services/firebase';

interface SimulatorViewProps {
  data: CompanyDatabase;
  onNavigate: (route: NavigationRoute) => void;
  onRefreshData?: () => void;
}

const PRESET_TERMS = [3, 5, 7, 8, 14, 21, 28, 31, 45];

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  data,
  onNavigate,
}) => {
  const today = getTodayISO();
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [baseDate, setBaseDate] = useState<string>(today);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedTerms, setSelectedTerms] = useState<number[]>([7, 14, 21]);
  const [customTermInput, setCustomTermInput] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleTerm = (term: number) => {
    setSuccessMessage(null);
    if (selectedTerms.includes(term)) {
      if (selectedTerms.length > 1) {
        setSelectedTerms(selectedTerms.filter((t) => t !== term));
      }
    } else {
      setSelectedTerms([...selectedTerms, term]);
    }
  };

  const addCustomTerm = () => {
    const termNum = parseInt(customTermInput, 10);
    if (termNum && termNum > 0 && !selectedTerms.includes(termNum)) {
      setSelectedTerms([...selectedTerms, termNum]);
      setCustomTermInput('');
    }
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setSupplierId('');
      setSupplierName('');
    } else {
      const sup = data.suppliers.find((s) => s.id === val);
      if (sup) {
        setSupplierId(sup.id);
        setSupplierName(sup.name);
      }
    }
  };

  // Calculation of Installments
  const numVal = typeof totalAmount === 'number' ? totalAmount : parseFloat(totalAmount) || 0;
  const partsCount = selectedTerms.length;
  const sortedTerms = [...selectedTerms].sort((a, b) => a - b);
  const partAmount = partsCount > 0 ? Math.round((numVal / partsCount) * 100) / 100 : 0;

  const protectedDay = data.profile.protectedDay || 20;

  // Analysis of each projected installment
  const projectedInstallments = sortedTerms.map((days, index) => {
    const dueDate = addDaysToISO(baseDate, days);
    const isLast = index === partsCount - 1;
    const thisAmount = isLast ? numVal - partAmount * (partsCount - 1) : partAmount;

    // Existing bills on this due date
    const existingBillsOnDay = data.bills.filter((b) => b.dueDate === dueDate && b.status === 'Pendente');
    const existingTotalOnDay = existingBillsOnDay.reduce((s, b) => s + b.amount, 0);
    const combinedTotal = existingTotalOnDay + thisAmount;

    const dueDayNumber = parseInt(dueDate.split('-')[2], 10);
    const isProtected = dueDayNumber === protectedDay;
    const isOverLimit = combinedTotal > data.profile.dailyLimit;
    const isNearLimit = combinedTotal > data.profile.dailyLimit * 0.8 && !isOverLimit;

    return {
      index: index + 1,
      days,
      dueDate,
      amount: thisAmount,
      existingTotalOnDay,
      combinedTotal,
      isProtected,
      isOverLimit,
      isNearLimit,
    };
  });

  const handleLaunchPurchase = async () => {
    if (!numVal || numVal <= 0) {
      alert('Informe um valor válido para a compra.');
      return;
    }

    if (selectedTerms.length === 0) {
      alert('Selecione ao menos um prazo de vencimento.');
      return;
    }

    setLoading(true);
    try {
      await FirebaseService.launchSimulatedPurchase(data.profile.id, {
        supplierName: supplierName.trim() || 'Fornecedor Avulso',
        supplierId: supplierId || undefined,
        totalAmount: numVal,
        baseDate,
        selectedTerms: sortedTerms,
        notes: notes.trim() || undefined,
      });

      setSuccessMessage(
        `Compra de ${formatMoney(numVal)} gravada com sucesso no Firestore! ${partsCount} boletos sincronizados em Contas a Pagar.`
      );
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gravar compra na nuvem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-teal-500/10 text-teal-400 text-[10px] font-bold uppercase tracking-wider">
              Simulador Inteligente Cloud
            </span>
          </div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
            Simulador de Impacto e Prazos Críticos
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Defina o valor e selecione os prazos para simular as datas e lançar os boletos automaticamente no Firestore.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => onNavigate('contas')}
            className="px-3 py-1.5 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs hover:bg-emerald-300 transition-all cursor-pointer whitespace-nowrap"
          >
            Ir para Contas a Pagar →
          </button>
        </div>
      )}

      {/* Inputs & Terms Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Parameters (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
          <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-400" />
            1. Dados da Nova Compra
          </h3>

          {/* Supplier Select / Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Fornecedor
            </label>
            <select
              value={supplierId || (supplierName ? 'custom' : '')}
              onChange={handleSupplierChange}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
            >
              <option value="">Selecione ou digite um fornecedor...</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.category || 'Geral'})
                </option>
              ))}
              <option value="custom">+ Digitar novo fornecedor...</option>
            </select>

            {(!supplierId || supplierId === 'custom' || data.suppliers.length === 0) && (
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Nome do Fornecedor (ex: Distribuidora Silva)"
                className="w-full mt-2 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
            )}
          </div>

          {/* Purchase Total Amount */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Valor Total da Compra (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={totalAmount}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setTotalAmount(val);
                }}
                placeholder="0,00"
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 font-mono text-base font-bold text-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
              />
            </div>
          </div>

          {/* Base Date */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Data Base do Pedido
            </label>
            <input
              type="date"
              value={baseDate}
              onChange={(e) => setBaseDate(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Observações / Nº Pedido (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Pedido reposição estoque fim de semana"
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        {/* Right: Terms Selection & Interactive Projection (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-400" />
                2. Seleção de Prazos (Parcelamento Inteligente)
              </h3>
              <span className="text-[11px] text-slate-400">
                {selectedTerms.length} {selectedTerms.length === 1 ? 'parcela' : 'parcelas'}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Clique em um ou mais prazos para dividir o valor total da compra em parcelas iguais:
            </p>

            {/* Terms Chips Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {PRESET_TERMS.map((term) => {
                const isSelected = selectedTerms.includes(term);
                return (
                  <button
                    key={term}
                    type="button"
                    onClick={() => toggleTerm(term)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      isSelected
                        ? 'bg-teal-400 text-slate-950 border-teal-400 shadow-md shadow-teal-500/20 scale-[1.02]'
                        : 'bg-slate-900/90 text-slate-300 border-white/10 hover:border-teal-500/30 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-sm font-mono font-extrabold">{term}d</span>
                    <span className="text-[10px] opacity-80">{term} dias</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Day Adder */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min="1"
                max="180"
                value={customTermInput}
                onChange={(e) => setCustomTermInput(e.target.value)}
                placeholder="Outro prazo (dias)..."
                className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={addCustomTerm}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-slate-300 hover:text-teal-400 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Real-time Detailed Projection Breakdown */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-teal-500/25 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-teal-300 border-b border-white/[0.08] pb-2">
              <span>PROJEÇÃO DETALHADA DOS BOLETOS:</span>
              <span className="font-mono text-sm text-white">{formatMoney(numVal)}</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {projectedInstallments.map((inst) => (
                <div
                  key={inst.days}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    inst.isProtected
                      ? 'bg-purple-500/10 border-purple-500/40 text-purple-200'
                      : inst.isOverLimit
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : inst.isNearLimit
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : 'bg-slate-800/80 border-white/[0.06] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white/10 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                      {inst.index}
                    </span>
                    <div>
                      <div className="font-semibold text-white">
                        Boleto {inst.index}/{partsCount} ({inst.days} dias)
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                        <span>Vencimento: {formatDateBR(inst.dueDate)}</span>
                        {inst.isProtected && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">
                            DIA PROTEGIDO
                          </span>
                        )}
                        {inst.isOverLimit && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px]">
                            ESTOURA LIMITE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono font-extrabold text-sm text-white">
                    {formatMoney(inst.amount)}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Button: Lançar Compra no Fluxo */}
            <div className="pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleLaunchPurchase}
                className="w-full py-3 px-4 rounded-xl font-display font-bold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all shadow-lg shadow-teal-500/25 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Sincronizando no Firestore...' : `Lançar Compra no Fluxo (Gerar ${partsCount} Boletos)`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
