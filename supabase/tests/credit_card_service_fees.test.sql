begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into households (id, name) values ('fee-test-household', 'Fee Test');
insert into household_members (id, household_id, role, display_name)
values ('fee-test-member', 'fee-test-household', 'admin', 'Fee Tester');

insert into wallets (
  id, household_id, owner_id, name, wallet_type, is_shared,
  current_balance, credit_limit, service_fee_balance
) values
  ('fee-test-bank', 'fee-test-household', 'fee-test-member', 'Bank', 'bank', true, 50000, null, 0),
  ('fee-test-card', 'fee-test-household', 'fee-test-member', 'Card', 'credit_card', false, 7000, 10000, 1000);

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

select * from finish();
rollback;
