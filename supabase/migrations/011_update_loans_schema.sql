-- Migration 011: Add source_wallet_id, total_amortizations, and paid_amortizations_count to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS source_wallet_id VARCHAR(100);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_amortizations INT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS paid_amortizations_count INT DEFAULT 0;
