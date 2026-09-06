'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Banknote, CreditCard, Edit2, Landmark, Lock, Plus, Shield, Smartphone, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { Wallet, WalletType } from '../types/database';

interface WalletsViewProps {
  onLogCardExpense?: (walletId: string) => void;
}

export const WalletsView: React.FC<WalletsViewProps> = ({ onLogCardExpense }) => {
  const {
    wallets,
    members,
    currentMember,
    isAdmin,
    hasPermission,
    addWallet,
    updateWallet,
    deleteWallet,
  } = useHousehold();

  const [showWalletModal, setShowWalletModal] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [name, setName] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('bank');
  const [isShared, setIsShared] = useState(isAdmin);
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<WalletType>('bank');
  const [editBalance, setEditBalance] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editIsShared, setEditIsShared] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const canManageWallets = hasPermission('manage_wallets');
  const canLogTransactions = hasPermission('create_transactions');

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'bank': return <Landmark className="w-5 h-5 text-sky-400" />;
      case 'e_wallet': return <Smartphone className="w-5 h-5 text-indigo-400" />;
      case 'cash': return <Banknote className="w-5 h-5 text-emerald-400" />;
      case 'credit_card': return <CreditCard className="w-5 h-5 text-purple-400" />;
    }
  };

  const handleWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) return;

    const result = addWallet({
      name: name.trim(),
      wallet_type: walletType,
      is_shared: canManageWallets ? isShared : false,
      owner_id: currentMember.id,
      initial_balance: parseFloat(initialBalance) || 0,
      credit_limit: walletType === 'credit_card' ? (parseFloat(creditLimit) || 0) : null,
    });

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to create account.');
      return;
    }

    setName('');
    setInitialBalance('');
    setCreditLimit('');
    setShowWalletModal(false);
  };

  const handleEditWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;
    setErrorMsg('');

    const result = updateWallet(editingWallet.id, {
      name: editName.trim(),
      wallet_type: editType,
      current_balance: parseFloat(editBalance) || 0,
      credit_limit: editType === 'credit_card' ? (parseFloat(editCreditLimit) || 0) : null,
      is_shared: editIsShared,
    });

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update account.');
      return;
    }

    setEditingWallet(null);
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    if (!window.confirm(`Are you sure you want to delete account "${wallet.name}"?`)) return;
    const result = deleteWallet(wallet.id);
    if (!result.success) alert(result.error);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <WalletIcon className="w-5 h-5 text-sky-400" />
            <span>Wallets, Accounts & Credit Lines</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track bank accounts, e-wallets, cash, and credit card credit lines.
          </p>
        </div>

        {canManageWallets && (
          <button
            onClick={() => {
              setErrorMsg('');
              setShowWalletModal(true);
            }}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Account / Credit Line</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleWallets.map(wallet => {
          const owner = members.find(member => member.id === wallet.owner_id);
          const isCreditCard = wallet.wallet_type === 'credit_card';
          const creditLimitValue = wallet.credit_limit || 0;
          const usedBalance = wallet.current_balance;
          const availableCredit = Math.max(0, creditLimitValue - usedBalance);
          const utilPercent = isCreditCard && creditLimitValue > 0 ? Math.min(Math.round((usedBalance / creditLimitValue) * 100), 100) : 0;

          return (
            <div
              key={wallet.id}
              className={`bg-slate-800/90 border rounded-xl p-5 space-y-4 transition-all shadow-lg flex flex-col justify-between ${
                isCreditCard ? 'border-purple-500/50 hover:border-purple-400' : 'border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/60">
                      {getWalletIcon(wallet.wallet_type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{wallet.name}</h3>
                      <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                        {wallet.wallet_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {wallet.is_shared ? (
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
                  <div className="space-y-2 pt-2 border-t border-slate-700/60 font-mono">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-400">Available Credit:</span>
                      <span className="font-bold text-emerald-400 text-base">
                        ₱{availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                      <div>
                        <span className="text-slate-400">Credit Limit:</span>
                        <p className="font-semibold text-white">₱{creditLimitValue.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">Used Balance:</span>
                        <p className="font-bold text-rose-400">₱{usedBalance.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">Credit Utilization</span>
                        <span className={utilPercent > 80 ? 'text-rose-400 font-bold' : 'text-purple-300 font-medium'}>
                          {utilPercent}% Used
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${utilPercent > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-purple-500 to-indigo-400'}`}
                          style={{ width: `${utilPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-700/60 flex items-end justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">Current Balance</span>
                      <div className="text-xl font-bold font-mono text-emerald-400">
                        ₱{wallet.current_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

              {(canManageWallets || (isCreditCard && canLogTransactions)) && (
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                  {isCreditCard && canLogTransactions ? (
                    <button
                      onClick={() => onLogCardExpense?.(wallet.id)}
                      title="Log Credit Card Expense"
                      className="flex items-center space-x-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-purple-200 hover:bg-purple-500/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Log Card Expense</span>
                    </button>
                  ) : <span />}

                  {canManageWallets && (
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setErrorMsg('');
                          setEditingWallet(wallet);
                          setEditName(wallet.name);
                          setEditType(wallet.wallet_type);
                          setEditBalance(wallet.current_balance.toString());
                          setEditCreditLimit((wallet.credit_limit || 0).toString());
                          setEditIsShared(wallet.is_shared);
                        }}
                        title="Edit Wallet Details"
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWallet(wallet)}
                        title="Delete Wallet Account"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card / Credit Line</option>
                  <option value="e_wallet">E-Wallet</option>
                  <option value="cash">Physical Cash</option>
                </select>
              </div>

              {walletType === 'credit_card' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Approved Credit Limit (₱ PHP)</label>
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">Current Used Balance (₱ PHP)</label>
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

              {canManageWallets && (
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isSharedCheck"
                    checked={isShared}
                    onChange={(e) => setIsShared(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-sky-500 bg-slate-800 cursor-pointer"
                  />
                  <label htmlFor="isSharedCheck" className="text-xs text-slate-300 cursor-pointer">
                    Share with all household members
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">Approved Credit Limit (₱ PHP)</label>
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">Used Balance (₱ PHP)</label>
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
    </div>
  );
};
