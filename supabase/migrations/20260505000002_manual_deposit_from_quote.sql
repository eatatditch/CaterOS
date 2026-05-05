-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Manual deposit recorded from a quote
-- Wraps accept_quote() + record_manual_payment() so staff can take cash, a
-- check, or in-person card while still on the quote screen.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.record_manual_payment_for_quote(
  p_quote_id uuid,
  p_amount_cents bigint,
  p_method text,
  p_received_at timestamptz default now(),
  p_reference text default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote quotes%rowtype;
  v_invoice invoices%rowtype;
  v_user uuid := auth.uid();
  v_payment jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'quote_not_found';
  end if;

  if not public.has_org_role(v_quote.org_id, 'manager') then
    raise exception 'forbidden';
  end if;

  if v_quote.status in ('declined', 'expired') then
    raise exception 'quote_not_acceptable';
  end if;

  -- Auto-accept the quote if it hasn't been accepted yet — this creates the
  -- invoice with deposit_amount_cents based on org settings.
  if v_quote.status <> 'accepted' then
    if v_quote.public_token is null then
      raise exception 'quote_missing_public_token';
    end if;
    perform public.accept_quote(v_quote.public_token);
  end if;

  select * into v_invoice
    from invoices
    where quote_id = p_quote_id
    order by created_at desc
    limit 1;
  if not found then
    raise exception 'invoice_not_found';
  end if;

  v_payment := public.record_manual_payment(
    v_invoice.id,
    p_amount_cents,
    p_method,
    p_received_at,
    p_reference,
    p_note
  );

  return jsonb_build_object(
    'ok', true,
    'invoice_id', v_invoice.id,
    'invoice_number', v_invoice.number,
    'payment', v_payment
  );
end;
$$;

grant execute on function public.record_manual_payment_for_quote(
  uuid, bigint, text, timestamptz, text, text
) to authenticated;
