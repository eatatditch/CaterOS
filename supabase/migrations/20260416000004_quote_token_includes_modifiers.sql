-- Extend get_quote_by_token to expose modifiers on each quote item so the
-- public accept view can render "Brunch Option: Big John Burger" etc.

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
    'currency', (select currency from q),
    'notes', (select notes from q),
    'terms_html', (select terms_html from q),
    'org', (select row_to_json(org) from org),
    'contact', (select row_to_json(contact) from contact),
    'items', coalesce((select arr from items), '[]'::jsonb)
  )
  where exists (select 1 from q);
$$;
