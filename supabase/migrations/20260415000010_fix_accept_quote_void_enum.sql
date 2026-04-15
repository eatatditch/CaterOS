-- Fix: accept_quote referenced 'void' which isn't in the quote_status enum.
-- Valid enum values: draft, sent, viewed, accepted, declined, expired, converted.
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
