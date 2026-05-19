-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS seed — 3 months of realistic sample data
--
-- Idempotent: re-running on a clean db produces the same result; on a db
-- that already has the demo data, it no-ops (everything is keyed off slug
-- 'demo-ditch' and the seeded user emails).
--
-- This seed does NOT create auth.users entries — Supabase requires those via
-- the auth API. Instead, it wires demo data to whatever auth.users rows
-- happen to have the seeded emails. If you want fully populated dashboards
-- before signing anyone up, comment out the membership block at the top and
-- replace v_alex_id / v_owner_id with hard-coded uuids.
-- ════════════════════════════════════════════════════════════════════════════

do $seed$
declare
  v_org_id uuid;
  v_bay uuid;
  v_pj  uuid;
  v_owner_id uuid;
  v_alex_id  uuid;
  v_pipeline_id uuid;
  v_stage_lead uuid;
  v_stage_quote uuid;
  v_stage_followup uuid;
  v_stage_booked uuid;
  v_stage_lost uuid;
  v_contact_id uuid;
  v_deal_id uuid;
  v_event_id uuid;
  v_company_id uuid;
  v_now timestamptz := now();
  i int;
  src lead_source;
  evt event_type;
  amt bigint;
  ago interval;
begin
  -- ─── Org + locations ──────────────────────────────────────────────────────
  select id into v_org_id from orgs where slug = 'demo-ditch';
  if v_org_id is null then
    insert into orgs (name, slug, timezone, currency)
    values ('Ditch (demo)', 'demo-ditch', 'America/New_York', 'USD')
    returning id into v_org_id;
  end if;

  select id into v_bay from locations where org_id = v_org_id and name = 'Bay Shore';
  if v_bay is null then
    insert into locations (org_id, name, city, region, is_default)
    values (v_org_id, 'Bay Shore', 'Bay Shore', 'NY', true)
    returning id into v_bay;
  end if;

  select id into v_pj from locations where org_id = v_org_id and name = 'Port Jefferson';
  if v_pj is null then
    insert into locations (org_id, name, city, region)
    values (v_org_id, 'Port Jefferson', 'Port Jefferson', 'NY')
    returning id into v_pj;
  end if;

  -- Try to attach existing auth users by email. If none exist, skip — the
  -- rest of the seed will still produce data with null owners, which is fine.
  select id into v_owner_id from auth.users where email = 'owner@ditch.demo';
  select id into v_alex_id  from auth.users where email = 'alex@ditch.demo';

  if v_owner_id is not null then
    insert into memberships (org_id, user_id, role)
    values (v_org_id, v_owner_id, 'owner')
    on conflict do nothing;
    insert into profiles (id, full_name, first_name, last_name)
    values (v_owner_id, 'Demo Owner', 'Demo', 'Owner')
    on conflict (id) do update set full_name = excluded.full_name;
  end if;

  if v_alex_id is not null then
    insert into memberships (org_id, user_id, role)
    values (v_org_id, v_alex_id, 'sales')
    on conflict do nothing;
    insert into profiles (id, full_name, first_name, last_name)
    values (v_alex_id, 'Alex Manager', 'Alex', 'Manager')
    on conflict (id) do update set full_name = excluded.full_name;
  end if;

  -- ─── Default pipeline (auto-seeded by trigger; this is a safety net) ─────
  select id into v_pipeline_id from pipelines where org_id = v_org_id and is_default;
  if v_pipeline_id is null then
    insert into pipelines (org_id, name, is_default)
    values (v_org_id, 'Sales Pipeline', true)
    returning id into v_pipeline_id;
    insert into stages (pipeline_id, name, position, probability, is_won, is_lost) values
      (v_pipeline_id, 'Lead',       0, 15,  false, false),
      (v_pipeline_id, 'Quote Sent', 1, 50,  false, false),
      (v_pipeline_id, 'Follow up',  2, 60,  false, false),
      (v_pipeline_id, 'Booked',     3, 100, true,  false),
      (v_pipeline_id, 'Lost',       4, 0,   false, true);
  end if;

  select id into v_stage_lead     from stages where pipeline_id = v_pipeline_id and name = 'Lead';
  select id into v_stage_quote    from stages where pipeline_id = v_pipeline_id and name = 'Quote Sent';
  select id into v_stage_followup from stages where pipeline_id = v_pipeline_id and name = 'Follow up';
  select id into v_stage_booked   from stages where pipeline_id = v_pipeline_id and name = 'Booked';
  select id into v_stage_lost     from stages where pipeline_id = v_pipeline_id and name = 'Lost';

  -- ─── Idempotency guard ────────────────────────────────────────────────────
  -- If we've already seeded, bail.
  if exists (
    select 1 from deals where org_id = v_org_id
    and title like 'SEED:%'
  ) then
    raise notice 'Demo data already seeded for %, skipping.', v_org_id;
    return;
  end if;

  -- ─── 90 days of deals ────────────────────────────────────────────────────
  -- 60 deals spread across the last 90 days. ~25% won, ~15% lost, the rest in
  -- various open stages. Mixed sources, mixed event types, mixed locations.
  for i in 1..60 loop
    ago := make_interval(days => (90 - i)::int, hours => (i * 7 % 24)::int);

    src := (array['inbound','inbound','inbound','outbound','referral','paid_ad','event','walkup'])[1 + (i % 8)]::lead_source;
    evt := (array['corporate','wedding','social','holiday','other'])[1 + (i % 5)]::event_type;
    amt := (2500 + (i * 137) % 7500) * 100;

    insert into companies (org_id, name)
    values (v_org_id, 'SEED Company ' || i)
    returning id into v_company_id;

    insert into contacts (org_id, company_id, first_name, last_name, email, phone, lifecycle_stage, lead_source)
    values (
      v_org_id, v_company_id,
      (array['Avery','Jordan','Riley','Casey','Morgan','Quinn','Reese','Sage','Tatum','Drew'])[1 + (i % 10)],
      (array['Brooks','Reyes','Patel','Nguyen','Walker','Hill','Cohen','Singh','Murphy','Cruz'])[1 + ((i + 3) % 10)],
      'seed' || i || '@example.com',
      '555-01' || lpad((i % 100)::text, 2, '0'),
      'lead',
      src::text
    )
    returning id into v_contact_id;

    -- Stage assignment by index pattern
    insert into deals (
      org_id, pipeline_id, stage_id, contact_id, company_id, owner_id,
      title, amount_cents, source, source_detail, location_id, event_type,
      estimated_event_date, expected_close_date, created_at, updated_at
    ) values (
      v_org_id, v_pipeline_id,
      case (i % 10)
        when 0 then v_stage_booked
        when 1 then v_stage_booked
        when 2 then v_stage_booked
        when 3 then v_stage_lost
        when 4 then v_stage_quote
        when 5 then v_stage_followup
        when 6 then v_stage_lead
        when 7 then v_stage_quote
        when 8 then v_stage_followup
        else        v_stage_lead
      end,
      v_contact_id, v_company_id, coalesce(v_alex_id, v_owner_id),
      'SEED: ' || (case evt
        when 'corporate' then 'Corp lunch'
        when 'wedding'   then 'Wedding reception'
        when 'social'    then 'Birthday party'
        when 'holiday'   then 'Holiday party'
        else 'Catered event'
      end) || ' #' || i,
      amt, src,
      case src::text
        when 'paid_ad' then (case (i % 2) when 0 then 'Meta' else 'Google' end)
        when 'referral' then 'Word of mouth'
        when 'inbound' then 'web_form'
        else null
      end,
      case (i % 2) when 0 then v_bay else v_pj end,
      evt,
      v_now - ago + interval '30 days',
      v_now - ago + interval '30 days',
      v_now - ago,
      v_now - ago
    )
    returning id into v_deal_id;

    -- Activities: at least 1 per deal, more for booked deals.
    insert into activities (org_id, type, contact_id, deal_id, owner_id, subject, body, created_at)
    values (
      v_org_id, 'email', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id),
      'Initial outreach',
      'Replied to inbound inquiry with menu options.',
      v_now - ago + interval '2 hours'
    );

    if (i % 10) in (0, 1, 2) then
      -- Booked path: tasting + proposal + win
      insert into activities (org_id, type, contact_id, deal_id, owner_id, subject, created_at)
      values
        (v_org_id, 'tasting', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id), 'Tasting at kitchen', v_now - ago + interval '3 days'),
        (v_org_id, 'proposal_send', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id), 'Sent formal quote', v_now - ago + interval '4 days'),
        (v_org_id, 'call', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id), 'Closed by phone', v_now - ago + interval '6 days');

      -- Also create a delivered event so revenue metrics light up.
      insert into events (
        org_id, location_id, contact_id, owner_id, name, status, service_type,
        headcount, starts_at, ends_at, event_type,
        gross_revenue_cents, food_cost_cents, labor_cost_cents,
        created_at
      ) values (
        v_org_id, case (i % 2) when 0 then v_bay else v_pj end,
        v_contact_id, coalesce(v_alex_id, v_owner_id),
        'SEED Event ' || i, 'delivered', 'delivery',
        25 + (i % 50),
        v_now - ago + interval '14 days',
        v_now - ago + interval '14 days 4 hours',
        evt,
        amt,
        (amt * 0.32)::bigint,
        (amt * 0.18)::bigint,
        v_now - ago + interval '14 days'
      ) returning id into v_event_id;

    elsif (i % 10) = 3 then
      -- Lost path
      update deals set lost_reason = (array['Price too high','Lost to competitor','Date conflict','Ghosted'])[1 + (i % 4)]
        where id = v_deal_id;

    elsif (i % 10) in (4, 7) then
      -- Quote sent: tasting + proposal
      insert into activities (org_id, type, contact_id, deal_id, owner_id, subject, created_at)
      values (v_org_id, 'proposal_send', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id),
              'Sent quote', v_now - ago + interval '5 days');

    elsif (i % 10) in (5, 8) then
      -- Follow up
      insert into activities (org_id, type, contact_id, deal_id, owner_id, subject, created_at)
      values
        (v_org_id, 'proposal_send', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id), 'Quote sent', v_now - ago + interval '5 days'),
        (v_org_id, 'follow_up', v_contact_id, v_deal_id, coalesce(v_alex_id, v_owner_id), 'Follow-up call', v_now - ago + interval '12 days');
    end if;
  end loop;

  -- ─── Prospects (outbound queue) ──────────────────────────────────────────
  for i in 1..15 loop
    insert into prospects (
      org_id, owner_id, location_id, company_name, contact_name,
      contact_info, segment, status, next_touch_at, last_touched_at, notes
    ) values (
      v_org_id, coalesce(v_alex_id, v_owner_id),
      case (i % 2) when 0 then v_bay else v_pj end,
      'SEED Prospect ' || i,
      (array['Pat Lin','Jamie Wu','Sam Cohen','Rob Diaz','Ana Lee'])[1 + (i % 5)],
      jsonb_build_object('email', 'prospect' || i || '@example.com', 'phone', '555-02' || lpad(i::text, 2, '0')),
      (array['corporate_office','wedding_venue','event_planner','hospital','school','nonprofit','other'])[1 + (i % 7)]::prospect_segment,
      (array['cold','warming','cold','cold','warming'])[1 + (i % 5)]::prospect_status,
      v_now + make_interval(days => (i % 14)),
      case when i % 3 = 0 then v_now - make_interval(days => (i % 10)) else null end,
      'Targeted via outbound list ' || (i % 5 + 1)
    );
  end loop;

  -- ─── Ad spend (3 months) ─────────────────────────────────────────────────
  for i in 0..2 loop
    insert into ad_spend (org_id, channel, location_id, spend_cents, period_start, period_end, created_by)
    values
      (v_org_id, 'meta',   v_bay, 80000 + (i * 5000),  (v_now - make_interval(months => i + 1))::date, (v_now - make_interval(months => i))::date - interval '1 day', v_owner_id),
      (v_org_id, 'google', v_bay, 60000 + (i * 4000),  (v_now - make_interval(months => i + 1))::date, (v_now - make_interval(months => i))::date - interval '1 day', v_owner_id),
      (v_org_id, 'meta',   v_pj,  50000 + (i * 3000),  (v_now - make_interval(months => i + 1))::date, (v_now - make_interval(months => i))::date - interval '1 day', v_owner_id);
  end loop;

  -- ─── Goals (current month, weekly + monthly) ─────────────────────────────
  insert into goals (org_id, owner_id, location_id, period_type, period_start, revenue_goal_cents, activity_goals, created_by)
  values
    (v_org_id, coalesce(v_alex_id, v_owner_id), null, 'monthly',
     date_trunc('month', v_now)::date, 5000000,
     '{"outbound_contacts": 60, "tastings": 8, "prospects_contacted": 20}'::jsonb,
     v_owner_id),
    (v_org_id, coalesce(v_alex_id, v_owner_id), null, 'weekly',
     (date_trunc('week', v_now))::date, 1250000,
     '{"outbound_contacts": 15, "tastings": 2, "prospects_contacted": 5}'::jsonb,
     v_owner_id),
    (v_org_id, null, null, 'monthly',
     date_trunc('month', v_now)::date, 10000000,
     '{}'::jsonb,
     v_owner_id)
  on conflict do nothing;

  raise notice 'Seed complete for org %', v_org_id;
end$seed$;
