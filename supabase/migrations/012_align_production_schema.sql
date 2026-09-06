-- Migration 012: Align production Supabase schema with app text IDs and secure auth flow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'household_role') THEN
    ALTER TYPE household_role ADD VALUE IF NOT EXISTS 'parent_member';
  ELSE
    CREATE TYPE household_role AS ENUM ('admin', 'parent_member', 'member');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_type') THEN
    CREATE TYPE wallet_type AS ENUM ('bank', 'e_wallet', 'cash', 'credit_card');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'loan');
  END IF;
END $$;

DROP POLICY IF EXISTS "Members can view their household" ON households;
DROP POLICY IF EXISTS "Admins can update household settings" ON households;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
DROP POLICY IF EXISTS "Authenticated users can view their unlinked member row" ON household_members;
DROP POLICY IF EXISTS "Authenticated users can claim their member row" ON household_members;
DROP POLICY IF EXISTS "Admins can manage household members" ON household_members;
DROP POLICY IF EXISTS "View wallets policy" ON wallets;
DROP POLICY IF EXISTS "Create wallets policy" ON wallets;
DROP POLICY IF EXISTS "Update/Delete wallets policy" ON wallets;
DROP POLICY IF EXISTS "Members can view categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Members can view household transactions" ON transactions;
DROP POLICY IF EXISTS "Members can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Update transactions policy" ON transactions;
DROP POLICY IF EXISTS "Delete transactions policy" ON transactions;
DROP POLICY IF EXISTS "Members can view savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Members can fund savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Admins can create/delete savings goals" ON savings_goals;

DROP TRIGGER IF EXISTS trg_update_wallet_balance ON transactions;
DROP FUNCTION IF EXISTS update_wallet_balances_on_transaction();
DROP FUNCTION IF EXISTS is_household_member(UUID);
DROP FUNCTION IF EXISTS is_household_admin(UUID);
DROP FUNCTION IF EXISTS is_household_member(VARCHAR);
DROP FUNCTION IF EXISTS is_household_admin(VARCHAR);

ALTER TABLE IF EXISTS transactions DROP CONSTRAINT IF EXISTS transactions_household_id_fkey;
ALTER TABLE IF EXISTS transactions DROP CONSTRAINT IF EXISTS transactions_wallet_id_fkey;
ALTER TABLE IF EXISTS transactions DROP CONSTRAINT IF EXISTS transactions_destination_wallet_id_fkey;
ALTER TABLE IF EXISTS transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
ALTER TABLE IF EXISTS transactions DROP CONSTRAINT IF EXISTS transactions_payer_id_fkey;
ALTER TABLE IF EXISTS savings_goals DROP CONSTRAINT IF EXISTS savings_goals_household_id_fkey;
ALTER TABLE IF EXISTS wallets DROP CONSTRAINT IF EXISTS wallets_household_id_fkey;
ALTER TABLE IF EXISTS wallets DROP CONSTRAINT IF EXISTS wallets_owner_id_fkey;
ALTER TABLE IF EXISTS categories DROP CONSTRAINT IF EXISTS categories_household_id_fkey;
ALTER TABLE IF EXISTS household_members DROP CONSTRAINT IF EXISTS household_members_household_id_fkey;
ALTER TABLE IF EXISTS loans DROP CONSTRAINT IF EXISTS loans_household_id_fkey;
ALTER TABLE IF EXISTS loans DROP CONSTRAINT IF EXISTS loans_source_wallet_id_fkey;
ALTER TABLE IF EXISTS recurring_transfers DROP CONSTRAINT IF EXISTS recurring_transfers_household_id_fkey;
ALTER TABLE IF EXISTS recurring_transfers DROP CONSTRAINT IF EXISTS recurring_transfers_source_wallet_id_fkey;
ALTER TABLE IF EXISTS recurring_transfers DROP CONSTRAINT IF EXISTS recurring_transfers_destination_wallet_id_fkey;
ALTER TABLE IF EXISTS recurring_transfers DROP CONSTRAINT IF EXISTS recurring_transfers_category_id_fkey;
ALTER TABLE IF EXISTS recurring_transfers DROP CONSTRAINT IF EXISTS recurring_transfers_loan_id_fkey;
ALTER TABLE IF EXISTS activity_logs DROP CONSTRAINT IF EXISTS activity_logs_household_id_fkey;

ALTER TABLE IF EXISTS households ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS household_members ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS household_members ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS household_members ALTER COLUMN user_id TYPE VARCHAR(100) USING user_id::text;
ALTER TABLE IF EXISTS household_members ALTER COLUMN role TYPE VARCHAR(50) USING role::text;
ALTER TABLE IF EXISTS household_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS wallets ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS wallets ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS wallets ALTER COLUMN owner_id TYPE VARCHAR(100) USING owner_id::text;
ALTER TABLE IF EXISTS wallets ALTER COLUMN wallet_type TYPE VARCHAR(50) USING wallet_type::text;
ALTER TABLE IF EXISTS wallets ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(14, 2) DEFAULT NULL;
ALTER TABLE IF EXISTS categories ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS categories ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN wallet_id TYPE VARCHAR(100) USING wallet_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN destination_wallet_id TYPE VARCHAR(100) USING destination_wallet_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN category_id TYPE VARCHAR(100) USING category_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN payer_id TYPE VARCHAR(100) USING payer_id::text;
ALTER TABLE IF EXISTS transactions ALTER COLUMN type TYPE VARCHAR(50) USING type::text;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS fee NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS savings_goals ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS savings_goals ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;

CREATE TABLE IF NOT EXISTS savings_goals (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  household_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (current_amount >= 0),
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  household_id VARCHAR(100) NOT NULL,
  source_wallet_id VARCHAR(100),
  name VARCHAR(100) NOT NULL,
  lender VARCHAR(100) NOT NULL,
  total_principal NUMERIC(14, 2) NOT NULL CHECK (total_principal > 0),
  remaining_balance NUMERIC(14, 2) NOT NULL CHECK (remaining_balance >= 0),
  total_amortizations INT,
  paid_amortizations_count INT DEFAULT 0,
  amount_paid NUMERIC(12, 2) DEFAULT 0.00,
  interest_rate_annual NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
  monthly_amortization NUMERIC(12, 2) NOT NULL CHECK (monthly_amortization > 0),
  payment_frequency VARCHAR(20) DEFAULT 'monthly',
  due_day_of_month INT DEFAULT 1 NOT NULL CHECK (due_day_of_month BETWEEN 1 AND 31),
  second_due_day_of_month INTEGER,
  next_due_date DATE,
  start_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE IF EXISTS loans ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS loans ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS source_wallet_id VARCHAR(100);
ALTER TABLE IF EXISTS loans ALTER COLUMN source_wallet_id TYPE VARCHAR(100) USING source_wallet_id::text;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS total_amortizations INT;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS paid_amortizations_count INT DEFAULT 0;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS second_due_day_of_month INTEGER;
ALTER TABLE IF EXISTS loans ADD COLUMN IF NOT EXISTS next_due_date DATE;

CREATE TABLE IF NOT EXISTS recurring_transfers (
  id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  household_id VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) DEFAULT 'expense',
  source_wallet_id VARCHAR(100) NOT NULL,
  destination_wallet_id VARCHAR(100),
  category_id VARCHAR(100),
  loan_id VARCHAR(100),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  frequency VARCHAR(20) DEFAULT 'monthly' NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'bimonthly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom_days')),
  custom_interval_days INT,
  next_run_date DATE NOT NULL,
  note VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN source_wallet_id TYPE VARCHAR(100) USING source_wallet_id::text;
ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN destination_wallet_id TYPE VARCHAR(100) USING destination_wallet_id::text;
ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN destination_wallet_id DROP NOT NULL;
ALTER TABLE IF EXISTS recurring_transfers ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50) DEFAULT 'expense';
ALTER TABLE IF EXISTS recurring_transfers ALTER COLUMN rule_type TYPE VARCHAR(50) USING rule_type::text;
ALTER TABLE IF EXISTS recurring_transfers ADD COLUMN IF NOT EXISTS category_id VARCHAR(100);
ALTER TABLE IF EXISTS recurring_transfers ADD COLUMN IF NOT EXISTS custom_interval_days INT;
ALTER TABLE IF EXISTS recurring_transfers ADD COLUMN IF NOT EXISTS loan_id VARCHAR(100);

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  household_id VARCHAR(100),
  member_id VARCHAR(100),
  member_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS activity_logs ALTER COLUMN id TYPE VARCHAR(100) USING id::text;
ALTER TABLE IF EXISTS activity_logs ALTER COLUMN household_id TYPE VARCHAR(100) USING household_id::text;
ALTER TABLE IF EXISTS activity_logs ALTER COLUMN member_id TYPE VARCHAR(100) USING member_id::text;

ALTER TABLE household_members
  ADD CONSTRAINT household_members_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE wallets
  ADD CONSTRAINT wallets_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE wallets
  ADD CONSTRAINT wallets_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES household_members(id) ON DELETE SET NULL;
ALTER TABLE categories
  ADD CONSTRAINT categories_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_wallet_id_fkey
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_destination_wallet_id_fkey
  FOREIGN KEY (destination_wallet_id) REFERENCES wallets(id) ON DELETE RESTRICT;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_payer_id_fkey
  FOREIGN KEY (payer_id) REFERENCES household_members(id) ON DELETE RESTRICT;
ALTER TABLE savings_goals
  ADD CONSTRAINT savings_goals_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE loans
  ADD CONSTRAINT loans_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE loans
  ADD CONSTRAINT loans_source_wallet_id_fkey
  FOREIGN KEY (source_wallet_id) REFERENCES wallets(id) ON DELETE SET NULL;
ALTER TABLE recurring_transfers
  ADD CONSTRAINT recurring_transfers_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
ALTER TABLE recurring_transfers
  ADD CONSTRAINT recurring_transfers_source_wallet_id_fkey
  FOREIGN KEY (source_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE recurring_transfers
  ADD CONSTRAINT recurring_transfers_destination_wallet_id_fkey
  FOREIGN KEY (destination_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;
ALTER TABLE recurring_transfers
  ADD CONSTRAINT recurring_transfers_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE recurring_transfers
  ADD CONSTRAINT recurring_transfers_loan_id_fkey
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
ALTER TABLE activity_logs
  ADD CONSTRAINT activity_logs_household_id_fkey
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their household" ON households;
DROP POLICY IF EXISTS "Admins can update household settings" ON households;
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
DROP POLICY IF EXISTS "Authenticated users can view their unlinked member row" ON household_members;
DROP POLICY IF EXISTS "Authenticated users can claim their member row" ON household_members;
DROP POLICY IF EXISTS "Admins can manage household members" ON household_members;
DROP POLICY IF EXISTS "View wallets policy" ON wallets;
DROP POLICY IF EXISTS "Create wallets policy" ON wallets;
DROP POLICY IF EXISTS "Update/Delete wallets policy" ON wallets;
DROP POLICY IF EXISTS "Members can view categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Members can view household transactions" ON transactions;
DROP POLICY IF EXISTS "Members can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Update transactions policy" ON transactions;
DROP POLICY IF EXISTS "Delete transactions policy" ON transactions;
DROP POLICY IF EXISTS "Members can view savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Members can fund savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Admins can create/delete savings goals" ON savings_goals;
DROP POLICY IF EXISTS "Members can view loans" ON loans;
DROP POLICY IF EXISTS "Admins can manage loans" ON loans;
DROP POLICY IF EXISTS "Members can view recurring transfers" ON recurring_transfers;
DROP POLICY IF EXISTS "Admins can manage recurring transfers" ON recurring_transfers;
DROP POLICY IF EXISTS "Members can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Admins can manage activity logs" ON activity_logs;

DROP FUNCTION IF EXISTS is_household_member(UUID);
DROP FUNCTION IF EXISTS is_household_admin(UUID);
DROP FUNCTION IF EXISTS is_household_member(VARCHAR);
DROP FUNCTION IF EXISTS is_household_admin(VARCHAR);

CREATE OR REPLACE FUNCTION is_household_member(h_id VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = h_id
      AND user_id = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_household_admin(h_id VARCHAR(100))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = h_id
      AND user_id = auth.uid()::text
      AND role IN ('admin', 'parent_member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Members can view their household" ON households
  FOR SELECT USING (is_household_member(id));
CREATE POLICY "Admins can update household settings" ON households
  FOR UPDATE USING (is_household_admin(id));
CREATE POLICY "Members can view household members" ON household_members
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Authenticated users can view their unlinked member row" ON household_members
  FOR SELECT USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );
CREATE POLICY "Authenticated users can claim their member row" ON household_members
  FOR UPDATE USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    user_id = auth.uid()::text
    AND email IS NOT NULL
    AND lower(email) = lower(auth.jwt() ->> 'email')
  );
CREATE POLICY "Admins can manage household members" ON household_members
  FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "View wallets policy" ON wallets
  FOR SELECT USING (
    is_household_member(household_id)
    AND (
      is_shared = TRUE
      OR owner_id IN (SELECT id FROM household_members WHERE user_id = auth.uid()::text)
      OR is_household_admin(household_id)
    )
  );
CREATE POLICY "Create wallets policy" ON wallets
  FOR INSERT WITH CHECK (
    is_household_member(household_id)
    AND (
      is_household_admin(household_id)
      OR is_shared = FALSE
    )
  );
CREATE POLICY "Update/Delete wallets policy" ON wallets
  FOR ALL USING (
    is_household_admin(household_id)
    OR owner_id IN (SELECT id FROM household_members WHERE user_id = auth.uid()::text)
  );
CREATE POLICY "Members can view categories" ON categories
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "Members can view household transactions" ON transactions
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Members can insert transactions" ON transactions
  FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "Update transactions policy" ON transactions
  FOR UPDATE USING (
    is_household_admin(household_id)
    OR (
      payer_id IN (SELECT id FROM household_members WHERE user_id = auth.uid()::text)
      AND created_at >= (NOW() - INTERVAL '24 hours')
    )
  );
CREATE POLICY "Delete transactions policy" ON transactions
  FOR DELETE USING (
    is_household_admin(household_id)
    OR (
      payer_id IN (SELECT id FROM household_members WHERE user_id = auth.uid()::text)
      AND created_at >= (NOW() - INTERVAL '24 hours')
    )
  );
CREATE POLICY "Members can view savings goals" ON savings_goals
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Members can fund savings goals" ON savings_goals
  FOR UPDATE USING (is_household_member(household_id));
CREATE POLICY "Admins can create/delete savings goals" ON savings_goals
  FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "Members can view loans" ON loans
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Admins can manage loans" ON loans
  FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "Members can view recurring transfers" ON recurring_transfers
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Admins can manage recurring transfers" ON recurring_transfers
  FOR ALL USING (is_household_admin(household_id));
CREATE POLICY "Members can view activity logs" ON activity_logs
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "Admins can manage activity logs" ON activity_logs
  FOR ALL USING (is_household_admin(household_id));

CREATE OR REPLACE FUNCTION update_wallet_balances_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.type = 'expense' OR NEW.type = 'loan') THEN
      UPDATE wallets SET current_balance = current_balance - NEW.amount - COALESCE(NEW.fee, 0) WHERE id = NEW.wallet_id;
    ELSIF (NEW.type = 'income') THEN
      UPDATE wallets SET current_balance = current_balance + NEW.amount - COALESCE(NEW.fee, 0) WHERE id = NEW.wallet_id;
    ELSIF (NEW.type = 'transfer') THEN
      UPDATE wallets SET current_balance = current_balance - NEW.amount - COALESCE(NEW.fee, 0) WHERE id = NEW.wallet_id;
      IF (NEW.destination_wallet_id IS NOT NULL) THEN
        UPDATE wallets SET current_balance = current_balance + NEW.amount WHERE id = NEW.destination_wallet_id;
      END IF;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF (OLD.type = 'expense' OR OLD.type = 'loan') THEN
      UPDATE wallets SET current_balance = current_balance + OLD.amount + COALESCE(OLD.fee, 0) WHERE id = OLD.wallet_id;
    ELSIF (OLD.type = 'income') THEN
      UPDATE wallets SET current_balance = current_balance - OLD.amount + COALESCE(OLD.fee, 0) WHERE id = OLD.wallet_id;
    ELSIF (OLD.type = 'transfer') THEN
      UPDATE wallets SET current_balance = current_balance + OLD.amount + COALESCE(OLD.fee, 0) WHERE id = OLD.wallet_id;
      IF (OLD.destination_wallet_id IS NOT NULL) THEN
        UPDATE wallets SET current_balance = current_balance - OLD.amount WHERE id = OLD.destination_wallet_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_wallet_balance ON transactions;
CREATE TRIGGER trg_update_wallet_balance
AFTER INSERT OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_wallet_balances_on_transaction();

CREATE INDEX IF NOT EXISTS idx_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_wallets_household ON wallets(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_household ON savings_goals(household_id);
CREATE INDEX IF NOT EXISTS idx_loans_household ON loans(household_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_household ON recurring_transfers(household_id);

WITH steve_user AS (
  SELECT id::text AS user_id
  FROM auth.users
  WHERE lower(email) = 'steve.cantago@gmail.com'
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO households (id, name, base_currency)
VALUES ('hh-101', 'Cantago Family Household', 'PHP')
ON CONFLICT (id) DO NOTHING;

WITH steve_user AS (
  SELECT id::text AS user_id
  FROM auth.users
  WHERE lower(email) = 'steve.cantago@gmail.com'
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO household_members (id, household_id, user_id, role, display_name, email)
SELECT
  'member-steve-admin',
  'hh-101',
  (SELECT user_id FROM steve_user),
  'admin',
  'Steve Cantago (Head Admin Parent)',
  'steve.cantago@gmail.com'
ON CONFLICT (id) DO UPDATE
SET user_id = COALESCE(EXCLUDED.user_id, household_members.user_id),
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email;

INSERT INTO categories (id, household_id, name, icon_slug, monthly_budget_limit) VALUES
('cat-groceries', 'hh-101', 'Groceries & Supplies', 'shopping-cart', 15000.00),
('cat-utilities', 'hh-101', 'Utilities & Bills', 'zap', 8000.00),
('cat-internet', 'hh-101', 'Internet & Broadband', 'wifi', 2500.00),
('cat-school-dues', 'hh-101', 'School Dues & Tuition', 'graduation-cap', 10000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallets (id, household_id, owner_id, name, wallet_type, is_shared, current_balance, credit_limit) VALUES
('wallet-maya-e', 'hh-101', 'member-steve-admin', 'Maya Wallet', 'e_wallet', true, 0.00, NULL),
('wallet-maya-credit', 'hh-101', 'member-steve-admin', 'Maya Credit', 'credit_card', false, 0.00, 30000.00),
('wallet-maya-black', 'hh-101', 'member-steve-admin', 'Maya Black Card', 'credit_card', false, 0.00, 50000.00),
('wallet-gcash-e', 'hh-101', 'member-steve-admin', 'GCash Wallet', 'e_wallet', true, 0.00, NULL),
('wallet-gcash-cimb', 'hh-101', 'member-steve-admin', 'GCash CIMB GSave', 'bank', true, 0.00, NULL),
('wallet-gcash-uno', 'hh-101', 'member-steve-admin', 'GCash UNO Bank', 'bank', true, 0.00, NULL),
('wallet-ownbank', 'hh-101', 'member-steve-admin', 'OwnBank Savings', 'bank', true, 0.00, NULL),
('wallet-metrobank', 'hh-101', 'member-steve-admin', 'Metrobank Account', 'bank', true, 0.00, NULL),
('wallet-gotyme-e', 'hh-101', 'member-steve-admin', 'GoTyme Everyday Wallet', 'e_wallet', true, 0.00, NULL),
('wallet-gotyme-save', 'hh-101', 'member-steve-admin', 'GoTyme GoSave Account', 'bank', true, 0.00, NULL),
('wallet-unionbank-cc', 'hh-101', 'member-steve-admin', 'UnionBank Credit Card', 'credit_card', false, 0.00, 100000.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO loans (
  id, household_id, name, lender, total_principal, remaining_balance, amount_paid,
  interest_rate_annual, monthly_amortization, payment_frequency, due_day_of_month,
  second_due_day_of_month, next_due_date, start_date
) VALUES (
  'loan-housing-bdo', 'hh-101', 'BDO Housing Loan Mortgage', 'BDO Unibank',
  1500000.00, 1425000.00, 75000.00, 6.5, 15000.00, 'bi_monthly', 15, 30,
  '2026-09-15', CURRENT_DATE
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON COLUMN transactions.fee IS 'Processing, transaction, or transfer fee in PHP';
COMMENT ON TABLE activity_logs IS 'Audit trail logging all household wallet, loan, transaction, and admin actions';
