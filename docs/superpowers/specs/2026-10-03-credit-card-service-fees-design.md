# Credit Card Service Fees Design

Date: 2026-10-03
Status: Approved in chat; awaiting written-spec review
Supersedes: `2026-09-17-credit-card-interest-payments-design.md`

## Objective

Track outstanding service fees separately from a credit card or credit line's used balance. Credit-payment amounts must include both balances, apply to service fees first, and preserve an exact allocation that can be reversed safely.

## Confirmed Accounting Rules

For each credit card or credit line:

- `used balance` is the principal amount charged to the account.
- `service fee balance` is the outstanding issuer-added service fees.
- `total due` is `used balance + service fee balance`.
- `available credit` is `max(credit limit - total due, 0)`.
- credit utilization uses total due and remains capped at 100% for display.

For a credit-payment transaction:

- Apply payment to service fees first.
- Apply the remaining payment to used balance.
- Reject a payment greater than total due.
- The card must never gain a prepaid credit balance.
- The funding wallet decreases by the payment plus any separate transaction fee.
- Transaction fees remain separate from issuer service fees.

Allocation formulas:

- `service fee paid = min(payment, service fee balance before payment)`.
- `remaining payment = payment - service fee paid`.
- `used balance paid = min(remaining payment, used balance before payment)`.
- `new service fee balance = service fee balance before payment - service fee paid`.
- `new used balance = used balance before payment - used balance paid`.

Example:

- Used balance before payment: `PHP 7,000`.
- Service fee balance before payment: `PHP 1,000`.
- Payment: `PHP 7,500`.
- Service fee paid: `PHP 1,000`.
- Used balance paid: `PHP 6,500`.
- New service fee balance: `PHP 0`.
- New used balance: `PHP 500`.

## Data Model

Add `wallets.service_fee_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00` with a non-negative constraint.

Add `transactions.service_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00` with constraints that it is non-negative and does not exceed `amount`.

For a credit-payment transaction:

- `type` remains `loan`.
- `amount` stores the full payment.
- `service_fee_amount` stores the portion applied to outstanding service fees.
- Used-balance principal paid is derived as `amount - service_fee_amount`.
- `destination_wallet_id` identifies the credit card or credit line.
- `fee` remains the separate payment-processing or transfer fee.

Existing wallets and transactions receive zero through the column defaults.

## Payment and Reversal Flow

Creating a credit payment:

1. Validate a non-credit funding account and a credit-card destination.
2. Read the destination account's used balance and service fee balance.
3. Reject zero, negative, or above-total-due payments.
4. Calculate the service-fee and used-balance portions.
5. Reduce the funding wallet by the payment plus the separate transaction fee.
6. Reduce the card's service fee balance first, then its used balance.
7. Save the Loan transaction with `service_fee_amount`.

Deleting the transaction:

1. Restore the funding wallet by the payment plus the separate transaction fee.
2. Restore the card's service fee balance by `service_fee_amount`.
3. Restore the card's used balance by `amount - service_fee_amount`.

This transaction allocation is the source of truth for reversal. It avoids relying on the card's current balances, which may have changed since the payment was recorded.

## Supabase Consistency

Create one forward-only migration that:

- Adds and constrains both new columns.
- Updates `update_wallet_balances_on_transaction()` so credit-payment inserts and deletes allocate and restore the two card balances correctly.
- Preserves the existing positive-used-balance credit-card model.

For Supabase-backed transaction creation and deletion, the database trigger is the authoritative remote balance writer. The client may update local React state optimistically through the shared TypeScript helper, but it must not also send separate wallet-balance updates that duplicate the trigger.

Local-only mode continues to use the same TypeScript balance helper without a database trigger.

Apply the migration before deploying application code that writes either new column.

## Automatic Credit-Payment Schedules

Credit-card schedules remain generated from live wallet data rather than stored as separate recurring-transfer records.

- Schedule amount is `used balance + service fee balance`.
- A schedule appears only when total due is greater than zero.
- Selecting `Pay Balance` prefills the combined total due.
- After a payment, the schedule recalculates automatically from the remaining balances.
- A partial payment therefore leaves the next schedule at the remaining total due.

## User Interface

Credit-account editing:

- Add `Service Fees (₱ PHP)` immediately after `Used Balance (₱ PHP)` in the credit-card edit form.
- Require a non-negative value.
- New credit accounts start with zero service fees.

Credit-account cards:

- Show Used Balance, Service Fees, Total Due, and Available Credit.
- Calculate displayed available credit and utilization from total due.

Credit-payment entry:

- Default Amount to total due.
- Show a live breakdown of Service Fees Paid, Used Balance Paid, Transaction Fee, and Total Cash Deducted.
- Keep the required non-credit funding-account rules, including the locked Maya funding-account behavior.

Schedules and reporting:

- Show total due on automatic credit-payment schedule cards.
- Show the service-fee portion in desktop and mobile ledger entries.
- Add a Service Fee Amount column to CSV exports.

## Validation and Error Handling

- Reject negative wallet service fees.
- Reject zero or negative credit payments.
- Reject credit payments greater than total due.
- Reject a credit card as the funding account.
- Reject a non-credit destination account.
- Enforce non-negative database values and `service_fee_amount <= amount`.
- Preserve the existing synchronization warning when Supabase persistence fails.

## Testing

Test-first coverage will include:

- Payment below the service fee balance.
- Payment exactly equal to the service fee balance.
- Payment that clears service fees and partially reduces used balance.
- Payment exactly equal to total due.
- Payment above total due is rejected.
- Transaction fee remains separate from service-fee allocation.
- Deleting a payment restores the exact service-fee and used-balance portions.
- Legacy wallets and transactions behave as zero-service-fee records.
- Automatic schedule amount equals total due and updates after payment.
- Edit-form persistence saves and reloads the service fee balance.
- Wallet-card, ledger, mobile, and CSV formatting expose the new values.
- Full test suite, TypeScript check, production build, and local browser verification.

## Deployment Boundary

Implementation, a reviewed migration file, and local automated verification are in scope after the written design and implementation plan are approved.

Applying the migration to live Supabase, deploying to Vercel, or changing production data are separate production actions. Each requires Steve's explicit approval and live verification.
