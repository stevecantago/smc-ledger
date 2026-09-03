-- Migration 007: Add Amount Paid and Next Due Date Columns to Loans Table

ALTER TABLE loans
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS next_due_date DATE;

COMMENT ON COLUMN loans.amount_paid IS 'Total principal/amortization amount paid to date';
COMMENT ON COLUMN loans.next_due_date IS 'Explicit date for the next upcoming payment due';
