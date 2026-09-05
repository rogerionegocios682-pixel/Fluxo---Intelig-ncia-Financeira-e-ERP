import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Plus,
  Lock,
} from 'lucide-react';
import { Bill, CalendarFilterMode, CompanyDatabase, getCriticalDays } from '../types';
import {
  formatMoney,
  formatDateBR,
  toISODate,
  parseISODate,
  getTodayISO,
  addDaysToISO,
} from '../services/storage';
import { FirebaseService } from '../services/firebase';

interface CalendarViewProps {
  data: CompanyDatabase;
  onRefreshData?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  data,
}) => {
  const today = getTodayISO();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarFilterMode>('mensal');
  const [selectedDayISO, setSelectedDayISO] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    setCurrentDate(new Date());
  };

  const criticalDays = getCriticalDays(data.profile);

  // Build calendar days array based on viewMode
  let daysToRender: Array<{
    dateISO: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isProtected: boolean;
    bills: Bill[];
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
    isOverLimit: boolean;
  }> = [];

  if (viewMode === 'semanal') {
    // 7 days starting today or selected anchor
    for (let i = 0; i < 7; i++) {
      const dISO = addDaysToISO(today, i);
      const dayNum = parseInt(dISO.split('-')[2], 10);
      const bills = data.bills.filter((b) => b.dueDate === dISO);
      const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
      const pendingAmount = bills.filter((b) => b.status === 'Pendente').reduce((s, b) => s + b.amount, 0);
      const paidAmount = bills.filter((b) => b.status === 'Pago').reduce((s, b) => s + b.amount, 0);
      const isOverLimit = pendingAmount > data.profile.dailyLimit;

      daysToRender.push({
        dateISO: dISO,
        dayNum,
        isCurrentMonth: true,
        isToday: dISO === today,
        isProtected: criticalDays.includes(dayNum),
        bills,
        totalAmount,
        pendingAmount,
        paidAmount,
        isOverLimit,
      });
    }
  } else if (viewMode === 'quinzenal') {
    // 15 days starting today
    for (let i = 0; i < 15; i++) {
      const dISO = addDaysToISO(today, i);
      const dayNum = parseInt(dISO.split('-')[2], 10);
      const bills = data.bills.filter((b) => b.dueDate === dISO);
      const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
      const pendingAmount = bills.filter((b) => b.status === 'Pendente').reduce((s, b) => s + b.amount, 0);
      const paidAmount = bills.filter((b) => b.status === 'Pago').reduce((s, b) => s + b.amount, 0);
      const isOverLimit = pendingAmount > data.profile.dailyLimit;

      daysToRender.push({
        dateISO: dISO,
        dayNum,
        isCurrentMonth: true,
        isToday: dISO === today,
        isProtected: criticalDays.includes(dayNum),
        bills,
        totalAmount,
        pendingAmount,
        paidAmount,
        isOverLimit,
      });
    }
  } else {
    // Mensal: Full standard calendar grid (including leading padding days)
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous month padding
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dNum = prevMonthLastDate - i;
      const prevDate = new Date(year, month - 1, dNum);
      const dISO = toISODate(prevDate);
      const bills = data.bills.filter((b) => b.dueDate === dISO);
      const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
      const pendingAmount = bills.filter((b) => b.status === 'Pendente').reduce((s, b) => s + b.amount, 0);
      const paidAmount = bills.filter((b) => b.status === 'Pago').reduce((s, b) => s + b.amount, 0);

      daysToRender.push({
        dateISO: dISO,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: dISO === today,
        isProtected: criticalDays.includes(dNum),
        bills,
        totalAmount,
        pendingAmount,
        paidAmount,
        isOverLimit: pendingAmount > data.profile.dailyLimit,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dISO = toISODate(currDate);
      const bills = data.bills.filter((b) => b.dueDate === dISO);
      const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
      const pendingAmount = bills.filter((b) => b.status === 'Pendente').reduce((s, b) => s + b.amount, 0);
      const paidAmount = bills.filter((b) => b.status === 'Pago').reduce((s, b) => s + b.amount, 0);

      daysToRender.push({
        dateISO: dISO,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dISO === today,
        isProtected: criticalDays.includes(d),
        bills,
        totalAmount,
        pendingAmount,
        paidAmount,
        isOverLimit: pendingAmount > data.profile.dailyLimit,
      });
    }

    // Trailing days padding to fill rows of 7
    const remaining = (7 - (daysToRender.length % 7)) % 7;
    for (let r = 1; r <= remaining; r++) {
      const nextDate = new Date(year, month + 1, r);
      const dISO = toISODate(nextDate);
      const bills = data.bills.filter((b) => b.dueDate === dISO);
      const totalAmount = bills.reduce((s, b) => s + b.amount, 0);
      const pendingAmount = bills.filter((b) => b.status === 'Pendente').reduce((s, b) => s + b.amount, 0);
      const paidAmount = bills.filter((b) => b.status === 'Pago').reduce((s, b) => s + b.amount, 0);

      daysToRender.push({
        dateISO: dISO,
        dayNum: r,
        isCurrentMonth: false,
        isToday: dISO === today,
        isProtected: criticalDays.includes(r),
        bills,
        totalAmount,
        pendingAmount,
        paidAmount,
        isOverLimit: pendingAmount > data.profile.dailyLimit,
      });
    }
  }

  // Selected Day Details
  const selectedDayData = selectedDayISO ? daysToRender.find((d) => d.dateISO === selectedDayISO) : null;

  const handlePayBillFromCalendar = async (bill: Bill) => {
    await FirebaseService.updateBill(data.profile.id, bill.id, {
      status: 'Pago',
      paidAt: today,
      paidAmount: bill.amount,
    });
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header with Controls */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                Planejamento de Fluxo
              </span>
            </div>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-teal-400" />
              <span>{monthNames[month]} de {year}</span>
            </h2>
          </div>

          {/* View Mode Filters & Month Navigators */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl bg-slate-900 p-1 border border-white/10">
              {(['semanal', 'quinzenal', 'mensal'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer ${
                    viewMode === mode
                      ? 'bg-teal-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-xl p-1">
              <button
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-teal-400 transition-colors"
              >
                Hoje
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Próximo mês"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
            <span>Saídas Normais</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Excedeu Limite Diário ({formatMoney(data.profile.dailyLimit)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Travas de Compra ({criticalDays.map((d) => `Dia ${d}`).join(', ')})</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-4 sm:p-5 overflow-hidden">
        {/* Day of Week Headers (for Monthly view) */}
        {viewMode === 'mensal' && (
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>
        )}

        {/* Days Matrix */}
        <div
          className={`grid gap-1.5 sm:gap-2 ${
            viewMode === 'semanal'
              ? 'grid-cols-1 sm:grid-cols-7'
              : viewMode === 'quinzenal'
              ? 'grid-cols-2 sm:grid-cols-5 lg:grid-cols-5'
              : 'grid-cols-7'
          }`}
        >
          {daysToRender.map((day) => {
            const hasBills = day.bills.length > 0;
            const isSelected = selectedDayISO === day.dateISO;

            return (
              <button
                key={day.dateISO}
                onClick={() => setSelectedDayISO(day.dateISO)}
                className={`min-h-[80px] sm:min-h-[96px] p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all relative group cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-teal-400 border-teal-400 bg-slate-800'
                    : day.isProtected
                    ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                    : day.isOverLimit
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                    : hasBills
                    ? 'bg-slate-900/90 border-white/[0.08] hover:border-teal-500/40 hover:bg-slate-850'
                    : 'bg-slate-950/40 border-white/[0.04] opacity-70 hover:opacity-100'
                } ${!day.isCurrentMonth && viewMode === 'mensal' ? 'opacity-30' : ''}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-mono text-xs sm:text-sm font-bold ${
                      day.isToday
                        ? 'w-6 h-6 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center'
                        : day.isProtected
                        ? 'text-amber-300 font-extrabold'
                        : 'text-slate-300'
                    }`}
                  >
                    {day.dayNum}
                  </span>

                  {day.isProtected && (
                    <span className="p-0.5 rounded bg-amber-500/20 text-amber-300" title={`Trava de Compra: Dia ${day.dayNum}`}>
                      <Lock className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Amount Summary */}
                <div className="mt-2 space-y-1">
                  {day.pendingAmount > 0 && (
                    <div
                      className={`text-[10px] sm:text-xs font-mono font-extrabold truncate ${
                        day.isOverLimit ? 'text-rose-400' : 'text-teal-300'
                      }`}
                    >
                      {formatMoney(day.pendingAmount)}
                    </div>
                  )}

                  {day.paidAmount > 0 && day.pendingAmount === 0 && (
                    <div className="text-[10px] font-mono text-emerald-400 truncate">
                      ✓ {formatMoney(day.paidAmount)}
                    </div>
                  )}

                  {hasBills && (
                    <div className="text-[9px] text-slate-400 truncate hidden sm:block">
                      {day.bills.length} {day.bills.length === 1 ? 'boleto' : 'boletos'}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal / Drawer */}
      {selectedDayData && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                  Detalhamento do Dia
                </span>
                <h3 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
                  <span>{formatDateBR(selectedDayData.dateISO)}</span>
                  {selectedDayData.isProtected && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-xs font-bold">
                      Dia Protegido
                    </span>
                  )}
                </h3>
              </div>

              <button
                onClick={() => setSelectedDayISO(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Daily Total Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Pendente no Dia</span>
                <div className="font-mono font-bold text-base text-teal-300">
                  {formatMoney(selectedDayData.pendingAmount)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Limite Diário</span>
                <div className="font-mono font-bold text-base text-slate-300">
                  {formatMoney(data.profile.dailyLimit)}
                </div>
              </div>
            </div>

            {/* Bills List for this day */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {selectedDayData.bills.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  Nenhum boleto ou pagamento agendado para esta data.
                </div>
              ) : (
                selectedDayData.bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white truncate max-w-[200px]">
                        {bill.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {bill.desc} • Parcela {bill.parcel || '1/1'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white">
                        {formatMoney(bill.amount)}
                      </div>
                      {bill.status === 'Pago' ? (
                        <span className="text-[10px] text-emerald-400 font-bold">PAGO</span>
                      ) : (
                        <button
                          onClick={() => handlePayBillFromCalendar(bill)}
                          className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer"
                        >
                          Dar Baixa
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDayISO(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
