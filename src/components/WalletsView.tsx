'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Wallet as WalletIcon, Landmark, Smartphone, Banknote, Shield, Lock, Plus, CheckCircle2 } from 'lucide-react';
import { WalletType } from '../types/database';

export const WalletsView: React.FC = () => {
  const { wallets, members, currentMember, isAdmin, addWallet } = useHousehold();
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('bank');
  const [isShared, setIsShared] = useState(isAdmin);
  const [initialBalance, setInitialBalance] = useState('');

  // RLS Visibility Guard: Admin sees all; Member sees shared + personal owned
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addWallet({
      name: name.trim(),
      wallet_type: walletType,
      is_shared: isAdmin ? isShared : false, // Non-admins can only create personal
      owner_id: currentMember.id,
      initial_balance: parseFloat(initialBalance) || 0,
    });

    setName('');
    setInitialBalance('');
    setShowModal(false);
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
            Track bank accounts, e-wallets, and personal cash funds across household members.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Wallet Account</span>
        </button>
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
                    ${w.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

      {/* Add Wallet Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <WalletIcon className="w-5 h-5 text-sky-400" />
              <span>Create New Wallet Account</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank of America Checking, Venmo, Cash Pocket"
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
                  <option value="bank">Bank Account</option>
                  <option value="e_wallet">E-Wallet (Venmo / Apple Pay / PayPal)</option>
                  <option value="cash">Physical Cash / Allowance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Opening Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  onClick={() => setShowModal(false)}
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
    </div>
  );
};
