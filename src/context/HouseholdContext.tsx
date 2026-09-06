'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal, 
  Loan, RecurringTransfer, HouseholdRole, RecurringRuleType, RecurringFrequency, LoanPaymentFrequency,
  ActivityLogEntry, ActivityLogAction, HouseholdCustomRole, RolePermission, PermissionKey, PermissionLevel
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
  initialCustomRoles,
  initialRolePermissions,
  supabase
} from '../lib/supabase';
import { linkMemberToAuthenticatedUser, resolveAuthenticatedMember } from '../lib/authProfile';
import { getSyncFailureWarning, getSyncStatus, MutationResult } from '../lib/persistence';
import { AUTH_STORAGE_KEYS, STORAGE_KEYS, clearAuthStorage, clearHouseholdStorage } from '../lib/storageKeys';
import {
  canDeleteRole,
  canUpdateRolePermission,
  getEffectiveRoleId,
  getPermissionLevel,
  hasPermission as hasRolePermission,
  isHeadParent as getIsHeadParent,
} from '../lib/permissions';
import { applyTransactionBalanceChange, normalizeCreditCardWalletBalance, reverseTransactionBalanceChange } from '../lib/creditCardTransactions';

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
  activityLogs: ActivityLogEntry[];
  customRoles: HouseholdCustomRole[];
  rolePermissions: RolePermission[];
  isAdmin: boolean;
  isHeadParent: boolean;
  syncWarning: string | null;
  clearSyncWarning: () => void;
  resetDemoData: () => MutationResult;
  hasPermission: (key: PermissionKey, ownerMemberId?: string | null) => boolean;
  
  // Role & User Switching
  switchMember: (memberId: string) => void;
  
  // Activity Logging & Backup/Restoration
  logActivity: (action: ActivityLogAction, description: string, details?: any) => MutationResult;
  exportFullHouseholdBackup: () => void;
  restoreFullHouseholdBackup: (jsonContent: string) => { success: boolean; error?: string };

  // Wallets CRUD
  addWallet: (wallet: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number; credit_limit?: number | null }) => MutationResult;
  updateWallet: (id: string, updates: { name?: string; wallet_type?: Wallet['wallet_type']; current_balance?: number; credit_limit?: number | null; is_shared?: boolean }) => MutationResult;
  deleteWallet: (id: string) => MutationResult;

  // Categories CRUD
  addCategory: (category: { name: string; icon_slug: string; monthly_budget_limit: number }) => MutationResult;
  updateCategory: (id: string, updates: { name?: string; icon_slug?: string; monthly_budget_limit?: number }) => MutationResult;
  updateCategoryLimit: (id: string, limit: number) => MutationResult;
  deleteCategory: (id: string) => MutationResult;

  // Transactions CRUD
  addTransaction: (tx: { wallet_id: string; destination_wallet_id?: string | null; category_id?: string | null; type: Transaction['type']; amount: number; fee?: number | null; transaction_date: string; note?: string; receipt_url?: string }) => MutationResult;
  updateTransaction: (id: string, updates: Partial<Transaction>) => MutationResult;
  deleteTransaction: (id: string) => MutationResult;

  // Savings Goals CRUD
  addSavingsGoal: (goal: { name: string; target_amount: number; target_date?: string }) => MutationResult;
  updateSavingsGoal: (id: string, updates: { name?: string; target_amount?: number; target_date?: string | null }) => MutationResult;
  deleteSavingsGoal: (id: string) => MutationResult;
  fundSavingsGoal: (goalId: string, amount: number, walletId: string) => MutationResult;
  
  // Loans CRUD
  addLoan: (loan: { 
    name: string; 
    lender: string; 
    source_wallet_id?: string | null;
    total_principal: number; 
    total_amortizations?: number | null;
    paid_amortizations_count?: number | null;
    remaining_balance?: number;
    amount_paid?: number;
    interest_rate_annual: number; 
    monthly_amortization: number; 
    payment_frequency?: LoanPaymentFrequency;
    due_day_of_month?: number;
    second_due_day_of_month?: number | null;
    next_due_date?: string | null;
  }) => MutationResult;
  updateLoan: (id: string, updates: { 
    name?: string; 
    lender?: string; 
    source_wallet_id?: string | null;
    total_principal?: number; 
    total_amortizations?: number | null;
    paid_amortizations_count?: number | null;
    remaining_balance?: number; 
    amount_paid?: number;
    interest_rate_annual?: number; 
    monthly_amortization?: number; 
    payment_frequency?: LoanPaymentFrequency;
    due_day_of_month?: number;
    second_due_day_of_month?: number | null;
    next_due_date?: string | null;
  }) => MutationResult;
  deleteLoan: (id: string) => MutationResult;
  payLoanAmortization: (loanId: string, amount: number, walletId: string) => MutationResult;
  
  // Recurring Transfers & Bills CRUD
  addRecurringTransfer: (rule: { 
    rule_type: RecurringRuleType;
    source_wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    loan_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    custom_interval_days?: number | null;
    next_run_date?: string | null;
    note: string 
  }) => MutationResult;
  updateRecurringTransfer: (id: string, updates: { 
    rule_type?: RecurringRuleType;
    source_wallet_id?: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    loan_id?: string | null;
    amount?: number; 
    frequency?: RecurringFrequency; 
    custom_interval_days?: number | null;
    next_run_date?: string;
    note?: string;
    is_active?: boolean;
  }) => MutationResult;
  toggleRecurringTransfer: (id: string) => MutationResult;
  deleteRecurringTransfer: (id: string) => MutationResult;

  // Family Roster CRUD Actions
  addMember: (displayName: string, role: HouseholdRole, email?: string, authenticatedUserId?: string | null, options?: { memberId?: string; roleId?: string | null; syncToSupabase?: boolean }) => MutationResult;
  updateMember: (id: string, updates: { display_name?: string; role?: HouseholdRole; role_id?: string | null; email?: string }) => MutationResult;
  deleteMember: (id: string) => MutationResult;

  // Role Permissions CRUD
  addCustomRole: (data: { name: string; base_role: HouseholdRole; source_role_id?: string | null }) => MutationResult;
  updateCustomRole: (id: string, updates: { name?: string; base_role?: HouseholdRole; is_head_parent?: boolean }) => MutationResult;
  duplicateCustomRole: (id: string) => MutationResult;
  deleteCustomRole: (id: string) => MutationResult;
  updateRolePermission: (roleId: string, permissionKey: PermissionKey, level: PermissionLevel) => MutationResult;
  
  // Security Checks
  canEditTransaction: (tx: Transaction) => boolean;
  canDeleteTransaction: (tx: Transaction) => boolean;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [household] = useState<Household>(initialHousehold);
  const [isHydrated, setIsHydrated] = useState(false);

  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers);
  const [currentMember, setCurrentMember] = useState<HouseholdMember>(initialMembers[0]);
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>(initialSavingsGoals);
  const [loans, setLoans] = useState<Loan[]>(initialLoans);
  const [recurringTransfers, setRecurringTransfers] = useState<RecurringTransfer[]>(initialRecurringTransfers);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [customRoles, setCustomRoles] = useState<HouseholdCustomRole[]>(initialCustomRoles);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>(initialRolePermissions);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const clearSyncWarning = () => setSyncWarning(null);
  const localSaveResult = (): MutationResult => ({
    success: true,
    syncStatus: getSyncStatus(Boolean(supabase)),
  });

  const trackSupabaseWrite = <T,>(
    operation: string,
    request: PromiseLike<{ error?: unknown } | T>
  ): MutationResult => {
    if (!supabase) return { success: true, syncStatus: getSyncStatus(false) };

    Promise.resolve(request)
      .then((result) => {
        const maybeError = result && typeof result === 'object' && 'error' in result
          ? (result as { error?: unknown }).error
          : null;

        if (maybeError) {
          setSyncWarning(getSyncFailureWarning(operation, maybeError));
        }
      })
      .catch(error => {
        setSyncWarning(getSyncFailureWarning(operation, error));
      });

    return { success: true, syncStatus: getSyncStatus(true) };
  };

  // Helper to sync single wallet balance to Supabase
  const updateWalletBalanceInSupabase = (walletId: string, newBalance: number) => {
    if (supabase) {
      trackSupabaseWrite('Update wallet balance', supabase.from('wallets').update({ current_balance: newBalance }).eq('id', walletId));
    }
  };

  // 1. Initial Local Storage & Remote Supabase Hydration
  useEffect(() => {
    async function hydrate() {
      if (typeof window !== 'undefined') {
        try {
          // Local storage hydration for instant offline render
          const savedMembers = localStorage.getItem(STORAGE_KEYS.members);
          if (savedMembers) {
            const parsed = JSON.parse(savedMembers);
            if (Array.isArray(parsed) && parsed.length > 0) setMembers(parsed);
          }

          const savedWallets = localStorage.getItem(STORAGE_KEYS.wallets);
          if (savedWallets) {
            const parsed = JSON.parse(savedWallets);
            if (Array.isArray(parsed) && parsed.length > 0) setWallets(parsed.map(normalizeCreditCardWalletBalance));
          }

          const savedCategories = localStorage.getItem(STORAGE_KEYS.categories);
          if (savedCategories) {
            const parsed = JSON.parse(savedCategories);
            if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
          }

          const savedTransactions = localStorage.getItem(STORAGE_KEYS.transactions);
          if (savedTransactions) {
            const parsed = JSON.parse(savedTransactions);
            if (Array.isArray(parsed) && parsed.length > 0) setTransactions(parsed);
          }

          const savedGoals = localStorage.getItem(STORAGE_KEYS.goals);
          if (savedGoals) {
            const parsed = JSON.parse(savedGoals);
            if (Array.isArray(parsed) && parsed.length > 0) setSavingsGoals(parsed);
          }

          const savedLoans = localStorage.getItem(STORAGE_KEYS.loans);
          if (savedLoans) {
            const parsed = JSON.parse(savedLoans);
            if (Array.isArray(parsed) && parsed.length > 0) setLoans(parsed);
          }

          const savedRecurring = localStorage.getItem(STORAGE_KEYS.recurring);
          if (savedRecurring) {
            const parsed = JSON.parse(savedRecurring);
            if (Array.isArray(parsed) && parsed.length > 0) setRecurringTransfers(parsed);
          }

          const savedRoles = localStorage.getItem(STORAGE_KEYS.roles);
          if (savedRoles) {
            const parsed = JSON.parse(savedRoles);
            if (Array.isArray(parsed) && parsed.length > 0) setCustomRoles(parsed);
          }

          const savedRolePermissions = localStorage.getItem(STORAGE_KEYS.rolePermissions);
          if (savedRolePermissions) {
            const parsed = JSON.parse(savedRolePermissions);
            if (Array.isArray(parsed) && parsed.length > 0) setRolePermissions(parsed);
          }

          const savedLogs = localStorage.getItem(STORAGE_KEYS.activityLogs);
          if (savedLogs) {
            const parsed = JSON.parse(savedLogs);
            if (Array.isArray(parsed) && parsed.length > 0) setActivityLogs(parsed);
          }

          // Full Supabase Remote Database Hydration for ALL entities
          if (supabase) {
            try {
              // 1. Members
              const { data: remoteMembers, error: mErr } = await supabase.from('household_members').select('*');
              if (remoteMembers && remoteMembers.length > 0) {
                setMembers(remoteMembers);
                localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(remoteMembers));
              } else if (!mErr && initialMembers.length > 0) {
                await supabase.from('household_members').insert(initialMembers);
              }

              // 2. Wallets
              const { data: remoteWallets, error: wErr } = await supabase.from('wallets').select('*');
              if (remoteWallets && remoteWallets.length > 0) {
                const normalizedRemoteWallets = remoteWallets.map(normalizeCreditCardWalletBalance);
                setWallets(normalizedRemoteWallets);
                localStorage.setItem(STORAGE_KEYS.wallets, JSON.stringify(normalizedRemoteWallets));
              } else if (!wErr && initialWallets.length > 0) {
                await supabase.from('wallets').insert(initialWallets);
              }

              // 3. Categories
              const { data: remoteCategories, error: cErr } = await supabase.from('categories').select('*');
              if (remoteCategories && remoteCategories.length > 0) {
                setCategories(remoteCategories);
                localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(remoteCategories));
              } else if (!cErr && initialCategories.length > 0) {
                await supabase.from('categories').insert(initialCategories);
              }

              // 4. Transactions
              const { data: remoteTx } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
              if (remoteTx && remoteTx.length > 0) {
                setTransactions(remoteTx);
                localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(remoteTx));
              }

              // 5. Savings Goals
              const { data: remoteGoals } = await supabase.from('savings_goals').select('*');
              if (remoteGoals && remoteGoals.length > 0) {
                setSavingsGoals(remoteGoals);
                localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(remoteGoals));
              }

              // 6. Loans
              const { data: remoteLoans, error: lErr } = await supabase.from('loans').select('*');
              if (remoteLoans && remoteLoans.length > 0) {
                setLoans(remoteLoans);
                localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(remoteLoans));
              } else if (!lErr && initialLoans.length > 0) {
                await supabase.from('loans').insert(initialLoans);
              }

              // 7. Recurring Transfers
              const { data: remoteRecurring } = await supabase.from('recurring_transfers').select('*');
              if (remoteRecurring && remoteRecurring.length > 0) {
                setRecurringTransfers(remoteRecurring);
                localStorage.setItem(STORAGE_KEYS.recurring, JSON.stringify(remoteRecurring));
              }

              // 8. Role Permissions
              const { data: remoteRoles, error: rolesErr } = await supabase.from('household_roles').select('*').order('created_at', { ascending: true });
              if (remoteRoles && remoteRoles.length > 0) {
                setCustomRoles(remoteRoles);
                localStorage.setItem(STORAGE_KEYS.roles, JSON.stringify(remoteRoles));
              } else if (!rolesErr && initialCustomRoles.length > 0) {
                await supabase.from('household_roles').upsert(initialCustomRoles);
              }

              const { data: remoteRolePermissions, error: rolePermsErr } = await supabase.from('role_permissions').select('*');
              if (remoteRolePermissions && remoteRolePermissions.length > 0) {
                setRolePermissions(remoteRolePermissions);
                localStorage.setItem(STORAGE_KEYS.rolePermissions, JSON.stringify(remoteRolePermissions));
              } else if (!rolePermsErr && initialRolePermissions.length > 0) {
                await supabase.from('role_permissions').upsert(initialRolePermissions);
              }

              // 9. Activity Logs
              const { data: remoteLogs } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
              if (remoteLogs && remoteLogs.length > 0) {
                setActivityLogs(remoteLogs);
                localStorage.setItem(STORAGE_KEYS.activityLogs, JSON.stringify(remoteLogs));
              }
            } catch (sErr) {
              console.log('Supabase remote table sync fallback active:', sErr);
              setSyncWarning('Supabase sync is unavailable; using saved local data for now.');
            }
          }
        } catch (err) {
          console.error('Error loading persistent storage state:', err);
        } finally {
          setIsHydrated(true);
        }
      }
    }
    hydrate();
  }, []);

  // 2. Persist State Changes to Local Storage
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && members.length > 0) {
      localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
    }
  }, [members, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && wallets.length > 0) {
      localStorage.setItem(STORAGE_KEYS.wallets, JSON.stringify(wallets));
    }
  }, [wallets, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && categories.length > 0) {
      localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
    }
  }, [categories, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    }
  }, [transactions, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(savingsGoals));
    }
  }, [savingsGoals, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && loans.length > 0) {
      localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans));
    }
  }, [loans, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.recurring, JSON.stringify(recurringTransfers));
    }
  }, [recurringTransfers, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && activityLogs.length > 0) {
      localStorage.setItem(STORAGE_KEYS.activityLogs, JSON.stringify(activityLogs));
    }
  }, [activityLogs, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && customRoles.length > 0) {
      localStorage.setItem(STORAGE_KEYS.roles, JSON.stringify(customRoles));
    }
  }, [customRoles, isHydrated]);

  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined' && rolePermissions.length > 0) {
      localStorage.setItem(STORAGE_KEYS.rolePermissions, JSON.stringify(rolePermissions));
    }
  }, [rolePermissions, isHydrated]);

  // Activity Logger Helper
  const logActivity = (action: ActivityLogAction, description: string, details?: any) => {
    const entry: ActivityLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      household_id: household.id,
      member_id: currentMember.id,
      member_name: currentMember.display_name,
      action: action,
      description: description,
      details: details || null,
      created_at: new Date().toISOString(),
    };
    setActivityLogs(prev => [entry, ...prev]);

    const syncResult = supabase
      ? trackSupabaseWrite('Create activity log', supabase.from('activity_logs').insert([entry]))
      : { success: true, syncStatus: getSyncStatus(false) };
    return syncResult;
  };

  // Full Data Export Helper
  const exportFullHouseholdBackup = () => {
    if (!hasPermission('export_backup')) {
      setSyncWarning('Your role cannot export household backups.');
      return;
    }

    const data = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      household,
      members,
      customRoles,
      rolePermissions,
      wallets,
      categories,
      transactions,
      savingsGoals,
      loans,
      recurringTransfers,
      activityLogs,
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `smc-ledger-backup-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    logActivity('backup_export', `Exported full household backup JSON file.`);
  };

  // Full Data Restoration Helper
  const restoreFullHouseholdBackup = (jsonContent: string): { success: boolean; error?: string } => {
    if (!hasPermission('restore_backup')) {
      return { success: false, error: 'Your role cannot restore household backups.' };
    }

    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid JSON backup format.' };
      }

      if (parsed.members && Array.isArray(parsed.members)) {
        setMembers(parsed.members);
        if (supabase) trackSupabaseWrite('Restore household members', supabase.from('household_members').upsert(parsed.members));
      }
      if (parsed.wallets && Array.isArray(parsed.wallets)) {
        const normalizedWallets = parsed.wallets.map(normalizeCreditCardWalletBalance);
        setWallets(normalizedWallets);
        if (supabase) trackSupabaseWrite('Restore wallets', supabase.from('wallets').upsert(normalizedWallets));
      }
      if (parsed.categories && Array.isArray(parsed.categories)) {
        setCategories(parsed.categories);
        if (supabase) trackSupabaseWrite('Restore categories', supabase.from('categories').upsert(parsed.categories));
      }
      if (parsed.transactions && Array.isArray(parsed.transactions)) {
        setTransactions(parsed.transactions);
        if (supabase) trackSupabaseWrite('Restore transactions', supabase.from('transactions').upsert(parsed.transactions));
      }
      if (parsed.savingsGoals && Array.isArray(parsed.savingsGoals)) {
        setSavingsGoals(parsed.savingsGoals);
        if (supabase) trackSupabaseWrite('Restore savings goals', supabase.from('savings_goals').upsert(parsed.savingsGoals));
      }
      if (parsed.loans && Array.isArray(parsed.loans)) {
        setLoans(parsed.loans);
        if (supabase) trackSupabaseWrite('Restore loans', supabase.from('loans').upsert(parsed.loans));
      }
      if (parsed.recurringTransfers && Array.isArray(parsed.recurringTransfers)) {
        setRecurringTransfers(parsed.recurringTransfers);
        if (supabase) trackSupabaseWrite('Restore recurring transfers', supabase.from('recurring_transfers').upsert(parsed.recurringTransfers));
      }
      if (parsed.customRoles && Array.isArray(parsed.customRoles)) {
        setCustomRoles(parsed.customRoles);
        if (supabase) trackSupabaseWrite('Restore household roles', supabase.from('household_roles').upsert(parsed.customRoles));
      }
      if (parsed.rolePermissions && Array.isArray(parsed.rolePermissions)) {
        setRolePermissions(parsed.rolePermissions);
        if (supabase) trackSupabaseWrite('Restore role permissions', supabase.from('role_permissions').upsert(parsed.rolePermissions));
      }
      if (parsed.activityLogs && Array.isArray(parsed.activityLogs)) {
        setActivityLogs(parsed.activityLogs);
        if (supabase) trackSupabaseWrite('Restore activity logs', supabase.from('activity_logs').upsert(parsed.activityLogs));
      }

      logActivity('backup_restore', `Restored full household dataset from uploaded backup file.`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to parse JSON backup file.' };
    }
  };

  const activateAuthenticatedMember = (
    email: string | null | undefined,
    authenticatedUserId: string | null | undefined
  ): boolean => {
    const found = resolveAuthenticatedMember(members, email, authenticatedUserId);
    if (!found) return false;

    const linked = linkMemberToAuthenticatedUser(found, authenticatedUserId);
    setCurrentMember(linked);

    if (linked.user_id !== found.user_id) {
      setMembers(prev => prev.map(member => member.id === linked.id ? linked : member));
      if (supabase) {
        trackSupabaseWrite(
          'Link member to authenticated user',
          supabase.from('household_members').update({ user_id: linked.user_id }).eq('id', linked.id)
        );
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEYS[0], linked.email || '');
    }

    return true;
  };

  // Bind Supabase Auth listener
  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        activateAuthenticatedMember(session?.user?.email, session?.user?.id);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const isLinked = activateAuthenticatedMember(session?.user?.email, session?.user?.id);
        if (!session || !isLinked) {
          clearAuthStorage(window.localStorage);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [members]);

  const isHeadParent = getIsHeadParent(currentMember, customRoles);
  const hasPermission = (key: PermissionKey, ownerMemberId?: string | null) =>
    hasRolePermission(currentMember, rolePermissions, key, ownerMemberId, customRoles);
  const isAdmin = isHeadParent || ([
    'manage_wallets',
    'manage_categories',
    'manage_goals',
    'fund_goals',
    'manage_loans',
    'pay_loans',
    'manage_schedules',
    'manage_members',
    'send_password_resets',
    'view_activity_logs',
    'export_backup',
    'restore_backup',
    'reset_demo_data',
    'manage_roles',
  ] as PermissionKey[]).some(permissionKey => hasPermission(permissionKey));

  const canEditTransaction = (tx: Transaction): boolean => {
    const level = getPermissionLevel(currentMember, rolePermissions, 'update_transactions', customRoles);
    if (level === 'restricted' || level === 'read_only') return false;
    if (level === 'own_only' && tx.payer_id !== currentMember.id) return false;
    if (isHeadParent || level === 'allowed') return true;
    const diffHours = (Date.now() - new Date(tx.created_at).getTime()) / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  const canDeleteTransaction = (tx: Transaction): boolean => {
    const level = getPermissionLevel(currentMember, rolePermissions, 'delete_transactions', customRoles);
    if (level === 'restricted' || level === 'read_only') return false;
    if (level === 'own_only' && tx.payer_id !== currentMember.id) return false;
    if (isHeadParent || level === 'allowed') return true;
    const diffHours = (Date.now() - new Date(tx.created_at).getTime()) / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  const switchMember = (memberId: string) => {
    const found = members.find(m => m.id === memberId);
    if (found) {
      setCurrentMember(found);
    }
  };

  // Wallets CRUD
  const addWallet = (data: { name: string; wallet_type: Wallet['wallet_type']; is_shared: boolean; owner_id?: string | null; initial_balance: number; credit_limit?: number | null }) => {
    if (!hasPermission('manage_wallets', data.owner_id || currentMember.id)) {
      return { success: false, error: 'Your role cannot create this wallet or credit line.' };
    }
    const newWallet: Wallet = {
      id: `wallet-${Date.now()}`,
      household_id: household.id,
      owner_id: data.owner_id || currentMember.id,
      name: data.name,
      wallet_type: data.wallet_type,
      is_shared: data.is_shared,
      current_balance: data.wallet_type === 'credit_card' ? Math.abs(data.initial_balance) : data.initial_balance,
      credit_limit: data.credit_limit || null,
      created_at: new Date().toISOString(),
    };
    setWallets(prev => [...prev, newWallet]);
    logActivity('create_wallet', `Created account/wallet "${data.name}" (${data.wallet_type.toUpperCase()}) with initial balance ₱${data.initial_balance}`);

    return supabase
      ? trackSupabaseWrite('Create wallet', supabase.from('wallets').insert([newWallet]))
      : localSaveResult();
  };

  const updateWallet = (id: string, updates: { name?: string; wallet_type?: Wallet['wallet_type']; current_balance?: number; credit_limit?: number | null; is_shared?: boolean }) => {
    const target = wallets.find(w => w.id === id);
    if (!target) return { success: false, error: 'Wallet account not found.' };
    if (!hasPermission('manage_wallets', target.owner_id)) return { success: false, error: 'Your role cannot edit this wallet or credit line.' };
    const nextWalletType = updates.wallet_type || target.wallet_type;
    const normalizedUpdates = updates.current_balance !== undefined && nextWalletType === 'credit_card'
      ? { ...updates, current_balance: Math.abs(updates.current_balance) }
      : updates;
    setWallets(prev => prev.map(w => w.id === id ? { ...w, ...normalizedUpdates } : w));
    logActivity('update_wallet', `Updated account "${updates.name || target?.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Update wallet', supabase.from('wallets').update(normalizedUpdates).eq('id', id))
      : localSaveResult();
  };

  const deleteWallet = (id: string) => {
    const target = wallets.find(w => w.id === id);
    if (!target) return { success: false, error: 'Wallet account not found.' };
    if (!hasPermission('manage_wallets', target.owner_id)) return { success: false, error: 'Your role cannot delete this wallet or credit line.' };
    setWallets(prev => prev.filter(w => w.id !== id));
    logActivity('delete_wallet', `Deleted account "${target?.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Delete wallet', supabase.from('wallets').delete().eq('id', id))
      : localSaveResult();
  };

  // Categories CRUD
  const addCategory = (data: { name: string; icon_slug: string; monthly_budget_limit: number }) => {
    if (!hasPermission('manage_categories')) return { success: false, error: 'Your role cannot create envelope categories.' };
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      household_id: household.id,
      name: data.name,
      icon_slug: data.icon_slug,
      monthly_budget_limit: data.monthly_budget_limit,
      created_at: new Date().toISOString(),
    };
    setCategories(prev => [...prev, newCat]);
    logActivity('create_category', `Created envelope category "${data.name}" with monthly budget ₱${data.monthly_budget_limit}`);

    return supabase
      ? trackSupabaseWrite('Create category', supabase.from('categories').insert([newCat]))
      : localSaveResult();
  };

  const updateCategory = (id: string, updates: { name?: string; icon_slug?: string; monthly_budget_limit?: number }) => {
    if (!hasPermission('manage_categories')) return { success: false, error: 'Your role cannot edit envelope categories.' };
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    logActivity('update_category', `Updated category envelope "${updates.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Update category', supabase.from('categories').update(updates).eq('id', id))
      : localSaveResult();
  };

  const updateCategoryLimit = (id: string, limit: number) => {
    return updateCategory(id, { monthly_budget_limit: limit });
  };

  const deleteCategory = (id: string) => {
    if (!hasPermission('manage_categories')) return { success: false, error: 'Your role cannot delete envelope categories.' };
    const target = categories.find(c => c.id === id);
    setCategories(prev => prev.filter(c => c.id !== id));
    logActivity('delete_category', `Deleted envelope category "${target?.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Delete category', supabase.from('categories').delete().eq('id', id))
      : localSaveResult();
  };

  // Transactions CRUD with Processing Fee Accounting & Supabase Wallet Balance Sync
  const addTransaction = (data: { 
    wallet_id: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null; 
    type: Transaction['type']; 
    amount: number; 
    fee?: number | null;
    transaction_date: string; 
    note?: string; 
    receipt_url?: string 
  }) => {
    if (!hasPermission('create_transactions')) {
      return { success: false, error: 'Your role cannot log transactions.' };
    }

    const sourceWallet = wallets.find(w => w.id === data.wallet_id);
    if (!sourceWallet) return { success: false, error: 'Source wallet not found' };

    const feeAmount = data.fee || 0;
    const balanceResult = applyTransactionBalanceChange(wallets, data);
    if (!balanceResult.success) return { success: false, error: balanceResult.error };

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      household_id: household.id,
      wallet_id: data.wallet_id,
      destination_wallet_id: data.destination_wallet_id || null,
      category_id: data.category_id || null,
      payer_id: currentMember.id,
      type: data.type,
      amount: data.amount,
      fee: feeAmount > 0 ? feeAmount : null,
      transaction_date: data.transaction_date,
      note: data.note || null,
      receipt_url: data.receipt_url || null,
      created_at: new Date().toISOString(),
    };

    setWallets(balanceResult.wallets);
    balanceResult.changedWalletIds.forEach(walletId => {
      const changedWallet = balanceResult.wallets.find(wallet => wallet.id === walletId);
      if (changedWallet) updateWalletBalanceInSupabase(walletId, changedWallet.current_balance);
    });
    setTransactions(prev => [newTx, ...prev]);
    logActivity('create_tx', `Logged ${data.type.toUpperCase()} transaction of ₱${data.amount} (${data.note || 'No note'})`);

    return supabase
      ? trackSupabaseWrite('Create transaction', supabase.from('transactions').insert([newTx]))
      : localSaveResult();
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
    logActivity('update_tx', `Updated transaction "${target.note || id}"`);

    return supabase
      ? trackSupabaseWrite('Update transaction', supabase.from('transactions').update(updates).eq('id', id))
      : localSaveResult();
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

    const balanceResult = reverseTransactionBalanceChange(wallets, target);
    if (!balanceResult.success) return { success: false, error: balanceResult.error };

    setWallets(balanceResult.wallets);
    balanceResult.changedWalletIds.forEach(walletId => {
      const changedWallet = balanceResult.wallets.find(wallet => wallet.id === walletId);
      if (changedWallet) updateWalletBalanceInSupabase(walletId, changedWallet.current_balance);
    });
    setTransactions(prev => prev.filter(t => t.id !== id));
    logActivity('delete_tx', `Deleted transaction "${target.note || id}" of ₱${target.amount}`);

    return supabase
      ? trackSupabaseWrite('Delete transaction', supabase.from('transactions').delete().eq('id', id))
      : localSaveResult();
  };

  // Savings Goals CRUD
  const addSavingsGoal = (data: { name: string; target_amount: number; target_date?: string }) => {
    if (!hasPermission('manage_goals')) return { success: false, error: 'Your role cannot create savings goals.' };
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
    logActivity('create_goal', `Created savings goal "${data.name}" with target ₱${data.target_amount}`);

    return supabase
      ? trackSupabaseWrite('Create savings goal', supabase.from('savings_goals').insert([newGoal]))
      : localSaveResult();
  };

  const updateSavingsGoal = (id: string, updates: { name?: string; target_amount?: number; target_date?: string | null }) => {
    if (!hasPermission('manage_goals')) return { success: false, error: 'Your role cannot edit savings goals.' };
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    logActivity('update_goal', `Updated savings goal "${updates.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Update savings goal', supabase.from('savings_goals').update(updates).eq('id', id))
      : localSaveResult();
  };

  const deleteSavingsGoal = (id: string) => {
    if (!hasPermission('manage_goals')) return { success: false, error: 'Your role cannot delete savings goals.' };
    const target = savingsGoals.find(g => g.id === id);
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    logActivity('delete_goal', `Deleted savings goal "${target?.name || id}"`);

    return supabase
      ? trackSupabaseWrite('Delete savings goal', supabase.from('savings_goals').delete().eq('id', id))
      : localSaveResult();
  };

  const fundSavingsGoal = (goalId: string, amount: number, walletId: string) => {
    if (!hasPermission('fund_goals')) return { success: false, error: 'Your role cannot fund savings goals.' };
    const sourceWallet = wallets.find(w => w.id === walletId);
    if (!sourceWallet) return { success: false, error: 'Wallet not found' };
    if (sourceWallet.current_balance < amount) {
      return { success: false, error: 'Insufficient funds in selected wallet' };
    }

    const newWalletBal = sourceWallet.current_balance - amount;
    const targetGoal = savingsGoals.find(g => g.id === goalId);
    const newGoalAmount = targetGoal ? targetGoal.current_amount + amount : amount;

    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, current_balance: newWalletBal } : w));
    setSavingsGoals(prev => prev.map(g => g.id === goalId ? { ...g, current_amount: newGoalAmount } : g));

    addTransaction({
      wallet_id: walletId,
      type: 'expense',
      amount: amount,
      transaction_date: new Date().toISOString().split('T')[0],
      note: `Contribution to goal: ${targetGoal?.name || goalId}`,
    });

    logActivity('fund_goal', `Funded ₱${amount} into savings goal "${targetGoal?.name || goalId}"`);

    const syncResult = supabase
      ? trackSupabaseWrite('Fund savings goal', supabase.from('savings_goals').update({ current_amount: newGoalAmount }).eq('id', goalId))
      : localSaveResult();
    updateWalletBalanceInSupabase(walletId, newWalletBal);
    return syncResult;
  };

  // Loans CRUD
  const addLoan = (data: { 
    name: string; 
    lender: string; 
    source_wallet_id?: string | null;
    total_principal: number; 
    total_amortizations?: number | null;
    paid_amortizations_count?: number | null;
    remaining_balance?: number;
    amount_paid?: number;
    interest_rate_annual: number; 
    monthly_amortization: number; 
    payment_frequency?: LoanPaymentFrequency;
    due_day_of_month?: number;
    second_due_day_of_month?: number | null;
    next_due_date?: string | null;
  }) => {
    if (!hasPermission('manage_loans')) return { success: false, error: 'Your role cannot create loan records.' };

    const paidCount = data.paid_amortizations_count || 0;
    const paid = data.amount_paid !== undefined && data.amount_paid !== null ? data.amount_paid : (paidCount * data.monthly_amortization);
    const totalAmort = data.total_amortizations || null;
    const remaining = data.remaining_balance !== undefined && data.remaining_balance !== null ? data.remaining_balance : (totalAmort ? Math.max(0, (totalAmort - paidCount) * data.monthly_amortization) : Math.max(0, data.total_principal - paid));

    const newLoan: Loan = {
      id: `loan-${Date.now()}`,
      household_id: household.id,
      name: data.name,
      lender: data.lender,
      source_wallet_id: data.source_wallet_id || null,
      total_principal: data.total_principal,
      total_amortizations: totalAmort,
      paid_amortizations_count: paidCount,
      remaining_balance: remaining,
      amount_paid: paid,
      interest_rate_annual: data.interest_rate_annual,
      monthly_amortization: data.monthly_amortization,
      payment_frequency: data.payment_frequency || 'monthly',
      due_day_of_month: data.due_day_of_month || 1,
      second_due_day_of_month: data.second_due_day_of_month || null,
      next_due_date: data.next_due_date || null,
      start_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    setLoans(prev => [...prev, newLoan]);
    logActivity('create_loan', `Created loan record "${data.name}" (${data.lender}) with principal ₱${data.total_principal}`);

    const syncResult = supabase
      ? trackSupabaseWrite('Create loan', supabase.from('loans').insert([newLoan]))
      : localSaveResult();

    // Auto-create/sync Recurring Schedule Item for this Loan
    const sourceW = data.source_wallet_id || (wallets.length > 0 ? wallets[0].id : null);
    if (sourceW) {
      const freq: RecurringFrequency = data.payment_frequency === 'bi_monthly' ? 'bimonthly' : 'monthly';
      addRecurringTransfer({
        rule_type: 'loan_payment',
        source_wallet_id: sourceW,
        loan_id: newLoan.id,
        category_id: null,
        amount: data.monthly_amortization,
        frequency: freq,
        next_run_date: data.next_due_date || new Date().toISOString().split('T')[0],
        note: data.name,
      });
    }
    return syncResult;
  };

  const updateLoan = (id: string, updates: { 
    name?: string; 
    lender?: string; 
    source_wallet_id?: string | null;
    total_principal?: number; 
    total_amortizations?: number | null;
    paid_amortizations_count?: number | null;
    remaining_balance?: number; 
    amount_paid?: number;
    interest_rate_annual?: number; 
    monthly_amortization?: number; 
    payment_frequency?: LoanPaymentFrequency;
    due_day_of_month?: number;
    second_due_day_of_month?: number | null;
    next_due_date?: string | null;
  }) => {
    if (!hasPermission('manage_loans')) return { success: false, error: 'Your role cannot edit loan records.' };
    const target = loans.find(l => l.id === id);
    const updated = { ...target, ...updates } as Loan;
    setLoans(prev => prev.map(l => l.id === id ? updated : l));
    logActivity('update_loan', `Updated loan record "${updates.name || target?.name || id}"`);

    const syncResult = supabase
      ? trackSupabaseWrite('Update loan', supabase.from('loans').update(updates).eq('id', id))
      : localSaveResult();

    // Sync Recurring Transfer Rule
    const existingRule = recurringTransfers.find(r => r.loan_id === id);
    if (existingRule) {
      const freq: RecurringFrequency = updated.payment_frequency === 'bi_monthly' ? 'bimonthly' : 'monthly';
      updateRecurringTransfer(existingRule.id, {
        rule_type: 'loan_payment',
        source_wallet_id: updated.source_wallet_id || existingRule.source_wallet_id,
        amount: updated.monthly_amortization,
        frequency: freq,
        next_run_date: updated.next_due_date || existingRule.next_run_date,
        note: updated.name,
      });
    } else if (updated.source_wallet_id) {
      const freq: RecurringFrequency = updated.payment_frequency === 'bi_monthly' ? 'bimonthly' : 'monthly';
      addRecurringTransfer({
        rule_type: 'loan_payment',
        source_wallet_id: updated.source_wallet_id,
        loan_id: id,
        category_id: null,
        amount: updated.monthly_amortization,
        frequency: freq,
        next_run_date: updated.next_due_date || new Date().toISOString().split('T')[0],
        note: updated.name,
      });
    }

    return syncResult;
  };

  const deleteLoan = (id: string) => {
    if (!hasPermission('manage_loans')) return { success: false, error: 'Your role cannot delete loan records.' };
    const target = loans.find(l => l.id === id);
    setLoans(prev => prev.filter(l => l.id !== id));
    logActivity('delete_loan', `Deleted loan record "${target?.name || id}"`);

    // Delete linked recurring schedule rule
    const linkedRule = recurringTransfers.find(r => r.loan_id === id);
    if (linkedRule) {
      deleteRecurringTransfer(linkedRule.id);
    }

    return supabase
      ? trackSupabaseWrite('Delete loan', supabase.from('loans').delete().eq('id', id))
      : localSaveResult();
  };

  const payLoanAmortization = (loanId: string, amount: number, walletId: string) => {
    if (!hasPermission('pay_loans')) return { success: false, error: 'Your role cannot pay loan amortizations.' };
    const targetLoan = loans.find(l => l.id === loanId);
    if (!targetLoan) return { success: false, error: 'Loan record not found' };

    const sourceWallet = wallets.find(w => w.id === walletId);
    if (!sourceWallet) return { success: false, error: 'Source wallet account not found' };

    const balancePreview = applyTransactionBalanceChange(wallets, {
      wallet_id: walletId,
      type: 'expense',
      amount,
      fee: 0,
    });
    if (!balancePreview.success) {
      return { success: false, error: balancePreview.error };
    }

    if (sourceWallet.wallet_type !== 'credit_card' && sourceWallet.current_balance < amount) {
      return { success: false, error: 'Insufficient wallet balance for amortization payment' };
    }

    // Auto-advance next_due_date (+30 days for monthly, +15 days for bi-monthly)
    let nextDueDate: string | null = targetLoan.next_due_date || new Date().toISOString().split('T')[0];
    if (nextDueDate) {
      const currentDate = new Date(nextDueDate);
      const daysToAdd = targetLoan.payment_frequency === 'bi_monthly' ? 15 : 30;
      currentDate.setDate(currentDate.getDate() + daysToAdd);
      nextDueDate = currentDate.toISOString().split('T')[0];
    }

    const currentPaidCount = targetLoan.paid_amortizations_count || 0;
    const newPaidCount = currentPaidCount + 1;
    const currentPaid = targetLoan.amount_paid !== undefined ? targetLoan.amount_paid : (currentPaidCount * targetLoan.monthly_amortization);
    const newPaid = currentPaid + amount;
    
    const totalAmort = targetLoan.total_amortizations || null;
    const newRemaining = totalAmort 
      ? Math.max(0, (totalAmort - newPaidCount) * targetLoan.monthly_amortization) 
      : Math.max(0, targetLoan.remaining_balance - amount);

    setLoans(prev => prev.map(l => l.id === loanId ? { 
      ...l, 
      paid_amortizations_count: newPaidCount,
      remaining_balance: newRemaining,
      amount_paid: newPaid,
      next_due_date: nextDueDate,
      source_wallet_id: walletId,
    } : l));

    addTransaction({
      wallet_id: walletId,
      type: 'expense',
      amount: amount,
      transaction_date: new Date().toISOString().split('T')[0],
      note: `Amortization payment for: ${targetLoan.name} (${targetLoan.lender})`,
    });

    logActivity('pay_loan', `Paid loan amortization of ₱${amount} for "${targetLoan.name}"`);

    // Sync updated Next Due Date to Recurring Transfer Schedule
    const linkedRule = recurringTransfers.find(r => r.loan_id === loanId);
    if (linkedRule && nextDueDate) {
      updateRecurringTransfer(linkedRule.id, {
        next_run_date: nextDueDate,
        source_wallet_id: walletId,
        amount: targetLoan.monthly_amortization,
      });
    }

    const syncResult = supabase
      ? trackSupabaseWrite('Pay loan', supabase.from('loans').update({
        paid_amortizations_count: newPaidCount,
        remaining_balance: newRemaining,
        amount_paid: newPaid,
        next_due_date: nextDueDate,
        source_wallet_id: walletId,
      }).eq('id', loanId))
      : localSaveResult();
    return syncResult;
  };

  const getDaysOffset = (freq: RecurringFrequency, customDays?: number | null): number => {
    switch (freq) {
      case 'daily': return 1;
      case 'weekly': return 7;
      case 'biweekly': return 14;
      case 'bimonthly': return 15;
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
    loan_id?: string | null;
    amount: number; 
    frequency: RecurringFrequency; 
    custom_interval_days?: number | null;
    next_run_date?: string | null;
    note: string 
  }) => {
    if (!hasPermission('manage_schedules')) return { success: false, error: 'Your role cannot configure recurring schedule rules.' };
    const daysOffset = getDaysOffset(data.frequency, data.custom_interval_days);
    const calculatedNextRun = new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0];
    const newRule: RecurringTransfer = {
      id: `recurring-${Date.now()}`,
      household_id: household.id,
      rule_type: data.rule_type,
      source_wallet_id: data.source_wallet_id,
      destination_wallet_id: data.destination_wallet_id || null,
      category_id: data.category_id || null,
      loan_id: data.loan_id || null,
      amount: data.amount,
      frequency: data.frequency,
      custom_interval_days: data.custom_interval_days || null,
      next_run_date: data.next_run_date || calculatedNextRun,
      note: data.note,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setRecurringTransfers(prev => [...prev, newRule]);
    logActivity('create_recurring', `Created recurring ${data.rule_type.toUpperCase()} schedule rule "${data.note}" of ₱${data.amount} (Next Due: ${newRule.next_run_date})`);

    return supabase
      ? trackSupabaseWrite('Create recurring transfer', supabase.from('recurring_transfers').insert([newRule]))
      : localSaveResult();
  };

  const updateRecurringTransfer = (id: string, updates: { 
    rule_type?: RecurringRuleType;
    source_wallet_id?: string; 
    destination_wallet_id?: string | null; 
    category_id?: string | null;
    loan_id?: string | null;
    amount?: number; 
    frequency?: RecurringFrequency; 
    custom_interval_days?: number | null;
    next_run_date?: string;
    note?: string;
    is_active?: boolean;
  }) => {
    if (!hasPermission('manage_schedules')) return { success: false, error: 'Your role cannot edit recurring schedule rules.' };
    const target = recurringTransfers.find(r => r.id === id);
    setRecurringTransfers(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    logActivity('update_recurring', `Updated recurring schedule rule "${updates.note || target?.note || id}" (Next Due: ${updates.next_run_date || target?.next_run_date})`);

    return supabase
      ? trackSupabaseWrite('Update recurring transfer', supabase.from('recurring_transfers').update(updates).eq('id', id))
      : localSaveResult();
  };

  const toggleRecurringTransfer = (id: string) => {
    if (!hasPermission('manage_schedules')) return { success: false, error: 'Your role cannot edit recurring schedule rules.' };
    const target = recurringTransfers.find(r => r.id === id);
    const newActiveState = target ? !target.is_active : true;
    setRecurringTransfers(prev => prev.map(r => r.id === id ? { ...r, is_active: newActiveState } : r));
    logActivity('toggle_recurring', `${newActiveState ? 'Activated' : 'Paused'} recurring schedule rule "${target?.note || id}"`);

    return supabase
      ? trackSupabaseWrite('Toggle recurring transfer', supabase.from('recurring_transfers').update({ is_active: newActiveState }).eq('id', id))
      : localSaveResult();
  };

  const deleteRecurringTransfer = (id: string) => {
    if (!hasPermission('manage_schedules')) return { success: false, error: 'Your role cannot delete recurring schedule rules.' };
    const target = recurringTransfers.find(r => r.id === id);
    setRecurringTransfers(prev => prev.filter(r => r.id !== id));
    logActivity('delete_recurring', `Deleted recurring schedule rule "${target?.note || id}"`);

    return supabase
      ? trackSupabaseWrite('Delete recurring transfer', supabase.from('recurring_transfers').delete().eq('id', id))
      : localSaveResult();
  };

  const addMember = (
    displayName: string,
    role: HouseholdRole,
    email?: string,
    authenticatedUserId?: string | null,
    options?: { memberId?: string; roleId?: string | null; syncToSupabase?: boolean }
  ) => {
    if (!hasPermission('manage_members')) return { success: false, error: 'Your role cannot add or invite household members.' };
    const newMember: HouseholdMember = {
      id: options?.memberId || `member-${Date.now()}`,
      household_id: household.id,
      user_id: authenticatedUserId || null,
      role: role,
      role_id: options?.roleId || null,
      display_name: displayName,
      email: email || undefined,
      created_at: new Date().toISOString(),
    };
    setMembers(prev => [...prev, newMember]);
    logActivity('create_member', `Added member "${displayName}" (${role.toUpperCase()})`);

    if (options?.syncToSupabase === false) {
      return localSaveResult();
    }

    return supabase
      ? trackSupabaseWrite('Create member', supabase.from('household_members').insert([newMember]))
      : localSaveResult();
  };

  const updateMember = (id: string, updates: { display_name?: string; role?: HouseholdRole; role_id?: string | null; email?: string }) => {
    const isSelfProfileUpdate = currentMember.id === id && !('role' in updates) && !('role_id' in updates);
    if (!isSelfProfileUpdate && !hasPermission('manage_members')) {
      return { success: false, error: 'Your role cannot edit household members.' };
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

    logActivity('update_member', `Updated member record "${updates.display_name || target.display_name}"`);

    return supabase
      ? trackSupabaseWrite('Update member', supabase.from('household_members').update(updates).eq('id', id))
      : localSaveResult();
  };

  const deleteMember = (id: string) => {
    if (!hasPermission('manage_members')) return { success: false, error: 'Your role cannot remove household members.' };

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
    logActivity('delete_member', `Removed member "${target.display_name}"`);

    return supabase
      ? trackSupabaseWrite('Delete member', supabase.from('household_members').delete().eq('id', id))
      : localSaveResult();
  };

  const resetDemoData = (): MutationResult => {
    if (!hasPermission('reset_demo_data')) {
      return { success: false, error: 'Your role cannot reset demo data.' };
    }

    if (typeof window !== 'undefined') {
      clearHouseholdStorage(window.localStorage);
    }

    setMembers(initialMembers);
    setCurrentMember(initialMembers[0]);
    setWallets(initialWallets);
    setCategories(initialCategories);
    setTransactions(initialTransactions);
    setSavingsGoals(initialSavingsGoals);
    setLoans(initialLoans);
    setRecurringTransfers(initialRecurringTransfers);
    setActivityLogs([]);
    setCustomRoles(initialCustomRoles);
    setRolePermissions(initialRolePermissions);
    setSyncWarning(null);

    return { success: true, syncStatus: 'local_only' };
  };

  const addCustomRole = (data: { name: string; base_role: HouseholdRole; source_role_id?: string | null }): MutationResult => {
    if (!hasPermission('manage_roles')) return { success: false, error: 'Your role cannot create custom roles.' };
    const name = data.name.trim();
    if (!name) return { success: false, error: 'Role name is required.' };

    const newRole: HouseholdCustomRole = {
      id: `role-${Date.now()}`,
      household_id: household.id,
      name,
      base_role: data.base_role,
      is_head_parent: data.base_role === 'admin',
      is_default: false,
      created_at: new Date().toISOString(),
    };

    const sourcePermissions = rolePermissions.filter(permission => permission.role_id === (data.source_role_id || getEffectiveRoleId(currentMember)));
    const permissionsToCreate = (sourcePermissions.length > 0 ? sourcePermissions : initialRolePermissions.filter(permission => permission.role_id === 'role-teen-dependent')).map(permission => ({
      ...permission,
      id: `${newRole.id}-${permission.permission_key}`,
      household_id: household.id,
      role_id: newRole.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    setCustomRoles(prev => [...prev, newRole]);
    setRolePermissions(prev => [...prev, ...permissionsToCreate]);
    logActivity('update_member', `Created custom role "${newRole.name}"`);

    if (supabase) {
      trackSupabaseWrite('Create custom role', supabase.from('household_roles').insert([newRole]));
      trackSupabaseWrite('Create role permissions', supabase.from('role_permissions').insert(permissionsToCreate));
    }

    return localSaveResult();
  };

  const updateCustomRole = (id: string, updates: { name?: string; base_role?: HouseholdRole; is_head_parent?: boolean }): MutationResult => {
    if (!hasPermission('manage_roles')) return { success: false, error: 'Your role cannot edit custom roles.' };
    const target = customRoles.find(role => role.id === id);
    if (!target) return { success: false, error: 'Role not found.' };

    const nextRole = {
      ...target,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : target.name,
    };
    if (!nextRole.name) return { success: false, error: 'Role name is required.' };

    if (target.is_head_parent && updates.is_head_parent === false) {
      const otherHeadParentRoleIds = customRoles.filter(role => role.id !== id && role.is_head_parent).map(role => role.id);
      const hasOtherAssignedHeadParent = members.some(member => otherHeadParentRoleIds.includes(getEffectiveRoleId(member)));
      if (!hasOtherAssignedHeadParent) return { success: false, error: 'At least one Head Parent role must remain assigned.' };
    }

    setCustomRoles(prev => prev.map(role => role.id === id ? nextRole : role));
    logActivity('update_member', `Updated custom role "${nextRole.name}"`);

    return supabase
      ? trackSupabaseWrite('Update custom role', supabase.from('household_roles').update({
        name: nextRole.name,
        base_role: nextRole.base_role,
        is_head_parent: nextRole.is_head_parent,
      }).eq('id', id))
      : localSaveResult();
  };

  const duplicateCustomRole = (id: string): MutationResult => {
    const source = customRoles.find(role => role.id === id);
    if (!source) return { success: false, error: 'Role not found.' };
    return addCustomRole({
      name: `${source.name} Copy`,
      base_role: source.base_role,
      source_role_id: source.id,
    });
  };

  const deleteCustomRole = (id: string): MutationResult => {
    if (!hasPermission('manage_roles')) return { success: false, error: 'Your role cannot delete custom roles.' };
    const validation = canDeleteRole(id, members, customRoles);
    if (!validation.success) return validation;

    const target = customRoles.find(role => role.id === id);
    setCustomRoles(prev => prev.filter(role => role.id !== id));
    setRolePermissions(prev => prev.filter(permission => permission.role_id !== id));
    logActivity('update_member', `Deleted custom role "${target?.name || id}"`);

    if (supabase) {
      trackSupabaseWrite('Delete role permissions', supabase.from('role_permissions').delete().eq('role_id', id));
      trackSupabaseWrite('Delete custom role', supabase.from('household_roles').delete().eq('id', id));
    }

    return localSaveResult();
  };

  const updateRolePermission = (roleId: string, permissionKey: PermissionKey, level: PermissionLevel): MutationResult => {
    if (!hasPermission('manage_roles')) return { success: false, error: 'Your role cannot update role permissions.' };

    const validation = canUpdateRolePermission({
      roleId,
      permissionKey,
      nextLevel: level,
      roles: customRoles,
      members,
      permissions: rolePermissions,
    });
    if (!validation.success) return validation;

    const now = new Date().toISOString();
    const existing = rolePermissions.find(permission => permission.role_id === roleId && permission.permission_key === permissionKey);
    const nextPermission: RolePermission = existing ? {
      ...existing,
      level,
      updated_at: now,
    } : {
      id: `${roleId}-${permissionKey}`,
      household_id: household.id,
      role_id: roleId,
      permission_key: permissionKey,
      level,
      created_at: now,
      updated_at: now,
    };

    setRolePermissions(prev => existing
      ? prev.map(permission => permission.id === nextPermission.id ? nextPermission : permission)
      : [...prev, nextPermission]
    );
    logActivity('update_member', `Updated permission "${permissionKey}" for role "${roleId}"`);

    return supabase
      ? trackSupabaseWrite('Update role permission', supabase.from('role_permissions').upsert([nextPermission]))
      : localSaveResult();
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
      activityLogs,
      customRoles,
      rolePermissions,
      isAdmin,
      isHeadParent,
      syncWarning,
      clearSyncWarning,
      resetDemoData,
      hasPermission,
      switchMember,
      logActivity,
      exportFullHouseholdBackup,
      restoreFullHouseholdBackup,
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
      updateRecurringTransfer,
      toggleRecurringTransfer,
      deleteRecurringTransfer,
      addMember,
      updateMember,
      deleteMember,
      addCustomRole,
      updateCustomRole,
      duplicateCustomRole,
      deleteCustomRole,
      updateRolePermission,
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
