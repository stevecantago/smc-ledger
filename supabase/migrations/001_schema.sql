-- Migration 001: Core Database Schema Blueprint for Family Financial Tracker (KinLedger)

-- 0. Core Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Households (Tenant Boundary)
CREATE TABLE IF NOT EXISTS households (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(100) NOT NULL,
    base_currency VARCHAR(3) DEFAULT 'PHP' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Household Memberships
DO $$ BEGIN
    CREATE TYPE household_role AS ENUM ('admin', 'parent_member', 'member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS household_members (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id VARCHAR(100), -- references auth.users(id) after an authenticated user is linked
    role household_role DEFAULT 'member' NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(household_id, user_id)
);

-- 3. Wallets / Accounts
DO $$ BEGIN
    CREATE TYPE wallet_type AS ENUM ('bank', 'e_wallet', 'cash', 'credit_card');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS wallets (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    owner_id VARCHAR(100) REFERENCES household_members(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    wallet_type wallet_type NOT NULL,
    is_shared BOOLEAN DEFAULT TRUE NOT NULL,
    current_balance NUMERIC(14, 2) DEFAULT 0.00 NOT NULL,
    credit_limit NUMERIC(14, 2) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Budget Categories
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon_slug VARCHAR(50) DEFAULT 'receipt' NOT NULL,
    monthly_budget_limit NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Transactions Ledger
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'loan');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    wallet_id VARCHAR(100) NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    destination_wallet_id VARCHAR(100) REFERENCES wallets(id) ON DELETE RESTRICT, -- for transfers
    category_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
    payer_id VARCHAR(100) NOT NULL REFERENCES household_members(id) ON DELETE RESTRICT,
    type transaction_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(12, 2) DEFAULT 0.00,
    transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
    note TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Shared Goals / Sinking Funds
CREATE TABLE IF NOT EXISTS savings_goals (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
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
