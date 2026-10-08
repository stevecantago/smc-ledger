# Run only against the disposable local Task 2 PostgreSQL fixture after migrations.
param([string] $Container = 'family-credit-fees-task2-postgres')
$ErrorActionPreference = 'Stop'
$ports = (& docker inspect --format '{{json .NetworkSettings.Ports}}' $Container | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or $ports.'5432/tcp'[0].HostIp -ne '127.0.0.1' -or $ports.'5432/tcp'[0].HostPort -ne '56323') {
  throw 'Expected the disposable PostgreSQL container bound only to 127.0.0.1:56323.'
}

function Invoke-Sql([string] $Sql) {
  $output = & docker exec $Container psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -At -c $Sql 2>&1
  return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Text = ($output -join "`n").Trim() }
}
function Require-Sql([string] $Sql) {
  $result = Invoke-Sql $Sql
  if ($result.ExitCode -ne 0) { throw $result.Text }
  return $result.Text
}
function Wait-DatabaseEvent([string] $Name, [string] $Event) {
  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    $count = Require-Sql "select count(*) from pg_stat_activity where application_name = '$Name' and wait_event = '$Event'"
    if ($count -eq '1') { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Session $Name did not reach $Event."
}
function Require-State([string] $Expected) {
  $actual = Require-Sql @'
select (select household_id from wallets where id = 'wallet-collision-id'),
       (select owner_id from wallets where id = 'wallet-collision-id'),
       (select name from wallets where id = 'wallet-collision-id'),
       (select current_balance from wallets where id = 'wallet-collision-id'),
       (select owner_id from wallets where id = 'wallet-collision-safe'),
       (select name from wallets where id = 'wallet-collision-safe'),
       (select current_balance from wallets where id = 'wallet-collision-safe'),
       (select amount from transactions where id = 'wallet-collision-transaction'),
       (select service_fee_amount from transactions where id = 'wallet-collision-transaction'),
       (select count(*) from private.financial_restore_context);
'@
  if ($actual -ne $Expected) { throw "Partial or cross-household restore state: expected $Expected, received $actual" }
}

$runSession = {
  param($container, $sql)
  $output = & docker exec $container psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -At -c $sql 2>&1
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Text = ($output -join "`n").Trim() }
}
$jobs = @()

try {
  $null = Require-Sql @'
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

insert into public.households (id, name) values
  ('wallet-collision-household-a', 'Wallet collision A'),
  ('wallet-collision-household-b', 'Wallet collision B');
insert into public.household_roles (id, household_id, name, base_role, is_head_parent, is_default)
values ('wallet-collision-role-b', 'wallet-collision-household-b', 'Restorer', 'parent_member', false, true);
insert into public.role_permissions (id, household_id, role_id, permission_key, level)
values ('wallet-collision-permission-b', 'wallet-collision-household-b', 'wallet-collision-role-b', 'restore_backup', 'allowed');
insert into public.household_members (id, household_id, user_id, role, role_id, display_name) values
  ('wallet-collision-member-a', 'wallet-collision-household-a', null, 'admin', null, 'Household A'),
  ('wallet-collision-member-b', 'wallet-collision-household-b', '00000000-0000-0000-0000-000000000301', 'parent_member', 'wallet-collision-role-b', 'Household B');
insert into public.wallets (
  id, household_id, owner_id, name, wallet_type, current_balance, service_fee_balance
) values (
  'wallet-collision-safe', 'wallet-collision-household-b', 'wallet-collision-member-b',
  'Original safe wallet', 'bank', 100.00, 0
);
insert into public.transactions (
  id, household_id, wallet_id, payer_id, type, amount, fee, service_fee_amount, transaction_date
) values (
  'wallet-collision-transaction', 'wallet-collision-household-b', 'wallet-collision-safe',
  'wallet-collision-member-b', 'expense', 10.00, 0, 0, '2020-01-01'
);
'@

  $holderSql = @'
set application_name = 'task9-wallet-collision-holder';
begin;
insert into public.wallets (
  id, household_id, owner_id, name, wallet_type, current_balance, service_fee_balance
) values (
  'wallet-collision-id', 'wallet-collision-household-a', 'wallet-collision-member-a',
  'Household A original', 'bank', 321.00, 0
);
select pg_sleep(8);
commit;
'@
  $holder = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $holderSql
  $jobs += $holder
  Wait-DatabaseEvent 'task9-wallet-collision-holder' 'PgSleep'

  $restoreSql = @'
set application_name = 'task9-wallet-collision-restore';
set statement_timeout = '20s';
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select public.restore_wallets_and_transactions(
  jsonb_build_array(
    jsonb_build_object(
      'id', 'wallet-collision-safe', 'household_id', 'wallet-collision-household-b',
      'owner_id', 'wallet-collision-member-b', 'name', 'Restored safe wallet', 'wallet_type', 'bank',
      'is_shared', true, 'current_balance', 777.00, 'credit_limit', null,
      'service_fee_balance', 0, 'created_at', '2020-01-01T00:00:00Z'
    ),
    jsonb_build_object(
      'id', 'wallet-collision-id', 'household_id', 'wallet-collision-household-b',
      'owner_id', 'wallet-collision-member-b', 'name', 'Household B overwrite', 'wallet_type', 'bank',
      'is_shared', true, 'current_balance', 1.00, 'credit_limit', null,
      'service_fee_balance', 0, 'created_at', '2020-01-01T00:00:00Z'
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', 'wallet-collision-transaction', 'household_id', 'wallet-collision-household-b',
      'wallet_id', 'wallet-collision-safe', 'destination_wallet_id', null,
      'payer_id', 'wallet-collision-member-b', 'type', 'expense', 'amount', 22.00,
      'fee', 0, 'service_fee_amount', 0, 'transaction_date', '2020-01-01',
      'created_at', '2020-01-01T00:00:00Z'
    )
  )
);
commit;
'@
  $restore = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $restoreSql
  $jobs += $restore
  Wait-DatabaseEvent 'task9-wallet-collision-restore' 'transactionid'

  $null = Wait-Job -Job $holder, $restore -Timeout 25
  $holderResult = Receive-Job $holder
  $restoreResult = Receive-Job $restore
  if ($holder.State -ne 'Completed' -or $holderResult.ExitCode -ne 0) {
    throw "Concurrent wallet creator did not commit: $($holderResult.Text)"
  }
  if ($restore.State -ne 'Completed' -or $restoreResult.ExitCode -eq 0 -or $restoreResult.Text -notmatch '\b22023\b') {
    throw "Expected the restore to abort with SQLSTATE 22023 after the wallet-ID collision: $($restoreResult.Text)"
  }

  Require-State 'wallet-collision-household-a|wallet-collision-member-a|Household A original|321.00|wallet-collision-member-b|Original safe wallet|90.00|10.00|0.00|0'
  Write-Output 'PASS: a concurrent wallet-ID collision aborted the complete restore; the original household, owner, balances, transaction, allocation, and restore marker remained unchanged.'
} finally {
  $null = Invoke-Sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('task9-wallet-collision-holder', 'task9-wallet-collision-restore') and pid <> pg_backend_pid();"
  foreach ($job in $jobs) {
    if ($job.State -eq 'Running') { Stop-Job $job }
    Remove-Job $job -Force
  }
  $null = Require-Sql @'
delete from public.transactions where id = 'wallet-collision-transaction';
delete from public.wallets where id in ('wallet-collision-safe', 'wallet-collision-id');
delete from public.household_members where household_id in ('wallet-collision-household-a', 'wallet-collision-household-b');
delete from public.role_permissions where household_id = 'wallet-collision-household-b';
delete from public.household_roles where household_id = 'wallet-collision-household-b';
delete from public.households where id in ('wallet-collision-household-a', 'wallet-collision-household-b');
'@
}
