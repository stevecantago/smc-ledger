'use client';

import React, { useMemo, useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ArrowRightLeft, Calendar, Clock, Edit2, Landmark, Plus, Power, Trash2 } from 'lucide-react';
import { RecurringFrequency, RecurringRuleType, RecurringTransfer } from '../types/database';
import { CategoryIcon } from './CategoryIcon';

const ruleTypeLabels: Record<RecurringRuleType, string> = {
  expense: 'Recurring Bill',
  transfer: 'Recurring Transfer',
  loan_payment: 'Loan Repayment',
};

export const SchedulesView: React.FC = () => {
  const {
    wallets,
    categories,
    loans,
    recurringTransfers,
    currentMember,
    isAdmin,
    hasPermission,
    addRecurringTransfer,
    updateRecurringTransfer,
    toggleRecurringTransfer,
    deleteRecurringTransfer,
  } = useHousehold();

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const canManageSchedules = hasPermission('manage_schedules');

  const [typeFilter, setTypeFilter] = useState<'all' | RecurringRuleType>('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringTransfer | null>(null);
  const [ruleType, setRuleType] = useState<RecurringRuleType>('expense');
  const [sourceWalletId, setSourceWalletId] = useState(visibleWallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [loanId, setLoanId] = useState(loans[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [customDays, setCustomDays] = useState('10');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const filteredSchedules = useMemo(() => recurringTransfers.filter(rule => {
    if (typeFilter !== 'all' && rule.rule_type !== typeFilter) return false;
    if (walletFilter !== 'all' && rule.source_wallet_id !== walletFilter && rule.destination_wallet_id !== walletFilter) return false;
    if (statusFilter === 'active' && !rule.is_active) return false;
    if (statusFilter === 'paused' && rule.is_active) return false;
    if (fromDate && rule.next_run_date < fromDate) return false;
    if (toDate && rule.next_run_date > toDate) return false;
    return true;
  }), [fromDate, recurringTransfers, statusFilter, toDate, typeFilter, walletFilter]);

  const resetForm = () => {
    setEditingRule(null);
    setRuleType('expense');
    setSourceWalletId(visibleWallets[0]?.id || '');
    setDestWalletId('');
    setCategoryId(categories[0]?.id || '');
    setLoanId(loans[0]?.id || '');
    setAmount('');
    setFrequency('monthly');
    setCustomDays('10');
    setNextRunDate(new Date().toISOString().split('T')[0]);
    setNote('');
    setIsActive(true);
    setErrorMsg('');
  };

  const openEdit = (rule: RecurringTransfer) => {
    setEditingRule(rule);
    setRuleType(rule.rule_type);
    setSourceWalletId(rule.source_wallet_id);
    setDestWalletId(rule.destination_wallet_id || '');
    setCategoryId(rule.category_id || '');
    setLoanId(rule.loan_id || '');
    setAmount(rule.amount.toString());
    setFrequency(rule.frequency);
    setCustomDays((rule.custom_interval_days || 10).toString());
    setNextRunDate(rule.next_run_date);
    setNote(rule.note);
    setIsActive(rule.is_active);
    setErrorMsg('');
    setShowModal(true);
  };

  const formatFrequencyLabel = (freq: RecurringFrequency, customInterval?: number | null) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-Weekly';
      case 'bimonthly': return 'Bi-Monthly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly';
      case 'semi_annual': return 'Semi-Annual';
      case 'annual': return 'Annual';
      case 'custom_days': return `Every ${customInterval || 1} Days`;
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    if (!sourceWalletId) {
      setErrorMsg('Please select a source wallet.');
      return;
    }
    if (ruleType === 'transfer' && !destWalletId) {
      setErrorMsg('Please select a destination account.');
      return;
    }
    if (ruleType === 'loan_payment' && !loanId) {
      setErrorMsg('Please select a loan.');
      return;
    }

    const payload = {
      rule_type: ruleType,
      source_wallet_id: sourceWalletId,
      destination_wallet_id: ruleType === 'transfer' ? destWalletId : null,
      category_id: ruleType === 'loan_payment' ? null : (categoryId || null),
      loan_id: ruleType === 'loan_payment' ? loanId : null,
      amount: parseFloat(amount) || 0,
      frequency,
      custom_interval_days: frequency === 'custom_days' ? (parseInt(customDays, 10) || 1) : null,
      next_run_date: nextRunDate,
      note: note.trim() || ruleTypeLabels[ruleType],
    };

    const result = editingRule
      ? updateRecurringTransfer(editingRule.id, { ...payload, is_active: isActive })
      : addRecurringTransfer(payload);

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to save schedule.');
      return;
    }

    setShowModal(false);
    resetForm();
  };

  const handleDelete = (rule: RecurringTransfer) => {
    if (!window.confirm(`Delete schedule "${rule.note}"?`)) return;
    const result = deleteRecurringTransfer(rule.id);
    if (!result.success) alert(result.error);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-700/70 bg-slate-800/80 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center space-x-2 text-lg font-bold text-white">
            <Clock className="h-5 w-5 text-indigo-400" />
            <span>Schedules</span>
          </h2>
          <p className="mt-1 text-xs text-slate-400">Manage recurring bills, loan repayments, and transfer schedules.</p>
        </div>

        {canManageSchedules && (
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow transition-all hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Schedule</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-700/70 bg-slate-800/80 p-4 md:grid-cols-5">
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as typeof typeFilter)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white">
          <option value="all">All Types</option>
          <option value="expense">Recurring Bills</option>
          <option value="transfer">Transfers</option>
          <option value="loan_payment">Loan Repayments</option>
        </select>
        <select value={walletFilter} onChange={event => setWalletFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white">
          <option value="all">All Wallets</option>
          {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white" />
        <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs text-white" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredSchedules.length === 0 ? (
          <div className="rounded-xl border border-slate-700/70 bg-slate-800/80 p-5 text-sm text-slate-400 md:col-span-2">
            No schedules match the current filters.
          </div>
        ) : filteredSchedules.map(rule => {
          const source = wallets.find(wallet => wallet.id === rule.source_wallet_id);
          const destination = rule.destination_wallet_id ? wallets.find(wallet => wallet.id === rule.destination_wallet_id) : null;
          const category = rule.category_id ? categories.find(item => item.id === rule.category_id) : null;
          const loan = rule.loan_id ? loans.find(item => item.id === rule.loan_id) : null;

          return (
            <div key={rule.id} className="rounded-xl border border-slate-700/80 bg-slate-800/90 p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-indigo-300">
                    {rule.rule_type === 'loan_payment' ? <Landmark className="h-5 w-5 text-amber-400" /> : category ? <CategoryIcon slug={category.icon_slug} className="h-5 w-5" /> : <ArrowRightLeft className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{rule.note}</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      {rule.rule_type === 'transfer'
                        ? `${source?.name || 'Source'} -> ${destination?.name || 'Destination'}`
                        : `Payer: ${source?.name || 'Source wallet'}`}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{loan ? `Loan: ${loan.name}` : category ? `Envelope: ${category.name}` : ruleTypeLabels[rule.rule_type]}</p>
                  </div>
                </div>

                <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${rule.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-900 text-slate-500'}`}>
                  {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-700/70 pt-3 text-xs">
                <div>
                  <p className="font-mono font-bold text-emerald-400">₱{rule.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="mt-1 flex items-center text-[11px] text-amber-300">
                    <Calendar className="mr-1 h-3.5 w-3.5" />
                    Next Due: {rule.next_run_date} · {formatFrequencyLabel(rule.frequency, rule.custom_interval_days)}
                  </p>
                </div>

                {canManageSchedules && (
                  <div className="flex items-center space-x-2">
                    <button onClick={() => openEdit(rule)} className="rounded p-1.5 text-slate-400 hover:bg-amber-400/10 hover:text-amber-400" title="Edit Schedule">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleRecurringTransfer(rule.id)} className="rounded p-1.5 text-slate-400 hover:bg-indigo-400/10 hover:text-indigo-400" title="Pause or Activate Schedule">
                      <Power className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(rule)} className="rounded p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400" title="Delete Schedule">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h3 className="flex items-center space-x-2 text-base font-bold text-white">
              <Clock className="h-5 w-5 text-indigo-400" />
              <span>{editingRule ? 'Edit Schedule' : 'Create Schedule'}</span>
            </h3>

            {errorMsg && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Schedule Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['expense', 'transfer', 'loan_payment'] as RecurringRuleType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setRuleType(type);
                        if (type === 'loan_payment' && loans[0]) {
                          setLoanId(loans[0].id);
                          setAmount(loans[0].monthly_amortization.toString());
                          setNote(`Loan Amortization - ${loans[0].name}`);
                        }
                      }}
                      className={`rounded-lg border py-2 text-xs font-bold transition-all ${ruleType === type ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300 ring-1 ring-sky-500' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
                    >
                      {ruleTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Title / Description</label>
                <input value={note} onChange={event => setNote(event.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Payer / Source Wallet</label>
                <select value={sourceWalletId} onChange={event => setSourceWalletId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white">
                  {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                </select>
              </div>

              {ruleType === 'transfer' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Destination Account</label>
                  <select value={destWalletId} onChange={event => setDestWalletId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white">
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                  </select>
                </div>
              )}

              {ruleType === 'loan_payment' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Associated Loan</label>
                  <select
                    value={loanId}
                    onChange={event => {
                      const selectedId = event.target.value;
                      setLoanId(selectedId);
                      const foundLoan = loans.find(loan => loan.id === selectedId);
                      if (foundLoan) {
                        setNote(`Loan Amortization - ${foundLoan.name}`);
                        setAmount(foundLoan.monthly_amortization.toString());
                      }
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white"
                  >
                    <option value="">-- Select Associated Loan --</option>
                    {loans.map(loan => <option key={loan.id} value={loan.id}>{loan.name} ({loan.lender})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Envelope Category</label>
                  <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white">
                    <option value="">-- None / Uncategorized --</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Amount (₱)</label>
                  <input type="number" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-mono text-xs font-bold text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Frequency</label>
                  <select value={frequency} onChange={event => setFrequency(event.target.value as RecurringFrequency)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="bimonthly">Bi-Monthly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="annual">Annual</option>
                    <option value="custom_days">Custom Days</option>
                  </select>
                </div>
              </div>

              {frequency === 'custom_days' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Repeat Every N Days</label>
                  <input type="number" min="1" max="365" required value={customDays} onChange={event => setCustomDays(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-mono text-xs font-bold text-white" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Next Due Date</label>
                <input type="date" required value={nextRunDate} onChange={event => setNextRunDate(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 font-mono text-xs font-bold text-amber-300" />
              </div>

              {editingRule && (
                <label className="flex items-center space-x-2 text-xs text-slate-300">
                  <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600" />
                  <span>Schedule is active</span>
                </label>
              )}

              <div className="flex items-center justify-end space-x-3 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition-all hover:bg-indigo-500">
                  {editingRule ? 'Save Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
