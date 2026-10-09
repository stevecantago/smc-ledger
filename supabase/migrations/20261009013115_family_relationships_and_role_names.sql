-- Keep relationship labels separate from permission roles.
ALTER TABLE IF EXISTS public.household_members
  ADD COLUMN IF NOT EXISTS family_relationship text NOT NULL DEFAULT 'Other';

DO $$
BEGIN
  IF to_regclass('public.household_members') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.household_members'::regclass
        AND conname = 'household_members_family_relationship_check'
    ) THEN
    ALTER TABLE public.household_members
      ADD CONSTRAINT household_members_family_relationship_check
      CHECK (family_relationship IN (
        'Father', 'Mother', 'Grandfather', 'Grandmother', 'Guardian',
        'Son', 'Daughter', 'Niece', 'Nephew', 'Grandson', 'Granddaughter', 'Other'
      ));
  END IF;

  IF to_regclass('public.household_roles') IS NOT NULL THEN
    UPDATE public.household_roles
    SET name = CASE id
      WHEN 'role-admin-head-parent' THEN 'Owner'
      WHEN 'role-parent-guardian' THEN 'Admin'
      WHEN 'role-teen-dependent' THEN 'Member'
      ELSE name
    END
    WHERE id IN ('role-admin-head-parent', 'role-parent-guardian', 'role-teen-dependent');
  END IF;
END $$;

-- Make PostgREST see the new column and updated role rows after migration.
NOTIFY pgrst, 'reload schema';
