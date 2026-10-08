begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

alter table public.household_members add column if not exists role_id varchar(100);
create table if not exists public.household_roles (
  id varchar(100) primary key,
  household_id varchar(100) not null references public.households(id) on delete cascade,
  name varchar(120) not null,
  base_role varchar(50) not null,
  is_head_parent boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.role_permissions (
  id varchar(160) primary key,
  household_id varchar(100) not null references public.households(id) on delete cascade,
  role_id varchar(100) not null references public.household_roles(id) on delete cascade,
  permission_key varchar(80) not null,
  level varchar(20) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, permission_key)
);

grant select, insert, update, delete on public.wallets, public.transactions to authenticated;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
drop policy if exists "Restore contention wallet access" on public.wallets;
drop policy if exists "Restore contention transaction access" on public.transactions;
create policy "Fee tests allow member wallet access" on public.wallets
  for all to authenticated
  using (exists (
    select 1 from public.household_members member
    where member.household_id = wallets.household_id
      and member.user_id = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.household_members member
    where member.household_id = wallets.household_id
      and member.user_id = auth.uid()::text
  ));
create policy "Fee tests allow recent transaction changes" on public.transactions
  for all to authenticated
  using (exists (
    select 1 from public.household_members member
    where member.household_id = transactions.household_id
      and member.user_id = auth.uid()::text
      and transactions.created_at >= now() - interval '24 hours'
  ))
  with check (exists (
    select 1 from public.household_members member
    where member.household_id = transactions.household_id
      and member.user_id = auth.uid()::text
  ));

insert into households (id, name) values ('fee-test-household', 'Fee Test');
insert into public.household_roles (
  id, household_id, name, base_role, is_head_parent, is_default
) values
  ('fee-test-admin-role', 'fee-test-household', 'Admin', 'admin', true, true),
  ('fee-test-parent-role', 'fee-test-household', 'Parent', 'parent_member', false, true),
  ('fee-test-member-role', 'fee-test-household', 'Member', 'member', false, true);
insert into public.role_permissions (
  id, household_id, role_id, permission_key, level
) values
  ('fee-test-admin-restore', 'fee-test-household', 'fee-test-admin-role', 'restore_backup', 'allowed'),
  ('fee-test-parent-restore', 'fee-test-household', 'fee-test-parent-role', 'restore_backup', 'allowed'),
  ('fee-test-member-restore', 'fee-test-household', 'fee-test-member-role', 'restore_backup', 'restricted');
insert into household_members (id, household_id, user_id, role, role_id, display_name)
values
  ('fee-test-member', 'fee-test-household', '00000000-0000-0000-0000-000000000101', 'admin', 'fee-test-admin-role', 'Fee Tester'),
  ('fee-test-parent', 'fee-test-household', '00000000-0000-0000-0000-000000000102', 'parent_member', 'fee-test-parent-role', 'Parent Tester'),
  ('fee-test-denied', 'fee-test-household', '00000000-0000-0000-0000-000000000103', 'member', 'fee-test-member-role', 'Denied Tester'),
  ('fee-test-legacy-parent', 'fee-test-household', '00000000-0000-0000-0000-000000000105', 'parent_member', null, 'Legacy Parent');

insert into wallets (
  id, household_id, owner_id, name, wallet_type, is_shared,
  current_balance, credit_limit, service_fee_balance
) values
  ('fee-test-bank', 'fee-test-household', 'fee-test-member', 'Bank', 'bank', true, 50000, null, 0),
  ('fee-test-card', 'fee-test-household', 'fee-test-member', 'Card', 'credit_card', false, 7000, 10000, 1000);

insert into public.households (id, name) values ('fee-test-other-household', 'Other Household');
insert into public.household_members (id, household_id, user_id, role, display_name)
values (
  'fee-test-other-member', 'fee-test-other-household',
  '00000000-0000-0000-0000-000000000104', 'admin', 'Other Tester'
);
insert into public.wallets (
  id, household_id, owner_id, name, wallet_type, is_shared,
  current_balance, credit_limit, service_fee_balance
) values (
  'fee-test-other-wallet', 'fee-test-other-household', 'fee-test-other-member',
  'Other Bank', 'bank', true, 100, null, 0
);

insert into transactions (
  id, household_id, wallet_id, destination_wallet_id, payer_id,
  type, amount, fee, service_fee_amount, transaction_date
) values (
  'fee-test-payment', 'fee-test-household', 'fee-test-bank', 'fee-test-card',
  'fee-test-member', 'loan', 7500, 50, 0, current_date
);

select is((select service_fee_amount from transactions where id = 'fee-test-payment'), 1000::numeric, 'stores the fee portion');
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'deducts payment plus transaction fee');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'reduces used balance after fees');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'clears service fees first');

delete from transactions where id = 'fee-test-payment';

select is((select current_balance from wallets where id = 'fee-test-bank'), 50000::numeric, 'restores funding balance');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'restores used balance');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 1000::numeric, 'restores service fees');

select throws_ok(
  $$insert into transactions (
      id, household_id, wallet_id, destination_wallet_id, payer_id,
      type, amount, fee, service_fee_amount, transaction_date
    ) values (
      'fee-test-overpayment', 'fee-test-household', 'fee-test-bank', 'fee-test-card',
      'fee-test-member', 'loan', 8000.01, 0, 0, current_date
    )$$,
  'Credit card payment cannot exceed total due.',
  'rejects an overpayment'
);

select is((select current_balance from wallets where id = 'fee-test-bank'), 50000::numeric, 'rejected overpayment leaves funding balance unchanged');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'rejected overpayment leaves principal unchanged');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 1000::numeric, 'rejected overpayment leaves service fees unchanged');

-- A caller cannot choose the allocation, even when its supplied value exceeds the payment.
insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount, service_fee_amount)
values ('fee-test-partial', 'fee-test-household', 'fee-test-bank', 'fee-test-card', 'fee-test-member', 'loan', 250, 9999);
select is((select service_fee_amount from transactions where id = 'fee-test-partial'), 250::numeric, 'overrides a tampered allocation with the fee-first allocation');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'partial fee payment preserves principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 750::numeric, 'partial payment reduces fees only');
-- New fees posted after payment must not change the split restored on deletion.
update wallets set service_fee_balance = service_fee_balance + 100 where id = 'fee-test-card';
delete from transactions where id = 'fee-test-partial';
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 1100::numeric, 'reversal restores stored fees while preserving later charges');
select is((select current_balance from wallets where id = 'fee-test-bank'), 50000::numeric, 'partial payment reversal restores funding');

update wallets set current_balance = 0, service_fee_balance = 1000 where id = 'fee-test-card';
insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount)
values ('fee-test-fee-only', 'fee-test-household', 'fee-test-bank', 'fee-test-card', 'fee-test-member', 'loan', 1000);
select is((select service_fee_amount from transactions where id = 'fee-test-fee-only'), 1000::numeric, 'fee-only total due can be paid in full');
select is((select current_balance + service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'exact payment clears fee-only total due');
delete from transactions where id = 'fee-test-fee-only';
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 1000::numeric, 'fee-only reversal restores fees');
update wallets set current_balance = 7000 where id = 'fee-test-card';

select throws_ok(
  $$insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount)
    values ('fee-test-credit-source', 'fee-test-household', 'fee-test-card', 'fee-test-card', 'fee-test-member', 'loan', 100)$$,
  'Credit card payments require a non-credit funding account.', 'rejects credit funding for card payments'
);
select throws_ok(
  $$update wallets set service_fee_balance = -1 where id = 'fee-test-card'$$,
  '23514', null, 'rejects a negative outstanding fee balance'
);

insert into wallets (id, household_id, owner_id, name, wallet_type, current_balance)
values ('fee-test-cash', 'fee-test-household', 'fee-test-member', 'Cash', 'cash', 5000);
select is((select service_fee_balance from wallets where id = 'fee-test-cash'), 0::numeric, 'legacy wallet inserts default to zero service fees');

-- Each case starts and ends at the same fixture balances. Expectations are literal.
create function pg_temp.check_regular_transaction(
  test_id text, source_id text, destination_id text, tx_type text,
  expected_source numeric, expected_destination numeric
) returns setof text language plpgsql as $$
declare
  source_before numeric;
  destination_before numeric;
begin
  select current_balance into source_before from wallets where id = source_id;
  select current_balance into destination_before from wallets where id = destination_id;
  insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount, fee, service_fee_amount)
  values (test_id, 'fee-test-household', source_id, destination_id, 'fee-test-member', tx_type, 100, 10, 50);
  return next is((select current_balance from wallets where id = source_id), expected_source, test_id || ': source balance');
  if destination_id is not null then
    return next is((select current_balance from wallets where id = destination_id), expected_destination, test_id || ': destination balance');
  end if;
  return next is((select service_fee_amount from transactions where id = test_id), 0::numeric, test_id || ': ordinary transaction clears supplied fee allocation');
  return next is((select service_fee_balance from wallets where id = 'fee-test-card'), 1000::numeric, test_id || ': service fees preserved');
  delete from transactions where id = test_id;
  return next is((select current_balance from wallets where id = source_id), source_before, test_id || ': source reversed');
  if destination_id is not null then
    return next is((select current_balance from wallets where id = destination_id), destination_before, test_id || ': destination reversed');
  end if;
end;
$$;

select * from pg_temp.check_regular_transaction('bank-expense', 'fee-test-bank', null, 'expense', 49890, null);
select * from pg_temp.check_regular_transaction('card-expense', 'fee-test-card', null, 'expense', 7110, null);
select * from pg_temp.check_regular_transaction('ordinary-loan', 'fee-test-bank', 'fee-test-cash', 'loan', 49890, 5000);
select * from pg_temp.check_regular_transaction('bank-income', 'fee-test-bank', null, 'income', 50090, null);
select * from pg_temp.check_regular_transaction('card-income', 'fee-test-card', null, 'income', 6910, null);
select * from pg_temp.check_regular_transaction('cash-transfer', 'fee-test-bank', 'fee-test-cash', 'transfer', 49890, 5100);
select * from pg_temp.check_regular_transaction('legacy-card-transfer', 'fee-test-bank', 'fee-test-card', 'transfer', 49890, 6900);
select * from pg_temp.check_regular_transaction('card-funded-transfer', 'fee-test-card', 'fee-test-cash', 'transfer', 7110, 5100);

select throws_ok(
  $$insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount)
    values ('legacy-overpayment', 'fee-test-household', 'fee-test-bank', 'fee-test-card', 'fee-test-member', 'transfer', 7000.01)$$,
  'Credit card payment cannot exceed the used balance.', 'legacy transfer cannot consume the service-fee balance'
);

-- Backup restoration upserts must not apply existing ledger rows to balances again.
insert into transactions (id, household_id, wallet_id, payer_id, type, amount, fee, service_fee_amount)
values ('fee-test-expense-upsert', 'fee-test-household', 'fee-test-bank', 'fee-test-member', 'expense', 100, 10, 0)
on conflict (id) do update set amount = excluded.amount, fee = excluded.fee, service_fee_amount = excluded.service_fee_amount;
select is((select current_balance from wallets where id = 'fee-test-bank'), 49890::numeric, 'expense upsert initially debits funding once');
insert into transactions (id, household_id, wallet_id, payer_id, type, amount, fee, service_fee_amount)
values ('fee-test-expense-upsert', 'fee-test-household', 'fee-test-bank', 'fee-test-member', 'expense', 100, 10, 0)
on conflict (id) do update set amount = excluded.amount, fee = excluded.fee, service_fee_amount = excluded.service_fee_amount;
select is((select current_balance from wallets where id = 'fee-test-bank'), 49890::numeric, 'repeated expense upsert leaves funding unchanged');
select is((select service_fee_amount from transactions where id = 'fee-test-expense-upsert'), 0::numeric, 'repeated expense upsert preserves zero allocation');
select is((select count(*) from transactions where id = 'fee-test-expense-upsert'), 1::bigint, 'repeated expense upsert keeps one ledger row');
delete from transactions where id = 'fee-test-expense-upsert';
select is((select current_balance from wallets where id = 'fee-test-bank'), 50000::numeric, 'upserted expense reversal restores funding exactly');
-- Keep the payment regression independent if the expense regression fails.
update wallets set current_balance = 50000 where id = 'fee-test-bank';

insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount, fee, service_fee_amount)
values ('fee-test-payment-upsert', 'fee-test-household', 'fee-test-bank', 'fee-test-card', 'fee-test-member', 'loan', 750, 10, 0)
on conflict (id) do update set amount = excluded.amount, fee = excluded.fee, service_fee_amount = excluded.service_fee_amount;
select is((select current_balance from wallets where id = 'fee-test-bank'), 49240::numeric, 'payment upsert initially debits payment and processing fee once');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'initial partial payment upsert preserves principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 250::numeric, 'initial partial payment upsert reduces outstanding fees once');
select is((select service_fee_amount from transactions where id = 'fee-test-payment-upsert'), 750::numeric, 'initial payment upsert stores authoritative allocation');
insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount, fee, service_fee_amount)
values ('fee-test-payment-upsert', 'fee-test-household', 'fee-test-bank', 'fee-test-card', 'fee-test-member', 'loan', 750, 10, 0)
on conflict (id) do update set amount = excluded.amount, fee = excluded.fee, service_fee_amount = excluded.service_fee_amount;
select is((select current_balance from wallets where id = 'fee-test-bank'), 49240::numeric, 'repeated payment upsert leaves funding unchanged');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'repeated payment upsert leaves principal unchanged');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 250::numeric, 'repeated payment upsert leaves outstanding fees unchanged');
select is((select service_fee_amount from transactions where id = 'fee-test-payment-upsert'), 750::numeric, 'repeated payment upsert preserves the stored allocation instead of recalculating');
select is((select count(*) from transactions where id = 'fee-test-payment-upsert'), 1::bigint, 'repeated payment upsert keeps one ledger row');
delete from transactions where id = 'fee-test-payment-upsert';
select is((select current_balance from wallets where id = 'fee-test-bank'), 50000::numeric, 'upserted payment reversal restores funding exactly');
select is((select current_balance from wallets where id = 'fee-test-card'), 7000::numeric, 'upserted payment reversal restores principal exactly');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 1000::numeric, 'upserted payment reversal restores outstanding fees exactly');

-- Full backup restoration must treat saved wallet balances and allocations as source data.
select is(
  (select prosecdef from pg_proc where oid = 'public.restore_wallets_and_transactions(jsonb,jsonb)'::regprocedure),
  true,
  'backup restore RPC uses its hardened permission-checking owner rights'
);
select ok(
  has_function_privilege('authenticated', 'public.restore_wallets_and_transactions(jsonb,jsonb)', 'execute'),
  'authenticated users can execute the restore RPC'
);
select ok(
  not has_function_privilege('anon', 'public.restore_wallets_and_transactions(jsonb,jsonb)', 'execute'),
  'anonymous users cannot execute the restore RPC'
);
select ok(
  coalesce((
    select not exists (
      select 1 from aclexplode(coalesce(proacl, acldefault('f', proowner))) privilege
      where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
    )
    from pg_proc
    where oid = 'public.restore_wallets_and_transactions(jsonb,jsonb)'::regprocedure
  ), false),
  'PUBLIC cannot execute the restore RPC'
);
select ok(
  not has_table_privilege('authenticated', 'private.financial_restore_context', 'insert'),
  'authenticated callers cannot create the internal restore marker'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-card', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Card', 'wallet_type', 'credit_card', 'is_shared', false,
        'current_balance', 500.00, 'credit_limit', 10000.00, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-historical-payment', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'destination_wallet_id', 'fee-test-card',
        'category_id', null, 'payer_id', 'fee-test-member', 'type', 'loan',
        'amount', 7500.00, 'fee', 50.00, 'service_fee_amount', 1000.00,
        'transaction_date', current_date, 'note', 'Historical payment', 'receipt_url', null,
        'created_at', '2020-01-01T00:00:00Z'
      )
    )
  )$$,
  'restores a missing historical payment even when the saved card has a smaller remaining due'
);
reset role;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'backup restore preserves saved funding balance');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'backup restore preserves saved card principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'backup restore preserves saved card fees');
select is((select service_fee_amount from transactions where id = 'fee-test-historical-payment'), 1000::numeric, 'backup restore preserves missing payment allocation');

update transactions set service_fee_amount = 900 where id = 'fee-test-historical-payment';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
update public.transactions
set service_fee_amount = 800
where id = 'fee-test-historical-payment';
reset role;
select is(
  (select service_fee_amount from public.transactions where id = 'fee-test-historical-payment'),
  900::numeric,
  'ordinary authenticated RLS cannot update an old historical allocation'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select lives_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2026-10-03T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-card', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Card', 'wallet_type', 'credit_card', 'is_shared', false,
        'current_balance', 500.00, 'credit_limit', 10000.00, 'service_fee_balance', 0,
        'created_at', '2026-10-03T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-historical-payment', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'destination_wallet_id', 'fee-test-card',
        'category_id', null, 'payer_id', 'fee-test-member', 'type', 'loan',
        'amount', 7500.00, 'fee', 50.00, 'service_fee_amount', 1000.00,
        'transaction_date', current_date, 'note', 'Historical payment', 'receipt_url', null,
        'created_at', '2020-01-01T00:00:00Z'
      )
    )
  )$$,
  'allows an authenticated parent to restore an old payment without moving saved balances'
);
reset role;
select is((select service_fee_amount from transactions where id = 'fee-test-historical-payment'), 1000::numeric, 'backup restore replaces an existing payment with its saved allocation');
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'existing payment restore keeps saved funding balance');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'existing payment restore keeps saved principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'existing payment restore keeps saved fees');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000105', true);
select lives_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    '[]'::jsonb
  )$$,
  'allows the legacy parent role default to restore a financial snapshot'
);
reset role;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'legacy parent restore preserves the supplied wallet value');

-- Restore validation must finish before any snapshot row is written.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions('[]'::jsonb, '[]'::jsonb)$$,
  '22023',
  'Backup wallet snapshot cannot be empty.',
  'rejects an empty wallet snapshot'
);
reset role;

savepoint partial_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 41000.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2026-10-03T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-historical-payment', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'destination_wallet_id', 'fee-test-card',
        'category_id', null, 'payer_id', 'fee-test-member', 'type', 'loan',
        'amount', 7500.00, 'fee', 50.00, 'service_fee_amount', 1000.00,
        'transaction_date', current_date, 'created_at', '2020-01-01T00:00:00Z'
      )
    )
  )$$,
  '22023',
  'Every transaction wallet must be included in the backup wallet snapshot.',
  'rejects a partial wallet snapshot'
);
reset role;
rollback to savepoint partial_snapshot;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'rejected partial snapshot leaves funding unchanged');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'rejected partial snapshot leaves card principal unchanged');
select is((select service_fee_amount from transactions where id = 'fee-test-historical-payment'), 1000::numeric, 'rejected partial snapshot leaves allocation unchanged');

savepoint duplicate_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object('id', 'fee-test-bank', 'household_id', 'fee-test-household'),
      jsonb_build_object('id', 'fee-test-bank', 'household_id', 'fee-test-household')
    ),
    '[]'::jsonb
  )$$,
  '22023',
  'Backup wallet and transaction IDs must be present and unique.',
  'rejects duplicate wallet IDs'
);
reset role;
rollback to savepoint duplicate_snapshot;

savepoint missing_id_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(jsonb_build_object('household_id', 'fee-test-household')),
    '[]'::jsonb
  )$$,
  '22023',
  'Backup wallet and transaction IDs must be present and unique.',
  'rejects missing wallet IDs'
);
reset role;
rollback to savepoint missing_id_snapshot;

savepoint missing_transaction_id_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'household_id', 'fee-test-household', 'wallet_id', 'fee-test-bank',
        'payer_id', 'fee-test-member', 'type', 'expense', 'amount', 1,
        'transaction_date', current_date, 'created_at', '2020-01-01T00:00:00Z'
      )
    )
  )$$,
  '22023',
  'Backup wallet and transaction IDs must be present and unique.',
  'rejects missing transaction IDs'
);
reset role;
rollback to savepoint missing_transaction_id_snapshot;

savepoint duplicate_transaction_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'service_fee_balance', 0
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'duplicate-transaction', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'payer_id', 'fee-test-member',
        'type', 'expense', 'amount', 1, 'transaction_date', current_date
      ),
      jsonb_build_object(
        'id', 'duplicate-transaction', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'payer_id', 'fee-test-member',
        'type', 'expense', 'amount', 1, 'transaction_date', current_date
      )
    )
  )$$,
  '22023',
  'Backup wallet and transaction IDs must be present and unique.',
  'rejects duplicate transaction IDs'
);
reset role;
rollback to savepoint duplicate_transaction_snapshot;

savepoint cross_household_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'service_fee_balance', 0
      ),
      jsonb_build_object(
        'id', 'cross-household-card', 'household_id', 'other-household', 'owner_id', null,
        'name', 'Other card', 'wallet_type', 'credit_card', 'is_shared', false,
        'current_balance', 0, 'service_fee_balance', 0
      )
    ),
    '[]'::jsonb
  )$$,
  '22023',
  'Backup financial rows must belong to exactly one household.',
  'rejects a cross-household wallet payload'
);
reset role;
rollback to savepoint cross_household_snapshot;

savepoint unauthorized_household_snapshot;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-other-wallet', 'household_id', 'fee-test-other-household',
        'owner_id', 'fee-test-other-member', 'name', 'Other Bank', 'wallet_type', 'bank',
        'is_shared', true, 'current_balance', 1.00, 'credit_limit', null,
        'service_fee_balance', 0, 'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    '[]'::jsonb
  )$$,
  '42501',
  'Authenticated member cannot restore backups for this household.',
  'prevents an authorized member from restoring another household'
);
reset role;
rollback to savepoint unauthorized_household_snapshot;
select is((select current_balance from wallets where id = 'fee-test-other-wallet'), 100::numeric, 'cross-household denial leaves the other wallet unchanged');

savepoint denied_restore;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select throws_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 1.00, 'service_fee_balance', 0
      )
    ),
    '[]'::jsonb
  )$$,
  '42501',
  'Authenticated member cannot restore backups for this household.',
  'denies a member without restore_backup permission'
);
reset role;
rollback to savepoint denied_restore;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'denied restore leaves wallet state unchanged');

-- The saved financial snapshot is authoritative regardless of ledger input order.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-card', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Card', 'wallet_type', 'credit_card', 'is_shared', false,
        'current_balance', 500.00, 'credit_limit', 10000.00, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-old-refund', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-card', 'destination_wallet_id', null,
        'payer_id', 'fee-test-member', 'type', 'income', 'amount', 2000.00,
        'fee', 0, 'service_fee_amount', 0, 'transaction_date', '2020-01-01',
        'created_at', '2020-01-01T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-old-payment', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'destination_wallet_id', 'fee-test-card',
        'payer_id', 'fee-test-member', 'type', 'loan', 'amount', 7500.00,
        'fee', 50, 'service_fee_amount', 1000.00, 'transaction_date', '2020-01-02',
        'created_at', '2020-01-02T00:00:00Z'
      )
    )
  )$$,
  'restores a refund-then-payment history without replaying its effects'
);
reset role;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'refund-first restore preserves saved funding');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'refund-first restore preserves saved principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'refund-first restore preserves saved fees');
select is((select service_fee_amount from transactions where id = 'fee-test-old-payment'), 1000::numeric, 'refund-first restore preserves the old payment allocation');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.restore_wallets_and_transactions(
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-bank', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Bank', 'wallet_type', 'bank', 'is_shared', true,
        'current_balance', 42450.00, 'credit_limit', null, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-card', 'household_id', 'fee-test-household', 'owner_id', 'fee-test-member',
        'name', 'Card', 'wallet_type', 'credit_card', 'is_shared', false,
        'current_balance', 500.00, 'credit_limit', 10000.00, 'service_fee_balance', 0,
        'created_at', '2020-01-01T00:00:00Z'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'id', 'fee-test-old-payment', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-bank', 'destination_wallet_id', 'fee-test-card',
        'payer_id', 'fee-test-member', 'type', 'loan', 'amount', 7500.00,
        'fee', 50, 'service_fee_amount', 1000.00, 'transaction_date', '2020-01-02',
        'created_at', '2020-01-02T00:00:00Z'
      ),
      jsonb_build_object(
        'id', 'fee-test-old-refund', 'household_id', 'fee-test-household',
        'wallet_id', 'fee-test-card', 'destination_wallet_id', null,
        'payer_id', 'fee-test-member', 'type', 'income', 'amount', 2000.00,
        'fee', 0, 'service_fee_amount', 0, 'transaction_date', '2020-01-01',
        'created_at', '2020-01-01T00:00:00Z'
      )
    )
  )$$,
  'restores the same mixed history in the alternate input order'
);
reset role;
select is((select current_balance from wallets where id = 'fee-test-bank'), 42450::numeric, 'alternate-order restore preserves saved funding');
select is((select current_balance from wallets where id = 'fee-test-card'), 500::numeric, 'alternate-order restore preserves saved principal');
select is((select service_fee_balance from wallets where id = 'fee-test-card'), 0::numeric, 'alternate-order restore preserves saved fees');
select is((select service_fee_amount from transactions where id = 'fee-test-old-payment'), 1000::numeric, 'alternate-order restore preserves the exact payment allocation');

select * from finish();
rollback;
