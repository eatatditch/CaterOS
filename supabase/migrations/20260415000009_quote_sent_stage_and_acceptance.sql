-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Rename Proposal → Quote Sent, public quote acceptance
-- ════════════════════════════════════════════════════════════════════════════

update stages set name = 'Quote Sent' where name = 'Proposal';

create or replace function public.seed_default_pipeline()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default) values (new.id, 'Sales Pipeline', true) returning id into v_pipeline_id;
  insert into public.stages (pipeline_id, name, position, probability, is_won, is_lost) values
    (v_pipeline_id, 'Lead',       0, 15,  false, false),
    (v_pipeline_id, 'Quote Sent', 1, 50,  false, false),
    (v_pipeline_id, 'Booked',     2, 90,  false, false),
    (v_pipeline_id, 'Delivered',  3, 100, true,  false),
    (v_pipeline_id, 'Lost',       4, 0,   false, true);
  return new;
end;
$$;

create or replace function public.accept_quote(p_token text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_stage_id uuid;
begin
  select * into v_quote from quotes where public_token = p_token;
  if not found then raise exception 'quote_not_found'; end if;
  if v_quote.status = 'accepted' then
    return jsonb_build_object('ok', true, 'already_accepted', true, 'number', v_quote.number);
  end if;
  if v_quote.status in ('declined', 'expired', 'void') then
    raise exception 'quote_not_acceptable';
  end if;

  update quotes
    set status = 'accepted', accepted_at = now()
    where id = v_quote.id;

  if v_quote.deal_id is not null then
    select s.id into v_stage_id
      from stages s
      join pipelines p on p.id = s.pipeline_id
      where p.org_id = v_quote.org_id and p.is_default and s.name = 'Booked'
      limit 1;
    if v_stage_id is not null then
      update deals set stage_id = v_stage_id where id = v_quote.deal_id;
    end if;
  end if;

  insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
  values (v_quote.org_id, 'event_log', v_quote.contact_id, v_quote.deal_id,
          'Quote accepted', 'Client accepted quote ' || v_quote.number,
          jsonb_build_object('quote_id', v_quote.id, 'quote_number', v_quote.number));

  return jsonb_build_object('ok', true, 'number', v_quote.number);
end;
$$;

grant execute on function public.accept_quote(text) to anon, authenticated, service_role;

create or replace function public.mark_quote_viewed(p_token text)
returns void language sql security definer set search_path = public
as $$
  update quotes set status = 'viewed'
    where public_token = p_token and status = 'sent';
$$;

grant execute on function public.mark_quote_viewed(text) to anon, authenticated, service_role;

create or replace function public.get_quote_by_token(p_token text)
returns jsonb language sql stable security definer set search_path = public
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
      'total_cents', total_cents, 'position', position
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
