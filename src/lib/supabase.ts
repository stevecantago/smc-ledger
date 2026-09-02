import { createClient } from '@supabase/supabase-js';
import { Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Demo / Seed initial state for local interactive testing (PHP Currency)
export const initialHousehold: Household = {
  id: 'hh-101',
  name: 'SMCLedger Family Household',
  base_currency: 'PHP',
  created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

export const initialMembers: HouseholdMember[] = [
  {
    id: 'member-parent-1',
    household_id: 'hh-101',
    user_id: 'usr-parent-1',
    role: 'admin',
    display_name: 'David Miller (Parent)',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'member-parent-2',
    household_id: 'hh-101',
    user_id: 'usr-parent-2',
    role: 'admin',
    display_name: 'Sarah Miller (Parent)',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'member-teen-1',
    household_id: 'hh-101',
    user_id: 'usr-teen-1',
    role: 'member',
    display_name: 'Alex Miller (Teen)',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

export const initialWallets: Wallet[] = [
  {
    id: 'wallet-main-bank',
    household_id: 'hh-101',
    owner_id: 'member-parent-1',
    name: 'BDO / BPI Checking (Shared Family)',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 84500.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'wallet-savings-bank',
    household_id: 'hh-101',
    owner_id: 'member-parent-1',
    name: 'High-Yield Reserve',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 142000.50,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'wallet-parent-ewallet',
    household_id: 'hh-101',
    owner_id: 'member-parent-2',
    name: 'GCash / Maya (Sarah)',
    wallet_type: 'e_wallet',
    is_shared: true,
    current_balance: 6200.00,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'wallet-teen-cash',
    household_id: 'hh-101',
    owner_id: 'member-teen-1',
    name: 'Alex Allowance & Cash',
    wallet_type: 'cash',
    is_shared: false, // Private to Alex / Admin view
    current_balance: 1450.00,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

export const initialCategories: Category[] = [
  {
    id: 'cat-groceries',
    household_id: 'hh-101',
    name: 'Groceries & Supplies',
    icon_slug: 'shopping-cart',
    monthly_budget_limit: 25000.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cat-utilities',
    household_id: 'hh-101',
    name: 'Utilities & Meralco Bills',
    icon_slug: 'zap',
    monthly_budget_limit: 8500.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cat-dining',
    household_id: 'hh-101',
    name: 'Dining & Takeout',
    icon_slug: 'utensils',
    monthly_budget_limit: 12000.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cat-entertainment',
    household_id: 'hh-101',
    name: 'Family Activities & Movies',
    icon_slug: 'film',
    monthly_budget_limit: 5000.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'cat-education',
    household_id: 'hh-101',
    name: 'Books & School Supplies',
    icon_slug: 'book-open',
    monthly_budget_limit: 6000.00,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

const now = Date.now();
const hourAgo = new Date(now - 3 * 3600000).toISOString();
const yesterday = new Date(now - 48 * 3600000).toISOString();

export const initialTransactions: Transaction[] = [
  {
    id: 'tx-101',
    household_id: 'hh-101',
    wallet_id: 'wallet-main-bank',
    destination_wallet_id: null,
    category_id: 'cat-groceries',
    payer_id: 'member-parent-2',
    type: 'expense',
    amount: 3845.00,
    transaction_date: new Date(now - 12 * 3600000).toISOString().split('T')[0],
    note: 'Weekly Supermarket grocery haul',
    receipt_url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
    created_at: hourAgo,
  },
  {
    id: 'tx-102',
    household_id: 'hh-101',
    wallet_id: 'wallet-main-bank',
    destination_wallet_id: null,
    category_id: 'cat-utilities',
    payer_id: 'member-parent-1',
    type: 'expense',
    amount: 4165.20,
    transaction_date: new Date(now - 36 * 3600000).toISOString().split('T')[0],
    note: 'Meralco Electric Bill',
    receipt_url: null,
    created_at: yesterday,
  },
  {
    id: 'tx-103',
    household_id: 'hh-101',
    wallet_id: 'wallet-parent-ewallet',
    destination_wallet_id: 'wallet-teen-cash',
    category_id: null,
    payer_id: 'member-parent-1',
    type: 'transfer',
    amount: 1000.00,
    transaction_date: new Date(now - 2 * 3600000).toISOString().split('T')[0],
    note: 'Weekly allowance GCash transfer to Alex',
    receipt_url: null,
    created_at: hourAgo,
  },
  {
    id: 'tx-104',
    household_id: 'hh-101',
    wallet_id: 'wallet-teen-cash',
    destination_wallet_id: null,
    category_id: 'cat-education',
    payer_id: 'member-teen-1',
    type: 'expense',
    amount: 450.00,
    transaction_date: new Date(now - 1 * 3600000).toISOString().split('T')[0],
    note: 'Math Workbook for class',
    receipt_url: null,
    created_at: hourAgo,
  },
  {
    id: 'tx-105',
    household_id: 'hh-101',
    wallet_id: 'wallet-teen-cash',
    destination_wallet_id: null,
    category_id: 'cat-dining',
    payer_id: 'member-teen-1',
    type: 'expense',
    amount: 180.00,
    transaction_date: new Date(now - 72 * 3600000).toISOString().split('T')[0],
    note: 'Boba tea with school friends',
    receipt_url: null,
    created_at: new Date(now - 72 * 3600000).toISOString(),
  },
];

export const initialSavingsGoals: SavingsGoal[] = [
  {
    id: 'goal-vacation',
    household_id: 'hh-101',
    name: 'Summer Family Trip to Japan',
    target_amount: 250000.00,
    current_amount: 160000.00,
    target_date: '2026-07-15',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'goal-emergency',
    household_id: 'hh-101',
    name: 'Household Emergency Sinking Fund',
    target_amount: 500000.00,
    current_amount: 425000.00,
    target_date: '2026-12-31',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'goal-laptop',
    household_id: 'hh-101',
    name: 'Alex College Laptop Fund',
    target_amount: 60000.00,
    current_amount: 37500.00,
    target_date: '2026-09-01',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];
