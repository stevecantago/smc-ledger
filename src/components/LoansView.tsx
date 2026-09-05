'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Landmark, Plus, DollarSign, Calendar, AlertCircle, Percent, Edit2, Trash2, ShieldCheck, Clock, CheckCircle2, Wallet as WalletIcon } from 'lucide-react';
import { Loan, LoanPaymentFrequency } from '../types/database';

export const LoansView: React.FC = () => {
  const { loans, wallets, currentMember, isAdmin, addLoan, updateLoan, deleteLoan, payLoanAmortization } = useHousehold();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [payingLoan, setPayingLoan] = useState<Loan | null>(null);

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  // Add Loan Form
  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState(visibleWallets[0]?.id || '');
  const [totalPrincipal, setTotalPrincipal] = useState('');
  const [monthlyAmortization, setMonthlyAmortization] = useState(''); // Required Amortization
  const [totalAmortizations, setTotalAmortizations] = useState('');
  const [paidAmortizationsCount, setPaidAmortizationsCount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [paymentFrequency, setPaymentFrequency] = useState<LoanPaymentFrequency>('monthly');
  const [nextDueDate, setNextDueDate] = useState('');

  // Edit Loan Form
  const [editName, setEditName] = useState('');
  const [editLender, setEditLender] = useState('');
  const [editSourceWalletId, setEditSourceWalletId] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editMonthly, setEditMonthly] = useState('');
  const [editTotalAmortizations, setEditTotalAmortizations] = useState('');
  const [editPaidAmortizationsCount, setEditPaidAmortizationsCount] = useState('');
  const [editInterestRate, setEditInterestRate] = useState('');
  const [editFrequency, setEditFrequency] = useState<LoanPaymentFrequency>('monthly');
  const [editNextDueDate, setEditNextDueDate] = useState('');

  // Pay Amortization Form
  const [payAmount, setPayAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState(visibleWallets[0]?.id || '');
  const [errorMsg, setErrorMsg] = useState('');

  // Automatic Interest Calculation Helper
  const calculateAutoInterest = (pStr: string, nStr: string, aStr: string, freq: LoanPaymentFrequency) => {
    const P = parseFloat(pStr) || 0;
    const N = parseFloat(nStr) || 0;
    const A = parseFloat(aStr) || 0;
    if (P > 0 && N > 0 && A > 0) {
      const totalPaid = N * A;
      const totalInterest = totalPaid - P;
      if (totalInterest > 0) {
        const years = freq === 'bi_monthly' ? (N / 24) : (N / 12);
        if (years > 0) {
          const annualRate = ((totalInterest / P) / years) * 100;
          return (Math.round(annualRate * 100) / 100).toString();
        }
      }
    }
    return '0';
  };

  // Automatic Remaining Balance Helper
  const calculateAutoBalance = (nStr: string, kStr: string, aStr: string, pStr: string) => {
    const N = parseFloat(nStr) || 0;
    const K = parseFloat(kStr) || 0;
    const A = parseFloat(aStr) || 0;
    if (N > 0 && A > 0) {
      return Math.max(0, (N - K) * A);
    }
    const P = parseFloat(pStr) || 0;
    return Math.max(0, P - (K * A));
  };

  const totalOriginalDebt = loans.reduce((sum, l) => sum + l.total_principal, 0);
  const totalRemainingDebt = loans.reduce((sum, l) => sum + l.remaining_balance, 0);
  const totalPaidOff = totalOriginalDebt - totalRemainingDebt;
  const overallPayoffPercent = totalOriginalDebt > 0 ? Math.round((totalPaidOff / totalOriginalDebt) * 100) : 0;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lender.trim()) return;

    const principal = parseFloat(totalPrincipal) || 0;
    const reqAmort = parseFloat(monthlyAmortization) || 0;
    const totalAmort = parseInt(totalAmortizations) || 0;
    const paidCount = parseInt(paidAmortizationsCount) || 0;
    const calculatedPaid = paidCount * reqAmort;
    const calculatedRemBalance = calculateAutoBalance(totalAmortizations, paidAmortizationsCount, monthlyAmortization, totalPrincipal);
    const calculatedRate = parseFloat(interestRate) || 0;
    const chosenWallet = sourceWalletId || (visibleWallets[0]?.id || null);

    addLoan({
      name: name.trim(),
      lender: lender.trim(),
      source_wallet_id: chosenWallet,
      total_principal: principal,
      total_amortizations: totalAmort,
      paid_amortizations_count: paidCount,
      amount_paid: calculatedPaid,
      remaining_balance: calculatedRemBalance,
      interest_rate_annual: calculatedRate,
      monthly_amortization: reqAmort,
      payment_frequency: paymentFrequency,
      next_due_date: nextDueDate.trim() || null,
    });

    setName('');
    setLender('');
    setTotalPrincipal('');
    setMonthlyAmortization('');
    setTotalAmortizations('');
    setPaidAmortizationsCount('');
    setInterestRate('');
    setNextDueDate('');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoan) return;

    const principal = parseFloat(editPrincipal) || 0;
    const reqAmort = parseFloat(editMonthly) || 0;
    const totalAmort = parseInt(editTotalAmortizations) || 0;
    const paidCount = parseInt(editPaidAmortizationsCount) || 0;
    const calculatedPaid = paidCount * reqAmort;
    const calculatedRemBalance = calculateAutoBalance(editTotalAmortizations, editPaidAmortizationsCount, editMonthly, editPrincipal);
    const calculatedRate = parseFloat(editInterestRate) || 0;

    updateLoan(editingLoan.id, {
      name: editName.trim(),
      lender: editLender.trim(),
      source_wallet_id: editSourceWalletId || null,
      total_principal: principal,
      total_amortizations: totalAmort,
      paid_amortizations_count: paidCount,
      amount_paid: calculatedPaid,
      remaining_balance: calculatedRemBalance,
      interest_rate_annual: calculatedRate,
      monthly_amortization: reqAmort,
      payment_frequency: editFrequency,
      next_due_date: editNextDueDate.trim() || null,
    });

    setEditingLoan(null);
  };

  const handleDeleteLoan = (l: Loan) => {
    if (!window.confirm(`Are you sure you want to delete loan record "${l.name}"?`)) return;
    const res = deleteLoan(l.id);
    if (!res.success) alert(res.error);
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
    <div className="space-y-6 pb-28 md:pb-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-amber-400" />
            <span>Loans & Amortization Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track total principal debt, required amortizations, annual interest rates, source paying wallets & next upcoming due dates.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              if (visibleWallets.length > 0) setSourceWalletId(visibleWallets[0].id);
              setShowAddModal(true);
            }}
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
          const paidCount = loan.paid_amortizations_count || 0;
          const totalAmortCount = loan.total_amortizations || 0;
          const paidAmount = loan.amount_paid !== undefined && loan.amount_paid !== null ? loan.amount_paid : (paidCount * loan.monthly_amortization);
          const percentPaid = loan.total_principal > 0 
            ? Math.min(Math.round((paidAmount / loan.total_principal) * 100), 100) 
            : 0;

          const isBiMonthly = loan.payment_frequency === 'bi_monthly';
          const srcWallet = wallets.find(w => w.id === loan.source_wallet_id);

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

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-amber-300 bg-amber-400/15 px-2.5 py-1 rounded border border-amber-400/30 flex items-center font-mono">
                      <Percent className="w-3 h-3 mr-0.5" /> {loan.interest_rate_annual}% APR
                    </span>

                    {isAdmin && (
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingLoan(loan);
                            setEditName(loan.name);
                            setEditLender(loan.lender);
                            setEditSourceWalletId(loan.source_wallet_id || (visibleWallets[0]?.id || ''));
                            setEditPrincipal(loan.total_principal.toString());
                            setEditMonthly(loan.monthly_amortization.toString());
                            setEditTotalAmortizations((loan.total_amortizations || '').toString());
                            setEditPaidAmortizationsCount((loan.paid_amortizations_count || 0).toString());
                            setEditInterestRate(loan.interest_rate_annual.toString());
                            setEditFrequency(loan.payment_frequency || 'monthly');
                            setEditNextDueDate(loan.next_due_date || '');
                          }}
                          title="Edit Loan Agreement"
                          className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan)}
                          title="Delete Loan Agreement"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Due Date, Frequency, and Source Wallet Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {loan.next_due_date ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded border border-amber-500/30 font-mono">
                      <Calendar className="w-3 h-3 mr-1" /> Next Due: {loan.next_due_date}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-medium text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                      <Calendar className="w-3 h-3 mr-1" /> No Next Due Set
                    </span>
                  )}

                  <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded border ${
                    isBiMonthly 
                      ? 'text-purple-300 bg-purple-500/15 border-purple-500/30' 
                      : 'text-sky-300 bg-sky-500/15 border-sky-500/30'
                  }`}>
                    <Clock className="w-3 h-3 mr-1" /> {isBiMonthly ? 'Bi-Monthly' : 'Monthly'}
                  </span>

                  {srcWallet && (
                    <span className="inline-flex items-center text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded border border-emerald-500/30">
                      <WalletIcon className="w-3 h-3 mr-1" /> Payer: {srcWallet.name}
                    </span>
                  )}
                </div>

                {/* Key Loan Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                  <div>
                    <span className="text-slate-400">Remaining Balance:</span>
                    <p className="font-bold font-mono text-rose-400 text-sm">₱{loan.remaining_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Amortizations Paid:</span>
                    <p className="font-bold font-mono text-emerald-400 text-sm">
                      {paidCount} {totalAmortCount > 0 ? `/ ${totalAmortCount}` : ''} Paid
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Original Principal:</span>
                    <p className="font-medium text-slate-300">₱{loan.total_principal.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Required Amortization:</span>
                    <p className="font-bold font-mono text-white">₱{loan.monthly_amortization.toLocaleString()}</p>
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
                  setSelectedWalletId(loan.source_wallet_id || (visibleWallets[0]?.id || ''));
                }}
                className="w-full mt-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2.5 rounded-lg transition-all shadow flex items-center justify-center space-x-1.5"
              >
                <DollarSign className="w-4 h-4" />
                <span>
                  Pay Required Amortization (₱{loan.monthly_amortization.toLocaleString()})
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-amber-400" />
              <span>Create Loan & Amortization Agreement</span>
            </h3>

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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Wallet Account</label>
                <select
                  value={sourceWalletId}
                  onChange={(e) => setSourceWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} (₱{w.current_balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Schedule Frequency</label>
                <select
                  value={paymentFrequency}
                  onChange={(e) => {
                    const freq = e.target.value as LoanPaymentFrequency;
                    setPaymentFrequency(freq);
                    const rate = calculateAutoInterest(totalPrincipal, totalAmortizations, monthlyAmortization, freq);
                    setInterestRate(rate);
                  }}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi_monthly">Bi-Monthly</option>
                </select>
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
                    onChange={(e) => {
                      setTotalPrincipal(e.target.value);
                      const rate = calculateAutoInterest(e.target.value, totalAmortizations, monthlyAmortization, paymentFrequency);
                      setInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Required Amortization (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="12000"
                    value={monthlyAmortization}
                    onChange={(e) => {
                      setMonthlyAmortization(e.target.value);
                      const rate = calculateAutoInterest(totalPrincipal, totalAmortizations, e.target.value, paymentFrequency);
                      setInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-emerald-400 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Amortizations Required</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 24, 36, 60"
                    value={totalAmortizations}
                    onChange={(e) => {
                      setTotalAmortizations(e.target.value);
                      const rate = calculateAutoInterest(totalPrincipal, e.target.value, monthlyAmortization, paymentFrequency);
                      setInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Amortizations Paid So Far</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 (Optional)"
                    value={paidAmortizationsCount}
                    onChange={(e) => setPaidAmortizationsCount(e.target.value)}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="Auto-calculated"
                    className="w-full bg-slate-800 text-sky-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Remaining Balance (₱)</label>
                  <div className="w-full bg-slate-800/90 text-rose-400 text-xs border border-slate-700 rounded-lg p-2.5 font-mono font-bold">
                    ₱{calculateAutoBalance(totalAmortizations, paidAmortizationsCount, monthlyAmortization, totalPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Next Upcoming Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
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

      {/* Edit Loan Modal */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-amber-400" />
              <span>Edit Loan Agreement: {editingLoan.name}</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Loan Title / Description</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Lender / Financial Institution</label>
                <input
                  type="text"
                  required
                  value={editLender}
                  onChange={(e) => setEditLender(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Wallet Account</label>
                <select
                  value={editSourceWalletId}
                  onChange={(e) => setEditSourceWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name} (₱{w.current_balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Schedule Frequency</label>
                <select
                  value={editFrequency}
                  onChange={(e) => {
                    const freq = e.target.value as LoanPaymentFrequency;
                    setEditFrequency(freq);
                    const rate = calculateAutoInterest(editPrincipal, editTotalAmortizations, editMonthly, freq);
                    setEditInterestRate(rate);
                  }}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                >
                  <option value="monthly">Monthly</option>
                  <option value="bi_monthly">Bi-Monthly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Principal (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrincipal}
                    onChange={(e) => {
                      setEditPrincipal(e.target.value);
                      const rate = calculateAutoInterest(e.target.value, editTotalAmortizations, editMonthly, editFrequency);
                      setEditInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Required Amortization (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editMonthly}
                    onChange={(e) => {
                      setEditMonthly(e.target.value);
                      const rate = calculateAutoInterest(editPrincipal, editTotalAmortizations, e.target.value, editFrequency);
                      setEditInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-emerald-400 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Amortizations Required</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editTotalAmortizations}
                    onChange={(e) => {
                      setEditTotalAmortizations(e.target.value);
                      const rate = calculateAutoInterest(editPrincipal, e.target.value, editMonthly, editFrequency);
                      setEditInterestRate(rate);
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Amortizations Paid So Far</label>
                  <input
                    type="number"
                    min="0"
                    value={editPaidAmortizationsCount}
                    onChange={(e) => setEditPaidAmortizationsCount(e.target.value)}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editInterestRate}
                    onChange={(e) => setEditInterestRate(e.target.value)}
                    className="w-full bg-slate-800 text-sky-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Remaining Balance (₱)</label>
                  <div className="w-full bg-slate-800/90 text-rose-400 text-xs border border-slate-700 rounded-lg p-2.5 font-mono font-bold">
                    ₱{calculateAutoBalance(editTotalAmortizations, editPaidAmortizationsCount, editMonthly, editPrincipal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Next Upcoming Payment Due Date</label>
                <input
                  type="date"
                  required
                  value={editNextDueDate}
                  onChange={(e) => setEditNextDueDate(e.target.value)}
                  className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLoan(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Loan Changes
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
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <span>Pay Amortization: {payingLoan.name}</span>
            </h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Required Amortization Amount (₱ PHP)</label>
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
                  Deducts ₱{parseFloat(payAmount || '0').toLocaleString()} from selected wallet, logs an expense transaction, advances the payment due date (+30 or +15 days), and updates the recurring schedule rule.
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
