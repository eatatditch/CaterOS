# CaterOS — Project Notes for Claude

## Project
Catering CRM + Operations platform. Combines Toast Catering (menus, BEOs, ops) and HubSpot CRM (contacts, pipelines, marketing). Cloud-native: Vercel + Supabase.

## Stack
- **Web**: Next.js 15 (App Router, RSC), Tailwind, shadcn-style primitives
- **DB**: Supabase Postgres + RLS, Drizzle ORM
- **Auth**: Supabase Auth (email/password + magic link)
- **Monorepo**: Turborepo + pnpm workspaces
- **CI**: GitHub Actions

## Repo Layout
```
apps/web                 Next.js app (marketing + /app dashboard + /portal)
packages/db              Drizzle schema for Supabase Postgres
packages/ui              Shared UI primitives (Button, Card, Badge)
packages/lib             Shared utils (auth roles, money helpers, slugify)
supabase/migrations      SQL migrations — RLS-first
```

## Hard Rules
- **Multi-tenancy**: every tenant table has `org_id`; RLS policies use `public.user_org_ids()` and `public.has_org_role(org, role)`. Don't bypass RLS in app code.
- **Money**: integer cents only, paired with a `currency` column. Use `@cateros/lib/money`.
- **Time**: `timestamptz` (UTC) in DB; display in user/location timezone.
- **Roles**: owner > manager > sales > ops > driver > read_only. Use `hasRole`/`can` from `@cateros/lib/auth`.
- **Idempotency**: required on Stripe + webhook handlers.

## Branch
Develop on `claude/catering-crm-architecture-rfLLS`. Don't push to `main`.

## Build Phases
0. Foundation ✅ (current)
1. CRM (contacts, companies, deals, pipelines)
2. Menus + Quoting
3. Events + BEOs
4. Ops (dispatch, routing, driver PWA)
5. Billing (Stripe)
6. Marketing automation
7. Polish (custom fields, public API)

## Common Commands
```
pnpm dev                 # all apps
pnpm build               # all packages + apps
pnpm typecheck
pnpm lint
pnpm db:generate         # drizzle migrations from schema diff
pnpm supabase:start      # local supabase
pnpm supabase:reset      # nuke + reapply migrations + seed
pnpm supabase:types      # regenerate TS types
```
