'use client';

import React from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, ShieldCheck, Target, AlertTriangle } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab, onOpenAddTxModal }) => {
  const { household, currentMember, members, wallets, categories, transactions, savingsGoals, isAdmin } = useHousehold();

  // Wallet security filter
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const totalBalance = visibleWallets.reduce((acc, w) => acc + w.current_balance, 0);

  // Current Month Calculations
  const now = new Date();
  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.transaction_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalMonthlyBudget = categories.reduce((sum, c) => sum + c.monthly_budget_limit, 0);

  return (
    <div className="space-y-6">
      {/* Role Banner Info */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isAdmin ? 'bg-amber-500/10 border-amber-500/30' : 'bg-sky-500/10 border-sky-500/30'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Viewing as: <span className={isAdmin ? 'text-amber-400' : 'text-sky-400'}>{currentMember.display_name}</span> ({currentMember.role.toUpperCase()})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAdmin 
                ? 'Full Household Control: Manage budgets, manage members, edit any transactions, and manage all wallets.'
                : 'Member Mode: Manage personal cash wallet, log transactions, fund savings goals, and edit own entries (<24 hrs).'
              }
            </p>
          </div>
        </div>
        <button
          onClick={onOpenAddTxModal}
          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shadow"
        >
          + Add Transaction
        </button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Worth */}
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Net Worth</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            ₱{totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400">{visibleWallets.length} active wallets visible</p>
        </div>

        {/* Monthly Income */}
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">This Month's Income</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            +₱{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400">All household members</p>
        </div>

        {/* Monthly Expense */}
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">This Month's Expenses</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            -₱{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400">Budget cap: ₱{totalMonthlyBudget.toLocaleString()}</p>
        </div>

        {/* Sinking Funds / Goals */}
        <div className="bg-slate-800/80 border border-slate-700/70 p-4 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Savings Goals Saved</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-300 tracking-tight">
            ₱{savingsGoals.reduce((sum, g) => sum + g.current_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-400">{savingsGoals.length} active sinking funds</p>
        </div>
      </div>

      {/* Main Grid: Envelope Budgets & Recent Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Monthly Category Envelope Budgets */}
        <div className="lg:col-span-1 bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>Category Envelope Budgets</span>
            </h3>
            <button 
              onClick={() => setActiveTab('budgets')}
              className="text-xs text-sky-400 hover:underline font-medium"
            >
              View All
            </button>
          </div>

          <div className="space-y-4">
            {categories.map(cat => {
              // Calculate category spend this month
              const catSpend = currentMonthTransactions
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
                      <span>{cat.name}</span>
                    </span>
                    <span className={`font-mono ${isOver ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                      ₱{catSpend.toFixed(2)} / ₱{cat.monthly_budget_limit.toFixed(2)}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        isOver 
                          ? 'bg-rose-500' 
                          : percent > 85 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Recent Household Activity Ledger */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Recent Household Ledger Activity</h3>
            <button 
              onClick={() => setActiveTab('transactions')}
              className="text-xs text-sky-400 hover:underline font-medium"
            >
              View Full Ledger
            </button>
          </div>

          <div className="divide-y divide-slate-700/60">
            {transactions.slice(0, 6).map(tx => {
              const payer = members.find(m => m.id === tx.payer_id);
              const wallet = wallets.find(w => w.id === tx.wallet_id);
              const destWallet = tx.destination_wallet_id ? wallets.find(w => w.id === tx.destination_wallet_id) : null;
              const category = categories.find(c => c.id === tx.category_id);

              return (
                <div key={tx.id} className="py-3 flex items-center justify-between hover:bg-slate-700/20 px-2 rounded-lg transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                      tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      {tx.type === 'expense' ? <TrendingDown className="w-4 h-4" /> :
                       tx.type === 'income' ? <TrendingUp className="w-4 h-4" /> :
                       <ArrowRightLeft className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white">{tx.note || (category ? category.name : 'Transfer')}</span>
                        {category && (
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium">
                            {category.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                        <span className="text-slate-300 font-medium">{payer?.display_name || 'Member'}</span>
                        <span>•</span>
                        <span>{tx.type === 'transfer' ? `${wallet?.name} ➔ ${destWallet?.name}` : wallet?.name}</span>
                        <span>•</span>
                        <span>{tx.transaction_date}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`text-sm font-bold font-mono ${
                    tx.type === 'expense' ? 'text-rose-400' :
                    tx.type === 'income' ? 'text-emerald-400' :
                    'text-indigo-300'
                  }`}>
                    {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}₱{tx.amount.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Sinking Funds Progress Section */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Shared Household Sinking Funds & Savings Goals</h3>
            <p className="text-xs text-slate-400">Target funds for family vacations, emergency reserves, and big purchases</p>
          </div>
          <button 
            onClick={() => setActiveTab('goals')}
            className="text-xs text-sky-400 hover:underline font-medium"
          >
            Manage Goals
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savingsGoals.map(goal => {
            const percent = Math.min(Math.round((goal.current_amount / goal.target_amount) * 100), 100);
            return (
              <div key={goal.id} className="bg-slate-900/60 border border-slate-700/80 p-4 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <span className="font-semibold text-sm text-slate-100">{goal.name}</span>
                  <span className="text-xs font-bold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">
                    {percent}%
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>₱{goal.current_amount.toLocaleString()}</span>
                    <span>Target: ₱{goal.target_amount.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                {goal.target_date && (
                  <p className="text-[11px] text-slate-400">Target Date: <span className="text-slate-300 font-medium">{goal.target_date}</span></p>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
