'use client';

import React, { useEffect, useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import {
  TrendingDown, TrendingUp, Wallet as WalletIcon, ShieldCheck,
  Landmark, Plus, ChevronRight, ChevronDown, Clock, Calendar,
  Smartphone, CreditCard, Banknote, PiggyBank
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { getCreditCardAvailableCredit, getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { getInitialLedgerCycleFilter, getNextLedgerCycle, LedgerCycleRange } from '../lib/billingCycles';
import { getWalletTypeLabel, getWalletTypeSummary } from '../lib/walletTypes';
import {
  buildDashboardSummaryColumns,
  buildDashboardWalletGroups,
  buildScheduleWalletGroups,
  DashboardSummaryCardId,
  DashboardWalletGroupId,
} from '../lib/dashboardGroups';

const DASHBOARD_SCHEDULE_FILTER_KEY = 'smc_dashboard_schedule_filter';

function getSavedScheduleFilter(): LedgerCycleRange | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(DASHBOARD_SCHEDULE_FILTER_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (typeof parsed?.startDate === 'string' && typeof parsed?.endDate === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddTxModal }) => {
  const {
    household, currentMember, wallets, categories, transactions,
    loans, recurringTransfers, isAdmin
  } = useHousehold();

  const [expandedWalletSummaryCards, setExpandedWalletSummaryCards] = useState<Record<string, boolean>>({});
  const [showScheduleWallets, setShowScheduleWallets] = useState(false);
  const [expandedScheduleWallets, setExpandedScheduleWallets] = useState<Record<string, boolean>>({});

  // Date Range Filter State for Recurring Bills & Transfers
  const initialCycle = getInitialLedgerCycleFilter(new Date(), getSavedScheduleFilter());
  const [recurringStartDate, setRecurringStartDate] = useState<string>(initialCycle.startDate);
  const [recurringEndDate, setRecurringEndDate] = useState<string>(initialCycle.endDate);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_SCHEDULE_FILTER_KEY, JSON.stringify({
      startDate: recurringStartDate,
      endDate: recurringEndDate,
    }));
  }, [recurringStartDate, recurringEndDate]);

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  // Asset & Net Worth Math
  const liquidAssets = visibleWallets
    .filter(w => w.wallet_type !== 'credit_card')
    .reduce((acc, w) => acc + w.current_balance, 0);

  // Category totals for Wallets & Credit Lines Summary
  const walletSummary = getWalletTypeSummary(visibleWallets);
  const dashboardWalletGroups = buildDashboardWalletGroups(visibleWallets);
  const totalBankBalance = walletSummary.bankBalance;
  const totalEWalletBalance = walletSummary.eWalletBalance;
  const totalEWalletSavingsBalance = walletSummary.eWalletSavingsBalance;
  const totalCashBalance = walletSummary.cashBalance;
  const totalAvailableCredit = walletSummary.availableCredit;
  const totalCreditLimit = walletSummary.creditLimit;
  const totalUsedCredit = walletSummary.usedCredit;

  const totalCombinedAvailable = totalBankBalance + totalEWalletBalance + totalEWalletSavingsBalance + totalCashBalance + totalAvailableCredit;

  // Outstanding Credit Card Debt
  const creditCardDebt = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((acc, w) => acc + getCreditCardUsedBalance(w), 0);

  // Net Assets = Cash/Bank/E-Wallet Liquid Assets minus Credit Line Balances
  const netAssets = liquidAssets - creditCardDebt;

  const totalMonthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalMonthlyExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount + (t.fee || 0), 0);

  // Filter & Grouping Math for Recurring Bills & Transfers Schedule by Date Range and Wallet Account
  const filteredRecurring = recurringTransfers.filter(rule => {
    if (!rule.next_run_date) return false;
    const itemDate = rule.next_run_date;
    const matchesStart = !recurringStartDate || itemDate >= recurringStartDate;
    const matchesEnd = !recurringEndDate || itemDate <= recurringEndDate;
    return matchesStart && matchesEnd;
  });

  const walletGroups = buildScheduleWalletGroups(filteredRecurring, wallets);
  const totalFilteredOutflow = filteredRecurring.reduce((sum, r) => sum + r.amount, 0);
  const totalFilteredItemsCount = filteredRecurring.length;
  const summaryColumns = buildDashboardSummaryColumns();

  const toggleWalletSummaryCard = (id: DashboardWalletGroupId) => {
    setExpandedWalletSummaryCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleScheduleWallet = (id: string) => {
    setExpandedScheduleWallets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const walletSummaryCards: Array<{
    id: DashboardSummaryCardId;
    title: string;
    badge: string;
    total: number;
    totalClass: string;
    borderClass: string;
    badgeClass: string;
    icon: React.ReactNode;
    description: string;
    walletGroupId?: DashboardWalletGroupId;
  }> = [
    {
      id: 'total_purchasing_power',
      title: 'Total Purchasing Power',
      badge: 'Liquid + Credit',
      total: totalCombinedAvailable,
      totalClass: 'text-emerald-300',
      borderClass: 'border-emerald-500/30',
      badgeClass: 'bg-emerald-500/10 text-emerald-300',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />,
      description: 'Combined liquid funds & available credit',
    },
    {
      id: 'bank',
      walletGroupId: 'bank',
      title: 'Bank Accounts',
      badge: `${walletSummary.bankCount} Accounts`,
      total: totalBankBalance,
      totalClass: 'text-sky-400',
      borderClass: 'border-sky-500/30',
      badgeClass: 'bg-sky-500/10 text-sky-300',
      icon: <Landmark className="w-3.5 h-3.5 text-sky-400" />,
      description: 'Total liquid bank savings',
    },
    {
      id: 'e_wallet',
      walletGroupId: 'e_wallet',
      title: 'E Wallet Accounts',
      badge: `${walletSummary.eWalletCount} Accounts`,
      total: totalEWalletBalance,
      totalClass: 'text-indigo-400',
      borderClass: 'border-indigo-500/30',
      badgeClass: 'bg-indigo-500/10 text-indigo-300',
      icon: <Smartphone className="w-3.5 h-3.5 text-indigo-400" />,
      description: 'Total e-wallet balances',
    },
    {
      id: 'e_wallet_savings',
      walletGroupId: 'e_wallet_savings',
      title: 'E Wallet Savings Accounts',
      badge: `${walletSummary.eWalletSavingsCount} Accounts`,
      total: totalEWalletSavingsBalance,
      totalClass: 'text-teal-400',
      borderClass: 'border-teal-500/30',
      badgeClass: 'bg-teal-500/10 text-teal-300',
      icon: <PiggyBank className="w-3.5 h-3.5 text-teal-400" />,
      description: 'Total e-wallet savings balances',
    },
    {
      id: 'cash',
      walletGroupId: 'cash',
      title: 'Cash On Hand',
      badge: `${walletSummary.cashCount} Accounts`,
      total: totalCashBalance,
      totalClass: 'text-amber-400',
      borderClass: 'border-amber-500/30',
      badgeClass: 'bg-amber-500/10 text-amber-300',
      icon: <Banknote className="w-3.5 h-3.5 text-amber-400" />,
      description: 'Total cash balances',
    },
    {
      id: 'credit_card',
      walletGroupId: 'credit_card',
      title: 'Available Credits',
      badge: `${walletSummary.creditCardCount} Cards`,
      total: totalAvailableCredit,
      totalClass: 'text-emerald-400',
      borderClass: 'border-purple-500/30',
      badgeClass: 'bg-purple-500/10 text-purple-300',
      icon: <CreditCard className="w-3.5 h-3.5 text-purple-400" />,
      description: `Limit: ₱${totalCreditLimit.toLocaleString()} | Used: ₱${totalUsedCredit.toLocaleString()}`,
    },
  ];

  const walletSummaryCardMap = new Map(walletSummaryCards.map(card => [card.id, card]));
  const renderWalletSummaryCard = (cardId: DashboardSummaryCardId) => {
    const card = walletSummaryCardMap.get(cardId);
    if (!card) return null;

    const group = card.walletGroupId
      ? dashboardWalletGroups.find(item => item.id === card.walletGroupId)
      : null;
    const isExpanded = card.walletGroupId ? !!expandedWalletSummaryCards[card.walletGroupId] : false;

    return (
      <div key={card.id} className={`bg-slate-900/80 border ${card.borderClass} p-3.5 rounded-xl space-y-2`}>
        {card.walletGroupId ? (
          <button
            type="button"
            onClick={() => toggleWalletSummaryCard(card.walletGroupId!)}
            aria-expanded={isExpanded}
            className="w-full flex items-center justify-between gap-2 text-left text-xs text-slate-400"
          >
            <span className="flex min-w-0 items-center space-x-1">
              {card.icon}
              <span className="truncate">{card.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className={`text-[10px] ${card.badgeClass} font-mono px-1.5 py-0.2 rounded`}>
                {card.badge}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex min-w-0 items-center space-x-1">
              {card.icon}
              <span>{card.title}</span>
            </span>
            <span className={`text-[10px] ${card.badgeClass} font-mono px-1.5 py-0.2 rounded`}>
              {card.badge}
            </span>
          </div>
        )}

        <div className={`text-lg font-bold font-mono ${card.totalClass}`}>
          ₱{card.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        <p className={`text-[10px] text-slate-400 ${card.id === 'cash' ? 'font-mono' : ''}`}>
          {card.description}
        </p>

        {card.walletGroupId && isExpanded && (
          <div className="pt-2 border-t border-slate-700/50 space-y-1.5">
            {group && group.accounts.length > 0 ? (
              group.accounts.map(account => (
                <div key={account.id} className="flex items-start justify-between gap-2 rounded-md bg-slate-950/35 px-2 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-semibold text-white">{account.name}</span>
                      {account.isShared && (
                        <span className="shrink-0 text-[9px] bg-sky-500/15 text-sky-300 px-1 py-0.2 rounded font-mono">
                          Shared
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase font-mono">{account.typeLabel}</span>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <span className="block text-[11px] font-bold text-emerald-400">
                      ₱{account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    {account.secondaryBalance !== undefined && (
                      <span className="block text-[9px] text-rose-400 font-sans">
                        Used: ₱{account.secondaryBalance.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[10px] text-slate-500 italic">No accounts in this group.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-900/90 via-slate-800 to-indigo-900/80 border border-slate-700/80 rounded-xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider font-mono">Family Finance Command Center</span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
            Hello, {currentMember.display_name}! 👋
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Real-time balance tracking, envelope budgeting, loan amortization schedules, and sinking funds for the <strong className="text-white">{household.name}</strong>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <button
            onClick={onOpenAddTxModal}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Quick Log Transaction</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className="flex items-center justify-center space-x-2 bg-slate-900/70 hover:bg-slate-900 text-sky-200 border border-sky-500/30 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
          >
            <WalletIcon className="w-4 h-4" />
            <span>View / Manage Transactions</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Assets */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Household Net Assets</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <WalletIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₱{netAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Liquid: ₱{liquidAssets.toLocaleString()} | CC Debt: ₱{creditCardDebt.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Monthly Inflow */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Monthly Income</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-sky-400">
              ₱{totalMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Logged Inflows & Salary</p>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Monthly Expenses</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-400">
              ₱{totalMonthlyExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Logged Outflows & Fees</p>
          </div>
        </div>

        {/* Outstanding Loan Obligations */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Loan Principal Debt</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-400">
              ₱{loans.reduce((sum, l) => sum + l.remaining_balance, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{loans.length} active loan agreements</p>
          </div>
        </div>
      </div>

      {/* Household Accounts Summary Widget */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Household Wallets & Credit Lines Summary</h3>
              <p className="text-[11px] text-slate-400">Total liquid funds across bank accounts, e-wallets, e-wallet savings, cash, and available credit card lines</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('wallets')}
            className="text-xs text-sky-400 hover:underline font-medium shrink-0"
          >
            Manage Accounts ➔
          </button>
        </div>

        {/* Totals & Summary KPI Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-3">
            {summaryColumns.left.map(renderWalletSummaryCard)}
          </div>
          <div className="space-y-3">
            {summaryColumns.right.map(renderWalletSummaryCard)}
          </div>
        </div>
      </div>

      {/* Recurring Bills & Transfers Schedule Section */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-5 shadow-lg">
        {/* Header & Date Range Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-sm text-white">Recurring Bills & Transfers Schedule</h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Filter upcoming recurring bills & transfers by your 5th-19th and 20th-4th billing cycles.
            </p>
          </div>

          {/* Custom Start & End Date Inputs & Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-700 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-400 font-medium">From:</span>
              <input
                type="date"
                value={recurringStartDate}
                onChange={(e) => setRecurringStartDate(e.target.value)}
                className="bg-transparent text-amber-300 font-mono font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-700 px-2.5 py-1.5 rounded-lg">
              <span className="text-slate-400 font-medium">To:</span>
              <input
                type="date"
                value={recurringEndDate}
                onChange={(e) => setRecurringEndDate(e.target.value)}
                className="bg-transparent text-amber-300 font-mono font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const nextCycle = getNextLedgerCycle({
                  startDate: recurringStartDate,
                  endDate: recurringEndDate,
                });
                setRecurringStartDate(nextCycle.startDate);
                setRecurringEndDate(nextCycle.endDate);
              }}
              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-semibold rounded-lg transition-colors"
            >
              Next Cycle
            </button>

            <button
              type="button"
              onClick={() => {
                setRecurringStartDate('');
                setRecurringEndDate('');
              }}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-medium rounded-lg transition-colors"
            >
              Show All
            </button>
          </div>
        </div>

        {/* Overall Filter Summary Banner */}
        <div className="bg-slate-900/70 border border-slate-700/60 p-4 rounded-xl text-xs">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-400">Date Range Filter: </span>
                <strong className="text-amber-300 font-mono">
                  {recurringStartDate || 'Earliest'} ➔ {recurringEndDate || 'Latest'}
                </strong>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {totalFilteredItemsCount} scheduled items across {walletGroups.length} paying wallet accounts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-stretch lg:self-auto">
              {walletGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowScheduleWallets(prev => !prev)}
                  aria-expanded={showScheduleWallets}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/15"
                >
                  {showScheduleWallets ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>{showScheduleWallets ? 'Hide Wallets' : 'Show Wallets'}</span>
                </button>
              )}

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">Total Scheduled Outflow</span>
                <span className="text-xl font-bold font-mono text-rose-400 block">
                  ₱{totalFilteredOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <button onClick={() => setActiveTab('schedules')} className="mt-1 text-[11px] font-medium text-indigo-300 hover:underline">
                  Manage Schedules ➔
                </button>
              </div>
            </div>
          </div>

          {walletGroups.length > 0 && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {walletGroups.map(({ wallet, items, totalOutflow }, index) => {
                const groupKey = wallet?.id || `unknown-${index}`;

                return (
                  <div key={groupKey} className="rounded-lg bg-slate-950/35 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-white">{wallet?.name || 'Unknown Paying Account'}</p>
                        <p className="text-[10px] text-slate-500">{items.length} scheduled items</p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold font-mono text-rose-400">
                        ₱{totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Grouped by Paying Wallet Account */}
        {walletGroups.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-8 text-center text-slate-500 italic text-xs">
            No recurring bills or transfers scheduled with next due dates falling within the selected date range ({recurringStartDate || 'Start'} to {recurringEndDate || 'End'}).
          </div>
        ) : showScheduleWallets ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {walletGroups.map(({ wallet, items, totalOutflow, availableBalance, hasSufficientFunds }, index) => {
              const groupKey = wallet?.id || `unknown-${index}`;
              const isExpanded = !!expandedScheduleWallets[groupKey];

              return (
                <div key={groupKey} className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4 space-y-3 shadow-md">
                  {/* Wallet Group Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <button
                      type="button"
                      onClick={() => toggleScheduleWallet(groupKey)}
                      aria-expanded={isExpanded}
                      className="flex min-w-0 items-center space-x-2.5 text-left"
                    >
                      <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                        <WalletIcon className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-white flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          )}
                          <span className="truncate">{wallet?.name || 'Unknown Paying Account'}</span>
                          <span className="shrink-0 text-[10px] text-slate-400 font-mono uppercase bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                            {wallet ? getWalletTypeLabel(wallet.wallet_type) : 'Account'}
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          <span>Account Available: <strong className="text-slate-200 font-mono">₱{availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                          <span>{items.length} scheduled items</span>
                          {!hasSufficientFunds && (
                            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 px-1.5 py-0.2 rounded border border-rose-500/30">
                              Insufficient Available Balance!
                            </span>
                          )}
                        </p>
                      </div>
                    </button>

                    {/* Group Outflow Total */}
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">Paying Account Outflow Total</span>
                      <span className="text-base font-bold font-mono text-rose-400 block">
                        ₱{totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* List of Recurring Items for this Wallet */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 gap-3 pt-1">
                      {items.map(rule => {
                        const cat = rule.category_id ? categories.find(c => c.id === rule.category_id) : null;
                        const dst = rule.destination_wallet_id ? wallets.find(w => w.id === rule.destination_wallet_id) : null;
                        const loan = rule.loan_id ? loans.find(l => l.id === rule.loan_id) : null;

                        return (
                          <div key={rule.id} className="bg-slate-800/80 border border-slate-700/60 p-3 rounded-lg flex items-start justify-between gap-2 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-white">{rule.note}</span>
                                <span className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded uppercase ${
                                  rule.rule_type === 'expense' ? 'bg-rose-500/10 text-rose-400' :
                                  rule.rule_type === 'loan_payment' ? 'bg-amber-500/10 text-amber-400' :
                                  'bg-indigo-500/10 text-indigo-400'
                                }`}>
                                  {rule.rule_type === 'loan_payment' ? 'LOAN PAYMENT' : rule.rule_type}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                                {rule.rule_type === 'transfer' && dst && (
                                  <span>➔ Destination: <strong className="text-indigo-300">{dst.name}</strong></span>
                                )}

                                {loan ? (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-amber-300 bg-amber-500/15 px-2 py-0.2 rounded border border-amber-500/30">
                                    <Landmark className="w-3 h-3 mr-1 text-amber-400" />
                                    {loan.name}
                                  </span>
                                ) : cat ? (
                                  <span className="inline-flex items-center text-[10px] font-semibold text-sky-300 bg-sky-500/15 px-2 py-0.2 rounded border border-sky-500/30">
                                    <CategoryIcon slug={cat.icon_slug} className="w-3 h-3 mr-1" />
                                    {cat.name}
                                  </span>
                                ) : null}
                              </div>

                              <div className="text-[11px] font-bold text-amber-300 font-mono flex items-center pt-0.5">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-amber-400" /> Next Due Date: {rule.next_run_date}
                              </div>
                            </div>

                            <div className="text-right font-mono shrink-0">
                              <span className="font-bold text-sm text-rose-400 block">
                                ₱{rule.amount.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-sans block uppercase">
                                {rule.frequency === 'bimonthly' ? 'BI-MONTHLY' : rule.frequency}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

    </div>
  );
};
