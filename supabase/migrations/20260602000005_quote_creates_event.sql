-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · accept_quote() also provisions the Event
-- ════════════════════════════════════════════════════════════════════════════
-- When a client accepts a quote we already: flip quote → accepted, advance the
-- deal to Booked, create the deposit invoice, and log an activity. This extends
-- accept_quote() to also create the operational `events` row for the booking
-- (idempotent — one event per quote). Everything else is copied verbatim from
-- 20260602000001_flat_deposit.sql so the deposit/invoice/deal/activity logic is
-- preserved exactly.
--
-- The events table (see 20260415000003) has columns: org_id, contact_id,
-- quote_id, name (not null), status (event_status default 'tentative'),
-- headcount, starts_at (not null), ends_at (not null). There is no deal_id or
-- currency column on events, so those are not populated. start = quote.event_date;
-- we give a 2-hour default window for ends_at, falling back to now()+30d when the
-- quote has no event_date.

drop function if exists public.accept_quote(text);
create or replace function public.accept_quote(p_token text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_stage_id uuid;
  v_default_deposit bigint;
  v_deposit_cents bigint;
  v_invoice_id uuid;
  v_invoice_number text;
  v_invoice_token text;
  v_event_id uuid;
  v_event_start timestamptz;
begin
  select * into v_quote from quotes where public_token = p_token;
  if not found then raise exception 'quote_not_found'; end if;
  if v_quote.status = 'accepted' then
    select id, number, public_token, deposit_amount_cents
      into v_invoice_id, v_invoice_number, v_invoice_token, v_deposit_cents
      from invoices where quote_id = v_quote.id
      order by created_at desc limit 1;
    select id into v_event_id from events where quote_id = v_quote.id limit 1;
    return jsonb_build_object(
      'ok', true, 'already_accepted', true, 'number', v_quote.number,
      'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
      'invoice_token', v_invoice_token, 'deposit_cents', v_deposit_cents,
      'event_id', v_event_id
    );
  end if;
  if v_quote.status in ('declined', 'expired', 'converted') then
    raise exception 'quote_not_acceptable';
  end if;

  -- Flat default deposit (cents) from org settings; defaults to $500.
  select greatest(coalesce((settings->>'deposit_cents')::bigint, 50000), 0)
    into v_default_deposit from orgs where id = v_quote.org_id;

  -- Per-quote deposit wins when set; otherwise the flat org default.
  -- Always capped at the quote total so it can never exceed what's owed.
  if coalesce(v_quote.deposit_cents, 0) > 0 then
    v_deposit_cents := least(v_quote.deposit_cents, v_quote.total_cents);
  else
    v_deposit_cents := least(v_default_deposit, v_quote.total_cents);
  end if;

  update quotes set status = 'accepted', accepted_at = now() where id = v_quote.id;

  if v_quote.deal_id is not null then
    select s.id into v_stage_id
      from stages s
      join pipelines p on p.id = s.pipeline_id
      where p.org_id = v_quote.org_id and p.is_default and s.name = 'Booked'
      limit 1;
    update deals
      set stage_id = coalesce(v_stage_id, stage_id),
          amount_cents = v_quote.total_cents,
          currency = v_quote.currency,
          closed_at = case when v_stage_id is not null then now() else closed_at end
      where id = v_quote.deal_id;
  end if;

  v_invoice_number := public.next_invoice_number(v_quote.org_id);
  v_invoice_token := replace(gen_random_uuid()::text, '-', '') ||
                     replace(gen_random_uuid()::text, '-', '');

  insert into invoices (
    org_id, number, contact_id, quote_id,
    status, subtotal_cents, tax_cents, total_cents,
    deposit_amount_cents, amount_paid_cents,
    currency, issued_at, due_at, public_token, meta
  ) values (
    v_quote.org_id, v_invoice_number, v_quote.contact_id, v_quote.id,
    'open', v_quote.subtotal_cents, v_quote.tax_cents, v_quote.total_cents,
    v_deposit_cents, 0,
    v_quote.currency, now(),
    coalesce(v_quote.event_date, now() + interval '30 days'),
    v_invoice_token,
    jsonb_build_object('quote_number', v_quote.number, 'deposit_cents', v_deposit_cents)
  ) returning id into v_invoice_id;

  -- Provision the operational event for this booking (idempotent: one per quote).
  select id into v_event_id from events where quote_id = v_quote.id limit 1;
  if v_event_id is null then
    v_event_start := coalesce(v_quote.event_date, now() + interval '30 days');
    insert into events (
      org_id, contact_id, quote_id,
      name, status, headcount,
      starts_at, ends_at, meta
    ) values (
      v_quote.org_id, v_quote.contact_id, v_quote.id,
      'Event — ' || coalesce(v_quote.number, 'Quote'),
      'tentative', coalesce(v_quote.headcount, 0),
      v_event_start, v_event_start + interval '2 hours',
      jsonb_build_object('quote_number', v_quote.number, 'created_from', 'accept_quote')
    ) returning id into v_event_id;
  end if;

  insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
  values (v_quote.org_id, 'event_log', v_quote.contact_id, v_quote.deal_id,
          'Quote accepted', 'Client accepted quote ' || v_quote.number ||
            ' (invoice ' || v_invoice_number || ' created, deposit ' ||
            (v_deposit_cents / 100.0)::text || ')',
          jsonb_build_object(
            'quote_id', v_quote.id, 'quote_number', v_quote.number,
            'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
            'event_id', v_event_id,
            'deposit_cents', v_deposit_cents, 'total_cents', v_quote.total_cents));

  return jsonb_build_object(
    'ok', true, 'number', v_quote.number,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
    'invoice_token', v_invoice_token, 'deposit_cents', v_deposit_cents,
    'event_id', v_event_id
  );
end;
$$;

grant execute on function public.accept_quote(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
