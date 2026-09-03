-- Migration 006: Add Bi-Monthly Payment Frequency & Second Due Day Columns to Loans Table

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS second_due_day_of_month INTEGER;

COMMENT ON COLUMN loans.payment_frequency IS 'Payment frequency: monthly (1x/month) or bi_monthly (2x/month)';
COMMENT ON COLUMN loans.second_due_day_of_month IS 'Second due day of month for bi-monthly schedules (e.g. Day 30 or 15)';
