-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Flat-dollar deposits (default $500) instead of a percentage rate
-- ════════════════════════════════════════════════════════════════════════════
-- The org-level default deposit moves from a percentage of the quote total
-- (settings.deposit_rate, a decimal) to a flat amount in cents
-- (settings.deposit_cents, default 50000 = $500). The per-quote override
-- (quotes.deposit_cents) is unchanged and still wins when set. The effective
-- deposit is always capped at the quote total so it can't exceed what's owed.
--
-- This redefines accept_quote() and get_quote_by_token() to read the flat
-- default, and seeds settings.deposit_cents for existing orgs.

-- ─── Seed the flat default for existing orgs ────────────────────────────────
update orgs
  set settings = coalesce(settings, '{}'::jsonb)
    || jsonb_build_object('deposit_cents', 50000)
  where not (settings ? 'deposit_cents');

-- ─── accept_quote: flat org default deposit, capped at the total ────────────
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
begin
  select * into v_quote from quotes where public_token = p_token;
  if not found then raise exception 'quote_not_found'; end if;
  if v_quote.status = 'accepted' then
    select id, number, public_token, deposit_amount_cents
      into v_invoice_id, v_invoice_number, v_invoice_token, v_deposit_cents
      from invoices where quote_id = v_quote.id
      order by created_at desc limit 1;
    return jsonb_build_object(
      'ok', true, 'already_accepted', true, 'number', v_quote.number,
      'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
      'invoice_token', v_invoice_token, 'deposit_cents', v_deposit_cents
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

  insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
  values (v_quote.org_id, 'event_log', v_quote.contact_id, v_quote.deal_id,
          'Quote accepted', 'Client accepted quote ' || v_quote.number ||
            ' (invoice ' || v_invoice_number || ' created, deposit ' ||
            (v_deposit_cents / 100.0)::text || ')',
          jsonb_build_object(
            'quote_id', v_quote.id, 'quote_number', v_quote.number,
            'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
            'deposit_cents', v_deposit_cents, 'total_cents', v_quote.total_cents));

  return jsonb_build_object(
    'ok', true, 'number', v_quote.number,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
    'invoice_token', v_invoice_token, 'deposit_cents', v_deposit_cents
  );
end;
$$;

grant execute on function public.accept_quote(text) to anon, authenticated, service_role;

-- ─── get_quote_by_token: expose the effective deposit (deposit_due_cents) ────
create or replace function public.get_quote_by_token(p_token text)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  with q as (select * from quotes where public_token = p_token),
  org as (select name, currency, timezone from orgs where id = (select org_id from q)),
  contact as (
    select first_name, last_name, email from contacts where id = (select contact_id from q)
  ),
  items as (
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'description', description,
      'quantity', quantity, 'unit_price_cents', unit_price_cents,
      'total_cents', total_cents, 'position', position,
      'modifiers', coalesce(modifiers, '[]'::jsonb)
    ) order by position) as arr
    from quote_items where quote_id = (select id from q)
  )
  select jsonb_build_object(
    'id', (select id from q),
    'number', (select number from q),
    'status', (select status from q),
    'headcount', (select headcount from q),
    'event_date', (select event_date from q),
    'subtotal_cents', (select subtotal_cents from q),
    'tax_cents', (select tax_cents from q),
    'service_fee_cents', (select service_fee_cents from q),
    'delivery_fee_cents', (select delivery_fee_cents from q),
    'gratuity_cents', (select gratuity_cents from q),
    'discount_cents', (select discount_cents from q),
    'total_cents', (select total_cents from q),
    'deposit_cents', (select deposit_cents from q),
    -- Mirror accept_quote(): per-quote deposit wins; otherwise the flat org
    -- default (settings.deposit_cents, $500 when unset). Capped at the total.
    'deposit_due_cents', (
      select case
        when coalesce(q.deposit_cents, 0) > 0 then least(q.deposit_cents, q.total_cents)
        else least(
          greatest(
            coalesce(
              (select (settings->>'deposit_cents')::bigint from orgs where id = q.org_id),
              50000
            ), 0
          ),
          q.total_cents
        )
      end
      from q
    ),
    'currency', (select currency from q),
    'notes', (select notes from q),
    'terms_html', (select terms_html from q),
    'org', (select row_to_json(org) from org),
    'contact', (select row_to_json(contact) from contact),
    'items', coalesce((select arr from items), '[]'::jsonb)
  )
  where exists (select 1 from q);
$$;

grant execute on function public.get_quote_by_token(text) to anon, authenticated, service_role;
