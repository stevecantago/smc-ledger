'use client';

import React, { createContext, useContext, useState } from 'react';
import { 
  Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal, 
  Loan, RecurringTransfer, HouseholdRole, RecurringRuleType, RecurringFrequency 
} from '../types/database';
import { 
  initialHousehold, 
  initialMembers, 
  initialWallets, 
  initialCategories, 
  initialTransactions, 
  initialSavingsGoals,
  initialLoans,
  initialRecurringTransfers
} from '../lib/supabase';

interface HouseholdContextType {
  household: Household;
  currentMember: HouseholdMember;
  members: HouseholdMember[];
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  loans: Loan[];
  recurringTransfers: RecurringTransfer[];
  isAdmin: boolean;
  
  // Role & User Switching
  switchMember: (memberId: string) => void;
  
  // Actions
  addWallet: (wallet: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number }) => void;
  addCategory: (category: { name: string; icon_slug: string; monthly_budget_limit: number }) => void;
  updateCategoryLimit: (id: string, limit: number) => void;
  addTransaction: (tx: { wallet_id: string; destination_wallet_id?: string | null; category_id?: string | null; type: Transaction['type']; amount: number; transaction_date: string; note?: string; receipt_url?: string }) => { success: boolean; error?: string };
  updateTransaction: (id: string, updates: Partial<Transaction>) => { success: boolean; error?: string };
  deleteTransaction: (id: string) => { success: boolean; error?: string };
  addSavingsGoal: (goal: { name: string; target_amount: number; target_date?: string }) => void;
  fundSavingsGoal: (goalId: string, amount: number, walletId: string) => { success: boolean; error?: string };
  
  // Loans Actions
  addLoan: (loan: { name: string; lender: string; total_principal: number; interest_rate_annual: number; monthly_amortization: number; due_day_of_month: number }) => void;
  payLoanAmortization: (loanId: string, amount: number, walletId: string) => { success: boolean; error?: string };
  
  // Recurring Transfers & Bills Actions
  addRecurringTransfer: (rule: { 
    rule_type: RecurringRuleType;
    source_wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    note: string 
  }) => void;
  toggleRecurringTransfer: (id: string) => void;

  addMember: (displayName: string, role: HouseholdRole) => void;
  
  // Security Checks
  canEditTransaction: (tx: Transaction) => boolean;
  canDeleteTransaction: (tx: Transaction) => boolean;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household] = useState<Household>(initialHousehold);
  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers);
  const [currentMember, setCurrentMember] = useState<HouseholdMember>(initialMembers[0]);
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(initialSavingsGoals);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [recurringTransfers, setRecurringTransfers] = useState<RecurringTransfer[]>(initialRecurringTransfers);

  const isAdmin = currentMember.role === 'admin';

  const canEditTransaction = (tx: Transaction): boolean => {
    if (isAdmin) return true;
    if (tx.payer_id !== currentMember.id) return false;
    const createdAtTime = new Date(tx.created_at).getTime();
    const nowTime = Date.now();
    const diffHours = (nowTime - createdAtTime) / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  const canDeleteTransaction = (tx: Transaction): boolean => {
    return canEditTransaction(tx);
  };

  const switchMember = (memberId: string) => {
    const found = members.find(m => m.id === memberId);
    if (found) {
      setCurrentMember(found);
    }
  };

  const addWallet = (data: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number }) => {
    if (!isAdmin && data.is_shared) {
      alert("Only Household Admins can create shared wallets.");
      return;
    }
    const newWallet: Wallet = {
      id: `wallet-${Date.now()}`,
      household_id: household.id,
      owner_id: data.owner_id || currentMember.id,
      name: data.name,
      wallet_type: data.wallet_type,
      is_shared: data.is_shared,
      current_balance: data.initial_balance,
      created_at: new Date().toISOString(),
    };
    setWallets(prev => [...prev, newWallet]);
  };

  const addCategory = (data: { name: string; icon_slug: string; monthly_budget_limit: number }) => {
    if (!isAdmin) {
      alert("Only Household Admins can create categories.");
      return;
    }
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      household_id: household.id,
      name: data.name,
      icon_slug: data.icon_slug,
      monthly_budget_limit: data.monthly_budget_limit,
      created_at: new Date().toISOString(),
    };
    setCategories(prev => [...prev, newCat]);
  };

  const updateCategoryLimit = (id: string, limit: number) => {
    if (!isAdmin) {
      alert("Only Household Admins can edit monthly budget limits.");
      return;
    }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, monthly_budget_limit: limit } : c));
  };

  const addTransaction = (data: { 
    wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null; 
    type: Transaction['type']; 
    amount: number; 
    transaction_date: string; 
    note?: string; 
    receipt_url?: string 
  }) => {
    const sourceWallet = wallets.find(w => w.id === data.wallet_id);
    if (!sourceWallet) return { success: false, error: 'Source wallet not found' };

    let updatedWallets = [...wallets];

    if (data.type === 'expense') {
      updatedWallets = updatedWallets.map(w => w.id === data.wallet_id ? { ...w, current_balance: w.current_balance - data.amount } : w);
    } else if (data.type === 'income') {
      updatedWallets = updatedWallets.map(w => w.id === data.wallet_id ? { ...w, current_balance: w.current_balance + data.amount } : w);
    } else if (data.type === 'transfer') {
      if (!data.destination_wallet_id) return { success: false, error: 'Destination wallet required for transfers' };
      const destWallet = wallets.find(w => w.id === data.destination_wallet_id);
      if (!destWallet) return { success: false, error: 'Destination wallet not found' };

      updatedWallets = updatedWallets.map(w => {
        if (w.id === data.wallet_id) return { ...w, current_balance: w.current_balance - data.amount };
        if (w.id === data.destination_wallet_id) return { ...w, current_balance: w.current_balance + data.amount };
        return w;
      });
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      household_id: household.id,
      wallet_id: data.wallet_id,
      destination_wallet_id: data.destination_wallet_id || null,
      category_id: data.category_id || null,
      payer_id: currentMember.id,
      type: data.type,
      amount: data.amount,
      transaction_date: data.transaction_date,
      note: data.note || null,
      receipt_url: data.receipt_url || null,
      created_at: new Date().toISOString(),
    };

    setWallets(updatedWallets);
    setTransactions(prev => [newTx, ...prev]);
    return { success: true };
  };

  const updateTransaction = (id: string, updates: Partial<Transaction>) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return { success: false, error: 'Transaction not found' };

    if (!canEditTransaction(target)) {
      return { 
        success: false, 
        error: 'Permission Denied: Members can only edit their own transactions within 24 hours of creation.' 
      };
    }

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    return { success: true };
  };

  const deleteTransaction = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return { success: false, error: 'Transaction not found' };

    if (!canDeleteTransaction(target)) {
      return { 
        success: false, 
        error: 'Permission Denied: Members can only delete their own transactions within 24 hours of creation.' 
      };
    }

    let updatedWallets = [...wallets];
    if (target.type === 'expense') {
      updatedWallets = updatedWallets.map(w => w.id === target.wallet_id ? { ...w, current_balance: w.current_balance + target.amount } : w);
    } else if (target.type === 'income') {
      updatedWallets = updatedWallets.map(w => w.id === target.wallet_id ? { ...w, current_balance: w.current_balance - target.amount } : w);
    } else if (target.type === 'transfer') {
      updatedWallets = updatedWallets.map(w => {
        if (w.id === target.wallet_id) return { ...w, current_balance: w.current_balance + target.amount };
        if (w.id === target.destination_wallet_id) return { ...w, current_balance: w.current_balance - target.amount };
        return w;
      });
    }

    setWallets(updatedWallets);
    setTransactions(prev => prev.filter(t => t.id !== id));
    return { success: true };
  };

  const addSavingsGoal = (data: { name: string; target_amount: number; target_date?: string }) => {
    if (!isAdmin) {
      alert("Only Household Admins can create savings goals.");
      return;
    }
    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      household_id: household.id,
      name: data.name,
      target_amount: data.target_amount,
      current_amount: 0,
      target_date: data.target_date || null,
      created_at: new Date().toISOString(),
    };
    setSavingsGoals(prev => [...prev, newGoal]);
  };

  const fundSavingsGoal = (goalId: string, amount: number, walletId: string) => {
    const sourceWallet = wallets.find(w => w.id === walletId);
    if (!sourceWallet) return { success: false, error: 'Wallet not found' };
    if (sourceWallet.current_balance < amount) {
      return { success: false, error: 'Insufficient funds in selected wallet' };
    }

    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, current_balance: w.current_balance - amount } : w));
    setSavingsGoals(prev => prev.map(g => g.id === goalId ? { ...g, current_amount: g.current_amount + amount } : g));

    addTransaction({
      wallet_id: walletId,
      type: 'expense',
      amount: amount,
      transaction_date: new Date().toISOString().split('T')[0],
      note: `Contribution to goal: ${savingsGoals.find(g => g.id === goalId)?.name}`,
    });

    return { success: true };
  };

  const addLoan = (data: { name: string; lender: string; total_principal: number; interest_rate_annual: number; monthly_amortization: number; due_day_of_month: number }) => {
    if (!isAdmin) {
      alert("Only Household Admins can create loan records.");
      return;
    }
    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      household_id: household.id,
      name: data.name,
      lender: data.lender,
      total_principal: data.total_principal,
      remaining_balance: data.total_principal,
      interest_rate_annual: data.interest_rate_annual,
      monthly_amortization: data.monthly_amortization,
      due_day_of_month: data.due_day_of_month,
      start_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    setLoans(prev => [...prev, newLoan]);
  };

  const payLoanAmortization = (loanId: string, amount: number, walletId: string) => {
    const targetLoan = loans.find(l => l.id === loanId);
    if (!targetLoan) return { success: false, error: 'Loan record not found' };

    const sourceWallet = wallets.find(w => w.id === walletId);
    if (!sourceWallet) return { success: false, error: 'Source wallet account not found' };

    if (sourceWallet.current_balance < amount) {
      return { success: false, error: 'Insufficient wallet balance for amortization payment' };
    }

    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, current_balance: w.current_balance - amount } : w));
    setLoans(prev => prev.map(l => l.id === loanId ? { ...l, remaining_balance: Math.max(0, l.remaining_balance - amount) } : l));

    addTransaction({
      wallet_id: walletId,
      type: 'expense',
      amount: amount,
      transaction_date: new Date().toISOString().split('T')[0],
      note: `Amortization payment for: ${targetLoan.name} (${targetLoan.lender})`,
    });

    return { success: true };
  };

  const addRecurringTransfer = (data: { 
    rule_type: RecurringRuleType;
    source_wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    note: string 
  }) => {
    if (!isAdmin) {
      alert("Only Household Admins can configure recurring bill & transfer rules.");
      return;
    }
    const newRule: RecurringTransfer = {
      id: `recurring-${Date.now()}`,
      household_id: household.id,
      rule_type: data.rule_type,
      source_wallet_id: data.source_wallet_id,
      destination_wallet_id: data.destination_wallet_id || null,
      category_id: data.category_id || null,
      amount: data.amount,
      frequency: data.frequency,
      next_run_date: new Date(Date.now() + (data.frequency === 'weekly' ? 7 : 30) * 86400000).toISOString().split('T')[0],
      note: data.note,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setRecurringTransfers(prev => [...prev, newRule]);
  };

  const toggleRecurringTransfer = (id: string) => {
    if (!isAdmin) return;
    setRecurringTransfers(prev => prev.map(r => r.id === id ? { ...r, is_active: !r.is_active } : r));
  };

  const addMember = (displayName: string, role: HouseholdRole) => {
    if (!isAdmin) {
      alert("Only Household Admins can add or invite new members.");
      return;
    }
    const newMember: HouseholdMember = {
      id: `member-${Date.now()}`,
      household_id: household.id,
      user_id: `usr-${Date.now()}`,
      role: role,
      display_name: displayName,
      created_at: new Date().toISOString(),
    };
    setMembers(prev => [...prev, newMember]);
  };

  return (
    <HouseholdContext.Provider value={{
      household,
      currentMember,
      members,
      wallets,
      categories,
      transactions,
      savingsGoals,
      loans,
      recurringTransfers,
      isAdmin,
      switchMember,
      addWallet,
      addCategory,
      updateCategoryLimit,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addSavingsGoal,
      fundSavingsGoal,
      addLoan,
      payLoanAmortization,
      addRecurringTransfer,
      toggleRecurringTransfer,
      addMember,
      canEditTransaction,
      canDeleteTransaction,
    }}>
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
