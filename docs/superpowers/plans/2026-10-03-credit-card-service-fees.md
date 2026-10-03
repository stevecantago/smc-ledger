# Credit Card Service Fees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separately tracked credit-card service-fee balance, apply credit payments to fees before principal, and expose the exact allocation throughout FamLedger.

**Architecture:** Extend wallet and transaction records with service-fee fields, centralize all fee-first calculations in the existing credit-card helper, and make the Supabase transaction trigger the only remote balance writer. React keeps optimistic local balances through the same helper, while schedules, wallet cards, ledger entries, and CSV exports read the shared calculated values.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.7, Vitest 5, Supabase Postgres, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-03-credit-card-service-fees-design.md`

## Global Constraints

- Service fees are paid before used balance.
- Total due is `used balance + service fee balance`.
- Available credit is `max(credit limit - total due, 0)`.
- A payment cannot exceed total due and cannot create a prepaid card balance.
- The funding account decreases by payment plus the separate transaction fee.
- `transactions.service_fee_amount` stores the exact fee portion for reversal.
- New credit accounts start with zero service fees; legacy records normalize missing values to zero.
- Preserve the required Maya Wallet funding lock for Maya Credit and Maya Black.
- Supabase transaction triggers are the only remote balance writers for transaction inserts and deletes.
- Apply the database migration before deploying code that writes the new columns.
- Do not apply a live Supabase migration, deploy to Vercel, or change production data without Steve's separate approval.
- Add no new runtime or test dependencies.

---

### Task 1: Service-Fee Accounting Model

**Files:**
- Modify: `src/types/database.ts:80-115`
- Modify: `src/lib/supabase.ts:38-160`
- Modify: `src/lib/creditCardTransactions.ts:1-220`
- Modify: `src/lib/creditCardTransactions.test.ts:1-220`

**Interfaces:**
- Produces: `getCreditCardServiceFeeBalance(wallet: Wallet): number`
- Produces: `getCreditCardTotalDue(wallet: Wallet): number`
- Produces: `getCreditCardPaymentAllocation(wallet: Wallet, paymentAmount: number): CreditCardPaymentAllocation`
- Produces: `Transaction.service_fee_amount?: number | null`
- Produces: `Wallet.service_fee_balance?: number | null`
- Preserves: `getRequiredCreditCardFunding`, `getCreditCardUsedBalance`, and the Maya account rules.

- [ ] **Step 1: Add failing accounting tests**

Add `service_fee_balance: 0` to the shared card fixture, then add these cases to `src/lib/creditCardTransactions.test.ts`:

```ts
it('calculates total due and available credit from used balance plus service fees', () => {
  const cardWithFees = {
    ...card,
    current_balance: 7000,
    service_fee_balance: 1000,
    credit_limit: 10000,
  };

  expect(getCreditCardServiceFeeBalance(cardWithFees)).toBe(1000);
  expect(getCreditCardTotalDue(cardWithFees)).toBe(8000);
  expect(getCreditCardAvailableCredit(cardWithFees)).toBe(2000);
});

it.each([
  [500, 500, 0, 500, 7000],
  [1000, 1000, 0, 0, 7000],
  [7500, 1000, 6500, 0, 500],
  [8000, 1000, 7000, 0, 0],
])('allocates a payment of %s to fees before used balance', (
  payment,
  serviceFeePaid,
  usedBalancePaid,
  remainingServiceFees,
  remainingUsedBalance,
) => {
  const allocation = getCreditCardPaymentAllocation({
    ...card,
    current_balance: 7000,
    service_fee_balance: 1000,
  }, payment);

  expect(allocation).toEqual({
    serviceFeePaid,
    usedBalancePaid,
    remainingServiceFees,
    remainingUsedBalance,
  });
});

it('applies and reverses the stored fee-first allocation exactly', () => {
  const cardWithFees = { ...card, current_balance: 7000, service_fee_balance: 1000 };
  const applied = applyTransactionBalanceChange([bank, cardWithFees], {
    wallet_id: bank.id,
    destination_wallet_id: card.id,
    type: 'loan',
    amount: 7500,
    fee: 50,
  });

  expect(applied.success).toBe(true);
  expect(applied.wallets.find(wallet => wallet.id === bank.id)?.current_balance).toBe(42450);
  expect(applied.wallets.find(wallet => wallet.id === card.id)).toMatchObject({
    current_balance: 500,
    service_fee_balance: 0,
  });

  const reversed = reverseTransactionBalanceChange(applied.wallets, {
    wallet_id: bank.id,
    destination_wallet_id: card.id,
    type: 'loan',
    amount: 7500,
    fee: 50,
    service_fee_amount: 1000,
  });

  expect(reversed.wallets.find(wallet => wallet.id === bank.id)?.current_balance).toBe(50000);
  expect(reversed.wallets.find(wallet => wallet.id === card.id)).toMatchObject({
    current_balance: 7000,
    service_fee_balance: 1000,
  });
});

it('rejects a credit payment above total due', () => {
  const result = applyTransactionBalanceChange([
    bank,
    { ...card, current_balance: 7000, service_fee_balance: 1000 },
  ], {
    wallet_id: bank.id,
    destination_wallet_id: card.id,
    type: 'loan',
    amount: 8000.01,
    fee: 0,
  });

  expect(result.success).toBe(false);
  if (!result.success) expect(result.error).toBe('Credit card payment cannot exceed total due.');
});

it('normalizes a missing legacy service-fee balance to zero', () => {
  expect(getCreditCardServiceFeeBalance({ ...card, service_fee_balance: undefined })).toBe(0);
});
```

Update the import list to include the three new helpers.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```powershell
npm test -- src/lib/creditCardTransactions.test.ts
```

Expected: FAIL because the new helpers and fields do not exist and payment allocation still reduces only used balance.

- [ ] **Step 3: Add the backward-compatible fields and seed defaults**

Add to `Wallet` and `Transaction` in `src/types/database.ts`:

```ts
export interface Wallet {
  // existing fields
  current_balance: number;
  credit_limit?: number | null;
  service_fee_balance?: number | null;
  created_at: string;
}

export interface Transaction {
  // existing fields
  amount: number;
  fee?: number | null;
  service_fee_amount?: number | null;
  transaction_date: string;
  // remaining fields
}
```

Keep the TypeScript fields optional because saved local data and pre-migration rows may omit them. Add `service_fee_balance: 0.00` to every seeded wallet in `src/lib/supabase.ts`.

- [ ] **Step 4: Implement the shared accounting helpers**

Add these interfaces and functions to `src/lib/creditCardTransactions.ts`:

```ts
type TransactionBalanceInput = {
  wallet_id: string;
  destination_wallet_id?: string | null;
  type: TransactionType;
  amount: number;
  fee?: number | null;
  service_fee_amount?: number | null;
};

export interface CreditCardPaymentAllocation {
  serviceFeePaid: number;
  usedBalancePaid: number;
  remainingServiceFees: number;
  remainingUsedBalance: number;
}

export function getCreditCardServiceFeeBalance(wallet: Wallet): number {
  return wallet.wallet_type === 'credit_card'
    ? Math.max(0, wallet.service_fee_balance || 0)
    : 0;
}

export function getCreditCardTotalDue(wallet: Wallet): number {
  if (wallet.wallet_type !== 'credit_card') return 0;
  return getCreditCardUsedBalance(wallet) + getCreditCardServiceFeeBalance(wallet);
}

export function getCreditCardPaymentAllocation(
  wallet: Wallet,
  paymentAmount: number,
): CreditCardPaymentAllocation {
  const serviceFees = getCreditCardServiceFeeBalance(wallet);
  const usedBalance = getCreditCardUsedBalance(wallet);
  const serviceFeePaid = Math.min(Math.max(paymentAmount, 0), serviceFees);
  const usedBalancePaid = Math.min(Math.max(paymentAmount - serviceFeePaid, 0), usedBalance);

  return {
    serviceFeePaid,
    usedBalancePaid,
    remainingServiceFees: serviceFees - serviceFeePaid,
    remainingUsedBalance: usedBalance - usedBalancePaid,
  };
}
```

Change `getCreditCardAvailableCredit()` to subtract `getCreditCardTotalDue(wallet)`. Normalize credit cards with both positive used balance and a zero fallback for missing service fees:

```ts
export function normalizeCreditCardWalletBalance(wallet: Wallet): Wallet {
  return wallet.wallet_type === 'credit_card'
    ? {
        ...wallet,
        current_balance: getCreditCardUsedBalance(wallet),
        service_fee_balance: getCreditCardServiceFeeBalance(wallet),
      }
    : wallet;
}
```

For a `loan` transaction with a credit-card destination, reject `amount > getCreditCardTotalDue(destinationWallet)`, calculate the allocation, subtract `amount + fee` from the funding wallet, and apply the two remaining balances to the card. For reversal, restore `input.service_fee_amount || 0` to fees and restore `input.amount - serviceFeeAmount` to used balance. Leave transfer-to-card behavior as principal-only legacy behavior.

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
npm test -- src/lib/creditCardTransactions.test.ts
```

Expected: PASS, including the existing Maya funding, credit charge, legacy negative-balance, transfer, and reversal cases.

- [ ] **Step 6: Commit the accounting model**

```powershell
git add -- src/types/database.ts src/lib/supabase.ts src/lib/creditCardTransactions.ts src/lib/creditCardTransactions.test.ts
git commit -m "Add credit card service fee accounting"
```

---

### Task 2: Supabase Migration and Transaction Persistence

**Files:**
- Create: `supabase/migrations/20261003090000_add_credit_card_service_fees.sql`
- Create: `supabase/tests/credit_card_service_fees.test.sql`
- Modify: `src/context/HouseholdContext.tsx:72-84, 220-230, 677-720, 777-872`

**Interfaces:**
- Consumes: `getCreditCardPaymentAllocation()` and the optional service-fee fields from Task 1.
- Produces: `wallets.service_fee_balance NUMERIC(14,2) NOT NULL DEFAULT 0`.
- Produces: `transactions.service_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0`.
- Produces: a `BEFORE INSERT OR DELETE` trigger that writes remote balances once and stores the authoritative allocation.

- [ ] **Step 1: Write the failing database test**

Create `supabase/tests/credit_card_service_fees.test.sql`:

```sql
begin;

select plan(8);

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

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test and confirm failure**

Run:

```powershell
npx supabase test db supabase/tests/credit_card_service_fees.test.sql
```

Expected: FAIL because `service_fee_balance` and `service_fee_amount` do not exist.

- [ ] **Step 3: Add the forward-only migration**

Create `supabase/migrations/20261003090000_add_credit_card_service_fees.sql` with:

```sql
alter table wallets
  add column if not exists service_fee_balance numeric(14, 2) not null default 0.00;

alter table transactions
  add column if not exists service_fee_amount numeric(12, 2) not null default 0.00;

do $$ begin
  alter table wallets
    add constraint wallets_service_fee_balance_nonnegative
    check (service_fee_balance >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table transactions
    add constraint transactions_service_fee_amount_nonnegative
    check (service_fee_amount >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table transactions
    add constraint transactions_service_fee_amount_lte_amount
    check (service_fee_amount <= amount);
exception when duplicate_object then null;
end $$;

create or replace function update_wallet_balances_on_transaction()
returns trigger as $$
declare
  source_type wallet_type;
  destination_type wallet_type;
  destination_used numeric(14, 2) := 0;
  destination_fees numeric(14, 2) := 0;
begin
  if tg_op = 'INSERT' then
    select wallet_type into source_type
    from wallets where id = new.wallet_id for update;

    if new.destination_wallet_id is not null then
      select wallet_type, current_balance, service_fee_balance
      into destination_type, destination_used, destination_fees
      from wallets where id = new.destination_wallet_id for update;
    end if;

    if new.type = 'loan' and destination_type = 'credit_card' then
      if source_type = 'credit_card' then
        raise exception 'Credit card payments require a non-credit funding account.';
      end if;
      if new.amount > destination_used + destination_fees then
        raise exception 'Credit card payment cannot exceed total due.';
      end if;

      new.service_fee_amount := least(new.amount, destination_fees);
      update wallets
      set current_balance = current_balance - new.amount - coalesce(new.fee, 0)
      where id = new.wallet_id;
      update wallets
      set service_fee_balance = service_fee_balance - new.service_fee_amount,
          current_balance = current_balance - (new.amount - new.service_fee_amount)
      where id = new.destination_wallet_id;
    elsif new.type in ('expense', 'loan') then
      new.service_fee_amount := 0;
      update wallets
      set current_balance = case
        when source_type = 'credit_card' then current_balance + new.amount + coalesce(new.fee, 0)
        else current_balance - new.amount - coalesce(new.fee, 0)
      end
      where id = new.wallet_id;
    elsif new.type = 'income' then
      new.service_fee_amount := 0;
      update wallets
      set current_balance = case
        when source_type = 'credit_card' then greatest(0, current_balance - greatest(0, new.amount - coalesce(new.fee, 0)))
        else current_balance + new.amount - coalesce(new.fee, 0)
      end
      where id = new.wallet_id;
    elsif new.type = 'transfer' then
      new.service_fee_amount := 0;
      if destination_type = 'credit_card' and new.amount > destination_used then
        raise exception 'Credit card payment cannot exceed the used balance.';
      end if;
      update wallets
      set current_balance = case
        when source_type = 'credit_card' then current_balance + new.amount + coalesce(new.fee, 0)
        else current_balance - new.amount - coalesce(new.fee, 0)
      end
      where id = new.wallet_id;
      if new.destination_wallet_id is not null then
        update wallets
        set current_balance = case
          when destination_type = 'credit_card' then current_balance - new.amount
          else current_balance + new.amount
        end
        where id = new.destination_wallet_id;
      end if;
    end if;

    return new;
  end if;

  select wallet_type into source_type
  from wallets where id = old.wallet_id for update;

  if old.destination_wallet_id is not null then
    select wallet_type into destination_type
    from wallets where id = old.destination_wallet_id for update;
  end if;

  if old.type = 'loan' and destination_type = 'credit_card' then
    update wallets
    set current_balance = current_balance + old.amount + coalesce(old.fee, 0)
    where id = old.wallet_id;
    update wallets
    set service_fee_balance = service_fee_balance + old.service_fee_amount,
        current_balance = current_balance + (old.amount - old.service_fee_amount)
    where id = old.destination_wallet_id;
  elsif old.type in ('expense', 'loan') then
    update wallets
    set current_balance = case
      when source_type = 'credit_card' then greatest(0, current_balance - old.amount - coalesce(old.fee, 0))
      else current_balance + old.amount + coalesce(old.fee, 0)
    end
    where id = old.wallet_id;
  elsif old.type = 'income' then
    update wallets
    set current_balance = case
      when source_type = 'credit_card' then current_balance + greatest(0, old.amount - coalesce(old.fee, 0))
      else current_balance - old.amount + coalesce(old.fee, 0)
    end
    where id = old.wallet_id;
  elsif old.type = 'transfer' then
    update wallets
    set current_balance = case
      when source_type = 'credit_card' then greatest(0, current_balance - old.amount - coalesce(old.fee, 0))
      else current_balance + old.amount + coalesce(old.fee, 0)
    end
    where id = old.wallet_id;
    if old.destination_wallet_id is not null then
      update wallets
      set current_balance = case
        when destination_type = 'credit_card' then current_balance + old.amount
        else current_balance - old.amount
      end
      where id = old.destination_wallet_id;
    end if;
  end if;

  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_update_wallet_balance on transactions;
create trigger trg_update_wallet_balance
before insert or delete on transactions
for each row execute function update_wallet_balances_on_transaction();
```

- [ ] **Step 4: Store the allocation and remove duplicate remote wallet writes**

Import `getCreditCardPaymentAllocation` in `HouseholdContext.tsx`. Before constructing `newTx`, calculate the stored allocation only for a loan payment with a credit-card destination:

```ts
const destinationWallet = data.destination_wallet_id
  ? wallets.find(wallet => wallet.id === data.destination_wallet_id)
  : undefined;
const serviceFeeAmount = data.type === 'loan' && destinationWallet?.wallet_type === 'credit_card'
  ? getCreditCardPaymentAllocation(destinationWallet, data.amount).serviceFeePaid
  : 0;

const newTx: Transaction = {
  // existing fields
  amount: data.amount,
  fee: feeAmount > 0 ? feeAmount : null,
  service_fee_amount: serviceFeeAmount,
  // remaining fields
};
```

Keep `setWallets(balanceResult.wallets)` for optimistic/local-only state. Remove `updateWalletBalanceInSupabase()` and both `changedWalletIds.forEach(...)` blocks from transaction creation and deletion. Supabase receives only the transaction insert/delete; the trigger updates remote wallet balances once.

Extend wallet CRUD so new cards explicitly store `service_fee_balance: 0`, and `updateWallet()` accepts `service_fee_balance?: number | null`. Normalize card edits with `Math.max(0, updates.service_fee_balance || 0)`.

- [ ] **Step 5: Rebuild the local database and run the SQL test**

Run:

```powershell
npx supabase db reset
npx supabase test db supabase/tests/credit_card_service_fees.test.sql
```

Expected: migrations complete and all 8 pgTAP assertions pass. This is local verification only.

- [ ] **Step 6: Run the accounting regression tests**

Run:

```powershell
npm test -- src/lib/creditCardTransactions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the migration and persistence contract**

```powershell
git add -- supabase/migrations/20261003090000_add_credit_card_service_fees.sql supabase/tests/credit_card_service_fees.test.sql src/context/HouseholdContext.tsx
git commit -m "Persist credit card service fee allocations"
```

---

### Task 3: Credit-Account Editing and Summary Cards

**Files:**
- Modify: `src/components/WalletsView.tsx:26-98, 140-214, 247-258, 420-458`

**Interfaces:**
- Consumes: `getCreditCardServiceFeeBalance()`, `getCreditCardTotalDue()`, and `getCreditCardAvailableCredit()`.
- Consumes: `updateWallet(id, { service_fee_balance })` from Task 2.
- Produces: the exact edit label `Service Fees (₱ PHP)` immediately after `Used Balance (₱ PHP)`.

- [ ] **Step 1: Add edit state, validation, and persistence**

Add state:

```ts
const [editServiceFees, setEditServiceFees] = useState('');
```

When opening the edit modal, load the normalized value:

```ts
setEditServiceFees(getCreditCardServiceFeeBalance(wallet).toString());
```

In `handleEditWalletSubmit`, reject a negative parsed value and persist it:

```ts
const parsedServiceFees = parseFloat(editServiceFees) || 0;
if (editType === 'credit_card' && parsedServiceFees < 0) {
  setErrorMsg('Service fees cannot be negative.');
  return;
}

const result = updateWallet(editingWallet.id, {
  name: editName.trim(),
  wallet_type: editType,
  current_balance: editType === 'credit_card' ? Math.abs(parseFloat(editBalance) || 0) : (parseFloat(editBalance) || 0),
  credit_limit: editType === 'credit_card' ? (parseFloat(editCreditLimit) || 0) : null,
  service_fee_balance: editType === 'credit_card' ? parsedServiceFees : 0,
  is_shared: editIsShared,
});
```

- [ ] **Step 2: Add the approved edit field**

Insert this block immediately after the Used Balance input:

```tsx
<div>
  <label className="block text-xs font-medium text-slate-300 mb-1">Service Fees (₱ PHP)</label>
  <input
    type="number"
    min="0"
    step="0.01"
    required
    value={editServiceFees}
    onChange={(event) => setEditServiceFees(event.target.value)}
    className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono font-bold text-amber-300"
  />
</div>
```

Keep creation unchanged except for the Task 2 default of zero service fees.

- [ ] **Step 3: Show all four approved card values**

Calculate:

```ts
const serviceFees = getCreditCardServiceFeeBalance(wallet);
const totalDue = getCreditCardTotalDue(wallet);
const availableCredit = getCreditCardAvailableCredit(wallet);
const utilPercent = isCreditCard && creditLimitValue > 0
  ? Math.min(Math.round((totalDue / creditLimitValue) * 100), 100)
  : 0;
```

Change the credit-card value grid to display Credit Limit, Used Balance, Service Fees, and Total Due. Keep Available Credit above the grid and make utilization use `totalDue`.

- [ ] **Step 4: Run static verification**

Run:

```powershell
npm run build
npx tsc --noEmit
```

Expected: both commands exit successfully. Build runs first because `.next/types` is generated by the build.

- [ ] **Step 5: Verify the wallet flow in Codex's embedded browser**

Run the local app, open it only in Codex's embedded browser, and verify:

- A legacy card shows service fees as `₱0.00`.
- The edit field appears immediately after Used Balance.
- Saving `1000` reloads as `1000` in local-only data.
- A card with limit `10000`, used `7000`, and fees `1000` shows total due `8000` and available credit `2000`.
- A negative service-fee value is blocked.

- [ ] **Step 6: Commit the account UI**

```powershell
git add -- src/components/WalletsView.tsx
git commit -m "Show service fees on credit accounts"
```

---

### Task 4: Credit-Payment Entry and Live Allocation

**Files:**
- Modify: `src/components/TransactionsView.tsx:12-100, 145-228, 707-970`

**Interfaces:**
- Consumes: `getCreditCardPaymentAllocation()` and `getCreditCardTotalDue()`.
- Consumes: `addTransaction()` persistence from Task 2.
- Preserves: `getRequiredCreditCardFunding()` and the locked Maya funding selector.
- Produces: a live payment allocation and total-cash-deduction summary.

- [ ] **Step 1: Calculate the live payment breakdown**

Add the new helper imports, then calculate beside the selected-wallet values:

```ts
const parsedPaymentAmount = parseFloat(amount) || 0;
const parsedTransactionFee = parseFloat(fee) || 0;
const cardPaymentAllocation = isCreditCardPayment && selectedDestinationWallet?.wallet_type === 'credit_card'
  ? getCreditCardPaymentAllocation(selectedDestinationWallet, parsedPaymentAmount)
  : null;
const cardTotalDue = selectedDestinationWallet?.wallet_type === 'credit_card'
  ? getCreditCardTotalDue(selectedDestinationWallet)
  : 0;
const totalCashDeducted = parsedPaymentAmount + parsedTransactionFee;
```

The existing schedule draft continues to set Amount. Because Task 5 changes schedule amount to total due, Pay Balance will default to the correct combined amount.

- [ ] **Step 2: Add explicit submit validation**

Before calling `addTransaction()`, add:

```ts
if (isCardLoanPayment && parsedAmount > cardTotalDue) {
  setErrorMsg('Credit card payment cannot exceed total due.');
  return;
}
```

Keep the context/helper validation as the second enforcement layer.

- [ ] **Step 3: Render the approved breakdown**

Below the Amount and Transaction Fee inputs, render this only for credit-card payments:

```tsx
{isCreditCardPayment && cardPaymentAllocation && (
  <div className="grid grid-cols-2 gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-[11px]">
    <div><span className="text-slate-400">Service Fees Paid</span><p className="font-mono font-bold text-amber-300">₱{cardPaymentAllocation.serviceFeePaid.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Used Balance Paid</span><p className="font-mono font-bold text-purple-300">₱{cardPaymentAllocation.usedBalancePaid.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Transaction Fee</span><p className="font-mono font-bold text-amber-300">₱{parsedTransactionFee.toFixed(2)}</p></div>
    <div><span className="text-slate-400">Total Cash Deducted</span><p className="font-mono font-bold text-rose-300">₱{totalCashDeducted.toFixed(2)}</p></div>
  </div>
)}
```

Change the destination help text to: `This payment clears service fees first, then reduces used balance.`

- [ ] **Step 4: Run focused and static verification**

Run:

```powershell
npm test -- src/lib/creditCardTransactions.test.ts
npm run build
npx tsc --noEmit
```

Expected: all commands pass.

- [ ] **Step 5: Verify payment behavior in Codex's embedded browser**

With used balance `7000`, service fees `1000`, payment `7500`, and transaction fee `50`, verify the preview shows:

- Service Fees Paid: `₱1000.00`.
- Used Balance Paid: `₱6500.00`.
- Transaction Fee: `₱50.00`.
- Total Cash Deducted: `₱7550.00`.
- An `8000.01` payment is rejected.
- Maya Credit and Maya Black still require Maya Wallet - Steve.

- [ ] **Step 6: Commit the payment UI**

```powershell
git add -- src/components/TransactionsView.tsx
git commit -m "Add credit payment allocation preview"
```

---

### Task 5: Automatic Total-Due Schedules

**Files:**
- Modify: `src/lib/creditCardPaymentSchedules.ts:1-55`
- Modify: `src/lib/creditCardPaymentSchedules.test.ts:1-90`
- Modify: `src/components/SchedulesView.tsx:220-255`
- Modify: `src/components/DashboardView.tsx:503-532`

**Interfaces:**
- Consumes: `getCreditCardTotalDue(wallet: Wallet): number`.
- Produces: synthetic schedule `amount` equal to live total due.
- Produces: Pay Balance drafts whose amount includes used balance and service fees.

- [ ] **Step 1: Add failing schedule tests**

Update the base card with `service_fee_balance: 1000` and change the expected amount to `8000`. Add:

```ts
it('keeps a schedule when only service fees remain', () => {
  const schedules = buildCreditCardPaymentSchedules([
    { ...baseWallet, current_balance: 0, service_fee_balance: 250 },
  ], new Date(2026, 8, 17));

  expect(schedules[0]?.amount).toBe(250);
});

it('omits a card only when used balance and service fees are both zero', () => {
  expect(buildCreditCardPaymentSchedules([
    { ...baseWallet, current_balance: 0, service_fee_balance: 0 },
  ], new Date(2026, 8, 17))).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
npm test -- src/lib/creditCardPaymentSchedules.test.ts
```

Expected: FAIL because schedules still use only used balance.

- [ ] **Step 3: Generate schedules from total due**

Replace the used-balance import and calculation:

```ts
import { getCreditCardTotalDue } from './creditCardTransactions';

const amount = getCreditCardTotalDue(wallet);
if (amount <= 0) return [];
```

- [ ] **Step 4: Update schedule and dashboard copy**

In `SchedulesView.tsx`, change `Full current used balance` to `Full current total due`. In `DashboardView.tsx`, change `Full used balances due on the next 5th or 20th.` to `Full card totals due on the next 5th or 20th.`

- [ ] **Step 5: Run schedule tests**

Run:

```powershell
npm test -- src/lib/creditCardPaymentSchedules.test.ts
```

Expected: PASS, including date and filter regressions.

- [ ] **Step 6: Commit automatic total-due schedules**

```powershell
git add -- src/lib/creditCardPaymentSchedules.ts src/lib/creditCardPaymentSchedules.test.ts src/components/SchedulesView.tsx src/components/DashboardView.tsx
git commit -m "Use total due for credit card schedules"
```

---

### Task 6: Ledger, CSV, and Full Verification

**Files:**
- Modify: `src/components/TransactionsView.tsx:379-465, 498-588`
- Modify: `src/lib/exportCsv.ts:1-40`
- Create: `src/lib/exportCsv.test.ts`

**Interfaces:**
- Consumes: `Transaction.service_fee_amount` from Task 1.
- Produces: `buildTransactionsCsv(...)` for deterministic CSV testing.
- Produces: desktop, mobile, and CSV service-fee allocation visibility.

- [ ] **Step 1: Write the failing CSV test**

Create `src/lib/exportCsv.test.ts` with a minimal transaction, wallet, category, and member fixture:

```ts
import { describe, expect, it } from 'vitest';
import { buildTransactionsCsv } from './exportCsv';
import { Category, HouseholdMember, Transaction, Wallet } from '../types/database';

describe('transaction CSV export', () => {
  it('includes the stored service-fee allocation', () => {
    const transaction = {
      id: 'tx-1', household_id: 'hh-1', wallet_id: 'bank-1', destination_wallet_id: 'card-1',
      category_id: null, payer_id: 'member-1', type: 'loan', amount: 7500, fee: 50,
      service_fee_amount: 1000, transaction_date: '2026-10-03', note: 'Card payment',
      receipt_url: null, created_at: '2026-10-03T00:00:00.000Z',
    } satisfies Transaction;
    const wallets = [
      { id: 'bank-1', household_id: 'hh-1', owner_id: 'member-1', name: 'Bank', wallet_type: 'bank', is_shared: true, current_balance: 50000, credit_limit: null, service_fee_balance: 0, created_at: '2026-10-03T00:00:00.000Z' },
      { id: 'card-1', household_id: 'hh-1', owner_id: 'member-1', name: 'Card', wallet_type: 'credit_card', is_shared: false, current_balance: 7000, credit_limit: 10000, service_fee_balance: 1000, created_at: '2026-10-03T00:00:00.000Z' },
    ] satisfies Wallet[];
    const categories: Category[] = [];
    const members = [{ id: 'member-1', household_id: 'hh-1', user_id: null, role: 'admin', display_name: 'Steve', created_at: '2026-10-03T00:00:00.000Z' }] satisfies HouseholdMember[];

    const csv = buildTransactionsCsv([transaction], wallets, categories, members);

    expect(csv.split('\n')[0]).toContain('Service Fee Amount (PHP)');
    expect(csv.split('\n')[1]).toContain(',1000.00,');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
npm test -- src/lib/exportCsv.test.ts
```

Expected: FAIL because `buildTransactionsCsv()` does not exist.

- [ ] **Step 3: Extract and extend the CSV builder**

In `src/lib/exportCsv.ts`, extract the current string construction into an exported pure function. Include the new column immediately after Amount:

```ts
export function buildTransactionsCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[],
  members: HouseholdMember[],
): string {
  const headers = [
    'Transaction ID', 'Date', 'Type', 'Payer', 'Source Account',
    'Destination Account', 'Category', 'Amount (PHP)',
    'Service Fee Amount (PHP)', 'Note', 'Receipt URL',
  ];

  const rows = transactions.map(transaction => {
    const payer = members.find(member => member.id === transaction.payer_id)?.display_name || transaction.payer_id;
    const source = wallets.find(wallet => wallet.id === transaction.wallet_id)?.name || transaction.wallet_id;
    const destination = transaction.destination_wallet_id
      ? wallets.find(wallet => wallet.id === transaction.destination_wallet_id)?.name || transaction.destination_wallet_id
      : '';
    const category = categories.find(item => item.id === transaction.category_id)?.name || '';

    return [
      `"${transaction.id}"`, `"${transaction.transaction_date}"`, `"${transaction.type.toUpperCase()}"`,
      `"${payer}"`, `"${source}"`, `"${destination}"`, `"${category}"`,
      transaction.amount.toFixed(2), (transaction.service_fee_amount || 0).toFixed(2),
      `"${(transaction.note || '').replace(/"/g, '""')}"`, `"${transaction.receipt_url || ''}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
```

Make `exportTransactionsToCsv()` pass `buildTransactionsCsv(...)` to `downloadBlob()`.

- [ ] **Step 4: Show the fee portion in both ledger layouts**

For each desktop and mobile transaction row, calculate:

```ts
const serviceFeeAmount = tx.service_fee_amount || 0;
```

For a loan transaction whose destination is a credit card and whose service-fee amount is positive, render `Service fees paid: ₱{serviceFeeAmount.toFixed(2)}` beside the existing amount/transaction-fee details. Legacy rows with zero or missing values render no extra label.

- [ ] **Step 5: Run focused and full automated verification**

Run in this order:

```powershell
npm test -- src/lib/exportCsv.test.ts src/lib/creditCardTransactions.test.ts src/lib/creditCardPaymentSchedules.test.ts
npm test
npm run build
npx tsc --noEmit
git diff --check
```

Expected: all Vitest files pass, the production build succeeds, TypeScript reports no errors after generated types exist, and Git reports no whitespace errors.

- [ ] **Step 6: Run the complete local browser acceptance check**

Use only Codex's embedded browser. Verify:

- Edit a card to used `7000` and fees `1000`.
- Wallet card shows fees `1000`, total due `8000`, and available credit based on total due.
- Schedule and dashboard show `8000`; Pay Balance opens with Amount `8000`.
- Change payment to `7500`; preview allocates `1000` to fees and `6500` to used balance.
- Save the payment; the card becomes used `500`, fees `0`, and the funding wallet decreases by payment plus transaction fee.
- Desktop and mobile ledgers show the stored `1000` service-fee portion.
- CSV contains `Service Fee Amount (PHP)` and `1000.00` for the payment.
- Delete the payment; used balance, fees, and funding balance return to their exact prior values.
- Refresh local state and confirm the fee balance persists.

- [ ] **Step 7: Commit reporting and verified integration**

```powershell
git add -- src/components/TransactionsView.tsx src/lib/exportCsv.ts src/lib/exportCsv.test.ts
git commit -m "Report credit card service fee payments"
```

- [ ] **Step 8: Stop at the production boundary**

Report the implementation commits, automated results, browser acceptance evidence, and any remaining risks. Do not run a live Supabase migration, push a deployment, or change production data until Steve explicitly approves those separate actions.
