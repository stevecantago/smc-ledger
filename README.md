# SMCLedger - Family Financial Tracker (MVP 1.0.0)

**SMCLedger** is a multi-tenant, role-aware household financial ledger designed for family budget tracking, multi-account liquid asset management, shared monthly envelope budgets, and sinking funds with clear member attribution.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL & Row-Level Security)**.

---

## 🚀 Key Features

- **Multi-Tenant Isolation**: Strict household data boundary separation enforced via database RLS.
- **Multi-Account Wallets**: Track Bank checking/savings, E-Wallets (Venmo/Apple Pay), and Cash accounts with shared vs private privacy flags.
- **Shared Envelope Budgets**: Set monthly category spending caps (Groceries, Utilities, Dining, Entertainment, Education) with real-time budget utilization meters.
- **Sinking Funds / Savings Goals**: Target savings progress tracking for family trips, emergency reserves, and major purchases with multi-member contribution support.
- **Role-Based Access Control (RBAC & RLS)**:
  - **Admin (Parent / Guardian)**: Full control over categories, budget caps, member invitations, shared wallet creation, and transaction management.
  - **Member (Dependent / Teen)**: Log income/expense/transfers, manage personal cash wallets, fund savings goals, and edit/delete own transactions logged within the last 24 hours.
- **Interactive Persona Switcher**: Test Admin vs Member capabilities instantly in demo mode.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend & Database**: Supabase, PostgreSQL DDL, Row-Level Security (RLS) policies, PL/pgSQL balance triggers
- **Deployment**: Vercel & GitHub Actions

---

## 📁 Repository Structure

```
.
├── app/                      # Next.js App Router (Layout, Home Page, Globals CSS)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── components/           # UI Components (Navbar, Dashboard, Wallets, Ledger, Budgets, Goals, Members)
│   ├── context/              # HouseholdContext & Persona Switcher state
│   ├── lib/                  # Supabase client & initial demo seed data
│   └── types/                # TypeScript database interfaces
├── supabase/
│   └── migrations/           # PostgreSQL DDL & RLS Security policies
│       ├── 001_schema.sql
│       └── 002_rls_and_triggers.sql
├── next.config.ts
├── tailwind.config.js
└── vercel.json
```

---

## 💻 Local Development Setup

1. **Clone Repository & Install Dependencies**:
   ```bash
   git clone https://github.com/stevecantago/smc-ledger.git
   cd smc-ledger
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Database Setup (Optional - Supabase)**:
   - Create a new project in your Supabase dashboard.
   - Run the SQL migrations in `supabase/migrations/001_schema.sql` and `supabase/migrations/002_rls_and_triggers.sql` inside the Supabase SQL Editor.
   - Set environment variables in `.env.local`:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     ```

---

## 📜 License

MIT License. Built for household financial management.
