import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Layers,
  ArrowRight,
  Receipt,
  Truck,
} from 'lucide-react';
import { CompanyDatabase, NavigationRoute, Purchase } from '../types';
import { formatMoney, formatDateBR } from '../services/storage';

interface PurchasesHistoryViewProps {
  data: CompanyDatabase;
  onNavigate: (route: NavigationRoute) => void;
}

export const PurchasesHistoryView: React.FC<PurchasesHistoryViewProps> = ({
  data,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  // Filter purchases
  const filteredPurchases = data.purchases.filter((p) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchSup = p.supplierName.toLowerCase().includes(q);
      const matchNotes = (p.notes || '').toLowerCase().includes(q);
      return matchSup || matchNotes;
    }
    return true;
  });

  const totalPurchasesAmount = filteredPurchases.reduce((s, p) => s + p.totalAmount, 0);
  const avgTicket = filteredPurchases.length > 0 ? totalPurchasesAmount / filteredPurchases.length : 0;

  // Find bills for a selected purchase
  const getBillsForPurchase = (purchaseId: string) => {
    return data.bills.filter((b) => b.purchaseId === purchaseId);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
            Histórico de Compras e Pedidos
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Registro de compras simuladas e seus respectivos desdobramentos em parcelas
          </p>
        </div>

        <button
          onClick={() => onNavigate('simulador')}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Simular Nova Compra</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Comprado</span>
          <div className="font-mono font-extrabold text-xl text-white mt-1">
            {formatMoney(totalPurchasesAmount)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{filteredPurchases.length} pedidos registrados</div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio</span>
          <div className="font-mono font-extrabold text-xl text-teal-300 mt-1">
            {formatMoney(avgTicket)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Média por pedido</div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Parcelas Geradas</span>
          <div className="font-mono font-extrabold text-xl text-purple-300 mt-1">
            {filteredPurchases.reduce((s, p) => s + p.installmentsCount, 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Boletos integrados ao fluxo</div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por fornecedor ou observação..."
            className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">Fornecedor</th>
                <th className="pb-3 px-3">Data Compra</th>
                <th className="pb-3 px-3">Prazos Utilizados</th>
                <th className="pb-3 px-3">Parcelas</th>
                <th className="pb-3 px-4 text-right">Valor Total</th>
                <th className="pb-3 pl-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    Nenhuma compra registrada. Utilize o Simulador para criar novos pedidos.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => {
                  const bills = getBillsForPurchase(purchase.id);
                  const isExpanded = selectedPurchase?.id === purchase.id;

                  return (
                    <React.Fragment key={purchase.id}>
                      <tr className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 pr-4">
                          <div className="font-semibold text-white truncate max-w-[200px]">
                            {purchase.supplierName}
                          </div>
                          {purchase.notes && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {purchase.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                          {formatDateBR(purchase.date)}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {purchase.termsSelected.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-mono text-[10px] border border-white/10"
                              >
                                {t}d
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-xs font-semibold text-slate-300">
                            {purchase.installmentsCount}x
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                          {formatMoney(purchase.totalAmount)}
                        </td>
                        <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                          <button
                            onClick={() =>
                              setSelectedPurchase(isExpanded ? null : purchase)
                            }
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-teal-300 hover:bg-slate-700 transition-all border border-white/10 cursor-pointer"
                          >
                            {isExpanded ? 'Ocultar' : 'Ver Boletos'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Installments Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-slate-900/80 border-y border-teal-500/30">
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-teal-300 flex items-center gap-2">
                                <Receipt className="w-4 h-4" />
                                <span>Boletos Gerados no Fluxo para este Pedido ({bills.length}):</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {bills.map((b) => (
                                  <div
                                    key={b.id}
                                    className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-xs flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-semibold text-white">
                                        Parcela {b.parcel || '1/1'}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-mono">
                                        Venc: {formatDateBR(b.dueDate)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-mono font-bold text-white">
                                        {formatMoney(b.amount)}
                                      </div>
                                      <span
                                        className={`text-[10px] font-bold ${
                                          b.status === 'Pago' ? 'text-emerald-400' : 'text-amber-300'
                                        }`}
                                      >
                                        {b.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
