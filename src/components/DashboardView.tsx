'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, ShieldCheck, Target, AlertTriangle, Landmark, Calendar, DollarSign } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { Loan } from '../types/database';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddTxModal }) => {
  const { 
    household, wallets, categories, transactions, savingsGoals, loans, 
    currentMember, isAdmin, payLoanAmortization 
  } = useHousehold();

  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  // Net Worth = Liquid assets (Bank, E-Wallet, Cash) minus Credit Card Used debt & Loan remaining balances
  const liquidAssets = visibleWallets
    .filter(w => w.wallet_type !== 'credit_card')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const creditCardDebt = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const totalNetWorth = liquidAssets - creditCardDebt;

  const totalMonthlyBudget = categories.reduce((sum, c) => sum + c.monthly_budget_limit, 0);

  const now = new Date();
  const currentMonthTx = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalSpentThisMonth = currentMonthTx
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncomeThisMonth = currentMonthTx
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRemainingDebt = loans.reduce((sum, l) => sum + l.remaining_balance, 0) + creditCardDebt;

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!payingLoan) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      return;
    }

    const res = payLoanAmortization(payingLoan.id, amt, selectedWalletId);
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to process payment.');
      return;
    }

    setPayingLoan(null);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      
      {/* KPI Stats Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Worth */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Household Net Liquid Assets</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            ₱{totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">Across {visibleWallets.length} visible accounts</p>
        </div>

        {/* Monthly Budget Envelope Limit */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Monthly Envelope Budget</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">
            ₱{totalMonthlyBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-400">Spent: ₱{totalSpentThisMonth.toLocaleString()}</span>
            <span className={totalSpentThisMonth > totalMonthlyBudget ? 'text-rose-400 font-bold' : 'text-emerald-400 font-medium'}>
              {totalMonthlyBudget > 0 ? Math.round((totalSpentThisMonth / totalMonthlyBudget) * 100) : 0}% used
            </span>
          </div>
        </div>

        {/* Monthly Income vs Outflow */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Month Income / Outflow</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold font-mono text-emerald-400">+₱{totalIncomeThisMonth.toLocaleString()}</span>
            <span className="text-xs font-mono text-rose-400">-₱{totalSpentThisMonth.toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-400">Current month cashflow</p>
        </div>

        {/* Total Outstanding Debt */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Outstanding Debt</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">
            ₱{totalRemainingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400">{loans.length} loans + credit card statement balances</p>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Columns: Wallets & Recent Transactions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Wallets & Accounts Summary */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-sky-400" />
                <span>Household Wallets & Accounts</span>
              </h3>
              <button
                onClick={() => setActiveTab('wallets')}
                className="text-xs text-sky-400 hover:underline font-medium"
              >
                View All Accounts ➔
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleWallets.map(w => {
                const isCreditCard = w.wallet_type === 'credit_card';
                const creditLimitVal = w.credit_limit || 0;
                const usedBalance = w.current_balance;
                const availableCredit = isCreditCard 
                  ? (creditLimitVal > 0 ? creditLimitVal - usedBalance : 0) 
                  : w.current_balance;

                return (
                  <div key={w.id} className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3.5 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-xs text-white">{w.name}</h4>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{w.wallet_type.replace('_', ' ')}</span>
                    </div>
                    <div className="text-right">
                      {isCreditCard ? (
                        <>
                          <span className="text-[9px] text-slate-400 uppercase font-mono block">Remaining Available</span>
                          <span className="font-bold text-sm font-mono text-emerald-400">
                            ₱{availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-rose-400 font-mono block">
                            Used: ₱{usedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-sm font-mono text-emerald-400">
                          ₱{w.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Loans & Amortization Overview Widget */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                <span>Loans & Amortization Schedule</span>
              </h3>
              <button
                onClick={() => setActiveTab('loans')}
                className="text-xs text-amber-400 hover:underline font-medium"
              >
                Manage Loans ➔
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loans.map(loan => {
                const paidAmount = loan.total_principal - loan.remaining_balance;
                const percentPaid = loan.total_principal > 0 
                  ? Math.min(Math.round((paidAmount / loan.total_principal) * 100), 100) 
                  : 0;

                return (
                  <div key={loan.id} className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-xs text-white">{loan.name}</h4>
                        <p className="text-[11px] text-slate-400">{loan.lender}</p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Day {loan.due_day_of_month} Due
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline text-xs font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px]">Remaining Balance:</span>
                        <p className="font-bold text-rose-400">₱{loan.remaining_balance.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px]">Monthly Amortization:</span>
                        <p className="font-bold text-white">₱{loan.monthly_amortization.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Payoff Progress</span>
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
                        if (visibleWallets.length > 0) setSelectedWalletId(visibleWallets[0].id);
                      }}
                      className="w-full text-center py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Pay Amortization (₱{loan.monthly_amortization.toLocaleString()})</span>
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

                  <span className={`font-mono font-bold ${
                    tx.type === 'expense' ? 'text-rose-400' :
                    tx.type === 'income' ? 'text-emerald-400' :
                    'text-indigo-300'
                  }`}>
                    {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                    ₱{tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Envelope Budgets & Sinking Funds */}
        <div className="space-y-6">

          {/* Envelope Budgets Health */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Category Envelopes</span>
              </h3>
              <button
                onClick={() => setActiveTab('budgets')}
                className="text-xs text-sky-400 hover:underline font-medium"
              >
                Manage ➔
              </button>
            </div>

            <div className="space-y-3">
              {categories.slice(0, 5).map(cat => {
                const catSpend = currentMonthTx
                  .filter(t => t.type === 'expense' && t.category_id === cat.id)
                  .reduce((sum, t) => sum + t.amount, 0);

                const percent = cat.monthly_budget_limit > 0 
                  ? Math.min(Math.round((catSpend / cat.monthly_budget_limit) * 100), 100) 
                  : 0;

                const isOver = catSpend > cat.monthly_budget_limit;

                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs items-center">
                      <span className="font-semibold text-slate-200 flex items-center space-x-2">
                        <CategoryIcon slug={cat.icon_slug} className="w-4 h-4" />
                        <span className="truncate max-w-[140px]">{cat.name}</span>
                      </span>
                      <span className={`font-mono text-[11px] ${isOver ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                        ₱{catSpend.toFixed(0)} / ₱{cat.monthly_budget_limit.toFixed(0)}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sinking Funds / Savings Goals */}
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span>Shared Savings & Sinking Funds</span>
              </h3>
              <button
                onClick={() => setActiveTab('goals')}
                className="text-xs text-sky-400 hover:underline font-medium"
              >
                All Goals ➔
              </button>
            </div>

            <div className="space-y-3">
              {savingsGoals.map(goal => {
                const percent = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
                return (
                  <div key={goal.id} className="bg-slate-900/60 border border-slate-700/60 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white truncate max-w-[160px]">{goal.name}</span>
                      <span className="text-emerald-400 font-mono font-bold">{percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Pay Amortization Modal on Dashboard */}
      {payingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Pay Amortization: {payingLoan.name}</h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePaySubmit} className="space-y-4">
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
                      {w.name} (₱{w.current_balance.toFixed(2)})
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
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
