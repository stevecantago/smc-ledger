'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  TrendingDown, TrendingUp, ArrowRightLeft, Search, Filter, Trash2, Edit3, Clock, 
  ExternalLink, Plus, AlertCircle, CheckCircle2, ShieldAlert, Download, Image, Upload, DollarSign 
} from 'lucide-react';
import { Transaction, TransactionType } from '../types/database';
import { exportTransactionsToCsv } from '../lib/exportCsv';

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
  const [fee, setFee] = useState('');
  const [walletId, setWalletId] = useState(wallets[0]?.id || '');
  const [destWalletId, setDestWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState('');

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);

  const filteredTx = transactions.filter(t => {
    const matchesSearch = !searchTerm || (t.note && t.note.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesPayer = payerFilter === 'all' || t.payer_id === payerFilter;
    const matchesCategory = categoryFilter === 'all' || t.category_id === categoryFilter;
    return matchesSearch && matchesType && matchesPayer && matchesCategory;
  });

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
      const previewUrl = URL.createObjectURL(file);
      setReceiptUrl(previewUrl);
    }
  };

  const handleExportCsv = () => {
    exportTransactionsToCsv(filteredTx, wallets, categories, members);
  };

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

    const parsedFee = parseFloat(fee) || 0;

    const res = addTransaction({
      wallet_id: walletId,
      destination_wallet_id: txType === 'transfer' ? destWalletId : null,
      category_id: txType === 'expense' ? categoryId : null,
      type: txType,
      amount: parsedAmount,
      fee: parsedFee,
      transaction_date: txDate,
      note: note.trim(),
      receipt_url: receiptUrl.trim() || undefined,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to log transaction.');
      return;
    }

    setAmount('');
    setFee('');
    setNote('');
    setReceiptUrl('');
    setReceiptFileName('');
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
    <div className="space-y-4 sm:space-y-6 pb-28 md:pb-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-slate-800/80 border border-slate-700/70 p-4 sm:p-5 rounded-xl">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
            <span>Transactions Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-account audit log with payer attribution, processing fees, and RBAC 24-hour edit window.
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-end">
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-lg font-medium text-xs transition-all shadow"
            title="Export filtered transaction ledger to CSV file"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg('');
              if (visibleWallets.length > 0) setWalletId(visibleWallets[0].id);
              setShowModal(true);
            }}
            className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Log Transaction</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-800/60 border border-slate-700/60 p-3 sm:p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search note or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/80 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900/80 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Transaction Types</option>
            <option value="expense">Expenses Only</option>
            <option value="income">Income Only</option>
            <option value="transfer">Transfers Only</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900/80 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Envelope Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Payer Filter */}
          <select
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
            className="bg-slate-900/80 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">All Family Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Transaction Table (>= md) */}
      <div className="hidden md:block bg-slate-800/80 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-700">
                <th className="py-3 px-4">Date & Type</th>
                <th className="py-3 px-4">Description / Note</th>
                <th className="py-3 px-4">Source Account</th>
                <th className="py-3 px-4">Envelope / Dest</th>
                <th className="py-3 px-4">Payer</th>
                <th className="py-3 px-4 text-right">Amount & Fee</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 text-slate-300">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    No transaction entries match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTx.map(tx => {
                  const srcWallet = wallets.find(w => w.id === tx.wallet_id);
                  const dstWallet = tx.destination_wallet_id ? wallets.find(w => w.id === tx.destination_wallet_id) : null;
                  const category = tx.category_id ? categories.find(c => c.id === tx.category_id) : null;
                  const payer = members.find(m => m.id === tx.payer_id);
                  const editable = canEditTransaction(tx);
                  const txFee = tx.fee || 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`p-1.5 rounded ${
                            tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400' :
                            tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {tx.type === 'expense' ? <TrendingDown className="w-3.5 h-3.5" /> :
                             tx.type === 'income' ? <TrendingUp className="w-3.5 h-3.5" /> :
                             <ArrowRightLeft className="w-3.5 h-3.5" />}
                          </span>
                          <span>{tx.transaction_date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-white max-w-xs truncate">
                        <div className="flex flex-col">
                          <span>{tx.note || 'No description'}</span>
                          {tx.receipt_url && (
                            <a
                              href={tx.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-sky-400 hover:underline flex items-center mt-0.5"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> View Receipt
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {srcWallet?.name || 'Unknown'}
                      </td>

                      <td className="py-3 px-4">
                        {tx.type === 'expense' ? (
                          <span className="text-sky-300 font-medium">{category?.name || 'General'}</span>
                        ) : tx.type === 'transfer' ? (
                          <span className="text-indigo-300 font-medium">➔ {dstWallet?.name || 'Destination'}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded border border-slate-700">
                          {payer?.display_name || 'System'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={
                            tx.type === 'expense' ? 'text-rose-400' :
                            tx.type === 'income' ? 'text-emerald-400' :
                            'text-indigo-300'
                          }>
                            {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                            ₱{tx.amount.toFixed(2)}
                          </span>
                          {txFee > 0 && (
                            <span className="text-[10px] text-amber-400 font-normal">
                              + Fee: ₱{txFee.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {editable ? (
                          <button
                            onClick={() => handleDelete(tx)}
                            title="Delete Transaction"
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 flex items-center justify-end" title="Edit window expired (24h Limit)">
                            <Clock className="w-3 h-3 mr-1" /> Locked
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

      {/* Mobile Touch-Optimized Cards (< md) */}
      <div className="md:hidden space-y-3 pb-24">
        {filteredTx.length === 0 ? (
          <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-6 text-center text-slate-500 italic text-xs">
            No transaction entries match the selected filters.
          </div>
        ) : (
          filteredTx.map(tx => {
            const srcWallet = wallets.find(w => w.id === tx.wallet_id);
            const dstWallet = tx.destination_wallet_id ? wallets.find(w => w.id === tx.destination_wallet_id) : null;
            const category = tx.category_id ? categories.find(c => c.id === tx.category_id) : null;
            const payer = members.find(m => m.id === tx.payer_id);
            const editable = canEditTransaction(tx);
            const txFee = tx.fee || 0;

            return (
              <div 
                key={tx.id} 
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 space-y-3 shadow-md"
              >
                {/* Header Row: Type Icon, Date, Amount & Fee */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
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
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">{tx.type}</span>
                      <span className="text-xs text-slate-300 font-mono">{tx.transaction_date}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-base font-bold font-mono block ${
                      tx.type === 'expense' ? 'text-rose-400' :
                      tx.type === 'income' ? 'text-emerald-400' :
                      'text-indigo-300'
                    }`}>
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      ₱{tx.amount.toFixed(2)}
                    </span>
                    {txFee > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono font-medium block">
                        Fee: ₱{txFee.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description Note */}
                <div>
                  <h4 className="font-semibold text-xs text-white leading-snug">{tx.note || 'No description provided'}</h4>
                  {tx.receipt_url && (
                    <a
                      href={tx.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center mt-1 font-medium"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" /> View Uploaded Receipt
                    </a>
                  )}
                </div>

                {/* Details Footer */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                  <div className="space-y-0.5">
                    <div className="text-slate-400">
                      Account: <strong className="text-slate-200">{srcWallet?.name || 'Unknown'}</strong>
                    </div>
                    {tx.type === 'expense' && (
                      <div className="text-slate-400">
                        Envelope: <strong className="text-sky-300">{category?.name || 'General'}</strong>
                      </div>
                    )}
                    {tx.type === 'transfer' && (
                      <div className="text-slate-400">
                        Destination: <strong className="text-indigo-300">➔ {dstWallet?.name || 'Unknown'}</strong>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="bg-slate-900 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                      {payer?.display_name || 'Member'}
                    </span>
                    {editable && (
                      <button
                        onClick={() => handleDelete(tx)}
                        title="Delete Transaction"
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>Log New Transaction</span>
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded"
              >
                ✕
              </button>
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
                  <button
                    type="button"
                    onClick={() => setTxType('expense')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      txType === 'expense'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('income')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      txType === 'income'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('transfer')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      txType === 'transfer'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Transfer
                  </button>
                </div>
              </div>

              {/* Amount & Fee Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Amount (₱ PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Transaction Fee (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00 (Optional)"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Source Wallet */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Wallet Account</label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {visibleWallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} (₱{w.current_balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category for Expense */}
              {txType === 'expense' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Envelope Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- General Expense --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Wallet for Transfer */}
              {txType === 'transfer' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Destination Wallet Account</label>
                  <select
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} (₱{w.current_balance.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly Groceries, InstaPay Transfer, Load"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Transaction Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Transaction Date</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>

              {/* Optional Receipt Attachment Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Receipt Attachment (Optional)</label>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-sky-400" />
                    <span>Upload Image</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleReceiptFileChange} 
                      className="hidden" 
                    />
                  </label>
                  {receiptFileName && (
                    <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                      {receiptFileName}
                    </span>
                  )}
                </div>
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
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-all shadow"
                >
                  Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
