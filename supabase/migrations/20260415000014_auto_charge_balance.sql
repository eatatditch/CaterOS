-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Auto-charge balance due 24 hours before event
-- ════════════════════════════════════════════════════════════════════════════

alter table contacts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_default_payment_method_id text;

create index if not exists contacts_stripe_customer_idx on contacts(stripe_customer_id);

alter table invoices
  add column if not exists auto_charge_balance boolean not null default true,
  add column if not exists balance_charge_attempted_at timestamptz,
  add column if not exists balance_charge_failed_reason text;

update orgs set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('auto_charge_enabled', true)
  where not (settings ? 'auto_charge_enabled');

create or replace function public.list_invoices_due_balance_charge()
returns table (
  invoice_id uuid,
  org_id uuid,
  contact_id uuid,
  currency text,
  balance_cents bigint,
  stripe_customer_id text,
  stripe_payment_method_id text,
  event_date timestamptz,
  org_name text
)
language sql stable security definer set search_path = public
as $$
  select i.id, i.org_id, i.contact_id, i.currency,
         (i.total_cents - i.amount_paid_cents)::bigint as balance_cents,
         c.stripe_customer_id, c.stripe_default_payment_method_id,
         q.event_date,
         o.name as org_name
  from invoices i
  join quotes q on q.id = i.quote_id
  join contacts c on c.id = i.contact_id
  join orgs o on o.id = i.org_id
  where i.auto_charge_balance = true
    and i.status not in ('paid', 'void', 'refunded')
    and (i.total_cents - i.amount_paid_cents) > 0
    and i.balance_charge_attempted_at is null
    and q.event_date is not null
    and q.event_date > now()
    and q.event_date <= now() + interval '24 hours'
    and c.stripe_customer_id is not null
    and c.stripe_default_payment_method_id is not null
    and coalesce((o.settings->>'auto_charge_enabled')::boolean, true) = true;
$$;

grant execute on function public.list_invoices_due_balance_charge() to service_role;

create or replace function public.mark_balance_charge_attempted(
  p_invoice_id uuid, p_failed_reason text default null
) returns void language sql security definer set search_path = public
as $$
  update invoices
    set balance_charge_attempted_at = now(),
        balance_charge_failed_reason = p_failed_reason
    where id = p_invoice_id;
$$;

grant execute on function public.mark_balance_charge_attempted(uuid, text) to service_role;
