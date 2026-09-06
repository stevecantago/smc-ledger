-- Migration 003: Phase 2 Enhancements - Loans, Amortizations, Recurring Allowance, and Receipt Storage

-- 1. Loans & Amortization Table
CREATE TABLE IF NOT EXISTS loans (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    source_wallet_id VARCHAR(100) REFERENCES wallets(id) ON DELETE SET NULL,
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

-- 2. Recurring Transfers / Automated Allowance Table
CREATE TABLE IF NOT EXISTS recurring_transfers (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) DEFAULT 'expense',
    source_wallet_id VARCHAR(100) NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    destination_wallet_id VARCHAR(100) REFERENCES wallets(id) ON DELETE CASCADE,
    category_id VARCHAR(100) REFERENCES categories(id) ON DELETE SET NULL,
    loan_id VARCHAR(100) REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    frequency VARCHAR(20) DEFAULT 'monthly' NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'bimonthly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom_days')),
    custom_interval_days INT,
    next_run_date DATE NOT NULL,
    note VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_transfers ENABLE ROW LEVEL SECURITY;

-- Loans RLS Policies
CREATE POLICY "Members can view loans" ON loans
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Admins can manage loans" ON loans
    FOR ALL USING (is_household_admin(household_id));

-- Recurring Transfers RLS Policies
CREATE POLICY "Members can view recurring transfers" ON recurring_transfers
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Admins can manage recurring transfers" ON recurring_transfers
    FOR ALL USING (is_household_admin(household_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_household ON loans(household_id);
CREATE INDEX IF NOT EXISTS idx_recurring_transfers_household ON recurring_transfers(household_id);
