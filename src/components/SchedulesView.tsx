'use client';

import React, { useMemo, useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ArrowRightLeft, CalendarDays, Clock, CreditCard, Edit2, Filter, Landmark, Plus, Power, Search, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { RecurringFrequency, RecurringRuleType, RecurringTransfer, WalletType } from '../types/database';
import { buildCreditCardPaymentSchedules, filterCreditCardPaymentSchedules } from '../lib/creditCardPaymentSchedules';
import { CategoryIconTile } from './CategoryIcon';
import { Button } from './ui/Button';

const ruleTypeLabels: Record<RecurringRuleType, string> = {
  expense: 'Recurring Bill',
  transfer: 'Recurring Transfer',
  loan_payment: 'Loan Repayment',
};

interface SchedulesViewProps {
  onPayCreditCard: (walletId: string, amount: number, walletName: string) => void;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({ onPayCreditCard }) => {
  const {
    wallets,
    categories,
    loans,
    recurringTransfers,
    members,
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

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | WalletType>('all');
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
    const source = wallets.find(wallet => wallet.id === rule.source_wallet_id);
    const destination = rule.destination_wallet_id ? wallets.find(wallet => wallet.id === rule.destination_wallet_id) : null;
    const category = rule.category_id ? categories.find(item => item.id === rule.category_id) : null;
    const loan = rule.loan_id ? loans.find(item => item.id === rule.loan_id) : null;
    const query = searchTerm.trim().toLocaleLowerCase();
    const matchesSearch = !query || [rule.note, source?.name, destination?.name, category?.name, loan?.name]
      .some(value => value?.toLocaleLowerCase().includes(query));
    const matchesCategory = categoryFilter === 'all'
      || (categoryFilter === 'uncategorized' ? !rule.category_id : rule.category_id === categoryFilter);
    const matchesMember = memberFilter === 'all'
      || (memberFilter === 'shared' ? Boolean(source?.is_shared || !source?.owner_id) : source?.owner_id === memberFilter);
    const matchesWallet = walletFilter === 'all' || rule.source_wallet_id === walletFilter || rule.destination_wallet_id === walletFilter;
    const matchesPaymentMethod = paymentMethodFilter === 'all' || source?.wallet_type === paymentMethodFilter;
    return matchesSearch && matchesCategory && matchesMember && matchesWallet && matchesPaymentMethod
      && (!fromDate || rule.next_run_date >= fromDate)
      && (!toDate || rule.next_run_date <= toDate);
  }), [categories, categoryFilter, fromDate, loans, memberFilter, paymentMethodFilter, recurringTransfers, searchTerm, toDate, walletFilter, wallets]);

  const creditCardPayments = buildCreditCardPaymentSchedules(visibleWallets);
  const filteredCreditCardPayments = filterCreditCardPaymentSchedules(creditCardPayments, {
    walletId: walletFilter,
    fromDate,
    toDate,
  }).filter(payment => {
    const wallet = visibleWallets.find(item => item.id === payment.walletId);
    const query = searchTerm.trim().toLocaleLowerCase();
    const matchesSearch = !query || `${payment.walletName} credit card payment`.toLocaleLowerCase().includes(query);
    const matchesCategory = categoryFilter === 'all' || categoryFilter === 'uncategorized';
    const matchesMember = memberFilter === 'all'
      || (memberFilter === 'shared' ? Boolean(wallet?.is_shared || !wallet?.owner_id) : wallet?.owner_id === memberFilter);
    const matchesPaymentMethod = paymentMethodFilter === 'all' || wallet?.wallet_type === paymentMethodFilter;
    return matchesSearch && matchesCategory && matchesMember && matchesPaymentMethod;
  });

  const scheduleRows = [
    ...filteredSchedules.map(rule => ({ kind: 'schedule' as const, dueDate: rule.next_run_date, rule })),
    ...filteredCreditCardPayments.map(payment => ({ kind: 'credit-card-payment' as const, dueDate: payment.dueDate, payment })),
  ].sort((first, second) => first.dueDate.localeCompare(second.dueDate));

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
    <div className="famledger-view famledger-schedules space-y-6 pb-28 md:pb-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-line bg-brand-paper p-5 shadow-[var(--fam-shadow)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <Clock className="h-5 w-5 text-brand-orange" />
            <span>Schedules</span>
          </h2>
          <p className="mt-1 text-sm text-brand-muted">Manage recurring bills, loan repayments, and transfer schedules.</p>
        </div>

        {canManageSchedules && (
          <Button
            tone="primary"
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Schedule</span>
          </Button>
        )}
      </div>

      <section aria-labelledby="recurring-database-heading" className="space-y-4 rounded-2xl border border-brand-line bg-brand-paper p-4 shadow-[var(--fam-shadow)] sm:p-5">
        <h3 id="recurring-database-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-ink">
          <span className="h-6 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Recurring Transaction Database
        </h3>

        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
          <span className="sr-only">Search recurring transactions</span>
          <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search recurring transactions..." className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
        </label>

        <div className="space-y-2">
          <span className="text-xs font-medium text-brand-muted">Date Range</span>
          <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
            <label className="relative block">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <span className="sr-only">Start date</span>
              <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
            </label>
            <span className="hidden text-brand-muted sm:block" aria-hidden="true">→</span>
            <label className="relative block">
              <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <span className="sr-only">End date</span>
              <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Category</span>
            <span className="relative block">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-9 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                <option value="all">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Member</span>
            <select value={memberFilter} onChange={event => setMemberFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
              <option value="all">All Members</option>
              <option value="shared">Household / Shared</option>
              {members.map(member => <option key={member.id} value={member.id}>{member.display_name}</option>)}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Wallet</span>
            <span className="relative block">
              <WalletIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <select value={walletFilter} onChange={event => setWalletFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-9 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                <option value="all">All Wallets</option>
                {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
              </select>
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Payment Method</span>
            <span className="relative block">
              <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <select value={paymentMethodFilter} onChange={event => setPaymentMethodFilter(event.target.value as typeof paymentMethodFilter)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-9 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="e_wallet">E-wallet</option>
                <option value="e_wallet_savings">E-wallet Savings</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </span>
          </label>
        </div>
      </section>

      <section aria-label="Scheduled transactions" className="overflow-hidden rounded-2xl border border-brand-line bg-brand-paper shadow-[var(--fam-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] divide-y divide-brand-line text-left text-sm">
            <caption className="sr-only">Scheduled transactions, sorted by next due date from oldest to newest</caption>
            <thead className="bg-brand-canvas text-xs font-semibold uppercase tracking-wide text-brand-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Next due</th>
                <th scope="col" className="px-4 py-3">Schedule</th>
                <th scope="col" className="px-4 py-3">Type / category</th>
                <th scope="col" className="px-4 py-3">Account</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
                <th scope="col" className="px-4 py-3">Frequency / status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {scheduleRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-brand-muted">No schedules match the current filters.</td>
                </tr>
              ) : scheduleRows.map(row => {
                if (row.kind === 'credit-card-payment') {
                  const { payment } = row;
                  return (
                    <tr key={payment.id} className="bg-white align-middle hover:bg-brand-canvas/70">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-ink">{new Date(`${payment.dueDate}T00:00:00`).toLocaleDateString()}</td>
                      <th scope="row" className="min-w-52 px-4 py-3 font-semibold text-brand-ink">
                        <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />{payment.walletName} payment</span>
                      </th>
                      <td className="px-4 py-3 text-brand-muted">Credit card payment</td>
                      <td className="px-4 py-3 text-brand-ink">{payment.walletName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-brand-ink">₱{payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3"><span className="inline-flex rounded-full bg-brand-sky px-2.5 py-1 text-xs font-semibold text-brand-ink">Payment due</span><span className="mt-1 block text-xs text-brand-muted">Automatic · next 5th or 20th</span></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" tone="secondary" className="whitespace-nowrap" onClick={() => onPayCreditCard(payment.walletId, payment.amount, payment.walletName)}>Pay balance</Button>
                      </td>
                    </tr>
                  );
                }

                const { rule } = row;
                const source = wallets.find(wallet => wallet.id === rule.source_wallet_id);
                const destination = rule.destination_wallet_id ? wallets.find(wallet => wallet.id === rule.destination_wallet_id) : null;
                const category = rule.category_id ? categories.find(item => item.id === rule.category_id) : null;
                const loan = rule.loan_id ? loans.find(item => item.id === rule.loan_id) : null;
                const accountLabel = rule.rule_type === 'transfer'
                  ? `${source?.name || 'Source'} → ${destination?.name || 'Destination'}`
                  : source?.name || 'Source wallet';
                const typeLabel = rule.rule_type === 'loan_payment' ? 'Loan repayment' : ruleTypeLabels[rule.rule_type];
                const detailLabel = loan?.name || category?.name || ruleTypeLabels[rule.rule_type];

                return (
                  <tr key={rule.id} className="bg-white align-middle hover:bg-brand-canvas/70">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-brand-ink">{new Date(`${rule.next_run_date}T00:00:00`).toLocaleDateString()}</td>
                    <th scope="row" className="min-w-52 px-4 py-3 font-semibold text-brand-ink">{rule.note}</th>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        {category
                          ? <CategoryIconTile slug={category.icon_slug} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" iconClassName="h-4 w-4" categoryType={category.category_type} categoryName={category.name} />
                          : rule.rule_type === 'loan_payment'
                            ? <Landmark className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                            : <ArrowRightLeft className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden="true" />}
                        <span><span className="text-brand-ink">{typeLabel}</span><span className="mt-1 block text-xs text-brand-muted">{detailLabel}</span></span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-ink">{accountLabel}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-brand-ink">₱{rule.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${rule.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-canvas text-brand-muted'}`}>{rule.is_active ? 'Active' : 'Paused'}</span><span className="mt-1 block text-xs text-brand-muted">{formatFrequencyLabel(rule.frequency, rule.custom_interval_days)}</span></td>
                    <td className="px-4 py-3 text-right">
                      {canManageSchedules && <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(rule)} className="rounded-lg p-2 text-brand-muted hover:bg-brand-canvas hover:text-brand-ink" title="Edit schedule" aria-label={`Edit ${rule.note}`}><Edit2 className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => toggleRecurringTransfer(rule.id)} className="rounded-lg p-2 text-brand-muted hover:bg-brand-canvas hover:text-brand-ink" title="Pause or activate schedule" aria-label={`${rule.is_active ? 'Pause' : 'Activate'} ${rule.note}`}><Power className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => handleDelete(rule)} className="rounded-lg p-2 text-brand-muted hover:bg-rose-50 hover:text-rose-800" title="Delete schedule" aria-label={`Delete ${rule.note}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" className="max-h-[90vh] w-full max-w-md space-y-5 overflow-y-auto rounded-2xl border border-brand-line bg-brand-paper p-6 shadow-[var(--fam-shadow)]">
            <h3 id="schedule-dialog-title" className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <Clock className="h-5 w-5 text-brand-orange" />
              <span>{editingRule ? 'Edit Schedule' : 'Create Schedule'}</span>
            </h3>

            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-brand-muted">Schedule Type</label>
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
                      className={`min-h-11 rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${ruleType === type ? 'border-brand-orange bg-brand-orange/5 text-brand-ink ring-1 ring-brand-orange/30' : 'border-brand-line bg-white text-brand-muted hover:bg-brand-canvas'}`}
                    >
                      {ruleTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-muted">Title / Description</label>
                <input value={note} onChange={event => setNote(event.target.value)} required className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-muted">Payer / Source Wallet</label>
                <select value={sourceWalletId} onChange={event => setSourceWalletId(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                  {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                </select>
              </div>

              {ruleType === 'transfer' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Destination Account</label>
                  <select value={destWalletId} onChange={event => setDestWalletId(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(wallet => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                  </select>
                </div>
              )}

              {ruleType === 'loan_payment' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Associated Loan</label>
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
                    className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30"
                  >
                    <option value="">-- Select Associated Loan --</option>
                    {loans.map(loan => <option key={loan.id} value={loan.id}>{loan.name} ({loan.lender})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Expense Category</label>
                  <select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                    <option value="">-- None / Uncategorized --</option>
                    {categories.filter(category => category.category_type === 'expense').map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Amount (₱)</label>
                  <input type="number" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 font-mono text-sm font-semibold text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Frequency</label>
                  <select value={frequency} onChange={event => setFrequency(event.target.value as RecurringFrequency)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
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
                  <label className="mb-1 block text-xs font-medium text-brand-muted">Repeat Every N Days</label>
                  <input type="number" min="1" max="365" required value={customDays} onChange={event => setCustomDays(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 font-mono text-sm font-semibold text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-muted">Next Due Date</label>
                <input type="date" required value={nextRunDate} onChange={event => setNextRunDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 py-2.5 font-mono text-sm font-semibold text-brand-ink focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
              </div>

              {editingRule && (
                <label className="flex items-center gap-2 text-sm text-brand-ink">
                  <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 rounded border-brand-line text-brand-orange focus:ring-brand-orange/30" />
                  <span>Schedule is active</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-brand-line pt-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-brand-muted hover:bg-brand-canvas hover:text-brand-ink">
                  Cancel
                </button>
                <Button type="submit" tone="primary" size="sm">
                  {editingRule ? 'Save Schedule' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
