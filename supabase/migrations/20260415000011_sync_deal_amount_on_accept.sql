-- Sync deal.amount_cents from the linked quote total when a quote is accepted.
-- Keeps the pipeline kanban / per-stage totals / booked revenue stats accurate.

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
  if v_quote.status in ('declined', 'expired', 'converted') then
    raise exception 'quote_not_acceptable';
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

  insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
  values (v_quote.org_id, 'event_log', v_quote.contact_id, v_quote.deal_id,
          'Quote accepted', 'Client accepted quote ' || v_quote.number,
          jsonb_build_object('quote_id', v_quote.id, 'quote_number', v_quote.number,
                             'amount_cents', v_quote.total_cents));

  return jsonb_build_object('ok', true, 'number', v_quote.number);
end;
$$;

grant execute on function public.accept_quote(text) to anon, authenticated, service_role;

-- Backfill any already-linked accepted quotes
update deals d
set amount_cents = q.total_cents,
    currency = q.currency
from quotes q
where q.deal_id = d.id
  and q.status in ('accepted', 'converted')
  and d.amount_cents <> q.total_cents;
