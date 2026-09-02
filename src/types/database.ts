export type HouseholdRole = 'admin' | 'member';
export type WalletType = 'bank' | 'e_wallet' | 'cash';
export type TransactionType = 'income' | 'expense' | 'transfer';

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
  current_balance: number;
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
