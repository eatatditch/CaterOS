-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Void a recorded payment (e.g. a deposit entered in error / bounced)
-- ════════════════════════════════════════════════════════════════════════════
-- Reverses an off-Stripe payment from the invoice ledger and recomputes the
-- invoice's paid amount / status / deposit-paid flag. The payment row is kept
-- for the audit trail and marked voided. Stripe-captured payments are NOT
-- voidable here — real card charges must be refunded through Stripe so the
-- ledger never drifts from money actually moved.

alter table payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text;

create or replace function public.void_payment(
  p_payment_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay payments%rowtype;
  v_inv invoices%rowtype;
  v_user uuid := auth.uid();
  v_new_paid bigint;
  v_new_status invoice_status;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_pay from payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;

  -- Tenant + role gate: caller must be manager+ in the payment's org.
  if not public.has_org_role(v_pay.org_id, 'manager') then
    raise exception 'forbidden';
  end if;

  if v_pay.voided_at is not null then
    raise exception 'payment_already_voided';
  end if;
  if v_pay.status <> 'succeeded' then
    raise exception 'payment_not_voidable';
  end if;
  -- A real Stripe charge must be refunded via Stripe, not voided in the ledger.
  if v_pay.stripe_payment_intent_id is not null then
    raise exception 'stripe_payment_use_refund';
  end if;

  update payments
    set voided_at = now(),
        voided_by = v_user,
        void_reason = nullif(trim(p_reason), '')
    where id = v_pay.id;

  -- Reverse it from the invoice ledger (if attached to a live invoice).
  if v_pay.invoice_id is not null then
    select * into v_inv from invoices where id = v_pay.invoice_id for update;
    if found and v_inv.status not in ('void', 'refunded') then
      v_new_paid := greatest(v_inv.amount_paid_cents - v_pay.amount_cents, 0);
      if v_new_paid >= v_inv.total_cents then
        v_new_status := 'paid';
      elsif v_new_paid > 0 then
        v_new_status := 'partially_paid';
      else
        v_new_status := 'open';
      end if;

      update invoices
        set amount_paid_cents = v_new_paid,
            status = v_new_status,
            deposit_paid_at = case
              when v_new_paid < deposit_amount_cents then null else deposit_paid_at end,
            paid_at = case when v_new_status = 'paid' then paid_at else null end,
            updated_at = now()
        where id = v_inv.id;
    end if;
  end if;

  insert into activities (org_id, type, contact_id, subject, body, meta)
  values (
    v_pay.org_id, 'event_log', v_inv.contact_id,
    'Payment voided',
    'Voided ' || (v_pay.amount_cents / 100.0)::text || ' ' || v_pay.currency ||
      coalesce(' on invoice ' || v_inv.number, '') ||
      coalesce(' — ' || nullif(trim(p_reason), ''), ''),
    jsonb_build_object(
      'payment_id', v_pay.id,
      'invoice_id', v_pay.invoice_id,
      'amount_cents', v_pay.amount_cents,
      'voided_by', v_user,
      'reason', nullif(trim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay.id,
    'invoice_id', v_pay.invoice_id,
    'new_paid', coalesce(v_new_paid, 0),
    'status', v_new_status
  );
end;
$$;

grant execute on function public.void_payment(uuid, text) to authenticated;

notify pgrst, 'reload schema';
