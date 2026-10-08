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
select (select current_balance from wallets where id = 'restore-contention-bank'),
       (select current_balance from wallets where id = 'restore-contention-card'),
       (select service_fee_balance from wallets where id = 'restore-contention-card'),
       (select service_fee_amount from transactions where id = 'restore-contention-payment'),
       (select count(*) from transactions where id = 'restore-contention-payment');
'@
  if ($actual -ne $Expected) { throw "Partial restore state: expected $Expected, received $actual" }
}

$runSession = {
  param($container, $sql)
  $output = & docker exec $container psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -At -c $sql 2>&1
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Text = ($output -join "`n").Trim() }
}
$jobs = @()

$restore = @'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);
select public.restore_wallets_and_transactions(
  jsonb_build_array(
    jsonb_build_object(
      'id', 'restore-contention-bank', 'household_id', 'restore-contention-household',
      'owner_id', 'restore-contention-member', 'name', 'Bank', 'wallet_type', 'bank',
      'is_shared', true, 'current_balance', 49240.00, 'credit_limit', null,
      'service_fee_balance', 0, 'created_at', '2020-01-01T00:00:00Z'
    ),
    jsonb_build_object(
      'id', 'restore-contention-card', 'household_id', 'restore-contention-household',
      'owner_id', 'restore-contention-member', 'name', 'Card', 'wallet_type', 'credit_card',
      'is_shared', false, 'current_balance', 7000.00, 'credit_limit', 10000.00,
      'service_fee_balance', 250.00, 'created_at', '2020-01-01T00:00:00Z'
    )
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', 'restore-contention-payment', 'household_id', 'restore-contention-household',
      'wallet_id', 'restore-contention-bank', 'destination_wallet_id', 'restore-contention-card',
      'payer_id', 'restore-contention-member', 'type', 'loan', 'amount', 750.00,
      'fee', 10.00, 'service_fee_amount', 750.00, 'transaction_date', '2020-01-01',
      'created_at', '2020-01-01T00:00:00Z'
    )
  )
);
commit;
'@

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
grant select, insert, update, delete on public.wallets, public.transactions to authenticated;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
drop policy if exists "Restore contention wallet access" on public.wallets;
drop policy if exists "Restore contention transaction access" on public.transactions;
create policy "Restore contention wallet access" on public.wallets
  for all to authenticated
  using (exists (
    select 1 from public.household_members member
    where member.household_id = wallets.household_id and member.user_id = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.household_members member
    where member.household_id = wallets.household_id and member.user_id = auth.uid()::text
  ));
create policy "Restore contention transaction access" on public.transactions
  for all to authenticated
  using (exists (
    select 1 from public.household_members member
    where member.household_id = transactions.household_id and member.user_id = auth.uid()::text
  ))
  with check (exists (
    select 1 from public.household_members member
    where member.household_id = transactions.household_id and member.user_id = auth.uid()::text
  ));

insert into public.households (id, name)
values ('restore-contention-household', 'Restore contention');
insert into public.household_roles (id, household_id, name, base_role, is_head_parent, is_default)
values ('restore-contention-role', 'restore-contention-household', 'Parent', 'parent_member', false, true);
insert into public.role_permissions (id, household_id, role_id, permission_key, level)
values ('restore-contention-permission', 'restore-contention-household', 'restore-contention-role', 'restore_backup', 'allowed');
insert into public.household_members (id, household_id, user_id, role, role_id, display_name)
values (
  'restore-contention-member', 'restore-contention-household',
  '00000000-0000-0000-0000-000000000201', 'parent_member',
  'restore-contention-role', 'Restore Tester'
);
insert into public.wallets (
  id, household_id, owner_id, name, wallet_type, current_balance, credit_limit, service_fee_balance
) values
  ('restore-contention-bank', 'restore-contention-household', 'restore-contention-member', 'Bank', 'bank', 50000, null, 0),
  ('restore-contention-card', 'restore-contention-household', 'restore-contention-member', 'Card', 'credit_card', 7000, 10000, 1000);
insert into public.transactions (
  id, household_id, wallet_id, destination_wallet_id, payer_id,
  type, amount, fee, service_fee_amount, transaction_date, created_at
) values (
  'restore-contention-payment', 'restore-contention-household',
  'restore-contention-bank', 'restore-contention-card', 'restore-contention-member',
  'loan', 750, 10, 0, '2020-01-01', '2020-01-01T00:00:00Z'
);
'@
  Require-State '49240.00|7000.00|250.00|750.00|1'

  $deleteSql = @'
set application_name = 'task8-restore-delete';
begin;
select id from public.transactions where id = 'restore-contention-payment' for update;
select pg_sleep(8);
delete from public.transactions where id = 'restore-contention-payment';
commit;
'@
  $delete = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $deleteSql
  $jobs += $delete
  Wait-DatabaseEvent 'task8-restore-delete' 'PgSleep'

  $restoreSql = "set application_name = 'task8-restore-rpc'; set statement_timeout = '20s'; $restore"
  $restoreJob = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $restoreSql
  $jobs += $restoreJob
  Wait-DatabaseEvent 'task8-restore-rpc' 'transactionid'

  $null = Wait-Job -Job $delete, $restoreJob -Timeout 25
  $deleteResult = Receive-Job $delete
  $restoreResult = Receive-Job $restoreJob
  if ($delete.State -ne 'Completed' -or $restoreJob.State -ne 'Completed' -or
      $deleteResult.ExitCode -ne 0 -or $restoreResult.ExitCode -ne 0) {
    throw "Restore/delete coordination failed. Delete: $($deleteResult.Text) Restore: $($restoreResult.Text)"
  }
  Require-State '49240.00|7000.00|250.00|750.00|1'
  Write-Output 'PASS: restore waited on the transaction before wallet locks; concurrent delete committed; restore then reinstated the exact snapshot without deadlock or partial state.'
} finally {
  $null = Invoke-Sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('task8-restore-delete', 'task8-restore-rpc') and pid <> pg_backend_pid();"
  foreach ($job in $jobs) {
    if ($job.State -eq 'Running') { Stop-Job $job }
    Remove-Job $job -Force
  }
  $null = Require-Sql @'
delete from public.transactions where household_id = 'restore-contention-household';
delete from public.wallets where household_id = 'restore-contention-household';
delete from public.household_members where household_id = 'restore-contention-household';
delete from public.role_permissions where household_id = 'restore-contention-household';
delete from public.household_roles where household_id = 'restore-contention-household';
delete from public.households where id = 'restore-contention-household';
drop policy if exists "Restore contention wallet access" on public.wallets;
drop policy if exists "Restore contention transaction access" on public.transactions;
'@
}
