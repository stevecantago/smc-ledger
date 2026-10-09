ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS account_group varchar(20) NOT NULL DEFAULT 'main';

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_account_group_check;

ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_account_group_check
  CHECK (account_group IN ('main', 'savings'));

-- Keep existing backup restore RPCs compatible with the new wallet metadata.
DO $$
DECLARE
  restore_definition text;
  updated_definition text;
BEGIN
  restore_definition := pg_get_functiondef('public.restore_wallets_and_transactions(jsonb, jsonb)'::regprocedure);
  IF restore_definition NOT LIKE '%account_group = excluded.account_group%' THEN
    updated_definition := regexp_replace(
      restore_definition,
      'wallet_type[[:space:]]*,[[:space:]]*is_shared[[:space:]]*,[[:space:]]*current_balance',
      'wallet_type, account_group, is_shared, current_balance',
      'g'
    );
    updated_definition := regexp_replace(
      updated_definition,
      'restored[.]wallet_type[[:space:]]*,[[:space:]]*coalesce[[:space:]]*[(][[:space:]]*restored[.]is_shared[[:space:]]*,[[:space:]]*true[[:space:]]*[)][[:space:]]*,',
      'restored.wallet_type, coalesce(restored.account_group, ''main''), coalesce(restored.is_shared, true),',
      'g'
    );
    updated_definition := regexp_replace(
      updated_definition,
      'wallet_type[[:space:]]+varchar[(]50[)],?[[:space:]]*is_shared[[:space:]]+boolean,[[:space:]]*current_balance',
      'wallet_type varchar(50), account_group varchar(20), is_shared boolean, current_balance',
      'g'
    );
    updated_definition := regexp_replace(
      updated_definition,
      'wallet_type[[:space:]]*=[[:space:]]*excluded[.]wallet_type,[[:space:]]*is_shared[[:space:]]*=[[:space:]]*excluded[.]is_shared,',
      'wallet_type = excluded.wallet_type, account_group = excluded.account_group, is_shared = excluded.is_shared,',
      'g'
    );

    IF updated_definition NOT LIKE '%wallet_type, account_group, is_shared%'
      OR updated_definition NOT LIKE '%restored.account_group%'
      OR updated_definition NOT LIKE '%account_group varchar(20)%'
      OR updated_definition NOT LIKE '%account_group = excluded.account_group%' THEN
      RAISE EXCEPTION 'Could not update restore_wallets_and_transactions for wallet account_group';
    END IF;

    EXECUTE updated_definition;
  END IF;
END;
$$;
