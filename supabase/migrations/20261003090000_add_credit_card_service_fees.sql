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

    -- A missing row cannot be row-locked. Serialize creation by ID, then recheck
    -- after waiting: another transaction may have inserted and committed this ID.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('public.transactions:' || new.id, 0)
    );
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
