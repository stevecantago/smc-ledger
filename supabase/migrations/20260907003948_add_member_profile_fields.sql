ALTER TABLE IF EXISTS public.household_members
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

UPDATE public.household_members
SET
  first_name = COALESCE(
    NULLIF(first_name, ''),
    NULLIF(split_part(trim(regexp_replace(display_name, '\s*\([^)]*\)\s*$', '')), ' ', 1), '')
  ),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(
      trim(regexp_replace(
        trim(regexp_replace(display_name, '\s*\([^)]*\)\s*$', '')),
        '^\S+\s*',
        ''
      )),
      ''
    )
  )
WHERE first_name IS NULL
   OR first_name = ''
   OR last_name IS NULL
   OR last_name = '';
