'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Wallet as WalletIcon, Landmark, Smartphone, Banknote, Shield, Lock, Plus, ArrowRightLeft, Calendar, Power, Wifi, Clock, Edit2, Trash2, CreditCard } from 'lucide-react';
import { Wallet, WalletType, RecurringFrequency, RecurringRuleType, RecurringTransfer } from '../types/database';
import { CategoryIcon } from './CategoryIcon';

export const WalletsView: React.FC = () => {
  const { 
    wallets, categories, members, currentMember, isAdmin, 
    addWallet, updateWallet, deleteWallet,
    recurringTransfers, addRecurringTransfer, updateRecurringTransfer, toggleRecurringTransfer, deleteRecurringTransfer 
  } = useHousehold();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  
  // Recurring Modals & State
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransfer | null>(null);

  // Add Wallet Form State
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('bank');
  const [isShared, setIsShared] = useState(isAdmin);
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');

  // Edit Wallet Form State
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<WalletType>('bank');
  const [editBalance, setEditBalance] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editIsShared, setEditIsShared] = useState(true);

  // Add Recurring Bill / Transfer Form State
  const [ruleType, setRuleType] = useState<RecurringRuleType>('expense');
  const [sourceWalletId, setSourceWalletId] = useState(wallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [transferAmount, setTransferAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [customDays, setCustomDays] = useState('10');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNote, setTransferNote] = useState('');

  // Edit Recurring Bill / Transfer Form State
  const [editRuleType, setEditRuleType] = useState<RecurringRuleType>('expense');
  const [editSourceWalletId, setEditSourceWalletId] = useState('');
  const [editDestWalletId, setEditDestWalletId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTransferAmount, setEditTransferAmount] = useState('');
  const [editFrequency, setEditFrequency] = useState<RecurringFrequency>('monthly');
  const [editCustomDays, setEditCustomDays] = useState('10');
  const [editNextRunDate, setEditNextRunDate] = useState('');
  const [editTransferNote, setEditTransferNote] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  const handleWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addWallet({
      name: name.trim(),
      wallet_type: walletType,
      is_shared: isAdmin ? isShared : false,
      owner_id: currentMember.id,
      initial_balance: parseFloat(initialBalance) || 0,
      credit_limit: walletType === 'credit_card' ? (parseFloat(creditLimit) || 0) : null,
    });

    setName('');
    setInitialBalance('');
    setCreditLimit('');
    setShowWalletModal(false);
  };

  const handleEditWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;

    updateWallet(editingWallet.id, {
      name: editName.trim(),
      wallet_type: editType,
      current_balance: parseFloat(editBalance) || 0,
      credit_limit: editType === 'credit_card' ? (parseFloat(editCreditLimit) || 0) : null,
      is_shared: editIsShared,
    });

    setEditingWallet(null);
  };

  const handleDeleteWallet = (w: Wallet) => {
    if (!window.confirm(`Are you sure you want to delete account "${w.name}"?`)) return;
    const res = deleteWallet(w.id);
    if (!res.success) alert(res.error);
  };

  const handleDeleteRecurring = (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this recurring schedule rule?')) return;
    deleteRecurringTransfer(ruleId);
  };

  const handleRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWalletId) return;

    addRecurringTransfer({
      rule_type: ruleType,
      source_wallet_id: sourceWalletId,
      destination_wallet_id: ruleType === 'transfer' ? destWalletId : null,
      category_id: categoryId || null,
      amount: parseFloat(transferAmount) || 0,
      frequency: frequency,
      custom_interval_days: frequency === 'custom_days' ? (parseInt(customDays) || 1) : null,
      next_run_date: nextRunDate || null,
      note: transferNote.trim() || (ruleType === 'expense' ? 'Recurring Bill Payment' : 'Automated Allowance Transfer'),
    });

    setTransferAmount('');
    setTransferNote('');
    setNextRunDate(new Date().toISOString().split('T')[0]);
    setShowRecurringModal(false);
  };

  const handleEditRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecurring) return;

    updateRecurringTransfer(editingRecurring.id, {
      rule_type: editRuleType,
      source_wallet_id: editSourceWalletId,
      destination_wallet_id: editRuleType === 'transfer' ? editDestWalletId : null,
      category_id: editCategoryId || null,
      amount: parseFloat(editTransferAmount) || 0,
      frequency: editFrequency,
      custom_interval_days: editFrequency === 'custom_days' ? (parseInt(editCustomDays) || 1) : null,
      next_run_date: editNextRunDate.trim() || undefined,
      note: editTransferNote.trim(),
      is_active: editIsActive,
    });

    setEditingRecurring(null);
  };

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'bank': return <Landmark className="w-5 h-5 text-sky-400" />;
      case 'e_wallet': return <Smartphone className="w-5 h-5 text-indigo-400" />;
      case 'cash': return <Banknote className="w-5 h-5 text-emerald-400" />;
      case 'credit_card': return <CreditCard className="w-5 h-5 text-purple-400" />;
    }
  };

  const formatFrequencyLabel = (freq: RecurringFrequency, customInterval?: number | null) => {
    switch (freq) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-Weekly';
      case 'monthly': return 'Monthly';
      case 'quarterly': return 'Quarterly (Every 3 mos)';
      case 'semi_annual': return 'Semi-Annual (Every 6 mos)';
      case 'annual': return 'Annually (Every 1 yr)';
      case 'custom_days': return `Every ${customInterval || 1} Days`;
      default: return freq;
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <span>Wallets, Accounts & Credit Lines</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track bank accounts, e-wallets, credit card credit lines (available credit vs used balance), and scheduled bills.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button
              onClick={() => {
                if (visibleWallets.length > 0) setSourceWalletId(visibleWallets[0].id);
                if (categories.length > 0) setCategoryId(categories[0].id);
                setNextRunDate(new Date().toISOString().split('T')[0]);
                setShowRecurringModal(true);
              }}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow"
            >
              <Clock className="w-4 h-4" />
              <span>+ Schedule Recurring Bill</span>
            </button>
          )}

          <button
            onClick={() => setShowWalletModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Account / Credit Line</span>
          </button>
        </div>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleWallets.map(w => {
          const owner = members.find(m => m.id === w.owner_id);
          const isCreditCard = w.wallet_type === 'credit_card';
          const creditLimitVal = w.credit_limit || 0;
          const usedBalance = w.current_balance;
          const availableCredit = isCreditCard ? (creditLimitVal - usedBalance) : w.current_balance;
          const utilPercent = (isCreditCard && creditLimitVal > 0) ? Math.min(Math.round((usedBalance / creditLimitVal) * 100), 100) : 0;

          return (
            <div 
              key={w.id} 
              className={`bg-slate-800/90 border rounded-xl p-5 space-y-4 transition-all shadow-lg flex flex-col justify-between ${
                isCreditCard ? 'border-purple-500/50 hover:border-purple-400' : 'border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60">
                      {getWalletIcon(w.wallet_type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{w.name}</h3>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                        {w.wallet_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {w.is_shared ? (
                    <span className="flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                      <Shield className="w-3 h-3 mr-1" /> Shared
                    </span>
                  ) : (
                    <span className="flex items-center text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      <Lock className="w-3 h-3 mr-1" /> Personal
                    </span>
                  )}
                </div>

                {isCreditCard ? (
                  /* Credit Card Credit Line Card Details */
                  <div className="space-y-2 pt-2 border-t border-slate-700/60 font-mono">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-400">Available Credit Line:</span>
                      <span className="font-bold text-emerald-400 text-base">
                        ₱{availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                      <div>
                        <span className="text-slate-400">Total Credit Line:</span>
                        <p className="font-semibold text-white">₱{creditLimitVal.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Used Statement Balance:</span>
                        <p className="font-bold text-rose-400">₱{usedBalance.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Credit Line Meter */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Credit Line Utilization</span>
                        <span className={utilPercent > 80 ? 'text-rose-400 font-bold' : 'text-purple-300 font-medium'}>
                          {utilPercent}% Used
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            utilPercent > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-500 to-indigo-400'
                          }`}
                          style={{ width: `${utilPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Bank / Cash / E-Wallet Balance Card */
                  <div className="pt-2 border-t border-slate-700/60 flex items-end justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">Current Balance</span>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        ₱{w.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400">Account Owner</span>
                      <p className="text-xs font-semibold text-slate-300">
                        {owner?.display_name || 'Household'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      setEditingWallet(w);
                      setEditName(w.name);
                      setEditType(w.wallet_type);
                      setEditBalance(w.current_balance.toString());
                      setEditCreditLimit((w.credit_limit || 0).toString());
                      setEditIsShared(w.is_shared);
                    }}
                    title="Edit Wallet Details"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWallet(w)}
                    title="Delete Wallet Account"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Automated Recurring Bills & Allowance Schedules Section */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Automated Recurring Bills & Transfers Schedule</span>
            </h3>
            <p className="text-xs text-slate-400">Manage recurring Internet bills, School Dues, Water, Electric, Subscriptions, and Allowance rules with associated Envelope Categories & Next Due Dates.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                if (visibleWallets.length > 0) setSourceWalletId(visibleWallets[0].id);
                if (categories.length > 0) setCategoryId(categories[0].id);
                setNextRunDate(new Date().toISOString().split('T')[0]);
                setShowRecurringModal(true);
              }}
              className="text-xs text-indigo-400 hover:underline font-medium"
            >
              + Add Schedule Rule
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringTransfers.map(rule => {
            const src = wallets.find(w => w.id === rule.source_wallet_id);
            const dst = rule.destination_wallet_id ? wallets.find(w => w.id === rule.destination_wallet_id) : null;
            const cat = rule.category_id ? categories.find(c => c.id === rule.category_id) : null;

            return (
              <div key={rule.id} className="bg-slate-900/60 border border-slate-700/80 p-4 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {cat ? (
                      <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg shrink-0">
                        <CategoryIcon slug={cat.icon_slug} className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
                        <ArrowRightLeft className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-white">{rule.note}</h4>
                      <p className="text-xs text-slate-400 flex flex-wrap items-center gap-1 mt-0.5">
                        {rule.rule_type === 'expense' ? (
                          <span>Payer: <strong className="text-slate-200">{src?.name}</strong></span>
                        ) : (
                          <span>{src?.name} <strong className="text-indigo-400">➔</strong> {dst?.name || 'Destination'}</span>
                        )}
                        {cat && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-sky-300 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30">
                            <CategoryIcon slug={cat.icon_slug} className="w-3 h-3 mr-1" />
                            {cat.name}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border shrink-0 ${
                    rule.is_active 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">Amount: </span>
                    <span className="font-bold text-emerald-400 font-mono">₱{rule.amount.toFixed(2)}</span>
                    <span className="text-sky-300 font-medium ml-1 font-mono">
                      ({formatFrequencyLabel(rule.frequency, rule.custom_interval_days)})
                    </span>
                    <p className="text-[11px] font-bold text-amber-300 flex items-center mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-amber-400" /> Next Due: {rule.next_run_date}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingRecurring(rule);
                          setEditRuleType(rule.rule_type);
                          setEditSourceWalletId(rule.source_wallet_id);
                          setEditDestWalletId(rule.destination_wallet_id || '');
                          setEditCategoryId(rule.category_id || '');
                          setEditTransferAmount(rule.amount.toString());
                          setEditFrequency(rule.frequency);
                          setEditCustomDays((rule.custom_interval_days || 10).toString());
                          setEditNextRunDate(rule.next_run_date);
                          setEditTransferNote(rule.note);
                          setEditIsActive(rule.is_active);
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors flex items-center space-x-1"
                        title="Edit Recurring Schedule Rule & Next Due Date"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">Edit</span>
                      </button>
                      <button
                        onClick={() => toggleRecurringTransfer(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded transition-colors flex items-center space-x-1"
                        title="Toggle active/paused state"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">{rule.is_active ? 'Pause' : 'Activate'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteRecurring(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                        title="Delete Recurring Schedule Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Wallet / Credit Line Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <WalletIcon className="w-5 h-5 text-sky-400" />
              <span>Create New Wallet Account or Credit Line</span>
            </h3>

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BDO Platinum Visa, BPI Checking, GCash"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value as WalletType)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="bank">Bank Account (BDO / BPI / Metrobank / UnionBank)</option>
                  <option value="credit_card">Credit Card / Credit Line (Visa / Mastercard / Amex)</option>
                  <option value="e_wallet">E-Wallet (GCash / Maya / GrabPay)</option>
                  <option value="cash">Physical Cash / Allowance</option>
                </select>
              </div>

              {walletType === 'credit_card' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Approved Credit Line Limit (₱ PHP)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="150000.00"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Currently Used Statement Balance (₱ PHP)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-rose-400"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Initial Opening Balance (₱ PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              )}

              {isAdmin && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isSharedCheck"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500 bg-slate-800 cursor-pointer"
                  />
                  <label htmlFor="isSharedCheck" className="text-xs text-slate-300 cursor-pointer">
                    Share with all household members (Shared Account)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Wallet / Credit Line Modal */}
      {editingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Account: {editingWallet.name}</h3>

            <form onSubmit={handleEditWalletSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as WalletType)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card / Credit Line</option>
                  <option value="e_wallet">E-Wallet</option>
                  <option value="cash">Physical Cash</option>
                </select>
              </div>

              {editType === 'credit_card' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Approved Credit Limit Line (₱ PHP)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editCreditLimit}
                      onChange={(e) => setEditCreditLimit(e.target.value)}
                      className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Used Statement Balance (₱ PHP)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-rose-400"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Current Balance (₱ PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="editSharedCheck"
                  checked={editIsShared}
                  onChange={(e) => setEditIsShared(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500 bg-slate-800 cursor-pointer"
                />
                <label htmlFor="editSharedCheck" className="text-xs text-slate-300 cursor-pointer">
                  Shared Household Wallet
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingWallet(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Account Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recurring Bill / Transfer Schedule Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>Schedule Recurring Bill or Allowance</span>
            </h3>

            <form onSubmit={handleRecurringSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Schedule Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleType('expense')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      ruleType === 'expense'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Recurring Bill (Internet / School Dues)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleType('transfer')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      ruleType === 'transfer'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Recurring Transfer (Allowance)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bill / Transfer Title</label>
                <input
                  type="text"
                  required
                  placeholder={ruleType === 'expense' ? "e.g. PLDT Fiber Internet, Globe Load, Water Bill" : "e.g. Alex Weekly Allowance"}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payer / Source Wallet Account</label>
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

              {ruleType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Destination Account (Teen/Dependent)</label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (₱{w.current_balance.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Associated Envelope Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">-- None / Uncategorized --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Recurring Amount (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1899.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (Every 3 Mos)</option>
                    <option value="semi_annual">Semi-Annual (Every 6 Mos)</option>
                    <option value="annual">Annually (Every 1 Year)</option>
                    <option value="custom_days">Custom (Every N Days)</option>
                  </select>
                </div>
              </div>

              {frequency === 'custom_days' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Repeat Every (N Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    placeholder="10"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Next Payment / Execution Due Date</label>
                <input
                  type="date"
                  required
                  value={nextRunDate}
                  onChange={(e) => setNextRunDate(e.target.value)}
                  className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Create Schedule Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Recurring Bill / Transfer Schedule Modal */}
      {editingRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>Edit Recurring Schedule Rule: {editingRecurring.note}</span>
            </h3>

            <form onSubmit={handleEditRecurringSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Schedule Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditRuleType('expense')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      editRuleType === 'expense'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Recurring Bill (Internet / School Dues)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditRuleType('transfer')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      editRuleType === 'transfer'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Recurring Transfer (Allowance)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bill / Transfer Title</label>
                <input
                  type="text"
                  required
                  value={editTransferNote}
                  onChange={(e) => setEditTransferNote(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payer / Source Wallet Account</label>
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

              {editRuleType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Destination Account (Teen/Dependent)</label>
                  <select
                    value={editDestWalletId}
                    onChange={(e) => setEditDestWalletId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (₱{w.current_balance.toFixed(2)})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Associated Envelope Category</label>
                <select
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">-- None / Uncategorized --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Recurring Amount (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editTransferAmount}
                    onChange={(e) => setEditTransferAmount(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Frequency</label>
                  <select
                    value={editFrequency}
                    onChange={(e) => setEditFrequency(e.target.value as RecurringFrequency)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (Every 3 Mos)</option>
                    <option value="semi_annual">Semi-Annual (Every 6 Mos)</option>
                    <option value="annual">Annually (Every 1 Year)</option>
                    <option value="custom_days">Custom (Every N Days)</option>
                  </select>
                </div>
              </div>

              {editFrequency === 'custom_days' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Repeat Every (N Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    required
                    value={editCustomDays}
                    onChange={(e) => setEditCustomDays(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Next Payment / Execution Due Date</label>
                <input
                  type="date"
                  required
                  value={editNextRunDate}
                  onChange={(e) => setEditNextRunDate(e.target.value)}
                  className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActiveCheck"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800 cursor-pointer"
                />
                <label htmlFor="editIsActiveCheck" className="text-xs text-slate-300 cursor-pointer">
                  Schedule rule is active (Uncheck to pause)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecurring(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Schedule Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
