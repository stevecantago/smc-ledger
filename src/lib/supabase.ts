import { createClient } from '@supabase/supabase-js';
import { Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal, Loan, RecurringTransfer } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Clean Slate Initial State for Steve Cantago Family Household (PHP Currency)
export const initialHousehold: Household = {
  id: 'hh-101',
  name: 'Cantago Family Household',
  base_currency: 'PHP',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const initialMembers: HouseholdMember[] = [
  {
    id: 'member-steve-admin',
    household_id: 'hh-101',
    user_id: 'usr-steve-admin',
    role: 'admin',
    display_name: 'Steve Cantago (Head Admin Parent)',
    email: 'steve.cantago@gmail.com',
    created_at: new Date().toISOString(),
  },
];

export const initialWallets: Wallet[] = [];

export const initialCategories: Category[] = [
  {
    id: 'cat-groceries',
    household_id: 'hh-101',
    name: 'Groceries & Supplies',
    icon_slug: 'shopping-cart',
    monthly_budget_limit: 15000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-utilities',
    household_id: 'hh-101',
    name: 'Utilities & Bills',
    icon_slug: 'zap',
    monthly_budget_limit: 8000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-internet',
    household_id: 'hh-101',
    name: 'Internet & Broadband',
    icon_slug: 'wifi',
    monthly_budget_limit: 2500.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cat-school-dues',
    household_id: 'hh-101',
    name: 'School Dues & Tuition',
    icon_slug: 'graduation-cap',
    monthly_budget_limit: 10000.00,
    created_at: new Date().toISOString(),
  },
];

export const initialTransactions: Transaction[] = [];

export const initialSavingsGoals: SavingsGoal[] = [];

export const initialLoans: Loan[] = [];

export const initialRecurringTransfers: RecurringTransfer[] = [];
