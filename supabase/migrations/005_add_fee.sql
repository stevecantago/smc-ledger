-- Migration 005: Add Processing / Transaction Fee Column to Transactions Table

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS fee NUMERIC(12, 2) DEFAULT 0.00;

COMMENT ON COLUMN transactions.fee IS 'Processing, transaction, or transfer fee in PHP ₱';
