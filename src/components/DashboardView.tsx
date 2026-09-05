'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  TrendingDown, TrendingUp, ArrowRightLeft, Wallet as WalletIcon, ShieldCheck, 
  Landmark, Target, Plus, AlertCircle, CheckCircle2, ChevronRight, DollarSign, Clock, Calendar,
  Smartphone, CreditCard
} from 'lucide-react';
import { Loan } from '../types/database';

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

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  // Asset & Net Worth Math
  const liquidAssets = visibleWallets
    .filter(w => w.wallet_type !== 'credit_card')
    .reduce((acc, w) => acc + w.current_balance, 0);

  // Category totals for Wallets & Credit Lines Summary
  const totalBankBalance = visibleWallets
    .filter(w => w.wallet_type === 'bank')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const totalEWalletBalance = visibleWallets
    .filter(w => w.wallet_type === 'e_wallet')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const totalCashBalance = visibleWallets
    .filter(w => w.wallet_type === 'cash')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const totalAvailableCredit = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((sum, w) => sum + Math.max(0, (w.credit_limit || 0) - w.current_balance), 0);

  const totalCreditLimit = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((sum, w) => sum + (w.credit_limit || 0), 0);

  const totalUsedCredit = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((sum, w) => sum + w.current_balance, 0);

  const totalCombinedAvailable = totalBankBalance + totalEWalletBalance + totalCashBalance + totalAvailableCredit;

  // Outstanding Credit Card Debt
  const creditCardDebt = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((acc, w) => acc + w.current_balance, 0);

  // Net Assets = Cash/Bank/E-Wallet Liquid Assets minus Credit Line Balances
  const netAssets = liquidAssets - creditCardDebt;

  const totalMonthlyIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalMonthlyExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount + (t.fee || 0), 0);

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
              <p className="text-[11px] text-slate-400">Total liquid funds across bank accounts, e-wallets, cash, and available credit card lines</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Bank Accounts Total */}
          <div className="bg-slate-900/80 border border-sky-500/30 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Landmark className="w-3.5 h-3.5 text-sky-400" />
                <span>Bank Accounts</span>
              </span>
              <span className="text-[10px] bg-sky-500/10 text-sky-300 font-mono px-1.5 py-0.2 rounded">
                {visibleWallets.filter(w => w.wallet_type === 'bank').length} Accounts
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-sky-400">
              ₱{totalBankBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">Total liquid bank savings</p>
          </div>

          {/* E-Wallets Total */}
          <div className="bg-slate-900/80 border border-indigo-500/30 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
                <span>E-Wallets</span>
              </span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-mono px-1.5 py-0.2 rounded">
                {visibleWallets.filter(w => w.wallet_type === 'e_wallet').length} Accounts
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-indigo-400">
              ₱{totalEWalletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">Total e-wallet balances</p>
          </div>

          {/* Credit Lines Available Total */}
          <div className="bg-slate-900/80 border border-purple-500/30 p-3.5 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-400" />
                <span>Available Credit Lines</span>
              </span>
              <span className="text-[10px] bg-purple-500/10 text-purple-300 font-mono px-1.5 py-0.2 rounded">
                {visibleWallets.filter(w => w.wallet_type === 'credit_card').length} Cards
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              ₱{totalAvailableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400">
              Limit: ₱{totalCreditLimit.toLocaleString()} | Used: <strong className="text-rose-400">₱{totalUsedCredit.toLocaleString()}</strong>
            </p>
          </div>

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

        {/* Individual Accounts Breakdown Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Individual Account Balances</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {visibleWallets.map(w => {
              const isCC = w.wallet_type === 'credit_card';
              const remainingCredit = (w.credit_limit || 0) - w.current_balance;

              return (
                <div key={w.id} className="bg-slate-900/60 border border-slate-700/50 p-3.5 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-xs text-white">{w.name}</span>
                      {w.is_shared && (
                        <span className="text-[9px] bg-sky-500/15 text-sky-300 px-1 py-0.2 rounded font-mono">Shared</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{w.wallet_type.replace('_', ' ')}</span>
                  </div>

                  <div className="text-right font-mono">
                    {isCC ? (
                      <>
                        <span className="font-bold text-xs text-emerald-400 block">
                          ₱{remainingCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-rose-400 block font-sans">
                          Used: ₱{w.current_balance.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="font-bold text-xs text-emerald-400 block">
                        ₱{w.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
              const paidAmount = loan.amount_paid !== undefined ? loan.amount_paid : (loan.total_principal - loan.remaining_balance);
              const percentPaid = loan.total_principal > 0 
                ? Math.min(Math.round((paidAmount / loan.total_principal) * 100), 100) 
                : 0;

              const isBiMonthly = loan.payment_frequency === 'bi_monthly';
              const singleInstallment = isBiMonthly ? loan.monthly_amortization / 2 : loan.monthly_amortization;

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
                    ) : isBiMonthly ? (
                      <span className="text-[10px] font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/20">
                        Days {loan.due_day_of_month} & {loan.second_due_day_of_month || 30}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Day {loan.due_day_of_month} Due
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-baseline text-xs font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px]">Remaining Balance:</span>
                      <p className="font-bold text-rose-400">₱{loan.remaining_balance.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px]">
                        {isBiMonthly ? 'Bi-Monthly Payment:' : 'Monthly Amortization:'}
                      </span>
                      <p className="font-bold text-white">₱{singleInstallment.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400">Paid: ₱{paidAmount.toLocaleString()}</span>
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
                      setPayAmount(singleInstallment.toString());
                      if (visibleWallets.length > 0) setSelectedWalletId(visibleWallets[0].id);
                    }}
                    className="w-full text-center py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay Amortization (₱{singleInstallment.toLocaleString()})</span>
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
