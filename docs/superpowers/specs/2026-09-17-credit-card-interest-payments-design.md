# Credit Card Interest Payment Design

Date: 2026-09-17
Status: Superseded by `2026-10-03-credit-card-service-fees-design.md`

This earlier proposal treated payments above used balance as interest paid immediately. The approved replacement tracks outstanding service fees on each credit account and applies payments to those fees before reducing used balance.

## Objective

Allow a credit card or credit line payment to exceed the card's used balance. The amount that clears the used balance is principal. Any excess is interest paid. The card never gains a prepaid credit balance and its available credit never exceeds its configured credit limit.

## Accounting Rules

For a Loan-type credit card payment:

- `total payment` is the amount entered by the user.
- `principal paid` is `min(total payment, used balance before payment)`.
- `interest paid` is `max(total payment - principal paid, 0)`.
- `new used balance` is `max(used balance before payment - principal paid, 0)`.
- The non-credit funding account decreases by `total payment + transaction fee`.
- Transaction fees remain separate from interest.
- Available credit is `credit limit - new used balance`, capped at the credit limit.

Example:

- Used balance: `₱7,000`
- Payment: `₱8,000`
- Principal paid: `₱7,000`
- Interest paid: `₱1,000`
- New used balance: `₱0`
- Available credit: the full configured credit limit

If payment is less than or equal to the used balance, `interest paid` is zero.

## Data Model

Add `transactions.interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00` with constraints that it is non-negative and does not exceed `amount`.

Existing transactions backfill to zero through the default. No wallet column is added because excess payment is interest, not an account credit.

For a card payment transaction:

- `type` remains `loan`.
- `amount` stores the total payment.
- `interest_amount` stores the excess interest.
- Principal is derived as `amount - interest_amount`.
- `destination_wallet_id` identifies the card or credit line.

## Transaction and Reversal Flow

Creating a card payment:

1. Validate a non-credit funding account and a credit-card destination.
2. Read the destination card's used balance.
3. Derive principal and interest using the rules above.
4. Reduce the funding account by total payment plus the separate fee.
5. Reduce the card only by principal.
6. Save the Loan transaction with `interest_amount`.

Deleting the transaction:

1. Restore the funding account by total payment plus fee.
2. Restore the card used balance only by principal (`amount - interest_amount`).
3. Do not restore interest to the card balance.

This preserves correct reversal even when a payment exceeded the balance originally owed.

## Supabase Consistency

Create a new forward-only migration that:

- Adds and constrains `interest_amount`.
- Updates `update_wallet_balances_on_transaction()` so Loan transactions with a credit-card destination apply and reverse principal rather than total payment.
- Aligns trigger behavior with the app's positive-used-balance credit-card model.

The app currently performs optimistic wallet calculations and also persists wallet balances directly before inserting or deleting transactions. Implementation must prevent the transaction trigger from applying the same balance change a second time. Supabase-backed transaction posting will use one authoritative persistence path, while local-only mode will continue using the shared TypeScript balance helper.

The migration is backward compatible with the existing deployed app because old inserts omit `interest_amount` and receive zero. Apply the migration before deploying code that writes non-zero interest.

## User Interface

- Keep Credit Card / Credit Line Payment under the Loan transaction type.
- Prefill the current used balance, but allow a larger amount.
- Show a live breakdown: Principal, Interest, Transaction Fee, and Total Cash Outflow.
- When payment does not exceed used balance, show Interest as `₱0.00`.
- Continue requiring a non-credit funding account.
- Ledger desktop and mobile views show the principal and interest breakdown.
- CSV export includes an Interest Amount column.
- Scheduled payment amount remains the live used balance; users may increase it when recording payment.

## Validation and Errors

- Reject zero or negative payments.
- Reject a credit card as the funding account.
- Reject a non-credit destination.
- Reject negative interest or interest greater than total payment at the database boundary.
- If persistence fails, surface the existing synchronization warning and do not report the payment as successfully synchronized.

## Testing

Test-first coverage will include:

- Payment below used balance: zero interest and remaining used balance.
- Payment equal to used balance: zero interest and used balance zero.
- Payment above used balance: excess stored as interest and used balance zero.
- Transaction fee remains separate from interest.
- Deletion restores funding total and only the principal card balance.
- Legacy transactions without interest behave as zero-interest transactions.
- Credit-card funding remains rejected.
- Ledger and CSV formatting expose the interest breakdown.
- Full test suite, TypeScript check, production build, and local browser verification.

## Deployment Boundary

Implementation, migration file, and automated verification are in scope. Applying the migration to the live Supabase project and confirming the Vercel production deployment are separate production actions and require explicit approval and live verification.
