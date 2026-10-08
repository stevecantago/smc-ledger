-- Keep existing envelope categories as expenses; add a separate income list.
ALTER TABLE public.categories
  ADD COLUMN category_type TEXT NOT NULL DEFAULT 'expense'
  CHECK (category_type IN ('income', 'expense'));
