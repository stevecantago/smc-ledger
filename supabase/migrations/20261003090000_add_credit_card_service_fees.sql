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

-- Restore financial backup rows as one RLS-protected transaction. Missing ledger rows
-- may represent historical payments already reflected in the saved wallet balances, so
-- the saved balances and allocations are restored after ordinary insert triggers run.
create or replace function public.restore_wallets_and_transactions(
  p_wallets jsonb,
  p_transactions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_wallets, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_transactions, '[]'::jsonb)) <> 'array' then
    raise exception 'Backup wallets and transactions must be JSON arrays.';
  end if;

  insert into public.wallets (
    id, household_id, owner_id, name, wallet_type, is_shared,
    current_balance, credit_limit, service_fee_balance, created_at
  )
  select
    restored.id, restored.household_id, restored.owner_id, restored.name,
    restored.wallet_type, coalesce(restored.is_shared, true),
    restored.current_balance, restored.credit_limit,
    coalesce(restored.service_fee_balance, 0), restored.created_at
  from jsonb_to_recordset(coalesce(p_wallets, '[]'::jsonb)) as restored(
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

  -- Give ordinary triggers enough temporary due to accept every missing historical
  -- card payment. The exact saved wallet values are restored below in the same RPC.
  with restored_transactions as (
    select restored.*
    from jsonb_to_recordset(coalesce(p_transactions, '[]'::jsonb)) as restored(
      id varchar(100), destination_wallet_id varchar(100), type varchar(50),
      amount numeric(12, 2), service_fee_amount numeric(12, 2)
    )
  ),
  missing_transactions as (
    select restored.*
    from restored_transactions restored
    where not exists (select 1 from public.transactions existing where existing.id = restored.id)
  ),
  card_requirements as (
    select
      destination_wallet_id,
      sum(case
        when type = 'loan' then greatest(amount - coalesce(service_fee_amount, 0), 0)
        when type = 'transfer' then amount
        else 0
      end) as principal_required,
      sum(case
        when type = 'loan' then least(coalesce(service_fee_amount, 0), amount)
        else 0
      end) as service_fees_required
    from missing_transactions
    where destination_wallet_id is not null and type in ('loan', 'transfer')
    group by destination_wallet_id
  )
  update public.wallets wallet
  set current_balance = greatest(wallet.current_balance, requirements.principal_required),
      service_fee_balance = greatest(wallet.service_fee_balance, requirements.service_fees_required)
  from card_requirements requirements
  where wallet.id = requirements.destination_wallet_id
    and wallet.wallet_type = 'credit_card';

  insert into public.transactions (
    id, household_id, wallet_id, destination_wallet_id, category_id, payer_id,
    type, amount, fee, service_fee_amount, transaction_date, note, receipt_url, created_at
  )
  select
    restored.id, restored.household_id, restored.wallet_id, restored.destination_wallet_id,
    restored.category_id, restored.payer_id, restored.type, restored.amount,
    coalesce(restored.fee, 0), coalesce(restored.service_fee_amount, 0),
    restored.transaction_date, restored.note, restored.receipt_url, restored.created_at
  from jsonb_to_recordset(coalesce(p_transactions, '[]'::jsonb)) as restored(
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

  -- The insert trigger owns normal allocations. Backup restoration instead owns the
  -- historical allocation stored in the backup, including an existing row's value.
  update public.transactions transaction
  set service_fee_amount = coalesce(restored.service_fee_amount, 0)
  from jsonb_to_recordset(coalesce(p_transactions, '[]'::jsonb)) as restored(
    id varchar(100), service_fee_amount numeric(12, 2)
  )
  where transaction.id = restored.id;

  -- Trigger side effects are temporary during restoration. Saved balances are the
  -- source of truth and this final write is committed atomically with the ledger rows.
  insert into public.wallets (
    id, household_id, owner_id, name, wallet_type, is_shared,
    current_balance, credit_limit, service_fee_balance, created_at
  )
  select
    restored.id, restored.household_id, restored.owner_id, restored.name,
    restored.wallet_type, coalesce(restored.is_shared, true),
    restored.current_balance, restored.credit_limit,
    coalesce(restored.service_fee_balance, 0), restored.created_at
  from jsonb_to_recordset(coalesce(p_wallets, '[]'::jsonb)) as restored(
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
end;
$$;
