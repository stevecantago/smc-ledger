'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  TrendingDown, TrendingUp, ArrowRightLeft, Search, Filter, Trash2, Edit3, Clock, 
  ExternalLink, Plus, AlertCircle, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { Transaction, TransactionType } from '../types/database';

interface TransactionsViewProps {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ showModal, setShowModal }) => {
  const { 
    transactions, wallets, categories, members, currentMember, isAdmin,
    addTransaction, updateTransaction, deleteTransaction, canEditTransaction 
  } = useHousehold();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [payerFilter, setPayerFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state for Modal
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');

  // RLS-aware wallets list
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  // Filtered transactions
  const filteredTx = transactions.filter(t => {
    const matchesSearch = !searchTerm || (t.note && t.note.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesPayer = payerFilter === 'all' || t.payer_id === payerFilter;
    const matchesCategory = categoryFilter === 'all' || t.category_id === categoryFilter;
    return matchesSearch && matchesType && matchesPayer && matchesCategory;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    if (!walletId) {
      setErrorMsg('Please select a source wallet account.');
      return;
    }

    if (txType === 'transfer' && !destWalletId) {
      setErrorMsg('Please select a destination wallet for transfer.');
      return;
    }

    if (txType === 'transfer' && walletId === destWalletId) {
      setErrorMsg('Source and Destination wallets cannot be the same for transfers.');
      return;
    }

    const res = addTransaction({
      wallet_id: walletId,
      destination_wallet_id: txType === 'transfer' ? destWalletId : null,
      category_id: txType === 'expense' ? categoryId : null,
      type: txType,
      amount: parsedAmount,
      transaction_date: txDate,
      note: note.trim(),
      receipt_url: receiptUrl.trim() || undefined,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to log transaction.');
      return;
    }

    // Reset and close
    setAmount('');
    setNote('');
    setReceiptUrl('');
    setShowModal(false);
  };

  const handleDelete = (tx: Transaction) => {
    if (!window.confirm('Are you sure you want to delete this transaction entry?')) return;
    const res = deleteTransaction(tx.id);
    if (!res.success) {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Household Transactions Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-account audit log with payer attribution and RBAC 24-hour edit window enforcement.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            if (visibleWallets.length > 0) setWalletId(visibleWallets[0].id);
            setShowModal(true);
          }}
          className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
        >
          <Plus className="w-4 h-4" />
          <span>+ Log Transaction</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search note or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 text-xs text-white pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-900 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All Transaction Types</option>
          <option value="expense">Expenses Only (-)</option>
          <option value="income">Incomes Only (+)</option>
          <option value="transfer">Transfers Only (➔)</option>
        </select>

        {/* Payer Filter */}
        <select
          value={payerFilter}
          onChange={(e) => setPayerFilter(e.target.value)}
          className="bg-slate-900 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All Household Payers</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-900 text-xs text-white px-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="all">All Budget Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Date & Payer</th>
                <th className="py-3 px-4">Description & Category</th>
                <th className="py-3 px-4">Accounts Involved</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Receipt</th>
                <th className="py-3 px-4 text-center">RBAC Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-xs">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transactions match your search filters.
                  </td>
                </tr>
              ) : (
                filteredTx.map(tx => {
                  const payer = members.find(m => m.id === tx.payer_id);
                  const wallet = wallets.find(w => w.id === tx.wallet_id);
                  const destWallet = tx.destination_wallet_id ? wallets.find(w => w.id === tx.destination_wallet_id) : null;
                  const category = categories.find(c => c.id === tx.category_id);
                  const editable = canEditTransaction(tx);

                  return (
                    <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}>
                          {tx.type === 'expense' ? <TrendingDown className="w-3 h-3 mr-1" /> :
                           tx.type === 'income' ? <TrendingUp className="w-3 h-3 mr-1" /> :
                           <ArrowRightLeft className="w-3 h-3 mr-1" />}
                          {tx.type}
                        </span>
                      </td>

                      {/* Date & Payer */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{payer?.display_name || 'Member'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{tx.transaction_date}</div>
                      </td>

                      {/* Note & Category */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{tx.note || 'No note attached'}</div>
                        {category && (
                          <span className="inline-block mt-0.5 text-[10px] text-sky-400 bg-sky-400/10 px-1.5 py-0.2 rounded">
                            {category.name}
                          </span>
                        )}
                      </td>

                      {/* Wallet Accounts */}
                      <td className="py-3 px-4 font-medium text-slate-300">
                        {tx.type === 'transfer' ? (
                          <span>{wallet?.name} <span className="text-sky-400 font-bold">➔</span> {destWallet?.name}</span>
                        ) : (
                          <span>{wallet?.name}</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className={`py-3 px-4 text-right font-mono font-bold ${
                        tx.type === 'expense' ? 'text-rose-400' :
                        tx.type === 'income' ? 'text-emerald-400' :
                        'text-indigo-300'
                      }`}>
                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                        ${tx.amount.toFixed(2)}
                      </td>

                      {/* Receipt Link */}
                      <td className="py-3 px-4 text-center">
                        {tx.receipt_url ? (
                          <a
                            href={tx.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[10px] text-sky-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> Receipt
                          </a>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>

                      {/* RBAC Status */}
                      <td className="py-3 px-4 text-center">
                        {isAdmin ? (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-mono">
                            Admin Access
                          </span>
                        ) : editable ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded font-mono flex items-center justify-center">
                            <Clock className="w-3 h-3 mr-1" /> &lt;24h Editable
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono flex items-center justify-center">
                            <ShieldAlert className="w-3 h-3 mr-1 text-slate-500" /> Locked (&gt;24h)
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        {editable ? (
                          <button
                            onClick={() => handleDelete(tx)}
                            title="Delete Transaction"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[11px] font-mono cursor-not-allowed" title="Members cannot edit transactions >24hrs old">
                            Read Only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Log New Household Transaction</span>
              </h3>
              <span className="text-xs text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded font-mono">
                Payer: {currentMember.display_name}
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Transaction Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'expense', label: 'Expense (-)', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
                    { type: 'income', label: 'Income (+)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                    { type: 'transfer', label: 'Transfer (➔)', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.type}
                      onClick={() => setTxType(item.type as TransactionType)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                        txType === item.type 
                          ? `${item.color} shadow-sm ring-1 ring-sky-500` 
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700/50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800 text-white font-mono text-base font-bold border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Source Wallet Account */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {txType === 'transfer' ? 'From Wallet (Source)' : 'Wallet / Account Used'}
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} (${w.current_balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Wallet for Transfer */}
              {txType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">To Wallet (Destination)</label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} (${w.current_balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category for Expense */}
              {txType === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Budget Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Envelope Category --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Budget: ${c.monthly_budget_limit})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date & Note */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Receipt URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={receiptUrl}
                    onChange={(e) => setReceiptUrl(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Costco groceries, Electric bill, Movie tickets"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

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
                  Confirm & Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
