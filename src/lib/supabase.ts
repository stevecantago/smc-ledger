import { createClient } from '@supabase/supabase-js';
import { Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal, Loan, RecurringTransfer } from '../types/database';
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLES } from './permissions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Minimal fictional seed data for an empty local/demo household.
export const initialHousehold: Household = {
  id: 'hh-101',
  name: 'Demo Household',
  base_currency: 'PHP',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const initialMembers: HouseholdMember[] = [
  {
    id: 'member-demo-admin',
    household_id: 'hh-101',
    user_id: null,
    role: 'admin',
    role_id: 'role-admin-head-parent',
    first_name: 'Demo',
    last_name: 'Member',
    date_of_birth: null,
    display_name: 'Demo Household Admin',
    email: 'demo@example.invalid',
    created_at: new Date().toISOString(),
  },
];

export const initialWallets: Wallet[] = [
  {
    id: 'wallet-demo-cash',
    household_id: 'hh-101',
    owner_id: 'member-demo-admin',
    name: 'Demo Cash Wallet',
    wallet_type: 'cash',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    service_fee_balance: 0.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-demo-ewallet',
    household_id: 'hh-101',
    owner_id: 'member-demo-admin',
    name: 'Demo E-Wallet',
    wallet_type: 'e_wallet',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    service_fee_balance: 0.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-demo-bank',
    household_id: 'hh-101',
    owner_id: 'member-demo-admin',
    name: 'Demo Bank Account',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    service_fee_balance: 0.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-demo-savings',
    household_id: 'hh-101',
    owner_id: 'member-demo-admin',
    name: 'Demo Savings Account',
    wallet_type: 'e_wallet_savings',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    service_fee_balance: 0.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-demo-credit',
    household_id: 'hh-101',
    owner_id: 'member-demo-admin',
    name: 'Demo Credit Card',
    wallet_type: 'credit_card',
    is_shared: false,
    current_balance: 0.00,
    credit_limit: 1000.00,
    service_fee_balance: 0.00,
    created_at: new Date().toISOString(),
  },
];

export const initialCategories: Category[] = [
  {
    id: 'cat-groceries',
    household_id: 'hh-101',
    name: 'Groceries & Supplies',
    icon_slug: 'shopping-cart',
    category_type: 'expense',
    monthly_budget_limit: 15000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-utilities',
    household_id: 'hh-101',
    name: 'Utilities & Bills',
    icon_slug: 'zap',
    category_type: 'expense',
    monthly_budget_limit: 8000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-internet',
    household_id: 'hh-101',
    name: 'Internet & Broadband',
    icon_slug: 'wifi',
    category_type: 'expense',
    monthly_budget_limit: 2500.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-school-dues',
    household_id: 'hh-101',
    name: 'School Dues & Tuition',
    icon_slug: 'graduation-cap',
    category_type: 'expense',
    monthly_budget_limit: 10000.00,
    created_at: new Date().toISOString(),
  },
];

export const initialTransactions: Transaction[] = [];

export const initialSavingsGoals: SavingsGoal[] = [];

export const initialLoans: Loan[] = [];

export const initialRecurringTransfers: RecurringTransfer[] = [];

export const initialCustomRoles = DEFAULT_ROLES;
export const initialRolePermissions = DEFAULT_ROLE_PERMISSIONS;
