import { createClient } from '@supabase/supabase-js';
import { Household, HouseholdMember, Wallet, Category, Transaction, SavingsGoal, Loan, RecurringTransfer } from '../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initial State for Steve Cantago Family Household (PHP Currency)
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

// Pre-populated Default Family Accounts & Credit Lines (Prevents zero-data loss)
export const initialWallets: Wallet[] = [
  {
    id: 'wallet-maya-e',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'Maya Wallet',
    wallet_type: 'e_wallet',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-maya-credit',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'Maya Credit',
    wallet_type: 'credit_card',
    is_shared: false,
    current_balance: 0.00,
    credit_limit: 30000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-maya-black',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'Maya Black Card',
    wallet_type: 'credit_card',
    is_shared: false,
    current_balance: 0.00,
    credit_limit: 50000.00,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-gcash-e',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'GCash Wallet',
    wallet_type: 'e_wallet',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-gcash-cimb',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'GCash CIMB GSave',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-gcash-uno',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'GCash UNO Bank',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-ownbank',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'OwnBank Savings',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-metrobank',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'Metrobank Account',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-gotyme-e',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'GoTyme Everyday Wallet',
    wallet_type: 'e_wallet',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-gotyme-save',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'GoTyme GoSave Account',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 0.00,
    credit_limit: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'wallet-unionbank-cc',
    household_id: 'hh-101',
    owner_id: 'member-steve-admin',
    name: 'UnionBank Credit Card',
    wallet_type: 'credit_card',
    is_shared: false,
    current_balance: 0.00,
    credit_limit: 100000.00,
    created_at: new Date().toISOString(),
  },
];

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

export const initialLoans: Loan[] = [
  {
    id: 'loan-housing-bdo',
    household_id: 'hh-101',
    name: 'BDO Housing Loan Mortgage',
    lender: 'BDO Unibank',
    total_principal: 1500000.00,
    remaining_balance: 1425000.00,
    amount_paid: 75000.00,
    interest_rate_annual: 6.5,
    monthly_amortization: 15000.00,
    payment_frequency: 'bi_monthly',
    due_day_of_month: 15,
    second_due_day_of_month: 30,
    next_due_date: '2026-09-15',
    start_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  },
];

export const initialRecurringTransfers: RecurringTransfer[] = [];
