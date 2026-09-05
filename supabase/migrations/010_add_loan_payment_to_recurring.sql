-- Migration 010: Add loan_id and loan_payment rule_type support to recurring_transfers
ALTER TABLE recurring_transfers ADD COLUMN IF NOT EXISTS loan_id VARCHAR(100);
ALTER TABLE recurring_transfers ALTER COLUMN rule_type TYPE VARCHAR(50);
