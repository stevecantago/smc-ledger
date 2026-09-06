-- Migration 015: Add E Wallet Savings wallet type for clean database replays.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_type') THEN
    ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'e_wallet_savings';
  END IF;
END $$;
