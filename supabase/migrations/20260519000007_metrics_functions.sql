-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M8 · Reporting functions
-- All functions live in the metrics schema. They run as the caller (no
-- security definer) so existing RLS continues to apply — a manager sees their
-- managers, a sales rep sees only their own slice, etc.
--
-- Every function takes (p_org, p_from, p_to, p_owner?, p_location?). The
-- owner/location filters are nullable: null means "don't filter."
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists metrics;
grant usage on schema metrics to authenticated, service_role;

-- ─── funnel_counts ────────────────────────────────────────────────────────
-- Returns one row per pipeline stage with the count of deals created in the
-- window, the count of deals that ever reached that stage in the window
-- (from transitions), and total $ at that stage.
create or replace function metrics.funnel_counts(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  stage_id       uuid,
  stage_name     text,
  position       int,
  is_won         boolean,
  is_lost        boolean,
  deals_created  bigint,
  deals_reached  bigint,
  pipeline_cents bigint
)
language sql stable as $$
  with active_pipeline as (
    select id, name, position, is_won, is_lost
    from stages s
    where pipeline_id in (
      select id from pipelines where org_id = p_org and is_default
    )
  ),
  created_in_window as (
    select d.stage_id, count(*) as c, coalesce(sum(d.amount_cents), 0) as amt
    from deals d
    where d.org_id = p_org
      and d.created_at >= p_from and d.created_at < p_to
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
    group by d.stage_id
  ),
  reached_in_window as (
    select t.to_stage_id as stage_id, count(distinct t.deal_id) as c
    from deal_stage_transitions t
    join deals d on d.id = t.deal_id
    where t.org_id = p_org
      and t.occurred_at >= p_from and t.occurred_at < p_to
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
    group by t.to_stage_id
  )
  select
    s.id, s.name, s.position, s.is_won, s.is_lost,
    coalesce(c.c, 0)   as deals_created,
    coalesce(r.c, 0)   as deals_reached,
    coalesce(c.amt, 0) as pipeline_cents
  from active_pipeline s
  left join created_in_window c on c.stage_id = s.id
  left join reached_in_window r on r.stage_id = s.id
  order by s.position;
$$;

-- ─── lost_reasons ─────────────────────────────────────────────────────────
create or replace function metrics.lost_reasons(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  lost_reason text,
  count       bigint,
  total_cents bigint
)
language sql stable as $$
  select
    coalesce(d.lost_reason, '(unspecified)') as lost_reason,
    count(*),
    coalesce(sum(d.amount_cents), 0)
  from deals d
  join stages s on s.id = d.stage_id
  where d.org_id = p_org
    and s.is_lost
    and d.closed_at is not null
    and d.closed_at >= p_from and d.closed_at < p_to
    and (p_owner is null or d.owner_id = p_owner)
    and (p_location is null or d.location_id = p_location)
  group by 1
  order by 2 desc, 3 desc;
$$;

-- ─── response_speed ───────────────────────────────────────────────────────
-- For inbound deals only — outbound deals don't have a meaningful response
-- SLA. Returns minutes-to-first-response stats and breach counts.
create or replace function metrics.response_speed(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  total_leads           bigint,
  responded             bigint,
  awaiting_response     bigint,
  avg_minutes           numeric,
  p50_minutes           numeric,
  p90_minutes           numeric,
  under_4h              bigint,
  between_4h_and_24h    bigint,
  over_24h              bigint
)
language sql stable as $$
  with base as (
    select d.id, d.created_at, d.first_response_at,
           case when d.first_response_at is not null
                then extract(epoch from (d.first_response_at - d.created_at)) / 60.0
           end as resp_min
    from deals d
    where d.org_id = p_org
      and d.created_at >= p_from and d.created_at < p_to
      and (d.source is null or d.source in ('inbound','referral','paid_ad'))
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
  )
  select
    count(*),
    count(*) filter (where resp_min is not null),
    count(*) filter (where resp_min is null),
    round(avg(resp_min)::numeric, 1),
    round((percentile_cont(0.5) within group (order by resp_min))::numeric, 1),
    round((percentile_cont(0.9) within group (order by resp_min))::numeric, 1),
    count(*) filter (where resp_min is not null and resp_min < 240),
    count(*) filter (where resp_min is not null and resp_min >= 240 and resp_min < 1440),
    count(*) filter (where resp_min is not null and resp_min >= 1440)
  from base;
$$;

-- ─── aging_buckets ────────────────────────────────────────────────────────
-- Open deals grouped by days since last activity.
create or replace function metrics.aging_buckets(
  p_org uuid,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  bucket      text,
  count       bigint,
  total_cents bigint
)
language sql stable as $$
  with base as (
    select d.id, d.amount_cents,
           extract(epoch from (now() - coalesce(d.last_activity_at, d.created_at))) / 86400.0 as days_since
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org
      and not (s.is_won or s.is_lost)
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
  )
  select bucket, count(*)::bigint, coalesce(sum(amount_cents), 0)::bigint
  from (
    select case
      when days_since < 7  then '0-7'
      when days_since < 14 then '8-14'
      when days_since < 30 then '15-30'
      else '30+'
    end as bucket, amount_cents
    from base
  ) b
  group by bucket
  order by case bucket when '0-7' then 0 when '8-14' then 1 when '15-30' then 2 else 3 end;
$$;

-- ─── revenue_summary ──────────────────────────────────────────────────────
-- Booked = deals in a won stage closed in window.
-- Delivered = events with status delivered/completed in window.
-- Pipeline = open deals weighted by stage.probability/100.
create or replace function metrics.revenue_summary(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  booked_cents          bigint,
  delivered_cents       bigint,
  pipeline_cents        bigint,
  weighted_pipeline_cents bigint,
  open_deal_count       bigint,
  won_deal_count        bigint
)
language sql stable as $$
  with booked as (
    select coalesce(sum(d.amount_cents), 0)::bigint as cents, count(*)::bigint as cnt
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and s.is_won
      and d.closed_at >= p_from and d.closed_at < p_to
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
  ),
  delivered as (
    select coalesce(sum(e.gross_revenue_cents), 0)::bigint as cents
    from events e
    where e.org_id = p_org
      and e.status in ('delivered','completed')
      and e.starts_at >= p_from and e.starts_at < p_to
      and (p_owner is null or e.owner_id = p_owner)
      and (p_location is null or e.location_id = p_location)
  ),
  pipeline as (
    select
      coalesce(sum(d.amount_cents), 0)::bigint                            as cents,
      coalesce(sum(d.amount_cents * s.probability / 100.0), 0)::bigint    as wcents,
      count(*)::bigint                                                    as cnt
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and not (s.is_won or s.is_lost)
      and (p_owner is null or d.owner_id = p_owner)
      and (p_location is null or d.location_id = p_location)
  )
  select booked.cents, delivered.cents, pipeline.cents, pipeline.wcents, pipeline.cnt, booked.cnt
    from booked, delivered, pipeline;
$$;

-- ─── revenue_by_dimension ─────────────────────────────────────────────────
-- Booked revenue grouped by source, location, or event_type. Pass exactly
-- one of those strings in p_dimension.
create or replace function metrics.revenue_by_dimension(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_dimension text,                -- 'source' | 'location' | 'event_type'
  p_owner uuid default null
)
returns table (
  bucket      text,
  count       bigint,
  total_cents bigint
)
language sql stable as $$
  with base as (
    select
      d.amount_cents,
      case p_dimension
        when 'source'     then coalesce(d.source::text, '(none)')
        when 'location'   then coalesce((select name from locations where id = d.location_id), '(unassigned)')
        when 'event_type' then coalesce(d.event_type::text, '(none)')
      end as bucket
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and s.is_won
      and d.closed_at >= p_from and d.closed_at < p_to
      and (p_owner is null or d.owner_id = p_owner)
  )
  select bucket, count(*), coalesce(sum(amount_cents), 0)
  from base
  group by bucket
  order by 3 desc;
$$;

-- ─── repeat_rate ──────────────────────────────────────────────────────────
-- Trailing 12 months: % of contacts with ≥2 delivered events, plus
-- new-vs-repeat client revenue split for the window.
create or replace function metrics.repeat_rate(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null,
  p_location uuid default null
)
returns table (
  repeat_clients        bigint,
  total_clients         bigint,
  repeat_pct            numeric,
  new_client_cents      bigint,
  repeat_client_cents   bigint
)
language sql stable as $$
  with trailing as (
    select e.contact_id, count(*) as n
    from events e
    where e.org_id = p_org
      and e.status in ('delivered','completed')
      and e.starts_at >= (p_to - interval '12 months') and e.starts_at < p_to
      and e.contact_id is not null
      and (p_location is null or e.location_id = p_location)
    group by e.contact_id
  ),
  in_window as (
    select e.contact_id, e.gross_revenue_cents
    from events e
    where e.org_id = p_org
      and e.status in ('delivered','completed')
      and e.starts_at >= p_from and e.starts_at < p_to
      and (p_owner is null or e.owner_id = p_owner)
      and (p_location is null or e.location_id = p_location)
  )
  select
    (select count(*) from trailing where n >= 2)::bigint,
    (select count(*) from trailing)::bigint,
    case when (select count(*) from trailing) = 0 then 0
         else round(100.0 * (select count(*) from trailing where n >= 2) / (select count(*) from trailing), 1)
    end,
    coalesce(sum(case when (select n from trailing t where t.contact_id = w.contact_id) < 2 then w.gross_revenue_cents else 0 end), 0)::bigint,
    coalesce(sum(case when (select n from trailing t where t.contact_id = w.contact_id) >= 2 then w.gross_revenue_cents else 0 end), 0)::bigint
  from in_window w;
$$;

-- ─── activity_counts ──────────────────────────────────────────────────────
create or replace function metrics.activity_counts(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_owner uuid default null
)
returns table (
  owner_id       uuid,
  outbound       bigint,
  tastings       bigint,
  site_visits    bigint,
  proposals_sent bigint,
  follow_ups     bigint,
  networking     bigint,
  total          bigint
)
language sql stable as $$
  select
    a.owner_id,
    count(*) filter (where a.type in ('call','email','sms')),
    count(*) filter (where a.type = 'tasting'),
    count(*) filter (where a.type = 'site_visit'),
    count(*) filter (where a.type = 'proposal_send'),
    count(*) filter (where a.type = 'follow_up'),
    count(*) filter (where a.type = 'networking'),
    count(*)
  from activities a
  where a.org_id = p_org
    and a.created_at >= p_from and a.created_at < p_to
    and (p_owner is null or a.owner_id = p_owner)
  group by a.owner_id;
$$;

-- ─── ad_performance ───────────────────────────────────────────────────────
-- Cost-per-lead, cost-per-booked, ROAS. Leads attributed by deal.source =
-- 'paid_ad' AND deal.source_detail matching the channel.
create or replace function metrics.ad_performance(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz,
  p_location uuid default null
)
returns table (
  channel              ad_channel,
  spend_cents          bigint,
  leads                bigint,
  booked_deals         bigint,
  booked_cents         bigint,
  cost_per_lead_cents  bigint,
  cost_per_booked_cents bigint,
  roas                 numeric
)
language sql stable as $$
  with spend as (
    select a.channel, coalesce(sum(a.spend_cents), 0)::bigint as cents
    from ad_spend a
    where a.org_id = p_org
      and a.period_start < p_to::date
      and a.period_end >= p_from::date
      and (p_location is null or a.location_id = p_location)
    group by a.channel
  ),
  leads as (
    select
      case
        when lower(coalesce(d.source_detail, '')) ~ 'meta|facebook|instagram' then 'meta'::ad_channel
        when lower(coalesce(d.source_detail, '')) ~ 'google|adwords' then 'google'::ad_channel
        else 'other'::ad_channel
      end as channel,
      d.id, d.amount_cents,
      exists (
        select 1 from stages s where s.id = d.stage_id and s.is_won
      ) as is_won
    from deals d
    where d.org_id = p_org
      and d.source = 'paid_ad'
      and d.created_at >= p_from and d.created_at < p_to
      and (p_location is null or d.location_id = p_location)
  ),
  agg as (
    select channel,
           count(*)                                  as lead_count,
           count(*) filter (where is_won)            as booked_count,
           coalesce(sum(case when is_won then amount_cents end), 0)::bigint as booked_cents
    from leads
    group by channel
  )
  select
    coalesce(s.channel, a.channel)             as channel,
    coalesce(s.cents, 0)                       as spend_cents,
    coalesce(a.lead_count, 0)                  as leads,
    coalesce(a.booked_count, 0)                as booked_deals,
    coalesce(a.booked_cents, 0)                as booked_cents,
    case when coalesce(a.lead_count, 0) = 0 then null
         else coalesce(s.cents, 0) / a.lead_count
    end                                        as cost_per_lead_cents,
    case when coalesce(a.booked_count, 0) = 0 then null
         else coalesce(s.cents, 0) / a.booked_count
    end                                        as cost_per_booked_cents,
    case when coalesce(s.cents, 0) = 0 then null
         else round(coalesce(a.booked_cents, 0)::numeric / s.cents, 2)
    end                                        as roas
  from spend s
  full outer join agg a on a.channel = s.channel;
$$;

-- ─── coverage_ratio ───────────────────────────────────────────────────────
-- Open pipeline ÷ remaining revenue goal for the current period containing
-- p_as_of. Returns ratio and the health band ("healthy" / "watch" / "at_risk").
create or replace function metrics.coverage_ratio(
  p_org uuid,
  p_as_of timestamptz,
  p_owner uuid default null,
  p_location uuid default null,
  p_period goal_period default 'monthly'
)
returns table (
  period_start    date,
  period_end      date,
  open_pipeline_cents  bigint,
  revenue_goal_cents   bigint,
  booked_cents         bigint,
  remaining_goal_cents bigint,
  ratio                numeric,
  band                 text
)
language sql stable as $$
  with bounds as (
    select case p_period
      when 'weekly'    then date_trunc('week',    p_as_of)::date
      when 'monthly'   then date_trunc('month',   p_as_of)::date
      when 'quarterly' then date_trunc('quarter', p_as_of)::date
    end as period_start_date
  ),
  period as (
    select b.period_start_date as start_d,
           case p_period
             when 'weekly'    then (b.period_start_date + interval '7 days')::date
             when 'monthly'   then (b.period_start_date + interval '1 month')::date
             when 'quarterly' then (b.period_start_date + interval '3 months')::date
           end as end_d
    from bounds b
  ),
  goal as (
    select coalesce(sum(g.revenue_goal_cents), 0)::bigint as cents
    from goals g, period p
    where g.org_id = p_org
      and g.period_type = p_period
      and g.period_start = p.start_d
      and (p_owner    is null or g.owner_id    = p_owner    or g.owner_id    is null)
      and (p_location is null or g.location_id = p_location or g.location_id is null)
  ),
  booked as (
    select coalesce(sum(d.amount_cents), 0)::bigint as cents
    from deals d
    join stages s on s.id = d.stage_id
    cross join period p
    where d.org_id = p_org and s.is_won
      and d.closed_at >= (p.start_d::timestamptz) and d.closed_at < (p.end_d::timestamptz)
      and (p_owner    is null or d.owner_id    = p_owner)
      and (p_location is null or d.location_id = p_location)
  ),
  pipeline as (
    select coalesce(sum(d.amount_cents), 0)::bigint as cents
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and not (s.is_won or s.is_lost)
      and (p_owner    is null or d.owner_id    = p_owner)
      and (p_location is null or d.location_id = p_location)
  )
  select
    p.start_d, p.end_d,
    pipeline.cents,
    goal.cents,
    booked.cents,
    greatest(goal.cents - booked.cents, 0),
    case when goal.cents - booked.cents <= 0 then null
         else round(pipeline.cents::numeric / nullif(goal.cents - booked.cents, 0), 2)
    end,
    case
      when goal.cents - booked.cents <= 0 then 'goal_hit'
      when pipeline.cents::numeric / nullif(goal.cents - booked.cents, 0) >= 3 then 'healthy'
      when pipeline.cents::numeric / nullif(goal.cents - booked.cents, 0) >= 2 then 'watch'
      else 'at_risk'
    end
  from period p, goal, booked, pipeline;
$$;

-- ─── manager_scorecard ────────────────────────────────────────────────────
-- One row per manager (or sales user) for the scoreboard table.
create or replace function metrics.manager_scorecard(
  p_org uuid,
  p_from timestamptz,
  p_to   timestamptz
)
returns table (
  owner_id              uuid,
  full_name             text,
  role                  member_role,
  booked_cents          bigint,
  pipeline_cents        bigint,
  open_deal_count       bigint,
  won_deal_count        bigint,
  lost_deal_count       bigint,
  lead_to_won_pct       numeric,
  avg_response_minutes  numeric,
  unanswered_leads      bigint
)
language sql stable as $$
  with people as (
    select m.user_id as id, p.full_name, m.role
    from memberships m
    join profiles p on p.id = m.user_id
    where m.org_id = p_org
      and m.role in ('owner','manager','sales')
  ),
  booked as (
    select d.owner_id,
           count(*) as cnt,
           coalesce(sum(d.amount_cents), 0)::bigint as cents
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and s.is_won
      and d.closed_at >= p_from and d.closed_at < p_to
    group by d.owner_id
  ),
  lost as (
    select d.owner_id, count(*) as cnt
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and s.is_lost
      and d.closed_at >= p_from and d.closed_at < p_to
    group by d.owner_id
  ),
  open_pipe as (
    select d.owner_id,
           count(*) as cnt,
           coalesce(sum(d.amount_cents), 0)::bigint as cents
    from deals d
    join stages s on s.id = d.stage_id
    where d.org_id = p_org and not (s.is_won or s.is_lost)
    group by d.owner_id
  ),
  created as (
    select d.owner_id, count(*) as cnt
    from deals d
    where d.org_id = p_org
      and d.created_at >= p_from and d.created_at < p_to
    group by d.owner_id
  ),
  response as (
    select d.owner_id,
           avg(extract(epoch from (d.first_response_at - d.created_at)) / 60.0)::numeric as avg_min,
           count(*) filter (where d.first_response_at is null
                            and d.created_at >= (now() - interval '14 days')) as unanswered
    from deals d
    where d.org_id = p_org
      and d.created_at >= p_from and d.created_at < p_to
      and (d.source is null or d.source in ('inbound','referral','paid_ad'))
    group by d.owner_id
  )
  select
    p.id, p.full_name, p.role,
    coalesce(b.cents, 0),
    coalesce(o.cents, 0),
    coalesce(o.cnt, 0),
    coalesce(b.cnt, 0),
    coalesce(l.cnt, 0),
    case when coalesce(c.cnt, 0) = 0 then null
         else round(100.0 * coalesce(b.cnt, 0) / c.cnt, 1)
    end,
    round(r.avg_min, 1),
    coalesce(r.unanswered, 0)
  from people p
  left join booked    b on b.owner_id = p.id
  left join lost      l on l.owner_id = p.id
  left join open_pipe o on o.owner_id = p.id
  left join created   c on c.owner_id = p.id
  left join response  r on r.owner_id = p.id
  order by coalesce(b.cents, 0) desc, p.full_name;
$$;

-- ─── unanswered_leads ─────────────────────────────────────────────────────
-- Open inbound deals whose first_response_at is still null. Used by the
-- scoreboard "SLA breach" widget and manager dashboard.
create or replace function metrics.unanswered_leads(
  p_org uuid,
  p_owner uuid default null
)
returns table (
  deal_id           uuid,
  title             text,
  owner_id          uuid,
  created_at        timestamptz,
  minutes_waiting   numeric,
  amount_cents      bigint,
  contact_name      text,
  contact_email     text,
  contact_phone     text
)
language sql stable as $$
  select
    d.id,
    d.title,
    d.owner_id,
    d.created_at,
    round(extract(epoch from (now() - d.created_at)) / 60.0, 0),
    d.amount_cents,
    nullif(trim(concat(c.first_name, ' ', c.last_name)), ''),
    c.email,
    c.phone
  from deals d
  join stages s on s.id = d.stage_id
  left join contacts c on c.id = d.contact_id
  where d.org_id = p_org
    and not (s.is_won or s.is_lost)
    and d.first_response_at is null
    and (d.source is null or d.source in ('inbound','referral','paid_ad'))
    and (p_owner is null or d.owner_id = p_owner)
  order by d.created_at asc;
$$;

-- ─── stale_leads ──────────────────────────────────────────────────────────
create or replace function metrics.stale_leads(
  p_org uuid,
  p_days int default 7,
  p_owner uuid default null
)
returns table (
  deal_id           uuid,
  title             text,
  owner_id          uuid,
  last_activity_at  timestamptz,
  days_stale        numeric,
  amount_cents      bigint,
  stage_name        text,
  contact_name      text
)
language sql stable as $$
  select
    d.id, d.title, d.owner_id,
    coalesce(d.last_activity_at, d.created_at),
    round(extract(epoch from (now() - coalesce(d.last_activity_at, d.created_at))) / 86400.0, 1),
    d.amount_cents,
    s.name,
    nullif(trim(concat(c.first_name, ' ', c.last_name)), '')
  from deals d
  join stages s on s.id = d.stage_id
  left join contacts c on c.id = d.contact_id
  where d.org_id = p_org
    and not (s.is_won or s.is_lost)
    and coalesce(d.last_activity_at, d.created_at) < (now() - make_interval(days => p_days))
    and (p_owner is null or d.owner_id = p_owner)
  order by d.amount_cents desc, d.last_activity_at asc;
$$;

-- ─── hot_leads ────────────────────────────────────────────────────────────
-- High value × stage probability, sorted desc. Used on /app/my-pipeline.
create or replace function metrics.hot_leads(
  p_org uuid,
  p_owner uuid default null,
  p_limit int default 10
)
returns table (
  deal_id            uuid,
  title              text,
  owner_id           uuid,
  amount_cents       bigint,
  stage_name         text,
  weighted_cents     bigint,
  last_activity_at   timestamptz,
  contact_name       text
)
language sql stable as $$
  select
    d.id, d.title, d.owner_id, d.amount_cents,
    s.name,
    (d.amount_cents * s.probability / 100)::bigint,
    d.last_activity_at,
    nullif(trim(concat(c.first_name, ' ', c.last_name)), '')
  from deals d
  join stages s on s.id = d.stage_id
  left join contacts c on c.id = d.contact_id
  where d.org_id = p_org
    and not (s.is_won or s.is_lost)
    and (p_owner is null or d.owner_id = p_owner)
  order by (d.amount_cents * s.probability / 100) desc nulls last,
           d.last_activity_at desc nulls last
  limit p_limit;
$$;

-- ─── prospect_queue ───────────────────────────────────────────────────────
create or replace function metrics.prospect_queue(
  p_org uuid,
  p_owner uuid default null
)
returns table (
  prospect_id      uuid,
  company_name     text,
  contact_name     text,
  owner_id         uuid,
  segment          prospect_segment,
  status           prospect_status,
  next_touch_at    timestamptz,
  days_until_touch numeric,
  last_touched_at  timestamptz
)
language sql stable as $$
  select
    p.id, p.company_name, p.contact_name, p.owner_id, p.segment, p.status,
    p.next_touch_at,
    case when p.next_touch_at is null then null
         else round(extract(epoch from (p.next_touch_at - now())) / 86400.0, 1)
    end,
    p.last_touched_at
  from prospects p
  where p.org_id = p_org
    and p.status in ('cold','warming')
    and (p_owner is null or p.owner_id = p_owner)
  order by p.next_touch_at asc nulls last, p.last_touched_at asc nulls last;
$$;

-- Grant execute on the metrics functions to authenticated users. RLS on the
-- underlying tables still gates what each user sees inside them.
grant execute on all functions in schema metrics to authenticated;

notify pgrst, 'reload schema';
