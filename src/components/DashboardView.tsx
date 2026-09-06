'use client';

import React, { useEffect, useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  TrendingDown, TrendingUp, ArrowRightLeft, Wallet as WalletIcon, ShieldCheck, 
  Landmark, Plus, AlertCircle, ChevronRight, ChevronDown, DollarSign, Clock, Calendar,
  Smartphone, CreditCard, Banknote, PiggyBank
} from 'lucide-react';
import { Loan } from '../types/database';
import { CategoryIcon } from './CategoryIcon';
import { getCreditCardAvailableCredit, getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { getInitialLedgerCycleFilter, getNextLedgerCycle, LedgerCycleRange } from '../lib/billingCycles';
import { getWalletTypeLabel, getWalletTypeSummary } from '../lib/walletTypes';
import { buildDashboardWalletGroups, buildScheduleWalletGroups, DashboardWalletGroupId } from '../lib/dashboardGroups';

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
    household, currentMember, members, wallets, categories, transactions, 
    savingsGoals, loans, recurringTransfers, isAdmin, payLoanAmortization, fundSavingsGoal 
  } = useHousehold();

  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');
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

  const toggleWalletSummaryCard = (id: DashboardWalletGroupId) => {
    setExpandedWalletSummaryCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleScheduleWallet = (id: string) => {
    setExpandedScheduleWallets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const walletSummaryCards = [
    {
      id: 'bank' as DashboardWalletGroupId,
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
      id: 'e_wallet' as DashboardWalletGroupId,
      title: 'E-Wallets',
      badge: `${walletSummary.eWalletCount} Accounts`,
      total: totalEWalletBalance,
      totalClass: 'text-indigo-400',
      borderClass: 'border-indigo-500/30',
      badgeClass: 'bg-indigo-500/10 text-indigo-300',
      icon: <Smartphone className="w-3.5 h-3.5 text-indigo-400" />,
      description: 'Total e-wallet balances',
    },
    {
      id: 'e_wallet_savings' as DashboardWalletGroupId,
      title: 'E Wallet Savings',
      badge: `${walletSummary.eWalletSavingsCount} Accounts`,
      total: totalEWalletSavingsBalance,
      totalClass: 'text-teal-400',
      borderClass: 'border-teal-500/30',
      badgeClass: 'bg-teal-500/10 text-teal-300',
      icon: <PiggyBank className="w-3.5 h-3.5 text-teal-400" />,
      description: 'Total e-wallet savings balances',
    },
    {
      id: 'cash' as DashboardWalletGroupId,
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
      id: 'credit_card' as DashboardWalletGroupId,
      title: 'Available Credit Lines',
      badge: `${walletSummary.creditCardCount} Cards`,
      total: totalAvailableCredit,
      totalClass: 'text-emerald-400',
      borderClass: 'border-purple-500/30',
      badgeClass: 'bg-purple-500/10 text-purple-300',
      icon: <CreditCard className="w-3.5 h-3.5 text-purple-400" />,
      description: `Limit: ₱${totalCreditLimit.toLocaleString()} | Used: ₱${totalUsedCredit.toLocaleString()}`,
    },
  ];

  const handlePayAmortizationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!payingLoan) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid amortization payment amount.');
      return;
    }

    const res = payLoanAmortization(payingLoan.id, amt, selectedWalletId);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to process amortization payment.');
      return;
    }

    setPayAmount('');
    setPayingLoan(null);
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

        <button
          onClick={onOpenAddTxModal}
          className="flex items-center space-x-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-lg active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Quick Log Transaction</span>
        </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {walletSummaryCards.map(card => {
            const group = dashboardWalletGroups.find(item => item.id === card.id);
            const isExpanded = !!expandedWalletSummaryCards[card.id];

            return (
              <div key={card.id} className={`bg-slate-900/80 border ${card.borderClass} p-3.5 rounded-xl space-y-2`}>
                <button
                  type="button"
                  onClick={() => toggleWalletSummaryCard(card.id)}
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

                <div className={`text-lg font-bold font-mono ${card.totalClass}`}>
                  ₱{card.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className={`text-[10px] text-slate-400 ${card.id === 'cash' ? 'font-mono' : ''}`}>
                  {card.description}
                </p>

                {isExpanded && (
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
          })}

          {/* Combined Total Purchasing Power */}
          <div className="bg-slate-900/80 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Purchasing Power</span>
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-mono px-1.5 py-0.2 rounded">
                Liquid + Credit
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-300">
              ₱{totalCombinedAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">Combined liquid funds & available credit</p>
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
          <div className="space-y-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
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

      {/* Two Column Grid: Loans Amortization & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Loans Amortization Schedule */}
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Landmark className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Loans & Amortization Schedule</h3>
            </div>
            <button
              onClick={() => setActiveTab('loans')}
              className="text-xs text-amber-400 hover:underline font-medium"
            >
              Manage Loans ➔
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loans.map(loan => {
              const paidCount = loan.paid_amortizations_count || 0;
              const paidAmount = loan.amount_paid !== undefined && loan.amount_paid !== null ? loan.amount_paid : (paidCount * loan.monthly_amortization);
              const percentPaid = loan.total_principal > 0 
                ? Math.min(Math.round((paidAmount / loan.total_principal) * 100), 100) 
                : 0;

              const isBiMonthly = loan.payment_frequency === 'bi_monthly';

              return (
                <div key={loan.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-white">{loan.name}</h4>
                      <p className="text-[11px] text-slate-400">{loan.lender}</p>
                    </div>
                    {loan.next_due_date ? (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/25">
                        Due: {loan.next_due_date}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {isBiMonthly ? 'Bi-Monthly' : 'Monthly'}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px]">Remaining Balance:</span>
                      <p className="font-bold text-rose-400">₱{loan.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px]">
                        Required Amortization:
                      </span>
                      <p className="font-bold text-white">₱{loan.monthly_amortization.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Paid: {paidCount} Amortizations (₱{paidAmount.toLocaleString()})</span>
                      <span className="text-emerald-400 font-bold">{percentPaid}% Paid Off</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setPayingLoan(loan);
                      setPayAmount(loan.monthly_amortization.toString());
                      if (visibleWallets.length > 0) setSelectedWalletId(loan.source_wallet_id || visibleWallets[0].id);
                    }}
                    className="w-full text-center py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay Required Amortization (₱{loan.monthly_amortization.toLocaleString()})</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white">Recent Transactions Log</h3>
            <button
              onClick={() => setActiveTab('transactions')}
              className="text-xs text-sky-400 hover:underline font-medium"
            >
              View Full Ledger ➔
            </button>
          </div>

          <div className="space-y-2">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="bg-slate-900/60 border border-slate-700/40 p-3 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className={`p-2 rounded-lg ${
                    tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400' :
                    tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-indigo-500/10 text-indigo-400'
                  }`}>
                    {tx.type === 'expense' ? <TrendingDown className="w-4 h-4" /> :
                     tx.type === 'income' ? <TrendingUp className="w-4 h-4" /> :
                     <ArrowRightLeft className="w-4 h-4" />}
                  </span>
                  <div>
                    <h4 className="font-medium text-white">{tx.note || 'Transaction'}</h4>
                    <p className="text-[10px] text-slate-400">{tx.transaction_date}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-mono font-bold block ${
                    tx.type === 'expense' ? 'text-rose-400' :
                    tx.type === 'income' ? 'text-emerald-400' :
                    'text-indigo-300'
                  }`}>
                    {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                    ₱{tx.amount.toFixed(2)}
                  </span>
                  {(tx.fee || 0) > 0 && (
                    <span className="text-[9px] text-amber-400 font-mono block">
                      Fee: ₱{tx.fee?.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Pay Amortization Modal */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Pay Amortization: {payingLoan.name}</h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePayAmortizationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amortization Payment Amount (₱ PHP)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Wallet Account</label>
                <select
                  value={selectedWalletId}
                  onChange={(e) => setSelectedWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.wallet_type === 'credit_card'
                        ? `${w.name} (Available: ₱${getCreditCardAvailableCredit(w).toFixed(2)} | Used: ₱${getCreditCardUsedBalance(w).toFixed(2)})`
                        : `${w.name} (₱${w.current_balance.toFixed(2)})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayingLoan(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Confirm Amortization Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
