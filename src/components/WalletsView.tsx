'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Wallet as WalletIcon, Landmark, Smartphone, Banknote, Shield, Lock, Plus, ArrowRightLeft, Calendar, Power } from 'lucide-react';
import { WalletType, RecurringFrequency } from '../types/database';

export const WalletsView: React.FC = () => {
  const { 
    wallets, members, currentMember, isAdmin, addWallet, 
    recurringTransfers, addRecurringTransfer, toggleRecurringTransfer 
  } = useHousehold();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // Add Wallet Form State
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('bank');
  const [isShared, setIsShared] = useState(isAdmin);
  const [initialBalance, setInitialBalance] = useState('');

  // Add Recurring Transfer Form State
  const [sourceWalletId, setSourceWalletId] = useState(wallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('weekly');
  const [transferNote, setTransferNote] = useState('');

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
    });

    setName('');
    setInitialBalance('');
    setShowWalletModal(false);
  };

  const handleRecurringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWalletId || !destWalletId) return;

    addRecurringTransfer({
      source_wallet_id: sourceWalletId,
      destination_wallet_id: destWalletId,
      amount: parseFloat(transferAmount) || 0,
      frequency: frequency,
      note: transferNote.trim() || 'Automated allowance transfer',
    });

    setTransferAmount('');
    setTransferNote('');
    setShowRecurringModal(false);
  };

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'bank': return <Landmark className="w-5 h-5 text-sky-400" />;
      case 'e_wallet': return <Smartphone className="w-5 h-5 text-indigo-400" />;
      case 'cash': return <Banknote className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <span>Wallets & Accounts Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track bank accounts, e-wallets, personal cash funds, and automated allowance transfer schedules.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin && (
            <button
              onClick={() => {
                if (visibleWallets.length > 0) setSourceWalletId(visibleWallets[0].id);
                setShowRecurringModal(true);
              }}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>+ Schedule Allowance</span>
            </button>
          )}

          <button
            onClick={() => setShowWalletModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Wallet Account</span>
          </button>
        </div>
      </div>

      {/* Wallet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleWallets.map(w => {
          const owner = members.find(m => m.id === w.owner_id);
          return (
            <div 
              key={w.id} 
              className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-5 space-y-4 hover:border-slate-600 transition-all shadow-lg"
            >
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
            </div>
          );
        })}
      </div>

      {/* Automated Allowance / Recurring Transfers Section */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              <span>Automated Allowance & Recurring Transfers</span>
            </h3>
            <p className="text-xs text-slate-400">Scheduled transfers from parent wallets to teen/dependent wallets</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowRecurringModal(true)}
              className="text-xs text-indigo-400 hover:underline font-medium"
            >
              + Add Rule
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringTransfers.map(rule => {
            const src = wallets.find(w => w.id === rule.source_wallet_id);
            const dst = wallets.find(w => w.id === rule.destination_wallet_id);

            return (
              <div key={rule.id} className="bg-slate-900/60 border border-slate-700/80 p-4 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-white">{rule.note}</h4>
                    <p className="text-xs text-slate-400 flex items-center mt-0.5">
                      <span>{src?.name}</span>
                      <span className="text-indigo-400 font-bold mx-1.5">➔</span>
                      <span>{dst?.name}</span>
                    </p>
                  </div>

                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                    rule.is_active 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400">Transfer Amount: </span>
                    <span className="font-bold text-emerald-400 font-mono">₱{rule.amount.toFixed(2)}</span>
                    <span className="text-slate-500"> ({rule.frequency})</span>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => toggleRecurringTransfer(rule.id)}
                      className="p-1 text-slate-400 hover:text-indigo-400 transition-colors flex items-center space-x-1"
                      title="Toggle active state"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{rule.is_active ? 'Pause' : 'Activate'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <WalletIcon className="w-5 h-5 text-sky-400" />
              <span>Create New Wallet Account</span>
            </h3>

            <form onSubmit={handleWalletSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BDO Checking, GCash, Maya, Cash Pocket"
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
                  <option value="e_wallet">E-Wallet (GCash / Maya / GrabPay)</option>
                  <option value="cash">Physical Cash / Allowance</option>
                </select>
              </div>

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

              {isAdmin ? (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isSharedCheck"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500 bg-slate-800 cursor-pointer"
                  />
                  <label htmlFor="isSharedCheck" className="text-xs text-slate-300 cursor-pointer">
                    Share with all household members (Shared Wallet)
                  </label>
                </div>
              ) : (
                <p className="text-[11px] text-amber-400 bg-amber-400/10 p-2 rounded border border-amber-400/20">
                  Note: As a Household Member, created wallets are private to your profile.
                </p>
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
                  Create Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recurring Allowance Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
              <span>Schedule Automated Allowance Transfer</span>
            </h3>

            <form onSubmit={handleRecurringSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Note / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Weekly Allowance"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Account (Parent)</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Transfer Amount (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1000.00"
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
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
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
                  Schedule Transfer Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
