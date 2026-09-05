-- Migration 009: Ensure Full Schema Alignment for Supabase Persistence across all App Entities

-- 1. Ensure households table columns support string IDs
ALTER TABLE households ALTER COLUMN id TYPE VARCHAR(100);

-- 2. Household Members Table Enhancements
ALTER TABLE household_members ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE household_members ALTER COLUMN household_id TYPE VARCHAR(100);
ALTER TABLE household_members ALTER COLUMN user_id TYPE VARCHAR(100);
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 3. Wallets Table Enhancements
ALTER TABLE wallets ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE wallets ALTER COLUMN household_id TYPE VARCHAR(100);
ALTER TABLE wallets ALTER COLUMN owner_id TYPE VARCHAR(100);
ALTER TABLE wallets ALTER COLUMN wallet_type TYPE VARCHAR(50);
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2) DEFAULT NULL;

-- 4. Categories Table Enhancements
ALTER TABLE categories ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE categories ALTER COLUMN household_id TYPE VARCHAR(100);

-- 5. Transactions Table Enhancements
ALTER TABLE transactions ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN household_id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN wallet_id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN destination_wallet_id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN category_id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN payer_id TYPE VARCHAR(100);
ALTER TABLE transactions ALTER COLUMN type TYPE VARCHAR(50);

-- 6. Savings Goals Table Enhancements
ALTER TABLE savings_goals ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE savings_goals ALTER COLUMN household_id TYPE VARCHAR(100);

-- 7. Loans Table Enhancements
ALTER TABLE loans ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE loans ALTER COLUMN household_id TYPE VARCHAR(100);

-- 8. Recurring Transfers Table Enhancements
ALTER TABLE recurring_transfers ALTER COLUMN id TYPE VARCHAR(100);
ALTER TABLE recurring_transfers ALTER COLUMN household_id TYPE VARCHAR(100);
ALTER TABLE recurring_transfers ALTER COLUMN source_wallet_id TYPE VARCHAR(100);
ALTER TABLE recurring_transfers ALTER COLUMN destination_wallet_id TYPE VARCHAR(100);
ALTER TABLE recurring_transfers ALTER COLUMN destination_wallet_id DROP NOT NULL;
ALTER TABLE recurring_transfers ADD COLUMN IF NOT EXISTS rule_type VARCHAR(20) DEFAULT 'expense';
ALTER TABLE recurring_transfers ADD COLUMN IF NOT EXISTS category_id VARCHAR(100);
ALTER TABLE recurring_transfers ADD COLUMN IF NOT EXISTS custom_interval_days INT;
