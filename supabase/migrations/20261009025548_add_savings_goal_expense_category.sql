ALTER TABLE IF EXISTS public.savings_goals
  ADD COLUMN IF NOT EXISTS category_id VARCHAR(100);

ALTER TABLE IF EXISTS public.savings_goals
  DROP CONSTRAINT IF EXISTS savings_goals_category_id_fkey;

ALTER TABLE IF EXISTS public.savings_goals
  ADD CONSTRAINT savings_goals_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_savings_goals_category
  ON public.savings_goals(category_id);
