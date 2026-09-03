-- Migration 004: Clean Slate Database Reset for Steve Cantago Family Household
-- Currency: Philippine Peso (PHP / ₱)

TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE recurring_transfers RESTART IDENTITY CASCADE;
TRUNCATE TABLE loans RESTART IDENTITY CASCADE;
TRUNCATE TABLE savings_goals RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE wallets RESTART IDENTITY CASCADE;
TRUNCATE TABLE household_members RESTART IDENTITY CASCADE;
TRUNCATE TABLE households RESTART IDENTITY CASCADE;

-- Insert Primary Clean Household
INSERT INTO households (id, name, base_currency)
VALUES ('hh-101', 'Cantago Family Household', 'PHP');

-- Insert Primary Head Admin (Steve Cantago)
INSERT INTO household_members (id, household_id, user_id, role, display_name, email)
VALUES ('member-steve-admin', 'hh-101', 'usr-steve-admin', 'admin', 'Steve Cantago (Head Admin Parent)', 'steve.cantago@gmail.com');

-- Insert Starter Categories
INSERT INTO categories (id, household_id, name, icon_slug, monthly_budget_limit) VALUES
('cat-groceries', 'hh-101', 'Groceries & Supplies', 'shopping-cart', 15000.00),
('cat-utilities', 'hh-101', 'Utilities & Bills', 'zap', 8000.00),
('cat-internet', 'hh-101', 'Internet & Broadband', 'wifi', 2500.00),
('cat-school-dues', 'hh-101', 'School Dues & Tuition', 'graduation-cap', 10000.00);
