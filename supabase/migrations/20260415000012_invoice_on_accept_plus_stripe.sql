-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Invoice-on-accept + deposit flow (Stripe)
-- ════════════════════════════════════════════════════════════════════════════

alter table invoices
  add column if not exists quote_id uuid references quotes(id) on delete set null,
  add column if not exists deposit_amount_cents bigint not null default 0,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists stripe_checkout_session_id text unique,
  add column if not exists public_token text unique;

create index if not exists invoices_quote_idx on invoices(quote_id);
create index if not exists invoices_public_token_idx on invoices(public_token);

create or replace function public.next_invoice_number(p_org uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_prefix text;
  v_last text;
  v_num int;
begin
  v_prefix := 'I-' || v_year || '-';
  select number into v_last from invoices
    where org_id = p_org and number like v_prefix || '%'
    order by number desc limit 1;
  v_num := coalesce((substring(v_last from length(v_prefix) + 1))::int, 0) + 1;
  return v_prefix || lpad(v_num::text, 4, '0');
end;
$$;

drop function if exists public.accept_quote(text);
create or replace function public.accept_quote(p_token text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_stage_id uuid;
  v_deposit_rate numeric;
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

  select coalesce((settings->>'deposit_rate')::numeric, 0.25)
    into v_deposit_rate from orgs where id = v_quote.org_id;
  if v_deposit_rate < 0 then v_deposit_rate := 0;
  elsif v_deposit_rate > 1 then v_deposit_rate := 1;
  end if;
  v_deposit_cents := round(v_quote.total_cents * v_deposit_rate);

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
    jsonb_build_object('quote_number', v_quote.number, 'deposit_rate', v_deposit_rate)
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

create or replace function public.get_invoice_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = public
as $$
  with inv as (select * from invoices where public_token = p_token),
  o as (select name, currency from orgs where id = (select org_id from inv)),
  c as (select first_name, last_name, email from contacts where id = (select contact_id from inv)),
  q as (select number as quote_number, event_date from quotes where id = (select quote_id from inv))
  select jsonb_build_object(
    'id', (select id from inv),
    'number', (select number from inv),
    'status', (select status from inv),
    'total_cents', (select total_cents from inv),
    'amount_paid_cents', (select amount_paid_cents from inv),
    'deposit_amount_cents', (select deposit_amount_cents from inv),
    'deposit_paid_at', (select deposit_paid_at from inv),
    'currency', (select currency from inv),
    'due_at', (select due_at from inv),
    'org', (select row_to_json(o) from o),
    'contact', (select row_to_json(c) from c),
    'quote', (select row_to_json(q) from q)
  ) where exists (select 1 from inv);
$$;

grant execute on function public.get_invoice_by_token(text) to anon, authenticated, service_role;

create or replace function public.apply_invoice_payment(
  p_invoice_id uuid, p_amount_cents bigint, p_currency text,
  p_stripe_payment_intent_id text, p_method text default 'card'
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_inv invoices%rowtype;
  v_new_paid bigint;
  v_new_status invoice_status;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then raise exception 'invoice_not_found'; end if;

  if exists (select 1 from payments where stripe_payment_intent_id = p_stripe_payment_intent_id) then
    return jsonb_build_object('ok', true, 'already_recorded', true);
  end if;

  insert into payments (org_id, invoice_id, amount_cents, currency, status, method,
                        stripe_payment_intent_id, received_at)
  values (v_inv.org_id, v_inv.id, p_amount_cents, p_currency, 'succeeded', p_method,
          p_stripe_payment_intent_id, now());

  v_new_paid := v_inv.amount_paid_cents + p_amount_cents;
  if v_new_paid >= v_inv.total_cents then v_new_status := 'paid';
  elsif v_new_paid > 0 then v_new_status := 'partially_paid';
  else v_new_status := v_inv.status; end if;

  update invoices
    set amount_paid_cents = v_new_paid,
        status = v_new_status,
        deposit_paid_at = case
          when v_inv.deposit_paid_at is null and v_new_paid >= v_inv.deposit_amount_cents
          then now() else v_inv.deposit_paid_at end,
        paid_at = case when v_new_status = 'paid' then now() else null end
    where id = v_inv.id;

  return jsonb_build_object('ok', true, 'new_paid', v_new_paid, 'status', v_new_status);
end;
$$;

grant execute on function public.apply_invoice_payment(uuid, bigint, text, text, text)
  to service_role;
