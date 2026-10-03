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
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $count = Require-Sql "select count(*) from pg_stat_activity where application_name = '$Name' and wait_event = '$Event'"
    if ($count -eq '1') { return }
    Start-Sleep -Milliseconds 100
  }
  throw "Session $Name did not reach $Event."
}
function Require-RetryableFailure($Result) {
  if ($Result.ExitCode -eq 0 -or $Result.Text -notmatch '\b40001\b') {
    throw "Expected SQLSTATE 40001, received exit $($Result.ExitCode): $($Result.Text)"
  }
}
function Require-State([string] $Expected) {
  $actual = Require-Sql @'
select (select current_balance from wallets where id = 'contention-bank'),
       (select current_balance from wallets where id = 'contention-card'),
       (select service_fee_balance from wallets where id = 'contention-card'),
       coalesce((select service_fee_amount::text from transactions where id = 'contention-payment'), 'none'),
       (select count(*) from transactions where id = 'contention-payment'),
       (select count(*) from households where id = 'contention-marker');
'@
  if ($actual -ne $Expected) { throw "Partial or duplicate state: expected $Expected, received $actual" }
}
$runSession = {
  param($container, $sql)
  $output = & docker exec $container psql -U postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -At -c $sql 2>&1
  [pscustomobject]@{ ExitCode = $LASTEXITCODE; Text = ($output -join "`n").Trim() }
}
$jobs = @()
$payment = @'
insert into transactions (id, household_id, wallet_id, destination_wallet_id, payer_id, type, amount, fee, service_fee_amount)
values ('contention-payment', 'contention-household', 'contention-bank', 'contention-card', 'contention-member', 'loan', 750, 10, 0)
on conflict (id) do update set amount = excluded.amount, fee = excluded.fee, service_fee_amount = excluded.service_fee_amount;
'@
$transaction = "begin; insert into households (id, name) values ('contention-marker', 'Rollback Marker') on conflict do nothing; $payment commit;"

try {
  $null = Require-Sql @'
insert into households (id, name) values ('contention-household', 'Contention Test');
insert into household_members (id, household_id, role, display_name)
values ('contention-member', 'contention-household', 'admin', 'Test Member');
insert into wallets (id, household_id, owner_id, name, wallet_type, current_balance, service_fee_balance)
values ('contention-bank', 'contention-household', 'contention-member', 'Bank', 'bank', 50000, 0),
       ('contention-card', 'contention-household', 'contention-member', 'Card', 'credit_card', 7000, 1000);
'@
  $holderSql = "set application_name = 'task2-contention-holder'; begin; select pg_advisory_xact_lock(hashtextextended('public.transactions:contention-payment', 0)); select pg_sleep(8); commit;"
  $holder = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $holderSql
  $jobs += $holder
  Wait-DatabaseEvent 'task2-contention-holder' 'PgSleep'
  # The old blocking implementation returns 55P03 after the bounded lock timeout.
  $failed = Invoke-Sql "set lock_timeout = '1s'; $transaction"
  Require-RetryableFailure $failed
  Require-State '50000.00|7000.00|1000.00|none|0|0'
  Write-Output 'PASS: contention returned 40001; the entire transaction rolled back, including its earlier marker insert; wallets and ledger unchanged.'
  $null = Wait-Job $holder -Timeout 15
  $holderResult = Receive-Job $holder
  if ($holder.State -ne 'Completed' -or $holderResult.ExitCode -ne 0) { throw 'Advisory holder did not commit.' }
  $null = Require-Sql $transaction
  Require-State '49240.00|7000.00|250.00|750.00|1|1'
  $null = Require-Sql $transaction
  Require-State '49240.00|7000.00|250.00|750.00|1|1'
  Write-Output 'PASS: retry after holder commit applied balances once; another identical upsert preserved the same balance/allocation/row count.'

  # Force the reviewed lock graph: B has the advisory lock and waits on C's row;
  # C deletes/reinserts and must abort with 40001, releasing B without a deadlock.
  $deleteSql = "set application_name = 'task2-contention-delete'; begin; select id from transactions where id = 'contention-payment' for update; select pg_sleep(8); delete from transactions where id = 'contention-payment'; $payment commit;"
  $delete = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $deleteSql
  $jobs += $delete
  Wait-DatabaseEvent 'task2-contention-delete' 'PgSleep'
  $lookupSql = "set application_name = 'task2-contention-lookup'; begin; set local statement_timeout = '15s'; select pg_advisory_xact_lock(hashtextextended('public.transactions:contention-payment', 0)); select id from transactions where id = 'contention-payment' for update; commit;"
  $lookup = Start-Job -ScriptBlock $runSession -ArgumentList $Container, $lookupSql
  $jobs += $lookup
  Wait-DatabaseEvent 'task2-contention-lookup' 'transactionid'
  $null = Wait-Job -Job $delete, $lookup -Timeout 15
  $deleteResult = Receive-Job $delete
  $lookupResult = Receive-Job $lookup
  if ($delete.State -ne 'Completed' -or $lookup.State -ne 'Completed' -or $lookupResult.ExitCode -ne 0) {
    throw "Lock graph did not resolve successfully: $($lookupResult.Text)"
  }
  Require-RetryableFailure $deleteResult
  Require-State '49240.00|7000.00|250.00|750.00|1|1'
  $null = Require-Sql "begin; delete from transactions where id = 'contention-payment'; $payment commit;"
  Require-State '49240.00|7000.00|250.00|750.00|1|1'
  Write-Output 'PASS: observed the advisory-to-row lock graph; delete/reinsert returned 40001 and rolled back its reversal; B committed and a later retry succeeded exactly once.'
} finally {
  $null = Invoke-Sql "select pg_terminate_backend(pid) from pg_stat_activity where application_name in ('task2-contention-holder', 'task2-contention-delete', 'task2-contention-lookup') and pid <> pg_backend_pid();"
  foreach ($job in $jobs) {
    if ($job.State -eq 'Running') { Stop-Job $job }
    Remove-Job $job -Force
  }
  $null = Require-Sql @'
delete from transactions where household_id = 'contention-household';
delete from wallets where household_id = 'contention-household';
delete from household_members where household_id = 'contention-household';
delete from households where id in ('contention-household', 'contention-marker');
'@
}
