'use client';

import React, { useState } from 'react';
import NextImage from 'next/image';
import { useHousehold } from '../context/HouseholdContext';
import {
  TrendingDown, TrendingUp, Wallet as WalletIcon, ShieldCheck,
  Landmark, Plus, ChevronRight, ChevronDown,
  Smartphone, CreditCard, Banknote, PiggyBank
} from 'lucide-react';
import { getCreditCardAvailableCredit, getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { getWalletTypeSummary } from '../lib/walletTypes';
import {
  buildDashboardSummaryColumns,
  buildDashboardWalletGroups,
  DashboardSummaryCardId,
  DashboardWalletGroupId,
  getDashboardSummaryWallets,
} from '../lib/dashboardGroups';
import { getDisplayFirstName, getHouseholdDisplayName } from '../lib/householdNaming';
import { DASHBOARD_FINANCIAL_LABELS } from './dashboardLabels';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
  onPayCreditCard: (walletId: string, amount: number, walletName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddTxModal, onPayCreditCard }) => {
  const {
    currentMember, members, wallets, transactions,
    loans, isAdmin
  } = useHousehold();

  const [expandedWalletSummaryCards, setExpandedWalletSummaryCards] = useState<Record<string, boolean>>({});
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const dashboardSummaryWallets = getDashboardSummaryWallets(visibleWallets);

  // Asset & Net Worth Math
  const liquidAssets = visibleWallets
    .filter(w => w.wallet_type !== 'credit_card')
    .reduce((acc, w) => acc + w.current_balance, 0);

  // Category totals for Wallets & Credit Lines Summary
  const walletSummary = getWalletTypeSummary(dashboardSummaryWallets);
  const dashboardWalletGroups = buildDashboardWalletGroups(dashboardSummaryWallets);
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

  const summaryColumns = buildDashboardSummaryColumns();
  const greetingName = getDisplayFirstName(currentMember.display_name);
  const householdDisplayName = getHouseholdDisplayName(members);

  const toggleWalletSummaryCard = (id: DashboardWalletGroupId) => {
    setExpandedWalletSummaryCards(prev => ({ ...prev, [id]: !prev[id] }));
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
    <div className="famledger-view famledger-dashboard space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-900/90 via-slate-800 to-indigo-900/80 border border-slate-700/80 rounded-xl p-5 sm:p-6 shadow-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-0.5">
            Hello, {greetingName}! 👋
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            <strong className="text-white">{householdDisplayName}</strong>
          </p>
        </div>

        <NextImage
          src="/illustrations/household-finance.webp"
          alt="A couple reviewing their household budget together"
          width={300}
          height={200}
          sizes="(min-width: 1280px) 240px, 200px"
          className="hidden h-28 w-40 shrink-0 object-contain xl:block lg:h-32 lg:w-48"
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <button
            onClick={onOpenAddTxModal}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Log Transaction</span>
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
      <div className="grid grid-cols-1 gap-6">
        <div className="dashboard-overview min-w-0 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Liquid balance summary; formula remains liquid assets less used card balances. */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{DASHBOARD_FINANCIAL_LABELS.liquidBalances}</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <WalletIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₱{netAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              {DASHBOARD_FINANCIAL_LABELS.liquidBalancesNote}
            </p>
          </div>
        </div>

        {/* Monthly Inflow */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{DASHBOARD_FINANCIAL_LABELS.income}</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-sky-400">
              ₱{totalMonthlyIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">{DASHBOARD_FINANCIAL_LABELS.incomeNote}</p>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">{DASHBOARD_FINANCIAL_LABELS.expenses}</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-rose-400">
              ₱{totalMonthlyExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">{DASHBOARD_FINANCIAL_LABELS.expensesNote}</p>
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
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-2xl p-5 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm text-white">Household Wallets & Credit Lines Summary</h3>
              <p className="text-[11px] text-slate-400">Available money in wallets and unused credit card capacity are shown separately</p>
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

        </div>
      </div>
    </div>
  );
};
