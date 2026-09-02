import React, { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Clock,
  Download,
  FileDown,
  X,
  FileText,
  Loader2,
} from 'lucide-react';
import { Bill, CompanyDatabase } from '../types';
import { formatMoney, formatDateBR, getTodayISO } from '../services/storage';
import { FirebaseService } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BillsViewProps {
  data: CompanyDatabase;
  onRefreshData?: () => void;
}

export const BillsView: React.FC<BillsViewProps> = ({
  data,
}) => {
  const today = getTodayISO();
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Pendente' | 'Pago' | 'Atrasado'>('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // New Bill Modal State
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newDueDate, setNewDueDate] = useState(today);
  const [newCategory, setNewCategory] = useState('Geral');
  const [loading, setLoading] = useState(false);

  // Pay Modal State
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paymentDate, setPaymentDate] = useState(today);

  // Compute status for each bill
  const billsWithComputedStatus = data.bills.map((b) => {
    let computedStatus = b.status;
    if (b.status === 'Pendente' && b.dueDate < today) {
      computedStatus = 'Atrasado';
    }
    return { ...b, computedStatus };
  });

  // Filtered bills
  const filteredBills = billsWithComputedStatus.filter((b) => {
    // Status filter
    if (statusFilter !== 'Todos' && b.computedStatus !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchSup = b.supplierName.toLowerCase().includes(q);
      const matchDesc = b.desc.toLowerCase().includes(q);
      if (!matchSup && !matchDesc) return false;
    }

    // Month filter
    if (selectedMonth) {
      const monthPart = b.dueDate.split('-')[1];
      if (monthPart !== selectedMonth) return false;
    }

    return true;
  });

  // Totals
  const totalPending = billsWithComputedStatus
    .filter((b) => b.computedStatus === 'Pendente' || b.computedStatus === 'Atrasado')
    .reduce((s, b) => s + b.amount, 0);

  const totalPaid = billsWithComputedStatus
    .filter((b) => b.computedStatus === 'Pago')
    .reduce((s, b) => s + (b.paidAmount || b.amount), 0);

  const totalOverdue = billsWithComputedStatus
    .filter((b) => b.computedStatus === 'Atrasado')
    .reduce((s, b) => s + b.amount, 0);

  // Handlers
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = typeof newAmount === 'number' ? newAmount : parseFloat(newAmount) || 0;
    if (!amt || amt <= 0 || !newDueDate) {
      alert('Preencha os campos obrigatórios corretamente.');
      return;
    }

    setLoading(true);
    try {
      await FirebaseService.addBill(data.profile.id, {
        supplierName: newSupplierName.trim() || 'Fornecedor Diversos',
        desc: newDesc.trim() || 'Conta a pagar avulsa',
        amount: amt,
        dueDate: newDueDate,
        status: 'Pendente',
        category: newCategory,
        parcel: '1/1',
      });

      setIsNewBillOpen(false);
      setNewDesc('');
      setNewSupplierName('');
      setNewAmount('');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao cadastrar conta no Firestore.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!payingBill) return;
    try {
      await FirebaseService.updateBill(data.profile.id, payingBill.id, {
        status: 'Pago',
        paidAt: paymentDate,
        paidAmount: payingBill.amount,
      });
      setPayingBill(null);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao dar baixa no Firestore.');
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (confirm('Deseja realmente excluir este lançamento do Firestore?')) {
      try {
        await FirebaseService.deleteBill(data.profile.id, billId);
      } catch (err: any) {
        console.error(err);
        alert('Erro ao excluir conta do Firestore.');
      }
    }
  };

  // PDF Export Function via jsPDF + jspdf-autotable
  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const companyName = data.profile.name || 'Fluxo ERP';
      const tradeName = data.profile.tradeName || '';
      const cnpj = data.profile.cnpj || '';
      const phone = data.profile.phone || '';
      const now = new Date();
      const emittedAtStr = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      // 1. Header Background & Branding Banner
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 0, 297, 28, 'F');

      // Decorative Accent Line
      doc.setFillColor(45, 212, 191); // Teal 400
      doc.rect(0, 28, 297, 1.5, 'F');

      // Title & Company Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(companyName.toUpperCase(), 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // Slate 400
      let companyMeta = 'Relatório Consolidado de Contas a Pagar & Fluxo Financeiro';
      if (cnpj) companyMeta += ` | CNPJ: ${cnpj}`;
      if (phone) companyMeta += ` | Tel: ${phone}`;
      doc.text(companyMeta, 14, 19);

      // Emission Timestamp (Right aligned)
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`Emitido em: ${emittedAtStr}`, 283, 12, { align: 'right' });
      doc.text(`Filtro atual: ${statusFilter.toUpperCase()}`, 283, 19, { align: 'right' });

      // 2. Executive Summary Cards (Row of 4 metrics)
      const startY = 35;
      const cardWidth = 64;
      const cardHeight = 16;
      const gap = 6;
      const cardMarginLeft = 14;

      const summaryMetrics = [
        { label: 'PENDENTE NO FLUXO', value: formatMoney(totalPending), color: [13, 148, 136] }, // Teal
        { label: 'TOTAL QUITADO / PAGO', value: formatMoney(totalPaid), color: [16, 185, 129] }, // Emerald
        { label: 'VENCIDO / ATRASADO', value: formatMoney(totalOverdue), color: [225, 29, 72] }, // Rose
        { label: 'TOTAL GERAL', value: formatMoney(totalPending + totalPaid), color: [71, 85, 105] }, // Slate
      ];

      summaryMetrics.forEach((metric, index) => {
        const x = cardMarginLeft + index * (cardWidth + gap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD');

        // Color accent line
        doc.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
        doc.rect(x, startY, 2.5, cardHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(metric.label, x + 5, startY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(metric.value, x + 5, startY + 12);
      });

      // 3. Table Rows Generation
      const tableData = filteredBills.map((b) => [
        b.supplierName || 'Diversos',
        b.desc || '-',
        b.category || 'Geral',
        formatDateBR(b.dueDate),
        b.parcel || '1/1',
        b.computedStatus.toUpperCase(),
        formatMoney(b.amount),
        b.paidAt ? formatDateBR(b.paidAt) : '-',
      ]);

      // 4. Render Table with AutoTable
      autoTable(doc, {
        startY: 56,
        head: [['FORNECEDOR', 'DESCRIÇÃO', 'CATEGORIA', 'VENCIMENTO', 'PARCELA', 'STATUS', 'VALOR (R$)', 'DATA PAGTO']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 65 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 25, halign: 'center' },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body') {
            const rawStatus = hookData.row.raw as string[];
            const statusCol = rawStatus[5];
            if (hookData.column.index === 5) {
              if (statusCol === 'PAGO') {
                hookData.cell.styles.textColor = [16, 185, 129]; // Emerald
              } else if (statusCol === 'ATRASADO') {
                hookData.cell.styles.textColor = [225, 29, 72]; // Rose
              } else {
                hookData.cell.styles.textColor = [217, 119, 6]; // Amber
              }
            }
          }
        },
        foot: [[
          'TOTALIZADOR',
          `${filteredBills.length} títulos listados`,
          '',
          '',
          '',
          '',
          formatMoney(filteredBills.reduce((s, b) => s + b.amount, 0)),
          '',
        ]],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
        },
      });

      // 5. Footer with page numbering
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Fluxo ERP - Sistema de Inteligência Financeira | Página ${i} de ${pageCount}`,
          14,
          200,
          { baseline: 'bottom' }
        );
        doc.text(
          `Documento confidencial gerado por ${companyName}`,
          283,
          200,
          { align: 'right', baseline: 'bottom' }
        );
      }

      // 6. Download the PDF
      const fileName = `relatorio-contas-${data.profile.id}-${today}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erro ao gerar relatório PDF:', error);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
            Contas a Pagar
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Gestão, baixa de boletos e exportação de relatórios consolidado em PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || data.bills.length === 0}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all flex items-center gap-2 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            title="Exportar relatório consolidado em PDF"
          >
            {isExportingPDF ? (
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4 text-teal-400" />
            )}
            <span>{isExportingPDF ? 'Gerando PDF...' : 'Exportar PDF'}</span>
          </button>

          {/* New Bill Button */}
          <button
            onClick={() => setIsNewBillOpen(true)}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lançar Nova Conta</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pendente no Fluxo</span>
            <div className="font-mono font-extrabold text-xl text-white mt-1">
              {formatMoney(totalPending)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quitado / Pago</span>
            <div className="font-mono font-extrabold text-xl text-emerald-400 mt-1">
              {formatMoney(totalPaid)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Vencido / Atrasado</span>
            <div className="font-mono font-extrabold text-xl text-rose-400 mt-1">
              {formatMoney(totalOverdue)}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['Todos', 'Pendente', 'Atrasado', 'Pago'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-teal-400 text-slate-950 shadow-md font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar fornecedor, boleto..."
                className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
              />
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-400"
            >
              <option value="">Todos os Meses</option>
              <option value="01">Jan</option>
              <option value="02">Fev</option>
              <option value="03">Mar</option>
              <option value="04">Abr</option>
              <option value="05">Mai</option>
              <option value="06">Jun</option>
              <option value="07">Jul</option>
              <option value="08">Ago</option>
              <option value="09">Set</option>
              <option value="10">Out</option>
              <option value="11">Nov</option>
              <option value="12">Dez</option>
            </select>
          </div>
        </div>

        {/* Bills Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">Fornecedor / Título</th>
                <th className="pb-3 px-3">Vencimento</th>
                <th className="pb-3 px-3">Parcela</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-4 text-right">Valor</th>
                <th className="pb-3 pl-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    Nenhuma conta encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-white truncate max-w-[220px]">
                        {bill.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {bill.desc}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {formatDateBR(bill.dueDate)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                        {bill.parcel || '1/1'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {bill.computedStatus === 'Pago' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          PAGO
                        </span>
                      ) : bill.computedStatus === 'Atrasado' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          ATRASADO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          PENDENTE
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatMoney(bill.amount)}
                    </td>
                    <td className="py-3.5 pl-4 text-right whitespace-nowrap space-x-2">
                      {bill.status !== 'Pago' && (
                        <button
                          onClick={() => {
                            setPayingBill(bill);
                            setPaymentDate(today);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          Quitar
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBill(bill.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Excluir Lançamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Lançar Conta Avulsa */}
      {isNewBillOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-base text-white">
                Lançar Conta a Pagar Avulsa no Firestore
              </h3>
              <button
                onClick={() => setIsNewBillOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Fornecedor / Beneficiário
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Ex: Companhia Energética"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Descrição da Despesa
                </label>
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Ex: Conta de Energia Mês 08"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newAmount}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setNewAmount(val);
                    }}
                    placeholder="0,00"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 font-mono text-sm font-bold text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewBillOpen(false)}
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

      {/* Modal: Confirmar Baixa / Pagamento */}
      {payingBill && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base text-white">
              Confirmar Baixa do Boleto
            </h3>
            <p className="text-xs text-slate-400">
              Você está marcando como pago o boleto de{' '}
              <strong className="text-white">{payingBill.supplierName}</strong> no valor de{' '}
              <strong className="text-teal-400">{formatMoney(payingBill.amount)}</strong>.
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Data do Pagamento
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingBill(null)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-all cursor-pointer"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
