# Metrics reference

Definitions for every KPI rendered on `/app/scoreboard` and `/app/my-pipeline`.
All time windows use the org's timezone. Money fields are integer cents.

## Funnel

- **Total leads by source.** Count of deals created in the window grouped by
  `deals.source` enum (`inbound | outbound | referral | paid_ad | event | walkup`).
- **Stage conversion ratios.** Derived from `deal_stage_transitions`: of the
  deals that entered stage X in the window, what fraction entered the next
  stage. A trigger writes a transition row on every `deals.stage_id` change.
- **Lost reasons.** Grouped sum of `deals.lost_reason` for deals that closed
  in the window with a lost stage.

## Speed

- **Avg time to first response.** Minutes between `deals.created_at` and the
  first activity of type `call | email | meeting | sms`. Set automatically by
  a trigger on `activities` insert.
- **Response bands.** SLA target is 4h. The scoreboard splits responses into
  `<4h` (green), `4–24h` (yellow), `>24h` (red).
- **Avg sales cycle.** `closed_at - created_at` on won deals.
- **Aging buckets.** Days since `last_activity_at` (or `created_at` if no
  activity yet) grouped into `0-7 / 8-14 / 15-30 / 30+`.

## Revenue

- **Booked.** Sum of `deals.amount_cents` for deals closed in a won stage
  during the window.
- **Delivered.** Sum of `events.gross_revenue_cents` for events with status
  `delivered` or `completed` and `starts_at` in the window.
- **Pipeline value (face).** Sum of `deals.amount_cents` for open deals.
- **Pipeline value (weighted).** `amount_cents × stages.probability / 100`
  summed over open deals.
- **Avg deal size by event_type.** Mean of won-deal `amount_cents` grouped by
  `deals.event_type`.
- **Repeat booking rate.** % of contacts with ≥2 delivered events in the
  trailing 12 months at the window end.
- **New vs repeat revenue.** Delivered-event revenue split using the trailing
  12-month repeat threshold.

## Activity

- **Outbound contacts.** Activities of type `call`, `email`, or `sms` per
  manager per week.
- **Tastings booked.** Activities of type `tasting`.
- **Site visits.** Activities of type `site_visit`.
- **Touches per $1k of pipeline created.** Total activities in the window
  divided by (new pipeline created in window ÷ 1000).

## Paid ads

- **Cost per lead.** `sum(ad_spend.spend_cents) / count(deals where source='paid_ad')`
  for the window, attributed by channel via `deals.source_detail` matching
  `meta|facebook|instagram` or `google|adwords` (anything else lands in
  `other`).
- **Cost per booked event.** Same numerator over count of won deals.
- **Ad-attributed pipeline.** Sum of `amount_cents` on open deals with
  `source = 'paid_ad'`.
- **ROAS.** Booked revenue ÷ spend.

## Coverage

`coverage_ratio = open_pipeline_value / remaining_revenue_goal_in_period`.

| Ratio | Band     |
|-------|----------|
| ≥ 3x  | Healthy  |
| 2–3x  | Watch    |
| < 2x  | At risk  |
| 0 remaining | Goal hit |

The "remaining revenue goal" is the goal for the current period
(`weekly | monthly | quarterly`) minus revenue already booked in that period.

## How the data gets in

- **Inbound leads** → public web form → `capture_lead()` RPC → row in
  `deals` with `source='inbound'`.
- **Outbound prospects** → manually added in `/app/prospects`; convert to
  deal via the prospect detail page (sets `source='outbound'`).
- **Manager activity** → logged from `/app/deals/[id]` or
  `/app/prospects/[id]`. One-tap buttons handle call / email / meeting /
  tasting.
- **Cost data on events** → entered on the event detail page.
- **Ad spend** → entered manually at `/app/ad-spend`. The schema is
  designed so a future Meta/Google ingestion worker can insert the same
  shape with no UI changes.
- **Goals** → set by owner at `/app/goals`. Changes are written to
  `audit_logs` for traceability.
