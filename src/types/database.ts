export type HouseholdRole = 'admin' | 'parent_member' | 'member';
export type WalletType = 'bank' | 'e_wallet' | 'cash' | 'credit_card';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom_days';
export type RecurringRuleType = 'transfer' | 'expense';
export type LoanPaymentFrequency = 'monthly' | 'bi_monthly';

export type ActivityLogAction = 
  | 'create_wallet' | 'update_wallet' | 'delete_wallet'
  | 'create_loan' | 'update_loan' | 'delete_loan' | 'pay_loan'
  | 'create_tx' | 'update_tx' | 'delete_tx'
  | 'create_category' | 'update_category' | 'delete_category'
  | 'create_goal' | 'fund_goal' | 'delete_goal'
  | 'create_member' | 'update_member' | 'delete_member'
  | 'auth_login' | 'auth_logout' | 'backup_export' | 'backup_restore';

export interface Household {
  id: string;
  name: string;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  display_name: string;
  email?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  household_id: string;
  owner_id: string | null;
  name: string;
  wallet_type: WalletType;
  is_shared: boolean;
  current_balance: number; // For credit_card, this is used/outstanding balance
  credit_limit?: number | null; // Approved credit limit line (e.g. 150000.00)
  created_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  icon_slug: string;
  monthly_budget_limit: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  wallet_id: string;
  destination_wallet_id?: string | null;
  category_id?: string | null;
  payer_id: string;
  type: TransactionType;
  amount: number;
  fee?: number | null; // Processing / transaction / transfer fee
  transaction_date: string;
  note?: string | null;
  receipt_url?: string | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  household_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date?: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  household_id: string;
  name: string;
  lender: string;
  total_principal: number;
  remaining_balance: number;
  amount_paid?: number; // Total principal/amortization paid to date
  interest_rate_annual: number;
  monthly_amortization: number;
  payment_frequency?: LoanPaymentFrequency;
  due_day_of_month: number;
  second_due_day_of_month?: number | null; // e.g. Day 30 for 15th & 30th bi-monthly schedule
  next_due_date?: string | null; // Explicit upcoming due date (e.g. "2026-09-15")
  start_date: string;
  created_at: string;
}

export interface RecurringTransfer {
  id: string;
  household_id: string;
  rule_type: RecurringRuleType;
  source_wallet_id: string;
  destination_wallet_id?: string | null;
  category_id?: string | null;
  amount: number;
  frequency: RecurringFrequency;
  custom_interval_days?: number | null;
  next_run_date: string;
  note: string;
  is_active: boolean;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  household_id: string;
  member_id: string;
  member_name: string;
  action: ActivityLogAction;
  description: string;
  details?: any;
  created_at: string;
}
