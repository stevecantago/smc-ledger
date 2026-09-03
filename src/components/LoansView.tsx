'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Landmark, Plus, DollarSign, Calendar, AlertCircle, Percent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Loan } from '../types/database';

export const LoansView: React.FC = () => {
  const { loans, wallets, currentMember, isAdmin, addLoan, payLoanAmortization } = useHousehold();

  const [showAddModal, setShowAddModal] = useState(false);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);

  // Add Loan Form
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyAmortization, setMonthlyAmortization] = useState('');
  const [dueDay, setDueDay] = useState('15');

  // Pay Amortization Form
  const [payAmount, setPayAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  const totalOriginalDebt = loans.reduce((sum, l) => sum + l.total_principal, 0);
  const totalRemainingDebt = loans.reduce((sum, l) => sum + l.remaining_balance, 0);
  const totalPaidOff = totalOriginalDebt - totalRemainingDebt;
  const overallPayoffPercent = totalOriginalDebt > 0 ? Math.round((totalPaidOff / totalOriginalDebt) * 100) : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lender.trim()) return;

    addLoan({
      name: name.trim(),
      lender: lender.trim(),
      total_principal: parseFloat(totalPrincipal) || 0,
      interest_rate_annual: parseFloat(interestRate) || 0,
      monthly_amortization: parseFloat(monthlyAmortization) || 0,
      due_day_of_month: parseInt(dueDay) || 1,
    });

    setName('');
    setLender('');
    setTotalPrincipal('');
    setInterestRate('');
    setMonthlyAmortization('');
    setShowAddModal(false);
  };

  const handlePaySubmit = (e: React.FormEvent) => {
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
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-amber-400" />
            <span>Loans & Amortization Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track total principal debt, annual interest rates, monthly amortization schedules, and principal paydowns.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Loan Record</span>
          </button>
        )}
      </div>

      {/* Summary KPI Box */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs text-slate-400">Total Outstanding Debt</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-0.5">
            ₱{totalRemainingDebt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Original Principal: ₱{totalOriginalDebt.toLocaleString()}</p>
        </div>

        <div>
          <span className="text-xs text-slate-400">Total Paid Off</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
            ₱{totalPaidOff.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{overallPayoffPercent}% Total Debt Payoff</p>
        </div>

        <div>
          <span className="text-xs text-slate-400">Monthly Debt Obligations</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
            ₱{loans.reduce((sum, l) => sum + l.monthly_amortization, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{loans.length} active loan agreements</p>
        </div>
      </div>

      {/* Loan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loans.map(loan => {
          const paidAmount = loan.total_principal - loan.remaining_balance;
          const percentPaid = loan.total_principal > 0 
            ? Math.min(Math.round((paidAmount / loan.total_principal) * 100), 100) 
            : 0;

          return (
            <div key={loan.id} className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white">{loan.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center mt-0.5">
                      <Landmark className="w-3.5 h-3.5 mr-1 text-sky-400" /> {loan.lender}
                    </p>
                  </div>

                  <span className="text-xs font-bold text-amber-300 bg-amber-400/15 px-2.5 py-1 rounded border border-amber-400/30 flex items-center">
                    <Percent className="w-3 h-3 mr-0.5" /> {loan.interest_rate_annual}% APR
                  </span>
                </div>

                {/* Key Loan Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <div>
                    <span className="text-slate-400">Remaining Balance:</span>
                    <p className="font-bold font-mono text-rose-400 text-sm">₱{loan.remaining_balance.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Monthly Amortization:</span>
                    <p className="font-bold font-mono text-white text-sm">₱{loan.monthly_amortization.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Original Principal:</span>
                    <p className="font-medium text-slate-300">₱{loan.total_principal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Due Day:</span>
                    <p className="font-medium text-slate-300 flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-amber-400" /> Day {loan.due_day_of_month} of month
                    </p>
                  </div>
                </div>

                {/* Payoff Progress */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Principal Payoff Progress</span>
                    <span className="font-semibold text-emerald-400 font-mono">{percentPaid}% Paid Off</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Pay Action Button */}
              <button
                onClick={() => {
                  setErrorMsg('');
                  setPayingLoan(loan);
                  setPayAmount(loan.monthly_amortization.toString());
                  if (visibleWallets.length > 0) setSelectedWalletId(visibleWallets[0].id);
                }}
                className="w-full mt-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-lg transition-all shadow flex items-center justify-center space-x-1.5"
              >
                <DollarSign className="w-4 h-4" />
                <span>Pay Monthly Amortization (₱{loan.monthly_amortization.toLocaleString()})</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Loan Modal (Admin only) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Create Loan & Amortization Agreement</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Loan Title / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BDO Housing Mortgage, Toyota Auto Loan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lender / Financial Institution</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BDO Unibank, BPI, Toyota Financial"
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Principal (₱ PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1500000"
                    value={totalPrincipal}
                    onChange={(e) => setTotalPrincipal(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="6.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Monthly Amortization (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="15000"
                    value={monthlyAmortization}
                    onChange={(e) => setMonthlyAmortization(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Due Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Create Loan Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 space-y-1">
                <p className="font-semibold flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Payment Action:
                </p>
                <p className="text-[11px] text-slate-300">
                  Deducts ₱{parseFloat(payAmount || '0').toLocaleString()} from selected wallet, logs an expense transaction, and reduces remaining loan principal balance.
                </p>
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
