'use client';

import React, { useMemo, useState } from 'react';
import NextImage from 'next/image';
import { Filter, Landmark, Plus, TrendingDown, TrendingUp, Wallet as WalletIcon } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { getDisplayFirstName, getHouseholdDisplayName } from '../lib/householdNaming';
import { ANALYSIS_PERIODS, buildDashboardAnalysis, getAnalysisRange, getAnalysisRangeError, manilaToday, type AnalysisPeriod } from '../lib/dashboardAnalysis';
import { BarChart, ChartCard, DailyTrends, ExpenseBreakdown } from './dashboard/AnalysisCharts';
import { DASHBOARD_FINANCIAL_LABELS } from './dashboardLabels';
import { formatMoney } from './ui/MoneyAmount';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
  onPayCreditCard: (walletId: string, amount: number, walletName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddTxModal }) => {
  const { currentMember, members, wallets, transactions, categories, loans, isAdmin } = useHousehold();
  const [today] = useState(() => manilaToday());
  const [period, setPeriod] = useState<AnalysisPeriod>('this_month');
  const [custom, setCustom] = useState(() => getAnalysisRange('this_month', today, { start: '', end: '' }));
  const range = getAnalysisRange(period, today, custom);
  const rangeError = period === 'custom' && (!custom.start || !custom.end)
    ? 'Choose both a start date and an end date.' : getAnalysisRangeError(range);
  const analysis = useMemo(() => buildDashboardAnalysis(
    rangeError ? [] : transactions, categories, members, { start: range.start, end: range.end },
  ), [transactions, categories, members, range.start, range.end, rangeError]);

  // Preserve the existing current-balance formula; period selection never changes it.
  const visibleWallets = wallets.filter(wallet => isAdmin || wallet.is_shared || wallet.owner_id === currentMember.id);
  const liquidAssets = visibleWallets.filter(wallet => wallet.wallet_type !== 'credit_card')
    .reduce((sum, wallet) => sum + wallet.current_balance, 0);
  const usedCardBalances = visibleWallets.filter(wallet => wallet.wallet_type === 'credit_card')
    .reduce((sum, wallet) => sum + getCreditCardUsedBalance(wallet), 0);
  const netAssets = liquidAssets - usedCardBalances;
  const loanPrincipal = loans.reduce((sum, loan) => sum + loan.remaining_balance, 0);
  const selectedLabel = ANALYSIS_PERIODS.find(([id]) => id === period)?.[1];
  const periodDescription = period === 'all_time' ? 'All available loaded dates' : `${range.start || '—'} to ${range.end || '—'}`;

  return <div className="famledger-view famledger-dashboard space-y-5">
    <div className="flex min-h-36 items-center justify-between gap-4 rounded-3xl border border-brand-line bg-gradient-to-r from-white via-[#EBF6F7] to-[#FAF7F0] p-5 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight text-brand-ink sm:text-2xl">Hello, {getDisplayFirstName(currentMember.display_name)}! 👋</h1>
        <p className="mt-1 break-words text-xs font-semibold text-brand-ink">{getHouseholdDisplayName(members)}</p>
      </div>
      <NextImage src="/illustrations/household-finance.webp" alt="A couple reviewing their household budget together" width={300} height={200}
        sizes="(min-width: 768px) 160px, 96px" className="h-20 w-24 shrink-0 object-contain sm:h-28 sm:w-40" />
    </div>

    <section aria-label="Analysis period" className="rounded-xl border border-brand-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-ink"><Filter className="h-4 w-4 text-brand-muted" aria-hidden="true" />Analysis Period:</h2>
        <div role="group" aria-label="Select analysis period" className="flex flex-wrap gap-1">
          {ANALYSIS_PERIODS.map(([id, label]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}
            className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 ${period === id ? 'bg-blue-600 text-[#FFFFFF]' : 'text-brand-muted hover:bg-brand-canvas hover:text-brand-ink'}`}>{label}</button>)}
        </div>
      </div>
      {period === 'custom' && <div className="mt-3 flex flex-wrap gap-3 border-t border-brand-line pt-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-brand-ink">From<input type="date" value={custom.start} onChange={event => setCustom(value => ({ ...value, start: event.target.value }))} aria-invalid={!!rangeError} aria-describedby={rangeError ? 'dashboard-range-error' : undefined} className="min-h-11 rounded-lg border border-brand-line bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-brand-orange" /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-brand-ink">To<input type="date" value={custom.end} onChange={event => setCustom(value => ({ ...value, end: event.target.value }))} aria-invalid={!!rangeError} aria-describedby={rangeError ? 'dashboard-range-error' : undefined} className="min-h-11 rounded-lg border border-brand-line bg-white px-3 text-sm focus-visible:ring-2 focus-visible:ring-brand-orange" /></label>
      </div>}
      {rangeError ? <p id="dashboard-range-error" role="alert" className="mt-2 text-xs text-red-700">{rangeError}</p>
        : <p className="mt-2 text-xs leading-relaxed text-brand-muted" aria-live="polite">{periodDescription} · {analysis.transactionCount} income/expense records in the loaded ledger. Calendar dates use Asia/Manila; weeks start Monday.</p>}
    </section>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <section className="min-w-0 rounded-2xl border border-brand-ink bg-brand-ink p-5 text-[#FFFFFF]">
        <div className="flex items-start justify-between gap-2"><h2 className="text-xs font-semibold">{DASHBOARD_FINANCIAL_LABELS.liquidBalances}</h2><WalletIcon aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg bg-[#EDF5E4] p-2 text-[#7A9D4C]" /></div>
        <p className="mt-5 break-words text-2xl font-bold tabular-nums text-[#D5E8B7]">{formatMoney(netAssets)}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-[#E7EEF3]">{DASHBOARD_FINANCIAL_LABELS.liquidBalancesNote} Current balances; unaffected by analysis period.</p>
      </section>
      <Metric title="Filtered income" value={analysis.income} icon={<TrendingUp aria-hidden="true" className="h-4 w-4" />} tone="income" note={`Gross income in loaded records · ${selectedLabel}.`} />
      <Metric title="Filtered expenses" value={analysis.expenses} icon={<TrendingDown aria-hidden="true" className="h-4 w-4" />} tone="expenses" note={`Loaded expenses including transaction fees · ${selectedLabel}.`} />
      <Metric title="Loan principal debt" value={loanPrincipal} icon={<Landmark aria-hidden="true" className="h-4 w-4" />} tone="loans" note={`${loans.length} loan agreements · Current remaining principal; unaffected by analysis period.`} />
    </div>

    <ChartCard title="Daily Trends" note="Income and expenses in the selected period, based on loaded records. Expenses include transaction fees."><DailyTrends points={analysis.daily} /></ChartCard>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard title="Expense Breakdown" note="Selected-period expenses by category, including transaction fees."><ExpenseBreakdown groups={analysis.categories} total={analysis.expenses} /></ChartCard>
      <ChartCard title="Spending by Member" note="Selected-period expenses grouped by the transaction’s recorded payer."><BarChart groups={analysis.members} /></ChartCard>
    </div>
    <ChartCard title="Average Transaction Size" note="Average expense amount per category in the selected period, including transaction fees."><BarChart groups={analysis.categories} average /></ChartCard>
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" onClick={() => setActiveTab('transactions')} className="min-h-11 rounded-lg border border-brand-line bg-white px-4 text-sm font-semibold text-brand-ink focus-visible:ring-2 focus-visible:ring-brand-orange">View ledger</button>
      <button type="button" onClick={onOpenAddTxModal} className="flex min-h-11 items-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-bold text-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-brand-ink"><Plus className="h-4 w-4" aria-hidden="true" />Quick Log Transaction</button>
    </div>
  </div>;
};

function Metric({ title, value, icon, tone, note }: { title: string; value: number; icon: React.ReactNode; tone: 'income' | 'expenses' | 'loans'; note: string }) {
  const colors = { income: 'text-[#146C86] bg-[#E7F4FA]', expenses: 'text-[#B72E38] bg-[#FFF0F1]', loans: 'text-[#925500] bg-[#FFF3E3]' };
  return <section className="min-w-0 rounded-2xl border border-brand-line bg-white p-5">
    <div className="flex items-start justify-between gap-2"><h2 className="text-xs font-semibold text-brand-muted">{title}</h2><span className={`rounded-lg p-2 ${colors[tone]}`}>{icon}</span></div>
    <p className={`mt-5 break-words text-2xl font-bold tabular-nums ${colors[tone].split(' ')[0]}`}>{formatMoney(value)}</p>
    <p className="mt-2 text-[11px] leading-relaxed text-brand-muted">{note}</p>
  </section>;
}
