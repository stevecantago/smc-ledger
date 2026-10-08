-- Outstanding card service fees are separate from principal used balance.
alter table public.wallets
  add column if not exists service_fee_balance numeric(14, 2) not null default 0.00;

alter table public.transactions
  add column if not exists service_fee_amount numeric(12, 2) not null default 0.00;

do $$ begin
  alter table public.wallets add constraint wallets_service_fee_balance_nonnegative
    check (service_fee_balance >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.transactions add constraint transactions_service_fee_amount_nonnegative
    check (service_fee_amount >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.transactions add constraint transactions_service_fee_amount_lte_amount
    check (service_fee_amount <= amount);
exception when duplicate_object then null;
end $$;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.financial_restore_context (
  backend_pid integer not null,
  transaction_id bigint not null,
  primary key (backend_pid, transaction_id)
);
revoke all on table private.financial_restore_context from public, anon, authenticated;

create or replace function public.is_financial_restore_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from private.financial_restore_context context
    where context.backend_pid = pg_catalog.pg_backend_pid()
      and context.transaction_id = pg_catalog.txid_current()
  );
$$;
revoke all on function public.is_financial_restore_active() from public, anon;
grant execute on function public.is_financial_restore_active() to authenticated, service_role;

create or replace function public.update_wallet_balances_on_transaction()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_id public.wallets.id%type;
  destination_id public.wallets.id%type;
  source_type public.wallets.wallet_type%type;
  destination_type public.wallets.wallet_type%type;
  destination_used numeric(14, 2) := 0;
  destination_fees numeric(14, 2) := 0;
  stored_service_fee_amount public.transactions.service_fee_amount%type;
begin
  if tg_op = 'INSERT' then
    -- Only the permission-checked restore RPC can create this private marker.
    -- It already owns the transaction and wallet locks for the full snapshot.
    if public.is_financial_restore_active() then
      new.service_fee_amount := coalesce(new.service_fee_amount, 0);
      return new;
    end if;

    -- Backup restores use upserts. An existing ledger row has already moved balances.
    -- Lock it before any advisory lock so a concurrent delete/reinsert can finish.
    select service_fee_amount into stored_service_fee_amount
    from public.transactions where id = new.id for update;
    if found then
      new.service_fee_amount := stored_service_fee_amount;
      return new;
    end if;

    -- A missing row cannot be row-locked. Claim creation by ID without waiting:
    -- a delete/reinsert may already hold a row needed by the lock's owner.
    if not pg_catalog.pg_try_advisory_xact_lock(
      pg_catalog.hashtextextended('public.transactions:' || new.id, 0)
    ) then
      raise exception using
        errcode = '40001',
        message = 'Transaction ID is being processed concurrently. Retry the transaction.';
    end if;
    -- Another transaction may have inserted this ID since the first lookup.
    select service_fee_amount into stored_service_fee_amount
    from public.transactions where id = new.id for update;
    if found then
      new.service_fee_amount := stored_service_fee_amount;
      return new;
    end if;

    source_id := new.wallet_id;
    destination_id := new.destination_wallet_id;
  else
    source_id := old.wallet_id;
    destination_id := old.destination_wallet_id;
  end if;

  -- Opposite-direction transactions must acquire the same row locks in the same order.
  perform id from public.wallets
  where id in (source_id, destination_id)
  order by id for update;

  select wallet_type into source_type from public.wallets where id = source_id;
  if destination_id is not null then
    select wallet_type, current_balance, service_fee_balance
    into destination_type, destination_used, destination_fees
    from public.wallets where id = destination_id;
  end if;

  if tg_op = 'INSERT' then
    -- The database owns this allocation, regardless of the caller's supplied value.
    new.service_fee_amount := 0;
    if new.type = 'loan' and destination_type = 'credit_card' then
      if source_type = 'credit_card' then
        raise exception 'Credit card payments require a non-credit funding account.';
      end if;
      if new.amount > destination_used + destination_fees then
        raise exception 'Credit card payment cannot exceed total due.';
      end if;
      new.service_fee_amount := least(new.amount, destination_fees);
      update public.wallets
      set current_balance = current_balance - new.amount - coalesce(new.fee, 0)
      where id = source_id;
      update public.wallets
      set service_fee_balance = service_fee_balance - new.service_fee_amount,
          current_balance = current_balance - (new.amount - new.service_fee_amount)
      where id = destination_id;
    elsif new.type in ('expense', 'loan') then
      update public.wallets
      set current_balance = case
        when source_type = 'credit_card' then current_balance + new.amount + coalesce(new.fee, 0)
        else current_balance - new.amount - coalesce(new.fee, 0)
      end where id = source_id;
    elsif new.type = 'income' then
      update public.wallets
      set current_balance = case
        when source_type = 'credit_card' then greatest(0, current_balance - greatest(0, new.amount - coalesce(new.fee, 0)))
        else current_balance + new.amount - coalesce(new.fee, 0)
      end where id = source_id;
    elsif new.type = 'transfer' then
      -- Legacy transfers pay principal only; service fees require a loan payment.
      if destination_type = 'credit_card' and new.amount > destination_used then
        raise exception 'Credit card payment cannot exceed the used balance.';
      end if;
      update public.wallets
      set current_balance = case
        when source_type = 'credit_card' then current_balance + new.amount + coalesce(new.fee, 0)
        else current_balance - new.amount - coalesce(new.fee, 0)
      end where id = source_id;
      if destination_id is not null then
        update public.wallets
        set current_balance = case
          when destination_type = 'credit_card' then current_balance - new.amount
          else current_balance + new.amount
        end where id = destination_id;
      end if;
    end if;
    return new;
  end if;

  if old.type = 'loan' and destination_type = 'credit_card' then
    update public.wallets
    set current_balance = current_balance + old.amount + coalesce(old.fee, 0)
    where id = source_id;
    update public.wallets
    set service_fee_balance = service_fee_balance + old.service_fee_amount,
        current_balance = current_balance + (old.amount - old.service_fee_amount)
    where id = destination_id;
  elsif old.type in ('expense', 'loan') then
    update public.wallets
    set current_balance = case
      when source_type = 'credit_card' then greatest(0, current_balance - old.amount - coalesce(old.fee, 0))
      else current_balance + old.amount + coalesce(old.fee, 0)
    end where id = source_id;
  elsif old.type = 'income' then
    update public.wallets
    set current_balance = case
      when source_type = 'credit_card' then current_balance + greatest(0, old.amount - coalesce(old.fee, 0))
      else current_balance - old.amount + coalesce(old.fee, 0)
    end where id = source_id;
  elsif old.type = 'transfer' then
    update public.wallets
    set current_balance = case
      when source_type = 'credit_card' then greatest(0, current_balance - old.amount - coalesce(old.fee, 0))
      else current_balance + old.amount + coalesce(old.fee, 0)
    end where id = source_id;
    if destination_id is not null then
      update public.wallets
      set current_balance = case
        when destination_type = 'credit_card' then current_balance + old.amount
        else current_balance - old.amount
      end where id = destination_id;
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_update_wallet_balance on public.transactions;
create trigger trg_update_wallet_balance
before insert or delete on public.transactions
for each row execute function public.update_wallet_balances_on_transaction();

-- A backup is an authorized, complete financial snapshot. The function validates
-- tenant scope and permissions before writes, then takes transaction/advisory locks
-- before wallet locks so it coordinates with ordinary trigger activity.
create or replace function public.restore_wallets_and_transactions(
  p_wallets jsonb,
  p_transactions jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  snapshot_wallet_count integer;
  snapshot_transaction_count integer;
  distinct_id_count integer;
  household_count integer;
  restore_household_id varchar(100);
  authenticated_member_role text;
  authenticated_member_role_id varchar(100);
  restore_is_allowed boolean := false;
  restore_transaction_id varchar(100);
  locked_transaction_id varchar(100);
  affected_rows integer;
begin
  if jsonb_typeof(coalesce(p_wallets, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_transactions, '[]'::jsonb)) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Backup wallets and transactions must be JSON arrays.';
  end if;

  snapshot_wallet_count := jsonb_array_length(coalesce(p_wallets, '[]'::jsonb));
  snapshot_transaction_count := jsonb_array_length(coalesce(p_transactions, '[]'::jsonb));
  if snapshot_wallet_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'Backup wallet snapshot cannot be empty.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_wallets) as restored(id varchar(100))
    where nullif(pg_catalog.btrim(restored.id), '') is null
  ) or exists (
    select 1
    from jsonb_to_recordset(p_transactions) as restored(id varchar(100))
    where nullif(pg_catalog.btrim(restored.id), '') is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Backup wallet and transaction IDs must be present and unique.';
  end if;

  select count(distinct restored.id)
  into distinct_id_count
  from jsonb_to_recordset(p_wallets) as restored(id varchar(100));
  if distinct_id_count <> snapshot_wallet_count then
    raise exception using
      errcode = '22023',
      message = 'Backup wallet and transaction IDs must be present and unique.';
  end if;

  select count(distinct restored.id)
  into distinct_id_count
  from jsonb_to_recordset(p_transactions) as restored(id varchar(100));
  if distinct_id_count <> snapshot_transaction_count then
    raise exception using
      errcode = '22023',
      message = 'Backup wallet and transaction IDs must be present and unique.';
  end if;

  select min(restored.household_id), count(distinct restored.household_id)
  into restore_household_id, household_count
  from jsonb_to_recordset(p_wallets) as restored(household_id varchar(100));
  if restore_household_id is null or household_count <> 1 or exists (
    select 1
    from jsonb_to_recordset(p_transactions) as restored(household_id varchar(100))
    where restored.household_id is distinct from restore_household_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Backup financial rows must belong to exactly one household.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_transactions) as restored(
      wallet_id varchar(100), destination_wallet_id varchar(100)
    )
    where restored.wallet_id is null
      or not exists (
        select 1
        from jsonb_to_recordset(p_wallets) as wallet(id varchar(100))
        where wallet.id = restored.wallet_id
      )
      or (
        restored.destination_wallet_id is not null
        and not exists (
          select 1
          from jsonb_to_recordset(p_wallets) as wallet(id varchar(100))
          where wallet.id = restored.destination_wallet_id
        )
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Every transaction wallet must be included in the backup wallet snapshot.';
  end if;

  -- Existing IDs must already belong to this tenant; snapshot upserts cannot move
  -- another household's wallet or ledger row across the boundary.
  if exists (
    select 1
    from public.wallets existing
    join jsonb_to_recordset(p_wallets) as restored(id varchar(100)) on restored.id = existing.id
    where existing.household_id <> restore_household_id
  ) or exists (
    select 1
    from public.transactions existing
    join jsonb_to_recordset(p_transactions) as restored(id varchar(100)) on restored.id = existing.id
    where existing.household_id <> restore_household_id
  ) or exists (
    select 1
    from jsonb_to_recordset(p_wallets) as restored(owner_id varchar(100))
    where restored.owner_id is not null
      and not exists (
        select 1 from public.household_members member
        where member.id = restored.owner_id
          and member.household_id = restore_household_id
      )
  ) or exists (
    select 1
    from jsonb_to_recordset(p_transactions) as restored(
      payer_id varchar(100), category_id varchar(100)
    )
    where not exists (
      select 1 from public.household_members member
      where member.id = restored.payer_id
        and member.household_id = restore_household_id
    ) or (
      restored.category_id is not null
      and not exists (
        select 1 from public.categories category
        where category.id = restored.category_id
          and category.household_id = restore_household_id
      )
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'Backup financial rows contain a cross-household reference.';
  end if;

  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authenticated member cannot restore backups for this household.';
  end if;

  select member.role::text, member.role_id
  into authenticated_member_role, authenticated_member_role_id
  from public.household_members member
  where member.household_id = restore_household_id
    and member.user_id = auth.uid()::text
  order by member.id
  limit 1;
  if not found then
    raise exception using
      errcode = '42501',
      message = 'Authenticated member cannot restore backups for this household.';
  end if;

  restore_is_allowed := authenticated_member_role = 'admin'
    or (authenticated_member_role_id is null and authenticated_member_role = 'parent_member')
    or exists (
      select 1
      from public.household_roles role
      where role.id = authenticated_member_role_id
        and role.household_id = restore_household_id
        and (
          role.is_head_parent
          or exists (
            select 1
            from public.role_permissions permission
            where permission.household_id = restore_household_id
              and permission.role_id = role.id
              and permission.permission_key = 'restore_backup'
              and permission.level = 'allowed'
          )
        )
    );
  if not restore_is_allowed then
    raise exception using
      errcode = '42501',
      message = 'Authenticated member cannot restore backups for this household.';
  end if;

  -- Use the same transaction-row then advisory-lock order as normal upserts. A
  -- competing creator receives retryable 40001 instead of entering a lock cycle.
  for restore_transaction_id in
    select restored.id
    from jsonb_to_recordset(p_transactions) as restored(id varchar(100))
    order by restored.id
  loop
    locked_transaction_id := null;
    select existing.id
    into locked_transaction_id
    from public.transactions existing
    where existing.id = restore_transaction_id
    for update;

    if not found then
      if not pg_catalog.pg_try_advisory_xact_lock(
        pg_catalog.hashtextextended('public.transactions:' || restore_transaction_id, 0)
      ) then
        raise exception using
          errcode = '40001',
          message = 'Transaction ID is being processed concurrently. Retry the transaction.';
      end if;

      select existing.id
      into locked_transaction_id
      from public.transactions existing
      where existing.id = restore_transaction_id
      for update;
    end if;

    if locked_transaction_id is not null and exists (
      select 1 from public.transactions existing
      where existing.id = locked_transaction_id
        and existing.household_id <> restore_household_id
    ) then
      raise exception using
        errcode = '22023',
        message = 'Backup financial rows contain a cross-household reference.';
    end if;
  end loop;

  perform existing.id
  from public.wallets existing
  join jsonb_to_recordset(p_wallets) as restored(id varchar(100)) on restored.id = existing.id
  order by existing.id
  for update of existing;

  if exists (
    select 1
    from public.wallets existing
    join jsonb_to_recordset(p_wallets) as restored(id varchar(100)) on restored.id = existing.id
    where existing.household_id <> restore_household_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Backup financial rows contain a cross-household reference.';
  end if;

  insert into private.financial_restore_context (backend_pid, transaction_id)
  values (pg_catalog.pg_backend_pid(), pg_catalog.txid_current());

  insert into public.wallets (
    id, household_id, owner_id, name, wallet_type, is_shared,
    current_balance, credit_limit, service_fee_balance, created_at
  )
  select
    restored.id, restored.household_id, restored.owner_id, restored.name,
    restored.wallet_type, coalesce(restored.is_shared, true),
    restored.current_balance, restored.credit_limit,
    coalesce(restored.service_fee_balance, 0), restored.created_at
  from jsonb_to_recordset(p_wallets) as restored(
    id varchar(100), household_id varchar(100), owner_id varchar(100), name varchar(100),
    wallet_type varchar(50), is_shared boolean, current_balance numeric(14, 2),
    credit_limit numeric(14, 2), service_fee_balance numeric(14, 2), created_at timestamptz
  )
  on conflict (id) do update set
    household_id = excluded.household_id,
    owner_id = excluded.owner_id,
    name = excluded.name,
    wallet_type = excluded.wallet_type,
    is_shared = excluded.is_shared,
    current_balance = excluded.current_balance,
    credit_limit = excluded.credit_limit,
    service_fee_balance = excluded.service_fee_balance,
    created_at = excluded.created_at;
  get diagnostics affected_rows = row_count;
  if affected_rows <> snapshot_wallet_count then
    raise exception 'Backup wallet restore was incomplete.';
  end if;

  insert into public.transactions (
    id, household_id, wallet_id, destination_wallet_id, category_id, payer_id,
    type, amount, fee, service_fee_amount, transaction_date, note, receipt_url, created_at
  )
  select
    restored.id, restored.household_id, restored.wallet_id, restored.destination_wallet_id,
    restored.category_id, restored.payer_id, restored.type, restored.amount,
    coalesce(restored.fee, 0), coalesce(restored.service_fee_amount, 0),
    restored.transaction_date, restored.note, restored.receipt_url, restored.created_at
  from jsonb_to_recordset(p_transactions) as restored(
    id varchar(100), household_id varchar(100), wallet_id varchar(100),
    destination_wallet_id varchar(100), category_id varchar(100), payer_id varchar(100),
    type varchar(50), amount numeric(12, 2), fee numeric(12, 2),
    service_fee_amount numeric(12, 2), transaction_date date, note text,
    receipt_url text, created_at timestamptz
  )
  on conflict (id) do update set
    household_id = excluded.household_id,
    wallet_id = excluded.wallet_id,
    destination_wallet_id = excluded.destination_wallet_id,
    category_id = excluded.category_id,
    payer_id = excluded.payer_id,
    type = excluded.type,
    amount = excluded.amount,
    fee = excluded.fee,
    service_fee_amount = excluded.service_fee_amount,
    transaction_date = excluded.transaction_date,
    note = excluded.note,
    receipt_url = excluded.receipt_url,
    created_at = excluded.created_at;
  get diagnostics affected_rows = row_count;
  if affected_rows <> snapshot_transaction_count then
    raise exception 'Backup transaction restore was incomplete.';
  end if;

  select count(*)
  into affected_rows
  from public.transactions existing
  join jsonb_to_recordset(p_transactions) as restored(
    id varchar(100), household_id varchar(100), service_fee_amount numeric(12, 2)
  ) on restored.id = existing.id
  where existing.household_id = restored.household_id
    and existing.service_fee_amount = coalesce(restored.service_fee_amount, 0);
  if affected_rows <> snapshot_transaction_count then
    raise exception 'Backup transaction allocation restore was incomplete.';
  end if;

  delete from private.financial_restore_context context
  where context.backend_pid = pg_catalog.pg_backend_pid()
    and context.transaction_id = pg_catalog.txid_current();
exception when others then
  delete from private.financial_restore_context context
  where context.backend_pid = pg_catalog.pg_backend_pid()
    and context.transaction_id = pg_catalog.txid_current();
  raise;
end;
$$;

revoke all on function public.restore_wallets_and_transactions(jsonb, jsonb) from public, anon;
grant execute on function public.restore_wallets_and_transactions(jsonb, jsonb) to authenticated;
