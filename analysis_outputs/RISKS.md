# Project Risks

## P0 - Authentication Can Fall Back To Local Access

- Evidence:
  - `app/login/page.tsx:22-24` writes the entered email to browser storage before Supabase auth succeeds.
  - `app/login/page.tsx:30-33` treats a Supabase rate-limit error as a successful "Direct Session".
  - `app/login/page.tsx:60-63` repeats that fallback in the catch path.
  - `src/components/AuthModal.tsx:49-51` writes the email locally before auth succeeds.
  - `src/components/AuthModal.tsx:94-111` binds a matching local member, or falls back to the Steve admin member, after auth errors.
- Impact:
  - A failed or rate-limited auth attempt can still place the app into a privileged local profile.
  - For real financial data, this breaks the expected trust boundary between authentication and household access.
- Recommended fix:
  - Only bind a local profile after a valid Supabase session is confirmed.
  - Remove "rate limit means signed in" paths.
  - Treat local/demo mode as an explicit separate mode with visible boundaries.

## P0 - Supabase Migration Chain Is Likely Not Replayable

- Evidence:
  - `supabase/migrations/001_schema.sql:22-30`, `39-48`, and `67-80` define UUID IDs and foreign keys.
  - `supabase/migrations/004_clean_slate.sql:14-19` inserts string IDs such as `hh-101` and `member-steve-admin` before the later string-ID migration.
  - `supabase/migrations/009_sync_all_app_fields.sql:4-44` later attempts to alter many primary and foreign key columns from UUID to `VARCHAR(100)`.
  - `supabase/migrations/008_activity_logs.sql:5` creates an activity log foreign key to `households(id)` while the household ID is still UUID.
- Impact:
  - A clean Supabase database may fail before reaching migration 009.
  - Existing foreign keys may block or complicate type changes.
  - Local app seed data and database constraints are not aligned.
- Recommended fix:
  - Rebuild migrations into a clean, ordered baseline.
  - Avoid destructive reset migrations in normal deployment history.
  - Rehearse `supabase db reset` or equivalent clean replay before deployment.

## P1 - App And Database Roles Do Not Match

- Evidence:
  - App role type includes `parent_member` in `src/types/database.ts:1`.
  - Migration 001 creates `household_role` with only `admin` and `member` in `supabase/migrations/001_schema.sql:16-18`.
  - RLS admin helper checks only `role = 'admin'` in `supabase/migrations/002_rls_and_triggers.sql:24-34`.
  - Client-side admin logic treats both `admin` and `parent_member` as admin in `src/context/HouseholdContext.tsx:469-470`.
- Impact:
  - A parent member can appear as admin in the UI but fail admin RLS checks in Supabase.
  - Inserts or updates using `parent_member` may fail if the enum remains active.
- Recommended fix:
  - Align app roles, database enum or text constraints, and RLS policy logic.

## P1 - Remote Writes Can Fail Silently

- Evidence:
  - Wallet balance sync catches and ignores errors in `src/context/HouseholdContext.tsx:155-159`.
  - Transaction inserts catch and ignore errors in `src/context/HouseholdContext.tsx:657-659`.
  - Restore uses multiple Supabase upserts with ignored failures in `src/context/HouseholdContext.tsx:406-436`.
- Impact:
  - Users can see local success while remote persistence failed.
  - Browser storage, UI state, and Supabase can drift without clear warning.
- Recommended fix:
  - Return remote write status for money-changing operations.
  - Show sync errors clearly.
  - Add retry or reconciliation behavior.

## P1 - Loan Payment Can Double-Record Wallet Outflow

- Evidence:
  - `src/components/TransactionsView.tsx:123-133` logs a transaction first.
  - `src/components/TransactionsView.tsx:141-144` then calls `payLoanAmortization`.
  - `src/context/HouseholdContext.tsx:992-1010` deducts the wallet again and logs another expense transaction inside `payLoanAmortization`.
- Impact:
  - Loan payments entered through the transaction modal may deduct the wallet twice and create duplicate transaction records.
- Recommended fix:
  - Make loan payment a single operation.
  - Either create the transaction inside `payLoanAmortization` only, or let the transaction flow call a loan updater that does not create another transaction.

## P1 - Database Balance Trigger And Client Balance Updates Can Conflict

- Evidence:
  - Client updates wallet balances before/around transaction insert in `src/context/HouseholdContext.tsx:608-635`.
  - The transaction trigger also updates wallet balances on insert/delete in `supabase/migrations/002_rls_and_triggers.sql:114-135`.
- Impact:
  - If both client balance updates and database triggers succeed, balances can be applied twice.
  - If one succeeds and the other fails, balances can drift.
- Recommended fix:
  - Choose one source of truth for balance mutation.
  - Prefer database-side ledger-derived balances or atomic RPC functions for financial operations.

## P1 - Activity Logs Lack RLS In The Inspected Migration

- Evidence:
  - `supabase/migrations/008_activity_logs.sql:3-12` creates `activity_logs`.
  - No `ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY` or policies were found.
  - The client reads and writes `activity_logs` directly in `src/context/HouseholdContext.tsx:283-287` and `353-367`.
- Impact:
  - Audit entries may be unavailable under strict grants, or too broadly available under permissive grants.
- Recommended fix:
  - Enable RLS and add household-scoped select/insert policies.

## P2 - README Setup Is Outdated

- Evidence:
  - README says to run only migrations 001 and 002 in `README.md:69-72`.
  - The repository contains migrations 001 through 011.
- Impact:
  - A new setup based on the README will not match current app features such as loans, recurring transfers, fees, email, activity logs, and string IDs.
- Recommended fix:
  - Update setup instructions after the migration chain is repaired.

## P2 - Lint Tooling Is Not Configured For Current Next

- Evidence:
  - `package.json:5-10` uses `next lint`.
  - `npm run lint` entered Next's deprecated lint setup prompt and exited without running a configured lint check.
- Impact:
  - CI or local quality checks can give a false sense of coverage.
- Recommended fix:
  - Migrate to ESLint CLI and commit the config.

## P2 - Personal Seed Data Is In Source

- Evidence:
  - `src/lib/supabase.ts:11-28` includes named household and email seed data.
  - `src/lib/supabase.ts:33-75` includes named personal wallet seed data.
- Impact:
  - Fine for a private demo, but risky if shared, published, or reused as a template.
- Recommended fix:
  - Move personal seed data into local-only fixtures or environment-scoped seed scripts.
