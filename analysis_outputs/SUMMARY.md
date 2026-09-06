# Project Analysis Summary

## Executive Summary

- Project: SMCLedger family financial tracker.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase.
- Current branch: `main`, tracking `origin/main`.
- Repository state before analysis: clean.
- TypeScript check: passed with `npx tsc --noEmit`.
- Production build: passed with `npm run build`.
- Lint script: not usable yet; `npm run lint` opens the deprecated Next lint setup prompt instead of running a configured linter.

## What The App Does

- Tracks household wallets, budgets, transactions, savings goals, loans, recurring transfers, members, and activity logs.
- Uses a single client-side household context as the main state and business-rule layer.
- Uses browser storage for local persistence.
- Uses Supabase as optional remote persistence when public Supabase environment variables are present.
- Includes auth screens for login, registration, forgot password, and reset password.

## Main Entry Points

- App shell: `app/layout.tsx`
- Main UI router by active tab: `app/page.tsx`
- Shared state and business rules: `src/context/HouseholdContext.tsx`
- Supabase client and initial seed data: `src/lib/supabase.ts`
- Shared data types: `src/types/database.ts`
- Auth pages: `app/login/page.tsx`, `app/register/page.tsx`, `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- Main feature views:
  - `src/components/DashboardView.tsx`
  - `src/components/WalletsView.tsx`
  - `src/components/TransactionsView.tsx`
  - `src/components/BudgetsView.tsx`
  - `src/components/LoansView.tsx`
  - `src/components/SavingsGoalsView.tsx`
  - `src/components/MembersView.tsx`
  - `src/components/ActivityLogView.tsx`

## Data And Persistence Model

- The app ships demo-like initial household data with string IDs such as `hh-101`, `member-steve-admin`, and `wallet-maya-e`.
- Local data is loaded from browser storage first.
- Remote Supabase data is loaded after local storage if the Supabase client exists.
- Remote write failures are mostly swallowed, so the UI can show successful local changes even when Supabase did not persist them.
- There is no server-side API layer. The browser talks directly to Supabase using the public client key.

## Supabase Schema Shape

- Early migrations define UUID primary and foreign keys.
- Later migrations attempt to move most IDs to `VARCHAR(100)` to match app-generated string IDs.
- The migration set contains destructive seed/reset behavior.
- RLS is defined for the original core tables and the phase 2 loan/recurring tables.
- Activity logs are created without RLS in the inspected migration file.

## Verification Run

- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm run lint`: failed as a tooling/configuration issue because `next lint` prompts for ESLint setup.
- No unit, integration, database migration, RLS, or browser workflow tests were found in the inspected project files.

## Best Next Actions

- Fix the authentication bypass paths before using this with real household data.
- Repair and rehearse the Supabase migration chain from a clean database.
- Choose one ID strategy: real Supabase auth UUIDs or app-owned string IDs, then align schema, seed data, RLS helpers, and TypeScript types.
- Move money-changing operations behind verified persistence or explicit sync status.
- Add a small regression suite for transaction balance math, loan payment behavior, migration replay, and auth/profile binding.
