-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Manual payment entry (cash, check, in-person card, ACH, other)
-- Lets staff record off-Stripe payments against an invoice. Reuses the same
-- invoice-state update logic as apply_invoice_payment().
-- ════════════════════════════════════════════════════════════════════════════

-- Optional payment metadata columns. Stripe payments leave these null.
alter table payments
  add column if not exists reference text,
  add column if not exists note text,
  add column if not exists recorded_by uuid references auth.users(id) on delete set null;

create index if not exists payments_invoice_idx on payments(invoice_id, received_at desc);

create or replace function public.record_manual_payment(
  p_invoice_id uuid,
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
  v_inv invoices%rowtype;
  v_remaining bigint;
  v_new_paid bigint;
  v_new_status invoice_status;
  v_payment_id uuid;
  v_user uuid := auth.uid();
  v_method text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  v_method := lower(coalesce(p_method, ''));
  if v_method not in ('cash', 'check', 'card_in_person', 'ach', 'other') then
    raise exception 'invalid_method';
  end if;

  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'invoice_not_found';
  end if;

  -- Tenant + role gate: caller must be manager+ in the invoice's org.
  if not public.has_org_role(v_inv.org_id, 'manager') then
    raise exception 'forbidden';
  end if;

  if v_inv.status = 'void' or v_inv.status = 'refunded' then
    raise exception 'invoice_not_payable';
  end if;

  v_remaining := v_inv.total_cents - v_inv.amount_paid_cents;
  if p_amount_cents > v_remaining then
    raise exception 'amount_exceeds_balance';
  end if;

  insert into payments (
    org_id, invoice_id, amount_cents, currency, status, method,
    reference, note, recorded_by, received_at
  ) values (
    v_inv.org_id, v_inv.id, p_amount_cents, v_inv.currency, 'succeeded', v_method,
    nullif(trim(p_reference), ''), nullif(trim(p_note), ''), v_user,
    coalesce(p_received_at, now())
  ) returning id into v_payment_id;

  v_new_paid := v_inv.amount_paid_cents + p_amount_cents;
  if v_new_paid >= v_inv.total_cents then
    v_new_status := 'paid';
  elsif v_new_paid > 0 then
    v_new_status := 'partially_paid';
  else
    v_new_status := v_inv.status;
  end if;

  update invoices
    set amount_paid_cents = v_new_paid,
        status = v_new_status,
        deposit_paid_at = case
          when deposit_paid_at is null and v_new_paid >= deposit_amount_cents
          then now() else deposit_paid_at end,
        paid_at = case when v_new_status = 'paid' then now() else paid_at end,
        updated_at = now()
    where id = v_inv.id;

  insert into activities (org_id, type, contact_id, subject, body, meta)
  values (
    v_inv.org_id, 'event_log', v_inv.contact_id,
    'Manual payment recorded',
    'Recorded ' || (p_amount_cents / 100.0)::text || ' ' || v_inv.currency ||
      ' against invoice ' || v_inv.number ||
      ' via ' || v_method ||
      coalesce(' (ref ' || nullif(trim(p_reference), '') || ')', ''),
    jsonb_build_object(
      'invoice_id', v_inv.id,
      'invoice_number', v_inv.number,
      'payment_id', v_payment_id,
      'amount_cents', p_amount_cents,
      'method', v_method,
      'reference', nullif(trim(p_reference), ''),
      'recorded_by', v_user
    )
  );

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'new_paid', v_new_paid,
    'status', v_new_status
  );
end;
$$;

grant execute on function public.record_manual_payment(
  uuid, bigint, text, timestamptz, text, text
) to authenticated;
