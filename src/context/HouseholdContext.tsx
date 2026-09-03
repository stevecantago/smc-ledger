'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  initialRecurringTransfers,
  supabase
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
  
  // Wallets CRUD
  addWallet: (wallet: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number; credit_limit?: number | null }) => void;
  updateWallet: (id: string, updates: { name?: string; wallet_type?: Wallet['wallet_type']; current_balance?: number; credit_limit?: number | null; is_shared?: boolean }) => { success: boolean; error?: string };
  deleteWallet: (id: string) => { success: boolean; error?: string };

  // Categories CRUD
  addCategory: (category: { name: string; icon_slug: string; monthly_budget_limit: number }) => void;
  updateCategory: (id: string, updates: { name?: string; icon_slug?: string; monthly_budget_limit?: number }) => { success: boolean; error?: string };
  updateCategoryLimit: (id: string, limit: number) => void;
  deleteCategory: (id: string) => { success: boolean; error?: string };

  // Transactions CRUD
  addTransaction: (tx: { wallet_id: string; destination_wallet_id?: string | null; category_id?: string | null; type: Transaction['type']; amount: number; transaction_date: string; note?: string; receipt_url?: string }) => { success: boolean; error?: string };
  updateTransaction: (id: string, updates: Partial<Transaction>) => { success: boolean; error?: string };
  deleteTransaction: (id: string) => { success: boolean; error?: string };

  // Savings Goals CRUD
  addSavingsGoal: (goal: { name: string; target_amount: number; target_date?: string }) => void;
  updateSavingsGoal: (id: string, updates: { name?: string; target_amount?: number; target_date?: string | null }) => { success: boolean; error?: string };
  deleteSavingsGoal: (id: string) => { success: boolean; error?: string };
  fundSavingsGoal: (goalId: string, amount: number, walletId: string) => { success: boolean; error?: string };
  
  // Loans CRUD
  addLoan: (loan: { name: string; lender: string; total_principal: number; interest_rate_annual: number; monthly_amortization: number; due_day_of_month: number }) => void;
  updateLoan: (id: string, updates: { name?: string; lender?: string; total_principal?: number; remaining_balance?: number; interest_rate_annual?: number; monthly_amortization?: number; due_day_of_month?: number }) => { success: boolean; error?: string };
  deleteLoan: (id: string) => { success: boolean; error?: string };
  payLoanAmortization: (loanId: string, amount: number, walletId: string) => { success: boolean; error?: string };
  
  // Recurring Transfers & Bills CRUD
  addRecurringTransfer: (rule: { 
    rule_type: RecurringRuleType;
    source_wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    custom_interval_days?: number | null;
    note: string 
  }) => void;
  toggleRecurringTransfer: (id: string) => void;
  deleteRecurringTransfer: (id: string) => { success: boolean; error?: string };

  // Family Roster CRUD Actions
  addMember: (displayName: string, role: HouseholdRole, email?: string) => void;
  updateMember: (id: string, updates: { display_name?: string; role?: HouseholdRole; email?: string }) => { success: boolean; error?: string };
  deleteMember: (id: string) => { success: boolean; error?: string };
  
  // Security Checks
  canEditTransaction: (tx: Transaction) => boolean;
  canDeleteTransaction: (tx: Transaction) => boolean;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household] = useState<Household>(initialHousehold);
  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers);
  // Default active profile: Steve Cantago (steve.cantago@gmail.com)
  const [currentMember, setCurrentMember] = useState<HouseholdMember>(initialMembers[0]);
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(initialSavingsGoals);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [recurringTransfers, setRecurringTransfers] = useState<RecurringTransfer[]>(initialRecurringTransfers);

  // Bind Supabase Auth listener & local persistent session if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('smc_authenticated_email');
      if (storedEmail) {
        const found = members.find(m => m.email?.toLowerCase() === storedEmail.toLowerCase());
        if (found) setCurrentMember(found);
      }
    }

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          const userEmail = session.user.email;
          const found = members.find(m => m.email?.toLowerCase() === userEmail.toLowerCase());
          if (found) setCurrentMember(found);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user?.email) {
          const userEmail = session.user.email;
          const found = members.find(m => m.email?.toLowerCase() === userEmail.toLowerCase());
          if (found) setCurrentMember(found);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [members]);

  // Head Admin and Member (Parent/Guardian) have parent administrative privileges
  const isAdmin = currentMember.role === 'admin' || currentMember.role === 'parent_member';

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

  // Wallets CRUD
  const addWallet = (data: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number; credit_limit?: number | null }) => {
    if (!isAdmin && data.is_shared) {
      alert("Only Household Parents/Admins can create shared wallets.");
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
      credit_limit: data.credit_limit || null,
      created_at: new Date().toISOString(),
    };
    setWallets(prev => [...prev, newWallet]);
  };

  const updateWallet = (id: string, updates: { name?: string; wallet_type?: Wallet['wallet_type']; current_balance?: number; credit_limit?: number | null; is_shared?: boolean }) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can edit wallet accounts.' };
    setWallets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    return { success: true };
  };

  const deleteWallet = (id: string) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can delete wallet accounts.' };
    setWallets(prev => prev.filter(w => w.id !== id));
    return { success: true };
  };

  // Categories CRUD
  const addCategory = (data: { name: string; icon_slug: string; monthly_budget_limit: number }) => {
    if (!isAdmin) {
      alert("Only Household Parents/Admins can create categories.");
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

  const updateCategory = (id: string, updates: { name?: string; icon_slug?: string; monthly_budget_limit?: number }) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can edit category envelopes.' };
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    return { success: true };
  };

  const updateCategoryLimit = (id: string, limit: number) => {
    updateCategory(id, { monthly_budget_limit: limit });
  };

  const deleteCategory = (id: string) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can delete category envelopes.' };
    setCategories(prev => prev.filter(c => c.id !== id));
    return { success: true };
  };

  // Transactions CRUD
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

  // Savings Goals CRUD
  const addSavingsGoal = (data: { name: string; target_amount: number; target_date?: string }) => {
    if (!isAdmin) {
      alert("Only Household Parents/Admins can create savings goals.");
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

  const updateSavingsGoal = (id: string, updates: { name?: string; target_amount?: number; target_date?: string | null }) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can edit savings goals.' };
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    return { success: true };
  };

  const deleteSavingsGoal = (id: string) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can delete savings goals.' };
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    return { success: true };
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

  // Loans CRUD
  const addLoan = (data: { name: string; lender: string; total_principal: number; interest_rate_annual: number; monthly_amortization: number; due_day_of_month: number }) => {
    if (!isAdmin) {
      alert("Only Household Parents/Admins can create loan records.");
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

  const updateLoan = (id: string, updates: { name?: string; lender?: string; total_principal?: number; remaining_balance?: number; interest_rate_annual?: number; monthly_amortization?: number; due_day_of_month?: number }) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can edit loan records.' };
    setLoans(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    return { success: true };
  };

  const deleteLoan = (id: string) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can delete loan records.' };
    setLoans(prev => prev.filter(l => l.id !== id));
    return { success: true };
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

  const getDaysOffset = (freq: RecurringFrequency, customDays?: number | null): number => {
    switch (freq) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'biweekly': return 14;
      case 'monthly': return 30;
      case 'quarterly': return 90;
      case 'semi_annual': return 180;
      case 'annual': return 365;
      case 'custom_days': return customDays || 1;
      default: return 30;
    }
  };

  const addRecurringTransfer = (data: { 
    rule_type: RecurringRuleType;
    source_wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    custom_interval_days?: number | null;
    note: string 
  }) => {
    if (!isAdmin) {
      alert("Only Household Parents/Admins can configure recurring bill & transfer rules.");
      return;
    }
    const daysOffset = getDaysOffset(data.frequency, data.custom_interval_days);
    const newRule: RecurringTransfer = {
      id: `recurring-${Date.now()}`,
      household_id: household.id,
      rule_type: data.rule_type,
      source_wallet_id: data.source_wallet_id,
      destination_wallet_id: data.destination_wallet_id || null,
      category_id: data.category_id || null,
      amount: data.amount,
      frequency: data.frequency,
      custom_interval_days: data.custom_interval_days || null,
      next_run_date: new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0],
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

  const deleteRecurringTransfer = (id: string) => {
    if (!isAdmin) return { success: false, error: 'Only Household Parents/Admins can delete recurring schedule rules.' };
    setRecurringTransfers(prev => prev.filter(r => r.id !== id));
    return { success: true };
  };

  const addMember = (displayName: string, role: HouseholdRole, email?: string) => {
    if (!isAdmin) {
      alert("Only Household Parents/Admins can add or invite new members.");
      return;
    }
    const newMember: HouseholdMember = {
      id: `member-${Date.now()}`,
      household_id: household.id,
      user_id: `usr-${Date.now()}`,
      role: role,
      display_name: displayName,
      email: email || undefined,
      created_at: new Date().toISOString(),
    };
    setMembers(prev => [...prev, newMember]);
  };

  const updateMember = (id: string, updates: { display_name?: string; role?: HouseholdRole; email?: string }) => {
    if (!isAdmin) {
      return { success: false, error: 'Only Household Parents/Admins can edit family roster members.' };
    }

    const target = members.find(m => m.id === id);
    if (!target) return { success: false, error: 'Member record not found.' };

    if (updates.role && updates.role === 'member' && (target.role === 'admin' || target.role === 'parent_member')) {
      const adminCount = members.filter(m => m.role === 'admin' || m.role === 'parent_member').length;
      if (adminCount <= 1) {
        return { success: false, error: 'Cannot demote the last remaining Parent/Admin in the household.' };
      }
    }

    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    
    if (currentMember.id === id) {
      setCurrentMember(prev => ({ ...prev, ...updates }));
    }

    return { success: true };
  };

  const deleteMember = (id: string) => {
    if (!isAdmin) {
      return { success: false, error: 'Only Household Parents/Admins can remove family roster members.' };
    }

    if (currentMember.id === id) {
      return { success: false, error: 'Cannot remove your own active logged-in member profile. Switch to another Admin profile first.' };
    }

    const target = members.find(m => m.id === id);
    if (!target) return { success: false, error: 'Member record not found.' };

    if (target.role === 'admin' || target.role === 'parent_member') {
      const adminCount = members.filter(m => m.role === 'admin' || m.role === 'parent_member').length;
      if (adminCount <= 1) {
        return { success: false, error: 'Cannot remove the last remaining Parent/Admin in the household.' };
      }
    }

    setMembers(prev => prev.filter(m => m.id !== id));
    return { success: true };
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
      updateWallet,
      deleteWallet,
      addCategory,
      updateCategory,
      updateCategoryLimit,
      deleteCategory,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addSavingsGoal,
      updateSavingsGoal,
      deleteSavingsGoal,
      fundSavingsGoal,
      addLoan,
      updateLoan,
      deleteLoan,
      payLoanAmortization,
      addRecurringTransfer,
      toggleRecurringTransfer,
      deleteRecurringTransfer,
      addMember,
      updateMember,
      deleteMember,
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
