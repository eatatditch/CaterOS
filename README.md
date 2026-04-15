# CaterOS

> The all-in-one platform for catering businesses — CRM, menus, quoting, events, dispatch, and billing.

A combination of **Toast Catering** (menus, BEOs, ops) and **HubSpot CRM** (contacts, pipelines,
marketing automation), built cloud-native on Vercel + Supabase.

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 15 (App Router, RSC) on Vercel |
| UI | Tailwind + shadcn/ui primitives |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| ORM | Drizzle |
| Payments | Stripe |
| Email | Resend + React Email |
| SMS | Twilio |
| Jobs | Inngest (planned) |
| Observability | Sentry + PostHog |
| CI | GitHub Actions |

---

## Repo Layout

```
apps/
  web/                 # Next.js — marketing, app, customer portal
packages/
  db/                  # Drizzle schema + types
  ui/                  # Shared UI components (shadcn-style primitives)
  lib/                 # Shared utils (auth, money, slug)
supabase/
  migrations/          # SQL migrations (RLS-enforced)
  config.toml          # Local Supabase config
.github/workflows/     # CI + DB migrate
```

---

## Getting Started

### 1. Prereqs

- Node 20+
- pnpm 9
- Supabase CLI (`brew install supabase/tap/supabase`)
- A Supabase project (or run locally with `supabase start`)

### 2. Install

```bash
pnpm install
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL`.

### 3. Database

```bash
# local
pnpm supabase:start
pnpm supabase:reset    # applies migrations + seed
pnpm supabase:types    # regenerate TS types
```

For a hosted Supabase project:
```bash
supabase link --project-ref <ref>
supabase db push
```

### 4. Dev

```bash
pnpm dev
```

App runs at http://localhost:3000.

---

## Build Phases

- **Phase 0 — Foundation** ✅ (this commit) — monorepo, auth, RLS, orgs/users, CI
- **Phase 1 — CRM** — contacts, companies, deals, pipelines, activities
- **Phase 2 — Menus + Quoting** — menu catalog, quote builder, PDF, deposits
- **Phase 3 — Events + BEOs** — calendar, BEOs, capacity & conflict checks
- **Phase 4 — Ops** — kitchen sheets, dispatch, routing, driver PWA
- **Phase 5 — Billing** — Stripe invoices, payment schedules, accounting sync
- **Phase 6 — Marketing** — campaigns, sequences, segments
- **Phase 7 — Polish** — custom fields, public API, white-label

---

## Multi-tenancy

Every tenant table carries `org_id`. RLS policies use helper functions
`public.user_org_ids()` and `public.has_org_role(org, role)` so the app layer never
has to filter by org manually. New signups auto-provision an org, owner membership,
default kitchen location, and a default sales pipeline (Lead → Qualified → Proposal → Booked → Delivered → Lost).

## Money

All monetary values are stored as integer **cents** with a `currency` column.
Use `@cateros/lib/money` helpers (`toCents`, `formatMoney`, `computeQuoteTotals`) — never floats.

## Time

All timestamps are `timestamptz` (UTC). Display in the org/location's timezone.

---

## Deployment

- **Vercel** — connect this repo; `vercel.json` configures the build & install commands
- **Supabase** — migrations applied via `.github/workflows/db-migrate.yml` on push to `main`
- **Secrets** — set `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` in repo secrets
