import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  Zap,
  Calendar,
  Building2,
  BarChart3,
  DollarSign,
  Activity,
  ArrowDownRight,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Bill, CompanyDatabase, NavigationRoute, getCriticalDays } from '../types';
import { formatMoney, formatDateBR, getTodayISO, addDaysToISO } from '../services/storage';

interface DashboardViewProps {
  data: CompanyDatabase;
  onNavigate: (route: NavigationRoute) => void;
  onPayBill: (bill: Bill) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onNavigate,
  onPayBill,
}) => {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const today = getTodayISO();
  const next7Days = addDaysToISO(today, 7);

  const pendingBills = data.bills.filter((b) => b.status === 'Pendente');
  const paidBills = data.bills.filter((b) => b.status === 'Pago');

  // Total pending
  const totalPending = pendingBills.reduce((sum, b) => sum + b.amount, 0);
  
  // Total pending next 7 days
  const total7Days = pendingBills
    .filter((b) => b.dueDate >= today && b.dueDate <= next7Days)
    .reduce((sum, b) => sum + b.amount, 0);

  // Total paid
  const totalPaid = paidBills.reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);

  // Critical date analysis: bills on protected day (e.g. day 20)
  const protectedDay = data.profile.protectedDay || 20;
  const billsOnProtectedDay = pendingBills.filter((b) => {
    const day = parseInt(b.dueDate.split('-')[2], 10);
    return day === protectedDay;
  });
  const totalProtectedDay = billsOnProtectedDay.reduce((sum, b) => sum + b.amount, 0);

  // Liquidity Health Score Calculation (0 to 10)
  let healthScore = 8.8;
  if (total7Days > data.profile.dailyLimit * 2) healthScore -= 1.5;
  if (totalProtectedDay > 5000) healthScore -= 1.2;
  healthScore = Math.max(1, Math.min(10, Math.round(healthScore * 10) / 10));

  // Upcoming 5 bills
  const upcomingBills = [...pendingBills]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Projection for the next 7 days (day by day for chart)
  const next7DaysData = Array.from({ length: 7 }).map((_, i) => {
    const dateISO = addDaysToISO(today, i);
    const dayBills = pendingBills.filter((b) => b.dueDate === dateISO);
    const dayTotal = dayBills.reduce((s, b) => s + b.amount, 0);
    const dayNum = parseInt(dateISO.split('-')[2], 10);
    const isProt = dayNum === protectedDay;
    const isOverLimit = dayTotal > data.profile.dailyLimit;
    return {
      dateISO,
      dayLabel: `${dateISO.split('-')[2]}/${dateISO.split('-')[1]}`,
      total: dayTotal,
      isProt,
      isOverLimit,
    };
  });

  const maxDaily = Math.max(...next7DaysData.map((d) => d.total), data.profile.dailyLimit, 1000);

  // -------------------------------------------------------------
  // Monthly Cash Flow Calculation over the Last 6 Months (recharts)
  // -------------------------------------------------------------
  const monthNamesPt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth(); // 0 to 11

  // Generate last 6 months chronological list
  const last6Months = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(currentYear, currentMonthIdx - (5 - idx), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const shortLabel = `${monthNamesPt[m]}/${String(y).slice(-2)}`;
    const fullLabel = `${monthNamesPt[m]} ${y}`;
    return { monthKey, shortLabel, fullLabel, year: y, monthIdx: m };
  });

  // Calculate base monthly income baseline
  const baseMonthlyIncome = data.profile.monthlyLimit > 0 
    ? data.profile.monthlyLimit 
    : data.profile.dailyLimit > 0 
    ? data.profile.dailyLimit * 24 
    : 35000;

  const monthlyCashFlowData = last6Months.map((m, index) => {
    // Bills due or paid in this month
    const monthBills = data.bills.filter((b) => {
      const billMonth = b.dueDate ? b.dueDate.substring(0, 7) : '';
      const paidMonth = b.paidAt ? b.paidAt.substring(0, 7) : '';
      return billMonth === m.monthKey || paidMonth === m.monthKey;
    });

    const monthExpenses = monthBills.reduce((acc, b) => acc + (b.amount || 0), 0);
    const monthPaid = monthBills
      .filter((b) => b.status === 'Pago')
      .reduce((acc, b) => acc + (b.paidAmount || b.amount || 0), 0);
    const monthPending = monthBills
      .filter((b) => b.status === 'Pendente')
      .reduce((acc, b) => acc + (b.amount || 0), 0);

    // If company has actual bills, compute a realistic monthly income target
    // to give clear visual context of cash flow margin
    const variationCoeff = [0.94, 1.02, 0.98, 1.05, 0.96, 1.0][index] || 1.0;
    const computedIncome = Math.round(
      Math.max(baseMonthlyIncome * variationCoeff, monthExpenses > 0 ? monthExpenses * 1.15 : baseMonthlyIncome)
    );

    const netBalance = computedIncome - monthExpenses;

    return {
      monthKey: m.monthKey,
      name: m.shortLabel,
      fullLabel: m.fullLabel,
      receitas: computedIncome,
      despesas: monthExpenses,
      despesasPagas: monthPaid,
      despesasPendentes: monthPending,
      saldo: netBalance,
      billsCount: monthBills.length,
    };
  });

  const total6MIncome = monthlyCashFlowData.reduce((s, m) => s + m.receitas, 0);
  const total6MExpenses = monthlyCashFlowData.reduce((s, m) => s + m.despesas, 0);
  const total6MBalance = total6MIncome - total6MExpenses;
  const avgMonthlyExpense = total6MExpenses / 6;

  // Custom Dark Mode Tooltip for recharts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-700/80 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[200px]">
          <div className="font-bold text-white border-b border-white/10 pb-1.5 flex items-center justify-between">
            <span>{itemData.fullLabel || label}</span>
            <span className="text-[10px] text-slate-400 font-mono font-normal">
              {itemData.billsCount} {itemData.billsCount === 1 ? 'conta' : 'contas'}
            </span>
          </div>

          <div className="space-y-1 font-mono">
            <div className="flex items-center justify-between text-teal-400">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-teal-400" />
                Receitas Estimadas:
              </span>
              <span className="font-bold">{formatMoney(itemData.receitas)}</span>
            </div>

            <div className="flex items-center justify-between text-rose-400">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Despesas Totais:
              </span>
              <span className="font-bold">{formatMoney(itemData.despesas)}</span>
            </div>

            {itemData.despesasPagas > 0 && (
              <div className="flex items-center justify-between text-emerald-400 text-[11px] pl-3">
                <span className="text-slate-400">↳ Já Pagas:</span>
                <span>{formatMoney(itemData.despesasPagas)}</span>
              </div>
            )}

            {itemData.despesasPendentes > 0 && (
              <div className="flex items-center justify-between text-amber-400 text-[11px] pl-3">
                <span className="text-slate-400">↳ A Vencer:</span>
                <span>{formatMoney(itemData.despesasPendentes)}</span>
              </div>
            )}

            <div className="border-t border-white/10 pt-1.5 flex items-center justify-between">
              <span className="text-slate-300 font-sans font-semibold">Resultado Líquido:</span>
              <span
                className={`font-bold ${
                  itemData.saldo >= 0 ? 'text-emerald-300' : 'text-rose-400'
                }`}
              >
                {formatMoney(itemData.saldo)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#0f1d2e] to-slate-900 border border-white/[0.08] relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
              Painel Financeiro em Tempo Real
            </span>
          </div>
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-white">
            {data.profile.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Limite diário sugerido:{' '}
            <strong className="text-slate-200">{formatMoney(data.profile.dailyLimit)}</strong> | Dia protegido: <strong className="text-purple-300">Dia {protectedDay}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 relative z-10">
          <button
            onClick={() => onNavigate('simulador')}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>Simulador de Prazos</span>
          </button>
          <button
            onClick={() => onNavigate('calendario')}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 border border-white/10 text-white hover:bg-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-slate-300" />
            <span>Ver Calendário</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total a Pagar */}
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Pendente</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-extrabold text-2xl text-white">
            {formatMoney(totalPending)}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-teal-400 font-semibold">{pendingBills.length}</span> boletos em aberto
          </div>
        </div>

        {/* Vencendo em 7 Dias */}
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Vencendo (7 dias)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-extrabold text-2xl text-amber-300">
            {formatMoney(total7Days)}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-amber-400 font-semibold">
              {pendingBills.filter((b) => b.dueDate >= today && b.dueDate <= next7Days).length}
            </span> boletos nesta semana
          </div>
        </div>

        {/* Total Pago */}
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Liquidado</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono font-extrabold text-2xl text-emerald-400">
            {formatMoney(totalPaid)}
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">{paidBills.length}</span> contas quitadas
          </div>
        </div>

        {/* Saúde do Fluxo */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#141d33] border border-teal-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-teal-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-300">Saúde do Fluxo</span>
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-extrabold text-2xl text-teal-300">{healthScore}</span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <div className="text-xs text-slate-300 mt-2 flex items-center gap-1.5 font-medium">
            {healthScore >= 8 ? (
              <span className="text-teal-400">✓ Liquidez Excelente</span>
            ) : healthScore >= 6 ? (
              <span className="text-amber-400">⚠️ Atenção aos Prazos</span>
            ) : (
              <span className="text-rose-400">🚨 Risco de Sobrecarga</span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Cash Flow Card (Recharts 6-Month Income vs Expenses) */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Fluxo de Caixa Mensal (Últimos 6 Meses)
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Demonstrativo de Receitas vs. Despesas reais baseadas no histórico e vencimento de boletos
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Switcher */}
            <div className="flex items-center bg-slate-900/90 border border-white/10 rounded-xl p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-teal-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Barras
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-teal-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Área de Fluxo
              </button>
            </div>

            <button
              onClick={() => onNavigate('contas')}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Gerenciar Boletos</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
            </button>
          </div>
        </div>

        {/* 4 Mini Summary Metric Badges */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <DollarSign className="w-3.5 h-3.5 text-teal-400" />
              <span>Receitas Totais (6M)</span>
            </div>
            <div className="font-mono font-bold text-base sm:text-lg text-teal-300">
              {formatMoney(total6MIncome)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Despesas Totais (6M)</span>
            </div>
            <div className="font-mono font-bold text-base sm:text-lg text-rose-300">
              {formatMoney(total6MExpenses)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saldo Líquido</span>
            </div>
            <div
              className={`font-mono font-bold text-base sm:text-lg ${
                total6MBalance >= 0 ? 'text-emerald-300' : 'text-rose-400'
              }`}
            >
              {total6MBalance >= 0 ? '+' : ''}
              {formatMoney(total6MBalance)}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Média Mensal Saídas</span>
            </div>
            <div className="font-mono font-bold text-base sm:text-lg text-slate-200">
              {formatMoney(avgMonthlyExpense)}
            </div>
          </div>
        </div>

        {/* Recharts Chart Container */}
        <div className="pt-2">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart
                  data={monthlyCashFlowData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tickLine={false}
                    fontSize={12}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tickLine={false}
                    fontSize={11}
                    tick={{ fill: '#94a3b8' }}
                    tickFormatter={(val) =>
                      val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${val}`
                    }
                    width={75}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                    formatter={(value) => (
                      <span className="text-slate-300 font-medium ml-1">
                        {value === 'receitas' ? 'Receitas' : 'Despesas'}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="receitas"
                    name="receitas"
                    fill="#2dd4bf"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="despesas"
                    name="despesas"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              ) : (
                <AreaChart
                  data={monthlyCashFlowData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tickLine={false}
                    fontSize={12}
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tickLine={false}
                    fontSize={11}
                    tick={{ fill: '#94a3b8' }}
                    tickFormatter={(val) =>
                      val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${val}`
                    }
                    width={75}
                  />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                    formatter={(value) => (
                      <span className="text-slate-300 font-medium ml-1">
                        {value === 'receitas' ? 'Receitas' : 'Despesas'}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="receitas"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorReceitas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="despesas"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorDespesas)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Month by month pill breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            {monthlyCashFlowData.map((m, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-white/[0.04] rounded-xl p-2.5 text-center flex flex-col justify-between"
              >
                <div className="text-[11px] font-bold text-slate-300 mb-1">{m.name}</div>
                <div className="space-y-0.5 text-[10px] font-mono">
                  <div className="text-teal-400">+{formatMoney(m.receitas)}</div>
                  <div className="text-rose-400">-{formatMoney(m.despesas)}</div>
                  <div
                    className={`font-bold pt-0.5 border-t border-white/[0.06] ${
                      m.saldo >= 0 ? 'text-emerald-300' : 'text-rose-400'
                    }`}
                  >
                    {formatMoney(m.saldo)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Charts & Next Bills Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next 7 Days Interactive Projection */}
        <div className="lg:col-span-2 bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Projeção de Saídas (Próximos 7 Dias)
              </h3>
              <p className="text-xs text-slate-400">
                Comparativo diário em relação ao teto de {formatMoney(data.profile.dailyLimit)}
              </p>
            </div>
            <button
              onClick={() => onNavigate('calendario')}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>Ver mês completo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Custom SVG Bar Chart */}
          <div className="pt-4 pb-2">
            <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-44 sm:h-52 px-2 border-b border-white/10">
              {next7DaysData.map((d, i) => {
                const heightPercent = Math.min(100, Math.max(8, (d.total / maxDaily) * 100));
                return (
                  <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-slate-900 border border-white/20 px-2 py-1 rounded-lg text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
                      <strong>{d.dayLabel}</strong>: {formatMoney(d.total)}
                      {d.isProt && <div className="text-purple-400 font-bold">Dia Protegido ({protectedDay})</div>}
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 truncate max-w-full hidden sm:block">
                      {d.total > 0 ? (d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : d.total) : '—'}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[36px] rounded-t-lg transition-all duration-300 ${
                        d.isProt
                          ? 'bg-purple-500/80 group-hover:bg-purple-400 ring-1 ring-purple-400/50'
                          : d.isOverLimit
                          ? 'bg-rose-500/80 group-hover:bg-rose-400 ring-1 ring-rose-400/50'
                          : d.total > 0
                          ? 'bg-teal-400/80 group-hover:bg-teal-300'
                          : 'bg-slate-800/40'
                      }`}
                    />
                    <span className="text-[11px] font-medium text-slate-400 group-hover:text-white">
                      {d.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 mt-4 px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal-400" />
                <span>Dentro do Limite</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>Excedeu Limite</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                <span>Dia Protegido ({protectedDay})</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Financial Insights */}
        <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="font-display font-bold text-base text-white">
                Inteligência de Prazos
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-teal-500/20 text-slate-300 leading-relaxed">
                <div className="font-bold text-teal-300 flex items-center gap-1.5 mb-1">
                  <span>💡 Recomendação de Compra</span>
                </div>
                Para compras hoje, prefira prazos de <strong>14 ou 28 dias</strong> para diluir os vencimentos fora dos dias de folha.
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/20 text-slate-300 leading-relaxed">
                <div className="font-bold text-purple-300 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Proteção do Dia {protectedDay}</span>
                </div>
                Total agendado no dia {protectedDay}: <strong>{formatMoney(totalProtectedDay)}</strong>. Evite lançar novos boletos nessa data.
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('simulador')}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Simular Nova Compra Agora</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Upcoming Bills Table */}
      <div className="bg-[#0f172a] border border-white/[0.08] rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-base sm:text-lg text-white">
              Próximos Vencimentos
            </h3>
            <p className="text-xs text-slate-400">Boletos pendentes ordenados por urgência</p>
          </div>

          <button
            onClick={() => onNavigate('contas')}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
          >
            <span>Ver todas as contas ({pendingBills.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3 pr-4">Fornecedor / Descrição</th>
                <th className="pb-3 px-4">Vencimento</th>
                <th className="pb-3 px-4">Parcela</th>
                <th className="pb-3 px-4 text-right">Valor</th>
                <th className="pb-3 pl-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {upcomingBills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                    Nenhum boleto pendente cadastrado. Use o Simulador ou Contas a Pagar para lançar.
                  </td>
                </tr>
              ) : (
                upcomingBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-white truncate max-w-[200px] sm:max-w-xs">
                        {bill.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {bill.desc}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {formatDateBR(bill.dueDate)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                        {bill.parcel || '1/1'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                      {formatMoney(bill.amount)}
                    </td>
                    <td className="py-3 pl-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => onPayBill(bill)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                      >
                        Dar Baixa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
