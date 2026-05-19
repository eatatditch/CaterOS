# Metrics & Performance Tracking — Audit + Proposed Plan

> **Status:** awaiting owner approval before any migrations are written.
> **Branch:** `claude/setup-cateros-platform-uXpw8`.
> **Scope:** what already exists in CaterOS today, what the metrics spec asks for, and the deltas (extend vs. add).

---

## TL;DR

The CaterOS foundation is more complete than the spec assumes. Almost every "new" table the spec names already exists in some form:

- The spec's `leads` ≈ existing `deals` (with `contacts` for the person and `stages` for the funnel).
- The spec's `events` ≈ existing `events`.
- The spec's `activities` ≈ existing `activities` (already supports call/email/meeting/task/note/sms/event_log).

What is genuinely **new**:
1. `prospects` (outbound list — no existing table).
2. `ad_spend` (no existing table).
3. `goals` (no existing table).
4. Time-tracking columns on `deals` (`first_response_at`, `last_activity_at`, `lost_reason`, `event_type`, `estimated_event_date`, `location_id`).
5. Cost columns on `events` (`food_cost_cents`, `labor_cost_cents`, `gross_revenue_cents`, `parent_event_id`, `event_type`).
6. A `stage_transitions` table (or columns) so we can measure time-in-stage and conversions.
7. Owner-scoped RLS for the catering-manager role (today's RLS is org-scoped; the spec wants managers to see only their own deals/leads/activity).
8. Pages: `/scoreboard`, `/my-pipeline`, `/prospects`, `/goals`, `/ad-spend`. Lead detail already exists at `/app/deals/[id]`.
9. SQL views/functions for the funnel, speed, revenue, activity, paid-ads, and coverage metrics.
10. The `staff` role concept — for now this maps cleanly onto the existing `read_only` role plus a public form, no new role needed.

The biggest decision you need to make before I write anything: **how to reconcile the spec's 3-role model (owner / catering_manager / staff) with the existing 6-role model.** I recommend mapping rather than reinventing — details in §7.

---

## 1. Database schema — current state

Migrations live in `supabase/migrations/` (23 files, oldest → newest). Drizzle mirror in `packages/db/src/schema/`. Both are kept in sync by hand; the Drizzle schema is the typed read-model for app code, the SQL is the source of truth.

### 1.1 Identity, tenancy, RBAC — `20260415000001_init_orgs_and_auth.sql`

```sql
create type member_role as enum (
  'owner', 'manager', 'sales', 'ops', 'driver', 'read_only'
);
```

Tables:

| table | key columns | notes |
|---|---|---|
| `orgs` | `id`, `slug` unique, `timezone`, `currency`, `settings jsonb` | tenant root. `settings.role_permissions` holds per-role permission overrides. |
| `locations` | `org_id`, `name`, address, `is_default` | physical sites — Bay Shore / Port Jefferson / Kings Park will live here. |
| `profiles` | PK = `auth.users.id`, `full_name`, `first_name`, `last_name`, `phone` | 1:1 with `auth.users`. `first_name`/`last_name` added in `20260416000001_invite_profile_flow.sql`. |
| `memberships` | composite PK `(org_id, user_id)`, `role member_role` | one row per user × org. |
| `audit_logs` | `org_id`, `actor_id`, `action`, `entity`, `diff jsonb` | not currently written from app code; available for the goal-edit audit trail. |

RLS helpers (all `security definer`, `set search_path = public`):

```sql
public.user_org_ids()                       -- setof uuid the caller belongs to
public.is_org_member(target_org uuid)
public.user_role_in_org(target_org uuid)    -- returns the caller's role in that org
public.has_org_role(target_org, required)   -- rank-based >=, matches ROLE_RANK in @cateros/lib/auth
```

Trigger `on_auth_user_created` calls `handle_new_user()` which auto-provisions a profile, attaches pending invitations, and (if none) creates a new org with the user as `owner` and a "Main Kitchen" default location.

### 1.2 CRM core — `20260415000002_crm.sql`

```sql
create type lifecycle_stage as enum (
  'subscriber','lead','mql','sql','opportunity','customer','evangelist','other'
);
create type activity_type as enum (
  'note','call','email','meeting','task','sms','event_log'
);
```

| table | key columns | notes |
|---|---|---|
| `companies` | `org_id`, `name`, `domain`, `owner_id`, `custom_fields jsonb`, `tags text[]` | optional FK from contacts. |
| `contacts` | `org_id`, `company_id?`, `email citext`, `lifecycle_stage`, `lead_source`, `owner_id`, `lead_score`, `do_not_email/call`, `custom_fields`, `tags` | the person. |
| `pipelines` | `org_id`, `name`, `is_default` | one default seeded per org. |
| `stages` | `pipeline_id`, `name`, `position`, `probability 0–100`, `is_won`, `is_lost` | per-pipeline ordered list. |
| `deals` | `org_id`, `pipeline_id`, `stage_id`, `contact_id?`, `company_id?`, `owner_id?`, `title`, `amount_cents bigint`, `currency`, `expected_close_date`, `closed_at`, `source text`, `custom_fields`, `tags` | **this is what the spec calls a "lead".** |
| `activities` | `org_id`, `type activity_type`, `contact_id?`, `company_id?`, `deal_id?`, `owner_id?`, `subject`, `body`, `meta jsonb`, `due_at`, `completed_at`, `created_at` | already supports everything the spec lists except `prospect_id`. |

Trigger `seed_pipeline_after_org` runs `seed_default_pipeline()` on org insert. After the rename/refresh migrations, the **current default pipeline** is:

```
0 Lead         · 15% · open
1 Quote Sent   · 50% · open  (renamed from Proposal in 0009)
2 Follow up    · 60% · open  (added in 0013)
3 Booked       · 100% · WON  (was "Booked"; "Delivered" stage was dropped in 0013)
4 Lost         · 0% · LOST
```

So `is_won = true` lives on `Booked`; there's no separate "Delivered" stage anymore. `closed_at` on `deals` exists but I didn't find a trigger that sets it on stage change — worth confirming when we add the funnel views.

### 1.3 Ops layer — `20260415000003_menu_quotes_events_billing.sql`

| table | purpose | notes |
|---|---|---|
| `menus`, `menu_categories`, `menu_items`, `modifier_groups`, `modifiers` | menu builder | money in `*_cents`. |
| `quotes` | sellable proposal | `total_cents bigint`, `status quote_status`, `public_token` for client view, `deal_id?` link. |
| `quote_items` | line items | |
| `events` | the booked deliverable | `org_id`, `location_id?`, `contact_id?`, `quote_id?`, `owner_id?`, `status event_status`, `service_type`, `headcount`, `starts_at`, `ends_at`. **Has no cost/margin columns yet.** |
| `event_staff` | crew assigned to event | |
| `beos` | versioned BEO PDFs | |
| `invoices` | `event_id?`, `total_cents`, `amount_paid_cents`, `stripe_invoice_id` | |
| `payments` | `invoice_id?`, `stripe_payment_intent_id`, `status payment_status` | |

```sql
create type event_status as enum (
  'tentative','confirmed','in_prep','in_progress','delivered','completed','cancelled'
);
```

So "delivered" lives on `events.status`, not on the deals pipeline — that's a clean separation.

### 1.4 Lead capture + Gmail — `20260415000005_team_and_forms.sql`, `..0007_leads_and_gmail.sql`

- Public RPC `capture_lead(...)` (`security definer`, granted to `service_role`) creates contact + deal + (sometimes) a tentative event from the public web form. Auto-assigns owner via `pick_lead_owner(org_id)` which load-balances among `owner/manager/sales` members by open-deal count.
- `invitations` table + flow in `..0005`.
- `gmail_connections` (org-level OAuth) in `..0007`.

### 1.5 Marketing — `20260415000015_marketing_automation.sql`

`segments`, `segment_members`, `campaigns`, `campaign_sends`, sequences. Not directly relevant to metrics, but `ad_spend` will fit alongside.

### 1.6 Drizzle schema mirror — `packages/db/src/schema/`

`orgs.ts`, `crm.ts`, `events.ts`, `quotes.ts`, `menu.ts`, `billing.ts`. Faithful 1:1 of the SQL above. Will need additions for the new columns/tables we add.

---

## 2. RLS — current state

**Pattern:** every tenant table follows "tenant read for org members, write gated by role rank."

```sql
create policy "tenant read" on deals for select
  using (org_id in (select public.user_org_ids()));

create policy "sales write" on deals for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));
```

The same pair appears on `companies`, `contacts`, `pipelines`, `stages`, `deals`, `activities`, plus `menus`, `quotes`, `events`, `invoices` etc. with progressively higher role bars.

**Implication for this spec:** RLS today is org-scoped. A `sales`-rank member can read every other rep's deals/contacts/activities. The spec wants `catering_manager` to see only their own. We'll need a new pattern (see §7).

---

## 3. Auth & roles — current state

`packages/lib/src/auth.ts` defines:

- `MemberRole = owner | manager | sales | ops | driver | read_only` with `ROLE_RANK` (owner 100, manager 80, sales 60, ops 50, driver 30, read_only 10).
- 15 fine-grained `Permission`s (`contacts.manage`, `deals.manage`, `quotes.manage`, …, `reports.read`).
- `DEFAULT_ROLE_PERMISSIONS` per role. Per-org overrides live in `orgs.settings.role_permissions` (jsonb) and are surfaced through `/app/settings/roles`.
- `can(role, perm, overrides)` is the only authorization gate in app code. `resolveRolePermissions(role, overrides)` is the runtime resolver.

`apps/web/src/lib/auth/current.ts:27` — `getCurrent()` is a React `cache`d server function that reads the current Supabase session, finds the user's (first) membership, hydrates the org row + permission overrides, and returns `{ user, org, role, can }`. `requireCurrent()` redirects to `/login` if absent. `requirePermission(perm)` redirects back to `/app?denied=…` if the permission is missing.

There is **no** owner-scoping anywhere in app code yet — every query just hits the table and trusts RLS. We will keep that pattern; the new owner-scoping has to be enforced at the RLS layer, not by sprinkling `.eq('owner_id', user.id)` everywhere.

---

## 4. Existing metrics — current state

**None.** No SQL views, no materialized views, no metrics functions. The only "metric-ish" surface is the dashboard at `apps/web/src/app/app/page.tsx`, which counts new inquiries / open quotes / upcoming events / booked-MTD via direct table queries, and flags unanswered leads by looking for `activities.type in ('call','email','meeting','sms')` against deals in the `Lead` stage (`apps/web/src/app/app/page.tsx:88-99`).

So the funnel/speed/revenue/activity/paid-ads/coverage layer is fully greenfield. Good — we get to design it correctly the first time.

---

## 5. Routes — current state

Under `apps/web/src/app/app/`:

```
/app                    Dashboard (inquiries, open quotes, upcoming events, booked MTD)
/app/contacts           list / new / [id]
/app/companies          list / new / [id]
/app/deals              new / [id]  (no list — pipeline view covers it)
/app/pipeline           kanban board
/app/menus              list / [id]
/app/quotes             list / new / [id] / [id]/edit
/app/events             list / new / [id]
/app/dispatch           routing board
/app/invoices           list / [id]
/app/billing            payment-method + balance auto-charge config
/app/marketing          campaigns / segments / sequences / forms
/app/settings           org / team / locations / integrations / roles
```

Public:
```
/                       marketing/home
/quote/[token]          public quote view + accept + deposit
/embed/[slug]           embeddable lead form
/widget.js              JS snippet for embedding the form on third-party sites
/api/public/leads/[slug]
/api/public/form-meta/[slug]
```

So **none** of `/scoreboard`, `/my-pipeline`, `/prospects`, `/goals`, `/ad-spend` exist. Lead detail = `/app/deals/[id]` (already supports activity logging).

Layout `apps/web/src/app/app/layout.tsx:34-46` defines the sidebar `navConfig`. Adding entries there is the only thing needed to surface new top-level pages.

---

## 6. CRM-ish models — extend vs. create

| spec asks for | existing table | recommendation |
|---|---|---|
| `leads` | `deals` (+ `contacts` for the person, + `stages` for funnel) | **Extend `deals`.** Add `source`, `source_detail`, `location_id`, `event_type`, `estimated_event_date`, `first_response_at`, `last_activity_at`, `lost_reason`, `stage_weight` (or use `stages.probability/100`). Keep `amount_cents` as `estimated_value`. |
| `events` (deliverables, with cost/margin) | `events` | **Extend.** Add `event_type`, `gross_revenue_cents`, `food_cost_cents`, `labor_cost_cents`, generated `net_margin_cents`, `parent_event_id` for repeats. Keep existing `status` enum. |
| `activities` | `activities` | **Extend.** Add `prospect_id` FK. The existing `activity_type` enum already covers everything the spec lists except: `site_visit`, `tasting`, `proposal_send`, `follow_up`, `networking`. Add those as new enum values. |
| `prospects` (outbound) | — | **Create.** |
| `ad_spend` | — | **Create.** |
| `goals` | — | **Create.** |

There's also no `stage_transitions` table today. To compute "avg sales cycle" and "time in stage" properly we need one (or a `deals.stage_history jsonb` column — table is cleaner). **Recommendation: create `deal_stage_transitions`** with a trigger on `deals` that writes a row on `stage_id` change.

`closed_at` on deals — confirm/add a trigger to set it when entering `is_won` or `is_lost`.

---

## 7. The 3-role-vs-6-role decision (please decide before §8)

The existing system has six member roles. The spec describes three:

| spec role | what it should do | proposed mapping |
|---|---|---|
| `owner` | sees everything across all locations and managers | existing `owner` (and `manager`) |
| `catering_manager` | sees + edits only **their own** leads/deals/activity/prospects | existing `sales` role, **with owner-scoping added at RLS** |
| `staff` | submits inbound leads via a form, no pipeline access | existing `read_only` — and the form already runs as `service_role` via `capture_lead()`, so staff don't actually need a login for the inbound-leads use case at all |

I recommend **option A: map, don't replace.** Concretely:

1. Keep the 6-role enum. Do not add a `catering_manager` role.
2. Treat existing `sales` (and `ops` if desired) as "owner-scoped" roles via new RLS:
   - `select` on `deals` / `activities` / `prospects` / `events`: allowed if `has_org_role(org_id, 'manager')` **or** `owner_id = auth.uid()`.
   - Existing tenant-read policies on those tables get *replaced*, not added to. (Postgres OR-combines policies; if we leave the wide one, the narrow one is moot.)
3. The "staff submits leads" case is already covered by the public embed form. No login needed. If you still want a logged-in staff form, `read_only` + a new `/staff/new-lead` page that calls the `capture_lead` RPC is enough.

This keeps the existing `manager`/`ops`/`driver` semantics for the other Swell-Brands needs (BEOs, dispatch) without breaking anything, and gets owner-scoping just where you want it. The cost: two more policies per affected table.

**Open question for you:**

> Should `ops`-role users also be owner-scoped on deals/activities/prospects (they shouldn't see Alex's pipeline either), or do they get full org-read like today? My default would be: owner-scoped, same as sales.

---

## 8. Proposed migrations (still pending your approval — no SQL written yet)

I'd add them in this order. Each is small and self-contained.

### M1 — `deals` extensions for the metrics layer
```
alter table deals
  add column source              text,             -- inbound/outbound/referral/paid_ad/event/walkup
  add column source_detail       text,             -- "Meta", "Google", referrer name
  add column location_id         uuid references locations(id) on delete set null,
  add column event_type          event_type_enum,  -- corporate/wedding/social/holiday/other
  add column estimated_event_date timestamptz,     -- distinct from expected_close_date if you want
  add column first_response_at   timestamptz,
  add column last_activity_at    timestamptz,
  add column lost_reason         text;
create type event_type_enum as enum ('corporate','wedding','social','holiday','other');
```
Plus triggers that set `first_response_at` on first outbound activity and `last_activity_at` on every activity insert, and a trigger that sets `closed_at` when `stage_id` becomes `is_won` or `is_lost`.

`stage_weight` is already covered by `stages.probability` — I'll use that, no new column.

### M2 — `events` extensions
```
alter table events
  add column event_type          event_type_enum,
  add column gross_revenue_cents bigint not null default 0,
  add column food_cost_cents     bigint not null default 0,
  add column labor_cost_cents    bigint not null default 0,
  add column net_margin_cents    bigint generated always as
    (gross_revenue_cents - food_cost_cents - labor_cost_cents) stored,
  add column parent_event_id     uuid references events(id) on delete set null;
```

### M3 — `deal_stage_transitions`
```
create table deal_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  from_stage_id uuid references stages(id),
  to_stage_id   uuid not null references stages(id),
  actor_id      uuid references profiles(id),
  occurred_at   timestamptz not null default now()
);
-- trigger on deals: write a row when stage_id changes.
```

### M4 — `prospects`
```
create type prospect_segment as enum (
  'corporate_office','wedding_venue','event_planner','hospital','school','nonprofit','other'
);
create type prospect_status  as enum ('cold','warming','converted_to_lead','dead');
create table prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  owner_id uuid references profiles(id) on delete set null,
  location_id uuid references locations(id) on delete set null,
  company_name text not null,
  contact_name text,
  contact_info jsonb not null default '{}'::jsonb,
  segment prospect_segment not null default 'other',
  status  prospect_status  not null default 'cold',
  notes text,
  converted_deal_id uuid references deals(id) on delete set null,
  last_touched_at timestamptz,
  next_touch_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- + index (org_id, owner_id, next_touch_at), set_updated_at trigger
```
Also: `alter table activities add column prospect_id uuid references prospects(id) on delete cascade;`
And add `site_visit`, `tasting`, `proposal_send`, `follow_up`, `networking` to the `activity_type` enum.

### M5 — `ad_spend`
```
create type ad_channel as enum ('meta','google','other');
create table ad_spend (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  channel ad_channel not null,
  campaign_name text,
  spend_cents   bigint not null,
  currency      text not null default 'USD',
  period_start  date not null,
  period_end    date not null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
```

### M6 — `goals` + goal-edit audit
```
create type goal_period as enum ('weekly','monthly','quarterly');
create table goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,   -- null = cross-manager
  location_id uuid references locations(id) on delete cascade, -- null = cross-location
  period_type goal_period not null,
  period_start date not null,
  revenue_goal_cents bigint not null default 0,
  activity_goals     jsonb  not null default '{}'::jsonb,
                                          -- {outbound_contacts: n, tastings: n, prospects: n}
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, owner_id, location_id, period_type, period_start)
);
```
Audit changes via existing `audit_logs` table — write a row on each goal update.

### M7 — owner-scoped RLS for sales-role users
For each of `deals`, `activities`, `prospects`, `events`:
- Drop the wide `"tenant read"` policy.
- Add `"manager+ read all"` (`has_org_role(org_id, 'manager')`) and `"owner-scoped read"` (`owner_id = auth.uid() and org_id in (select user_org_ids())`).
- For writes, narrow `sales` policies the same way (`has_org_role(.., 'sales') and (has_org_role(.., 'manager') or owner_id = auth.uid())`).

### M8 — metrics views/functions

SQL views (`public.*`) for what the dashboards query. Drafted list — all parameterized via `(org_id, window_start, window_end, location_id?, owner_id?)` via Postgres functions returning `setof`/`jsonb`:

| name | output |
|---|---|
| `metrics.funnel_counts(...)` | leads/qualified/quote-sent/follow-up/booked/lost counts + conversion ratios |
| `metrics.lost_reasons(...)` | grouped `lost_reason` sums |
| `metrics.response_speed(...)` | avg, p50, p90 first-response minutes; counts in 0–4h / 4–24h / 24h+ buckets |
| `metrics.aging_buckets(...)` | 0-7 / 8-14 / 15-30 / 30+ counts of open deals by last_activity_at |
| `metrics.revenue_by(...)` | booked vs delivered vs pipeline, grouped by source/location/event_type |
| `metrics.repeat_rate(...)` | % contacts with ≥2 events trailing 12mo |
| `metrics.activity_counts(...)` | per-owner outbound contacts / tastings / site visits per week |
| `metrics.touches_per_pipeline_dollar(...)` | efficiency ratio |
| `metrics.ad_performance(...)` | CPL / CPE / ROAS by channel × location × period |
| `metrics.coverage_ratio(...)` | open pipeline ÷ remaining revenue goal |
| `metrics.unanswered_leads(...)` | list of deals with no outbound activity past SLA |
| `metrics.stale_leads(...)` | open deals with `last_activity_at` > 7d |

These get called from RSC pages; RLS still applies because they're not `security definer` unless they need to be.

---

## 9. App-side deliverables (after migrations land)

### Pages
- `/app/scoreboard` — owner only. Cards row + per-manager table + drill-down filters. Server components, all data via the metrics functions above.
- `/app/my-pipeline` — visible to anyone with `reports.read`. Renders the *caller's* slice (no UI choice needed; RLS handles it).
- `/app/prospects` — list + new prospect form + per-prospect activity log. Owner-scoped.
- `/app/goals` — owner only. Goal-setting UI + per-period grid. Edits write audit_logs rows.
- `/app/ad-spend` — owner only. Manual entry, period picker, channel breakdown. Designed so a future ingestion worker can insert the same rows.

### Sidebar (`apps/web/src/app/app/layout.tsx:34`)
Add two top-level entries above Settings:

```ts
{ href: '/app/scoreboard',  label: 'Scoreboard',  Icon: BarChart3, perm: 'reports.read' },
{ href: '/app/my-pipeline', label: 'My pipeline', Icon: Target,    perm: 'deals.manage' },
{ href: '/app/prospects',   label: 'Prospects',   Icon: Compass,   perm: 'deals.manage' },
```

`/goals` and `/ad-spend` live under `/app/settings/` (owner-only).

### Existing pages that get a light touch
- `/app/deals/[id]` — add the new fields (`source`, `source_detail`, `location_id`, `event_type`, `estimated_event_date`, `lost_reason`) to the deal edit form.
- `/app/events/[id]` — add cost-entry fields + repeat-of dropdown.
- `/app` (dashboard) — link the existing "unanswered leads" widget into `/app/scoreboard?filter=unanswered`.

### Generated types
After M1–M7 land: `pnpm supabase:types` → commit `packages/db/src/types/supabase.ts`. Drizzle schema files get updated by hand to match.

### Seed (`supabase/seed.sql`)
Currently a stub. New seed: 3 months of realistic deals, events, activities for Bay Shore + Port Jefferson with one seeded `catering_manager` (Alex). Designed to make the dashboards non-empty on first paint.

### README / onboarding doc
- README: add a "Metrics" section linking to a `docs/metrics.md` with one-paragraph definitions for each KPI (response-time, coverage, repeat rate, ROAS, etc.).
- `docs/manager-onboarding.md`: one-pager for Alex on **how to log activity** so the metrics don't lie (every call, every email, every site visit; what counts as a tasting; how to mark lost reasons; etc.).

---

## 10. Acceptance criteria mapping

| spec criterion | how it's met |
|---|---|
| Owner sees this-week's rev vs goal, coverage, unanswered leads, per-manager health in 10s | `/app/scoreboard` is a single RSC page — all queries parallelized in one `Promise.all`. |
| Alex sees hot leads / stale leads / unanswered / WTD progress in 10s | `/app/my-pipeline`, same pattern. |
| Activity logging ≤ 3 taps on mobile | extend the existing `new-activity-form.tsx` (already used on `/app/deals/[id]`) with a quick-action row of icons (call / email / meeting / tasting), default `created_at = now()`, single submit. |
| Adding a Kings Park hire is a config change, not a code change | invite the user → role `sales` → set goals at `/app/settings/goals` for their `owner_id`. No code edits. |

---

## 11. Things I want to confirm with you before writing migrations

1. **Owner-scoping for `ops` role too?** (See §7.) Default: yes.
2. **Source enum or free text?** Spec says `source (inbound | outbound | referral | paid_ad | event | walkup)`. Existing `deals.source` is `text`. Recommend converting to an enum `lead_source` and backfilling. OK?
3. **`event_type` enum values.** Spec has `corporate | wedding | social | holiday | other`. Add `tasting`? `funeral`/`memorial`? Otherwise locking to the five is fine.
4. **Stage weight.** Spec calls for `stage_weight (decimal)`. Existing `stages.probability` is `int 0-100`. I'd just divide by 100. OK?
5. **The "Qualified" stage** was removed in migration 0005 and the funnel today is `Lead → Quote Sent → Follow up → Booked → Lost`. The spec mentions a `tasting_booked` and a `qualified` status. Two options:
   - (a) Add a `Tasting Booked` stage between Lead and Quote Sent.
   - (b) Don't add a stage; track tasting bookings as an activity (`type = 'tasting'`, `due_at = scheduled time`) and surface "tasting-booked" count as a derived activity metric, not a pipeline column.
   I lean (b) — fewer stages, more accurate signal, and the pipeline stays readable on the kanban.
6. **Will catering managers ever need to *see* (read-only) someone else's deal** (covering during PTO, etc.)? If yes, owner-scoping needs an explicit override or temporary delegation. If no, simple owner-scoping is fine.
7. **Multi-location membership.** Today a profile has one `membership` row per org with one role. If Alex later runs both Bay Shore and Port Jefferson, do we want a `memberships.location_ids uuid[]` to scope her to a subset, or is "manager sees all locations in her org" fine?
8. **Repeat client detection.** Use `events.parent_event_id` (explicit), or derive from `contact_id` having 2+ delivered events in trailing 12mo? I'd add `parent_event_id` for manual confirmation but also derive when it's null — best of both.

Once you answer those (or just say "your defaults are fine"), I'll write M1–M8 as separate timestamped migrations, regenerate types, update the Drizzle schema, write the seed, build the pages, and put it all up on `claude/setup-cateros-platform-uXpw8`.
