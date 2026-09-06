-- Migration 016: Link savings goals to tracked wallet accounts.
ALTER TABLE IF EXISTS public.savings_goals
  ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(100);

ALTER TABLE IF EXISTS public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_wallet_id_fkey;

ALTER TABLE IF EXISTS public.savings_goals
  ADD CONSTRAINT savings_goals_wallet_id_fkey
  FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_savings_goals_wallet ON public.savings_goals(wallet_id);
