'use client';

import React, { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { useHousehold } from '../context/HouseholdContext';
import { 
  TrendingDown, TrendingUp, ArrowRightLeft, Landmark, Search, Filter, Trash2, Edit3, Clock, 
  ExternalLink, Plus, AlertCircle, CheckCircle2, ShieldAlert, Download, Image, Upload, DollarSign,
  CalendarDays, CreditCard, Wallet as WalletIcon,
} from 'lucide-react';
import { CategoryType, Transaction, TransactionType, Wallet, WalletType } from '../types/database';
import { exportTransactionsToCsv } from '../lib/exportCsv';
import { getTransactionSubmissionAction } from '../lib/transactionFlow';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import {
  type CreditCardPaymentAllocation,
  addPhpAmounts,
  getCreditCardAvailableCredit,
  getCreditCardPaymentAllocation,
  getCreditCardTotalDue,
  getCreditCardUsedBalance,
  getRequiredCreditCardFunding,
  getTransactionFeeValidationError,
  isPhpAmountGreaterThan,
  normalizeTransactionFee,
} from '../lib/creditCardTransactions';

export function getCreditCardPaymentAmountError(
  isCardLoanPayment: boolean,
  paymentAmount: number,
  cardTotalDue: number,
): string | null {
  return isCardLoanPayment && isPhpAmountGreaterThan(paymentAmount, cardTotalDue)
    ? 'Credit card payment cannot exceed total due.'
    : null;
}

export function getTransactionFeeError(fee: number): string | null {
  return getTransactionFeeValidationError(fee);
}

export function getCreditCardDestinationHelpText(
  isCreditCardPayment: boolean,
  destinationWalletType: Wallet['wallet_type'] | undefined,
): string | null {
  if (destinationWalletType !== 'credit_card') return null;
  return isCreditCardPayment
    ? 'This payment clears service fees first, then reduces used balance.'
    : 'Transfers into this card reduce used balance only; service fees stay unchanged.';
}

interface CreditCardPaymentPreviewProps {
  allocation: CreditCardPaymentAllocation;
  transactionFee: number;
  totalCashDeducted: number;
}

export const CreditCardPaymentPreview: React.FC<CreditCardPaymentPreviewProps> = ({
  allocation,
  transactionFee,
  totalCashDeducted,
}) => (
  <div className="grid grid-cols-2 gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-[11px]">
    <div><span className="text-slate-400">Service Fees Paid</span><p className="font-mono font-bold text-amber-300">₱{allocation.serviceFeePaid.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Used Balance Paid</span><p className="font-mono font-bold text-purple-300">₱{allocation.usedBalancePaid.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Transaction Fee</span><p className="font-mono font-bold text-amber-300">₱{transactionFee.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Total Cash Deducted</span><p className="font-mono font-bold text-rose-300">₱{totalCashDeducted.toFixed(2)}</p></div>
  </div>
);

interface TransactionsViewProps {
  showModal: boolean;
  setShowModal: (open: boolean) => void;
  draft?: {
    type?: TransactionType;
    walletId?: string;
    destinationWalletId?: string;
    amount?: number;
    note?: string;
    requireSourceSelection?: boolean;
    creditCardPayment?: boolean;
    categoryId?: string;
    selectedRecurringId?: string;
    selectedLoanId?: string;
    transactionDate?: string;
  } | null;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ showModal, setShowModal, draft }) => {
  const { 
    transactions, wallets, categories, loans, recurringTransfers, members, currentMember, isAdmin,
    addTransaction, updateTransaction, deleteTransaction, canEditTransaction,
    updateRecurringTransfer, deleteRecurringTransfer, payLoanAmortization 
  } = useHousehold();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CategoryType>('all');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState<string>('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | WalletType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Form state for Modal
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [selectedRecurringId, setSelectedRecurringId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [showCustomNote, setShowCustomNote] = useState(false);
  const [isCreditCardPayment, setIsCreditCardPayment] = useState(false);
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
  const selectedWallet = wallets.find(w => w.id === walletId);
  const selectedDestinationWallet = wallets.find(w => w.id === destWalletId);
  const requiredCardFunding = getRequiredCreditCardFunding(selectedDestinationWallet, visibleWallets);
  const isFundingAccountLocked = isCreditCardPayment && requiredCardFunding.locked;
  const requiredFundingWalletId = isFundingAccountLocked ? requiredCardFunding.walletId : null;
  const parsedPaymentAmount = parseFloat(amount) || 0;
  const parsedTransactionFee = parseFloat(fee) || 0;
  const cardPaymentAllocation = isCreditCardPayment && selectedDestinationWallet?.wallet_type === 'credit_card'
    ? getCreditCardPaymentAllocation(selectedDestinationWallet, parsedPaymentAmount)
    : null;
  const cardTotalDue = selectedDestinationWallet?.wallet_type === 'credit_card'
    ? getCreditCardTotalDue(selectedDestinationWallet)
    : 0;
  const totalCashDeducted = addPhpAmounts(parsedPaymentAmount, parsedTransactionFee);
  const transactionCategories = categories.filter(category => category.category_type === (txType === 'income' ? 'income' : 'expense'));

  useEffect(() => {
    if (!showModal || !draft) return;
    if (draft.type) setTxType(draft.type);
    setCategoryId(draft.categoryId || '');
    if (draft.requireSourceSelection) {
      setWalletId('');
    } else if (draft.walletId) {
      setWalletId(draft.walletId);
    }
    if (draft.destinationWalletId) setDestWalletId(draft.destinationWalletId);
    if (draft.amount !== undefined) setAmount(draft.amount.toString());
    if (draft.note !== undefined) setNote(draft.note);
    setIsCreditCardPayment(Boolean(draft.creditCardPayment));
    setSelectedRecurringId(draft.selectedRecurringId || '');
    setSelectedLoanId(draft.selectedLoanId || '');
    if (draft.transactionDate) setTxDate(draft.transactionDate);
    setShowCustomNote(false);
    setErrorMsg('');
  }, [draft, showModal]);

  useEffect(() => {
    if (!showModal || !isFundingAccountLocked) return;
    setWalletId(requiredFundingWalletId || '');
  }, [isFundingAccountLocked, requiredFundingWalletId, showModal]);

  const formatWalletOption = (wallet: typeof wallets[number]) => {
    if (wallet.wallet_type !== 'credit_card') {
      return `${wallet.name} (Balance: ₱${wallet.current_balance.toFixed(2)})`;
    }

    const available = getCreditCardAvailableCredit(wallet);
    const used = getCreditCardUsedBalance(wallet);
    return `${wallet.name} (Available: ₱${available.toFixed(2)} | Used: ₱${used.toFixed(2)})`;
  };

  const getDaysOffset = (freq: string, customInterval?: number | null) => {
    switch (freq) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'biweekly': return 14;
      case 'bimonthly': return 15;
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'semi_annual': return 180;
      case 'annual': return 365;
      case 'custom_days': return customInterval || 1;
      default: return 30;
    }
  };

  const advanceDateByDays = (startDateStr: string, days: number) => {
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const availableCategoryTypes = categories.filter(category => categoryFilter === 'all' || category.category_type === categoryFilter);
  const filteredTx = transactions.filter(transaction => {
    const source = wallets.find(wallet => wallet.id === transaction.wallet_id);
    const destination = wallets.find(wallet => wallet.id === transaction.destination_wallet_id);
    const category = categories.find(category => category.id === transaction.category_id);
    const payer = members.find(member => member.id === transaction.payer_id);
    const query = searchTerm.trim().toLocaleLowerCase();
    const matchesSearch = !query || [transaction.note, transaction.type, source?.name, destination?.name, category?.name, payer?.display_name]
      .some(value => value?.toLocaleLowerCase().includes(query));
    const matchesCategory = categoryFilter === 'all'
      || (categoryFilter === 'income' ? transaction.type === 'income' : transaction.type === 'expense' || transaction.type === 'loan');
    const matchesCategoryType = categoryTypeFilter === 'all'
      || (categoryTypeFilter === 'uncategorized' ? !transaction.category_id : transaction.category_id === categoryTypeFilter);
    const matchesPayer = payerFilter === 'all' || transaction.payer_id === payerFilter;
    const matchesWallet = walletFilter === 'all' || transaction.wallet_id === walletFilter || transaction.destination_wallet_id === walletFilter;
    const matchesAccountType = accountTypeFilter === 'all' || source?.wallet_type === accountTypeFilter || destination?.wallet_type === accountTypeFilter;
    const date = transaction.transaction_date.slice(0, 10);
    return matchesSearch && matchesCategory && matchesCategoryType && matchesPayer && matchesWallet && matchesAccountType
      && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
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
    const isCardLoanPayment = txType === 'loan'
      && isCreditCardPayment
      && selectedDestinationWallet?.wallet_type === 'credit_card';

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    const rawFee = fee.trim() ? Number(fee) : 0;
    const feeError = getTransactionFeeError(rawFee);
    if (feeError) {
      setErrorMsg(feeError);
      return;
    }
    const parsedFee = normalizeTransactionFee(rawFee);

    if (isFundingAccountLocked && !requiredFundingWalletId) {
      setErrorMsg('The required funding account "Maya Wallet - Steve" was not found for this card.');
      return;
    }

    if (isFundingAccountLocked && walletId !== requiredFundingWalletId) {
      setErrorMsg('Maya Credit and Maya Black payments must use "Maya Wallet - Steve".');
      return;
    }

    if (!walletId) {
      setErrorMsg('Please select a source wallet account.');
      return;
    }

    if (txType === 'income' || txType === 'expense') {
      const selectedCategory = categories.find(category => category.id === categoryId);
      if (categoryId && selectedCategory?.category_type !== txType) {
        setErrorMsg(`Choose a category from the ${txType} list.`);
        return;
      }
    }

    if ((txType === 'transfer' || isCreditCardPayment) && !destWalletId) {
      setErrorMsg(isCreditCardPayment
        ? 'Please select the credit card or credit line being paid.'
        : 'Please select a destination wallet for transfer.');
      return;
    }

    if (isCreditCardPayment && selectedDestinationWallet?.wallet_type !== 'credit_card') {
      setErrorMsg('Please select a credit card or credit line for this loan payment.');
      return;
    }

    const cardPaymentAmountError = getCreditCardPaymentAmountError(
      isCardLoanPayment,
      parsedAmount,
      cardTotalDue,
    );
    if (cardPaymentAmountError) {
      setErrorMsg(cardPaymentAmountError);
      return;
    }

    if (txType === 'transfer' && walletId === destWalletId) {
      setErrorMsg('Source and Destination wallets cannot be the same for transfers.');
      return;
    }

    if (txType === 'loan' && !selectedLoanId && !isCardLoanPayment) {
      setErrorMsg('Please select an Associated Loan Item for the loan payment.');
      return;
    }

    const submissionAction = getTransactionSubmissionAction({ type: txType, selectedLoanId });
    let shouldAdvanceRecurring = submissionAction === 'transaction';

    if (submissionAction === 'loan_payment' && selectedLoanId) {
      const res = payLoanAmortization(selectedLoanId, parsedAmount, walletId, categoryId || null);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to process loan payment.');
        return;
      }

      if (selectedRecurringId && selectedRecurringId !== 'others') {
        const parentLoan = loans.find(l => l.id === selectedLoanId);
        if (parentLoan && (parentLoan.remaining_balance - parsedAmount) <= 0) {
          deleteRecurringTransfer(selectedRecurringId);
        } else {
          shouldAdvanceRecurring = true;
        }
      }
    } else {
      const res = addTransaction({
        wallet_id: walletId,
        destination_wallet_id: txType === 'transfer' || isCardLoanPayment ? destWalletId : null,
        category_id: txType === 'expense' || txType === 'income' ? (categoryId || null) : null,
        type: txType,
        amount: parsedAmount,
        fee: parsedFee,
        transaction_date: txDate,
        note: note.trim() || (txType === 'expense' ? 'Expense' : txType === 'transfer' ? 'Transfer' : txType === 'loan' ? 'Loan Payment' : 'Income'),
        receipt_url: receiptUrl.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to log transaction.');
        return;
      }
    }

    if (shouldAdvanceRecurring && selectedRecurringId && selectedRecurringId !== 'others') {
      // Advance the next due date after a successful scheduled transaction.
      const rule = recurringTransfers.find(r => r.id === selectedRecurringId);
      if (rule) {
        const offsetDays = getDaysOffset(rule.frequency, rule.custom_interval_days);
        const baseDate = rule.next_run_date || txDate;
        const newNextRun = advanceDateByDays(baseDate, offsetDays);
        updateRecurringTransfer(rule.id, { next_run_date: newNextRun });
      }
    }

    setAmount('');
    setFee('');
    setNote('');
    setSelectedRecurringId('');
    setSelectedLoanId('');
    setCategoryId('');
    setShowCustomNote(false);
    setIsCreditCardPayment(false);
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
    <div className="famledger-view famledger-ledger space-y-4 sm:space-y-6 pb-28 md:pb-6">
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

      </div>

      <section aria-labelledby="transaction-database-heading" className="space-y-4 rounded-2xl border border-brand-line bg-brand-paper p-4 shadow-[var(--fam-shadow)] sm:p-5">
        <h3 id="transaction-database-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-ink">
          <span className="h-6 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Transaction Database
        </h3>

        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
          <span className="sr-only">Search transactions</span>
          <input type="search" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search transactions..." className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-orange/30" />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Category</span>
            <span className="relative block">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value as typeof categoryFilter); setCategoryTypeFilter('all'); }} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-9 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                <option value="all">All Categories</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Category Type</span>
            <select value={categoryTypeFilter} onChange={event => setCategoryTypeFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
              <option value="all">All Types</option>
              {categoryFilter === 'all' && <option value="uncategorized">Uncategorized</option>}
              {availableCategoryTypes.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-brand-muted">Member</span>
            <select value={payerFilter} onChange={event => setPayerFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
              <option value="all">All Members</option>
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
            <span className="text-xs font-medium text-brand-muted">Account Type</span>
            <span className="relative block">
              <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
              <select value={accountTypeFilter} onChange={event => setAccountTypeFilter(event.target.value as typeof accountTypeFilter)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white py-2 pl-10 pr-9 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange/30">
                <option value="all">All Account Types</option>
                <option value="cash">Physical Cash</option>
                <option value="bank">Debit Card</option>
                <option value="credit_card">Credit Card / Credit Line</option>
                <option value="e_wallet">E-Wallet</option>
                <option value="e_wallet_savings">E-Wallet (Savings)</option>
              </select>
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-brand-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" tone="secondary" onClick={handleExportCsv} title="Export filtered transaction ledger to CSV file">
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Export to CSV</span>
          </Button>
          <Button type="button" tone="primary" className="!text-white" onClick={() => {
            setErrorMsg('');
            if (visibleWallets.length > 0) setWalletId(visibleWallets[0].id);
            setCategoryId('');
            setSelectedRecurringId('');
            setSelectedLoanId('');
            setShowCustomNote(false);
            setIsCreditCardPayment(false);
            setShowModal(true);
          }}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Log transaction</span>
          </Button>
        </div>
      </section>

      {/* Desktop Ledger Table (>= md) */}
      <div className="hidden md:block bg-slate-800/80 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-700">
              <tr>
                <th className="py-3 px-4">Date & Type</th>
                <th className="py-3 px-4">Description / Note</th>
                <th className="py-3 px-4">Source Account</th>
                <th className="py-3 px-4">Category / Target</th>
                <th className="py-3 px-4">Logged By</th>
                <th className="py-3 px-4 text-right">Amount (₱)</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                    {transactions.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-2 text-brand-muted not-italic">
                        <NextImage src="/illustrations/empty-ledger.webp" alt="" width={220} height={165} sizes="220px" className="h-28 w-40 object-contain sm:h-32 sm:w-44" />
                        <span>No transaction entries yet.</span>
                      </div>
                    ) : 'No transaction entries found matching your filter criteria.'}
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
                  const serviceFeeAmount = tx.service_fee_amount || 0;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2 font-mono">
                          <span className={`p-1.5 rounded ${
                            tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400' :
                            tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' :
                            tx.type === 'loan' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {tx.type === 'expense' ? <TrendingDown className="w-3.5 h-3.5" /> :
                             tx.type === 'income' ? <TrendingUp className="w-3.5 h-3.5" /> :
                             tx.type === 'loan' ? <Landmark className="w-3.5 h-3.5" /> :
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
                        {tx.type === 'expense' || tx.type === 'income' ? (
                          <span className="text-sky-300 font-medium">{category?.name || 'General'}</span>
                        ) : tx.type === 'transfer' ? (
                          <span className="text-indigo-300 font-medium">➔ {dstWallet?.name || 'Destination'}</span>
                        ) : tx.type === 'loan' ? (
                          <span className="text-amber-300 font-medium">
                            {dstWallet?.wallet_type === 'credit_card'
                              ? `Credit Card / Credit Line → ${dstWallet.name}`
                              : 'Loan Amortization'}
                          </span>
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
                            tx.type === 'loan' ? 'text-amber-400' :
                            'text-indigo-300'
                          }>
                            {tx.type === 'expense' || tx.type === 'loan' ? '-' : tx.type === 'income' ? '+' : ''}
                            ₱{tx.amount.toFixed(2)}
                          </span>
                          {txFee > 0 && (
                            <span className="text-[10px] text-amber-400 font-normal">
                              + Fee: ₱{txFee.toFixed(2)}
                            </span>
                          )}
                          {tx.type === 'loan' && dstWallet?.wallet_type === 'credit_card' && serviceFeeAmount > 0 && (
                            <span className="text-[10px] text-purple-300 font-normal">
                              Service fees paid: ₱{serviceFeeAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {editable ? (
                          <button
                            onClick={() => handleDelete(tx)}
                            title="Delete Transaction"
                            aria-label={`Delete transaction ${tx.note || ''}`}
                            className="p-1 text-rose-800 hover:text-rose-950 hover:bg-rose-50 rounded transition-colors"
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
          transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-line bg-white/70 p-6 text-center text-sm text-brand-muted">
              <NextImage src="/illustrations/empty-ledger.webp" alt="" width={220} height={165} sizes="220px" className="mx-auto h-32 w-44 object-contain" />
              <p className="mt-2">No transaction entries yet.</p>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-6 text-center text-slate-500 italic text-xs">
              No transaction entries match the selected filters.
            </div>
          )
        ) : (
          filteredTx.map(tx => {
            const srcWallet = wallets.find(w => w.id === tx.wallet_id);
            const dstWallet = tx.destination_wallet_id ? wallets.find(w => w.id === tx.destination_wallet_id) : null;
            const category = tx.category_id ? categories.find(c => c.id === tx.category_id) : null;
            const payer = members.find(m => m.id === tx.payer_id);
            const editable = canEditTransaction(tx);
            const txFee = tx.fee || 0;
            const serviceFeeAmount = tx.service_fee_amount || 0;

            return (
              <div 
                key={tx.id} 
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-4 space-y-3 shadow-md"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className={`p-2 rounded-lg ${
                      tx.type === 'expense' ? 'bg-rose-500/10 text-rose-400' :
                      tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' :
                      tx.type === 'loan' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-indigo-500/10 text-indigo-400'
                    }`}>
                      {tx.type === 'expense' ? <TrendingDown className="w-4 h-4" /> :
                       tx.type === 'income' ? <TrendingUp className="w-4 h-4" /> :
                       tx.type === 'loan' ? <Landmark className="w-4 h-4" /> :
                       <ArrowRightLeft className="w-4 h-4" />}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider block">{tx.type}</span>
                      <span className="text-xs text-slate-300 font-mono">{tx.transaction_date}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-base font-bold font-mono block ${
                      tx.type === 'expense' || tx.type === 'loan' ? 'text-rose-400' :
                      tx.type === 'income' ? 'text-emerald-400' :
                      'text-indigo-300'
                    }`}>
                      {tx.type === 'expense' || tx.type === 'loan' ? '-' : tx.type === 'income' ? '+' : ''}
                      ₱{tx.amount.toFixed(2)}
                    </span>
                    {txFee > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono font-medium block">
                        Fee: ₱{txFee.toFixed(2)}
                      </span>
                    )}
                    {tx.type === 'loan' && dstWallet?.wallet_type === 'credit_card' && serviceFeeAmount > 0 && (
                      <span className="text-[10px] text-purple-300 font-mono font-medium block">
                        Service fees paid: ₱{serviceFeeAmount.toFixed(2)}
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
                    {(tx.type === 'expense' || tx.type === 'income') && (
                      <div className="text-slate-400">
                        Category: <strong className="text-sky-300">{category?.name || 'General'}</strong>
                      </div>
                    )}
                    {tx.type === 'transfer' && (
                      <div className="text-slate-400">
                        Destination: <strong className="text-indigo-300">➔ {dstWallet?.name || 'Unknown'}</strong>
                      </div>
                    )}
                    {tx.type === 'loan' && (
                      <div className="text-slate-400">
                        Type: <strong className="text-amber-300">
                          {dstWallet?.wallet_type === 'credit_card' ? 'Credit Card / Credit Line Payment' : 'Loan Amortization Payment'}
                        </strong>
                        {dstWallet?.wallet_type === 'credit_card' && (
                          <span> · <strong className="text-purple-300">{dstWallet.name}</strong></span>
                        )}
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
                        aria-label={`Delete transaction ${tx.note || ''}`}
                        className="p-1.5 text-rose-800 hover:text-rose-950 hover:bg-rose-50 rounded transition-colors"
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
      <Dialog open={showModal} onClose={() => setShowModal(false)} titleId="transaction-dialog-title">
        {showModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 id="transaction-dialog-title" className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>Log New Transaction</span>
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                aria-label="Close transaction dialog"
                className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div role="alert" aria-live="assertive" className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <p id="transaction-type-label" className="mb-1.5 block text-xs font-medium text-slate-300">Transaction Type</p>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2" role="group" aria-labelledby="transaction-type-label">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('expense');
                      setCategoryId('');
                      setSelectedRecurringId('');
                      setSelectedLoanId('');
                      setShowCustomNote(false);
                      setIsCreditCardPayment(false);
                    }}
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
                    onClick={() => {
                      setTxType('income');
                      setCategoryId('');
                      setSelectedRecurringId('');
                      setSelectedLoanId('');
                      setShowCustomNote(false);
                      setIsCreditCardPayment(false);
                    }}
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
                    onClick={() => {
                      setTxType('transfer');
                      setCategoryId('');
                      setSelectedRecurringId('');
                      setSelectedLoanId('');
                      setShowCustomNote(false);
                      setIsCreditCardPayment(false);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      txType === 'transfer'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('loan');
                      setCategoryId('');
                      setSelectedRecurringId('');
                      setSelectedLoanId(loans[0]?.id || '');
                      setShowCustomNote(false);
                      setIsCreditCardPayment(false);
                    }}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                      txType === 'loan'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 ring-1 ring-sky-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Loan
                  </button>
                </div>
              </div>

              {isCreditCardPayment && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <p className="font-bold">Credit Card / Credit Line Payment</p>
                  <p className="mt-1 text-[11px] text-slate-300">Recorded as a loan transaction. Choose the non-credit account that will fund this payment.</p>
                </div>
              )}

              {/* Conditional Dropdown PLACED ABOVE Amount & Fee Fields */}
              {txType === 'expense' && (
                <div>
                  <label htmlFor="recurring-expense" className="block text-xs font-medium text-slate-300 mb-1">Recurring Expenses</label>
                  <select
                    id="recurring-expense"
                    value={selectedRecurringId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedRecurringId(val);
                      if (val === 'others') {
                        setShowCustomNote(true);
                        setNote('');
                      } else if (val) {
                        const r = recurringTransfers.find(item => item.id === val);
                        if (r) {
                          setAmount(r.amount.toString());
                          setWalletId(r.source_wallet_id);
                          if (r.category_id) setCategoryId(r.category_id);
                          setNote(r.note);
                          setShowCustomNote(false);
                        }
                      } else {
                        setShowCustomNote(false);
                      }
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Recurring Expense (Optional) --</option>
                    {recurringTransfers.filter(r => r.rule_type === 'expense').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.note} (₱{r.amount.toFixed(2)})
                      </option>
                    ))}
                    <option value="others">+ Others (Custom Expense)</option>
                  </select>
                </div>
              )}

              {txType === 'transfer' && (
                <div>
                  <label htmlFor="recurring-transfer" className="block text-xs font-medium text-slate-300 mb-1">Recurring Transfer</label>
                  <select
                    id="recurring-transfer"
                    value={selectedRecurringId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedRecurringId(val);
                      if (val === 'others') {
                        setShowCustomNote(true);
                        setNote('');
                      } else if (val) {
                        const r = recurringTransfers.find(item => item.id === val);
                        if (r) {
                          setAmount(r.amount.toString());
                          setWalletId(r.source_wallet_id);
                          if (r.destination_wallet_id) setDestWalletId(r.destination_wallet_id);
                          if (r.category_id) setCategoryId(r.category_id);
                          setNote(r.note);
                          setShowCustomNote(false);
                        }
                      } else {
                        setShowCustomNote(false);
                      }
                    }}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Recurring Transfer (Optional) --</option>
                    {recurringTransfers.filter(r => r.rule_type === 'transfer').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.note} (₱{r.amount.toFixed(2)})
                      </option>
                    ))}
                    <option value="others">+ Others (Custom Transfer)</option>
                  </select>
                </div>
              )}

              {txType === 'loan' && !isCreditCardPayment && (
                <div>
                  <label htmlFor="recurring-loan" className="block text-xs font-medium text-slate-300 mb-1">Loan Payments</label>
                  <select
                    id="recurring-loan"
                    value={selectedRecurringId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedRecurringId(val);
                      if (val === 'others') {
                        setShowCustomNote(true);
                        setNote('');
                      } else if (val) {
                        const r = recurringTransfers.find(item => item.id === val);
                        if (r) {
                          setAmount(r.amount.toString());
                          setWalletId(r.source_wallet_id);
                          if (r.loan_id) setSelectedLoanId(r.loan_id);
                          setCategoryId(r.category_id || '');
                          setNote(r.note);
                          setShowCustomNote(false);
                        }
                      } else {
                        setShowCustomNote(false);
                      }
                    }}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                  >
                    <option value="">-- Select Loan Payment Rule (Optional) --</option>
                    {recurringTransfers.filter(r => r.rule_type === 'loan_payment').map(r => (
                      <option key={r.id} value={r.id}>
                        {r.note} (₱{r.amount.toFixed(2)})
                      </option>
                    ))}
                    <option value="others">+ Others (Custom Loan Payment)</option>
                  </select>
                </div>
              )}

              {/* Custom entry field when Others is selected */}
              {(selectedRecurringId === 'others' || showCustomNote) && (
                <div>
                  <label htmlFor="custom-transaction-note" className="block text-xs font-medium text-amber-400 mb-1 font-mono">
                    Custom {txType.toUpperCase()} Title / Description
                  </label>
                  <input
                    id="custom-transaction-note"
                    type="text"
                    required
                    placeholder={`Indicate custom ${txType} transaction...`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-amber-500/50 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Amount & Fee Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="transaction-amount" className="block text-xs font-medium text-slate-300 mb-1">Amount (₱ PHP)</label>
                  <input
                    id="transaction-amount"
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
                  <label htmlFor="transaction-fee" className="block text-xs font-medium text-slate-300 mb-1">Transaction Fee (₱)</label>
                  <input
                    id="transaction-fee"
                    type="number"
                    step="0.01"
                    placeholder="0.00 (Optional)"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>
              </div>

              {isCreditCardPayment && cardPaymentAllocation && (
                <CreditCardPaymentPreview
                  allocation={cardPaymentAllocation}
                  transactionFee={parsedTransactionFee}
                  totalCashDeducted={totalCashDeducted}
                />
              )}

              {/* Source Wallet */}
              <div>
                <label htmlFor="source-wallet" className="block text-xs font-medium text-slate-300 mb-1">
                  {isCreditCardPayment
                    ? 'Funding Account'
                    : selectedWallet?.wallet_type === 'credit_card' && txType === 'expense'
                      ? 'Credit Card to Charge'
                      : 'Source Wallet Account'}
                </label>
                <select
                  id="source-wallet"
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  required
                  disabled={isFundingAccountLocked}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">
                    {isFundingAccountLocked
                      ? '-- Required Maya Wallet - Steve not found --'
                      : '-- Select Funding Account --'}
                  </option>
                  {visibleWallets.filter(w => !isCreditCardPayment || w.wallet_type !== 'credit_card').map(w => (
                    <option key={w.id} value={w.id}>
                      {formatWalletOption(w)}
                    </option>
                  ))}
                </select>
                {selectedWallet?.wallet_type === 'credit_card' && (
                  <p className="mt-1 text-[11px] text-purple-300">
                    Card expenses increase used balance. Transfers into this card reduce used balance.
                  </p>
                )}
                {isFundingAccountLocked && requiredFundingWalletId && (
                  <p className="mt-1 text-[11px] text-sky-300">
                    Required funding account for Maya Credit and Maya Black payments.
                  </p>
                )}
                {isFundingAccountLocked && !requiredFundingWalletId && (
                  <p className="mt-1 text-[11px] text-red-300">
                    Required account &quot;Maya Wallet - Steve&quot; was not found.
                  </p>
                )}
              </div>

              {/* Category for Income or Expense */}
              {(txType === 'expense' || txType === 'income') && (
                <div>
                  <label htmlFor="transaction-category" className="block text-xs font-medium text-slate-300 mb-1">
                    {txType === 'income' ? 'Income Category' : 'Expense Category'}
                  </label>
                  <select
                    id="transaction-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- General {txType === 'income' ? 'Income' : 'Expense'} --</option>
                    {transactionCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Destination Wallet for Transfer or Credit Card Payment */}
              {(txType === 'transfer' || isCreditCardPayment) && (
                <div>
                <label htmlFor="destination-wallet" className="block text-xs font-medium text-slate-300 mb-1">
                    {isCreditCardPayment ? 'Credit Card / Credit Line' : 'Destination Wallet Account'}
                  </label>
                  <select
                    id="destination-wallet"
                    value={destWalletId}
                    onChange={(e) => setDestWalletId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {visibleWallets.filter(w => !isCreditCardPayment || w.wallet_type === 'credit_card').map(w => (
                      <option key={w.id} value={w.id}>
                        {formatWalletOption(w)}
                      </option>
                    ))}
                  </select>
                  {getCreditCardDestinationHelpText(isCreditCardPayment, selectedDestinationWallet?.wallet_type) && (
                    <p className="mt-1 text-[11px] text-purple-300">
                      {getCreditCardDestinationHelpText(isCreditCardPayment, selectedDestinationWallet?.wallet_type)}
                    </p>
                  )}
                </div>
              )}

              {/* Associated Loan Item for Loan Payment */}
              {txType === 'loan' && !isCreditCardPayment && (
                <div>
                  <label htmlFor="associated-loan" className="block text-xs font-medium text-slate-300 mb-1">Associated Loan Item</label>
                  <select
                    id="associated-loan"
                    value={selectedLoanId}
                    onChange={(e) => {
                      const lId = e.target.value;
                      setSelectedLoanId(lId);
                      const foundLoan = loans.find(l => l.id === lId);
                      if (foundLoan) {
                        if (!amount) setAmount(foundLoan.monthly_amortization.toString());
                        if (!walletId && foundLoan.source_wallet_id) setWalletId(foundLoan.source_wallet_id);
                        if (!note) setNote(`Loan Amortization - ${foundLoan.name}`);
                      }
                    }}
                    className="w-full bg-slate-800 text-amber-300 text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                  >
                    <option value="">-- Select Associated Loan --</option>
                    {loans.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.lender}) - Bal: ₱{l.remaining_balance.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {txType === 'loan' && !isCreditCardPayment && (
                <div>
                  <label htmlFor="loan-expense-category" className="block text-xs font-medium text-slate-300 mb-1">Expense Category</label>
                  <select
                    id="loan-expense-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- Select Expense Category (Optional) --</option>
                    {categories.filter(category => category.category_type === 'expense').map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note / Description */}
              {selectedRecurringId !== 'others' && !showCustomNote && (
                <div>
                  <label htmlFor="transaction-note" className="block text-xs font-medium text-slate-300 mb-1 font-sans">Description / Note</label>
                  <input
                    id="transaction-note"
                    type="text"
                    placeholder="e.g. Weekly Groceries, InstaPay Transfer, Load"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              )}

              {/* Transaction Date */}
              <div>
                <label htmlFor="transaction-date" className="block text-xs font-medium text-slate-300 mb-1">Transaction Date</label>
                <input
                  id="transaction-date"
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                />
              </div>

              {/* Optional Receipt Attachment Upload */}
              <div>
                <p className="mb-1 block text-xs font-medium text-slate-300">Receipt Attachment (Optional)</p>
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
        )}
      </Dialog>
    </div>
  );
};
