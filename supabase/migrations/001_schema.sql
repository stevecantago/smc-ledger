-- Migration 001: Core Database Schema Blueprint for Family Financial Tracker (KinLedger)

-- 0. Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Households (Tenant Boundary)
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'PHP' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Household Memberships
DO $$ BEGIN
    CREATE TYPE household_role AS ENUM ('admin', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS household_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references auth.users(id)
    role household_role DEFAULT 'member' NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(household_id, user_id)
);

-- 3. Wallets / Accounts
DO $$ BEGIN
    CREATE TYPE wallet_type AS ENUM ('bank', 'e_wallet', 'cash');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    wallet_type wallet_type NOT NULL,
    is_shared BOOLEAN DEFAULT TRUE NOT NULL,
    current_balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Budget Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon_slug VARCHAR(50) DEFAULT 'receipt' NOT NULL,
    monthly_budget_limit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Transactions Ledger
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    destination_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT, -- for transfers
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    type transaction_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
    note TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Shared Goals / Sinking Funds
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (current_amount >= 0),
    target_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for optimal querying across tenant boundaries
CREATE INDEX IF NOT EXISTS idx_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_wallets_household ON wallets(household_id);
CREATE INDEX IF NOT EXISTS idx_categories_household ON categories(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_household ON savings_goals(household_id);
