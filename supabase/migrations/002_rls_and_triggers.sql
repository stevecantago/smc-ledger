-- Migration 002: Row-Level Security (RLS) Policies and Automated Balance Triggers

-- Enable Row Level Security on all tenant tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Helper function to check current user's membership in household
CREATE OR REPLACE FUNCTION is_household_member(h_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM household_members 
        WHERE household_id = h_id 
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is Admin in household
CREATE OR REPLACE FUNCTION is_household_admin(h_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM household_members 
        WHERE household_id = h_id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Households RLS
CREATE POLICY "Members can view their household" ON households
    FOR SELECT USING (is_household_member(id));

CREATE POLICY "Admins can update household settings" ON households
    FOR UPDATE USING (is_household_admin(id));

-- 2. Household Members RLS
CREATE POLICY "Members can view household members" ON household_members
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Admins can manage household members" ON household_members
    FOR ALL USING (is_household_admin(household_id));

-- 3. Wallets RLS
-- Shared wallets visible to all household members; Private wallets visible only to owner or household admins
CREATE POLICY "View wallets policy" ON wallets
    FOR SELECT USING (
        is_household_member(household_id) AND (
            is_shared = TRUE 
            OR owner_id IN (SELECT id FROM household_members WHERE user_id = auth.uid())
            OR is_household_admin(household_id)
        )
    );

CREATE POLICY "Create wallets policy" ON wallets
    FOR INSERT WITH CHECK (
        is_household_member(household_id) AND (
            is_household_admin(household_id) OR is_shared = FALSE
        )
    );

CREATE POLICY "Update/Delete wallets policy" ON wallets
    FOR ALL USING (
        is_household_admin(household_id) OR owner_id IN (SELECT id FROM household_members WHERE user_id = auth.uid())
    );

-- 4. Categories RLS
CREATE POLICY "Members can view categories" ON categories
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (is_household_admin(household_id));

-- 5. Transactions RLS
CREATE POLICY "Members can view household transactions" ON transactions
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Members can insert transactions" ON transactions
    FOR INSERT WITH CHECK (is_household_member(household_id));

-- Member edit/delete restricted to own transactions created within 24 hours; Admin can edit/delete any
CREATE POLICY "Update transactions policy" ON transactions
    FOR UPDATE USING (
        is_household_admin(household_id) OR (
            payer_id IN (SELECT id FROM household_members WHERE user_id = auth.uid())
            AND created_at >= (NOW() - INTERVAL '24 hours')
        )
    );

CREATE POLICY "Delete transactions policy" ON transactions
    FOR DELETE USING (
        is_household_admin(household_id) OR (
            payer_id IN (SELECT id FROM household_members WHERE user_id = auth.uid())
            AND created_at >= (NOW() - INTERVAL '24 hours')
        )
    );

-- 6. Savings Goals RLS
CREATE POLICY "Members can view savings goals" ON savings_goals
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Members can fund savings goals" ON savings_goals
    FOR UPDATE USING (is_household_member(household_id));

CREATE POLICY "Admins can create/delete savings goals" ON savings_goals
    FOR ALL USING (is_household_admin(household_id));

-- Balance update trigger on transactions
CREATE OR REPLACE FUNCTION update_wallet_balances_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.type = 'expense') THEN
            UPDATE wallets SET current_balance = current_balance - NEW.amount WHERE id = NEW.wallet_id;
        ELSIF (NEW.type = 'income') THEN
            UPDATE wallets SET current_balance = current_balance + NEW.amount WHERE id = NEW.wallet_id;
        ELSIF (NEW.type = 'transfer') THEN
            UPDATE wallets SET current_balance = current_balance - NEW.amount WHERE id = NEW.wallet_id;
            IF (NEW.destination_wallet_id IS NOT NULL) THEN
                UPDATE wallets SET current_balance = current_balance + NEW.amount WHERE id = NEW.destination_wallet_id;
            END IF;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.type = 'expense') THEN
            UPDATE wallets SET current_balance = current_balance + OLD.amount WHERE id = OLD.wallet_id;
        ELSIF (OLD.type = 'income') THEN
            UPDATE wallets SET current_balance = current_balance - OLD.amount WHERE id = OLD.wallet_id;
        ELSIF (OLD.type = 'transfer') THEN
            UPDATE wallets SET current_balance = current_balance + OLD.amount WHERE id = OLD.wallet_id;
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
