'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { computeQuoteTotals, formatMoney } from '@cateros/lib/money';
import { createQuote } from '@/lib/actions/quotes';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
  unit: string;
};

type LineItem = {
  key: string;
  menu_item_id?: string | null;
  name: string;
  description?: string;
  quantity: number;
  unit_price_cents: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function QuoteBuilder({
  currency,
  contacts,
  menuItems,
}: {
  currency: string;
  contacts: { id: string; label: string }[];
  menuItems: MenuItem[];
}) {
  const [contactId, setContactId] = useState('');
  const [headcount, setHeadcount] = useState(0);
  const [eventDate, setEventDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(0.0875);
  const [serviceFeeRate, setServiceFeeRate] = useState(0.18);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [gratuityRate, setGratuityRate] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price_cents, 0);
    return computeQuoteTotals({
      subtotalCents: subtotal,
      taxRate,
      serviceFeeRate,
      deliveryFeeCents: Math.round(deliveryFee * 100),
      gratuityRate,
      discountCents: Math.round(discount * 100),
    });
  }, [items, taxRate, serviceFeeRate, deliveryFee, gratuityRate, discount]);

  function addItemFromMenu(id: string) {
    const mi = menuItems.find((m) => m.id === id);
    if (!mi) return;
    setItems((prev) => [
      ...prev,
      {
        key: uid(),
        menu_item_id: mi.id,
        name: mi.name,
        description: mi.description ?? '',
        quantity: headcount || 1,
        unit_price_cents: mi.unit_price_cents,
      },
    ]);
  }

  function addBlank() {
    setItems((prev) => [
      ...prev,
      { key: uid(), name: '', description: '', quantity: 1, unit_price_cents: 0 },
    ]);
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function onSubmit() {
    setError(null);
    if (!items.length) {
      setError('Add at least one line item.');
      return;
    }
    startTransition(async () => {
      const res = await createQuote({
        contact_id: contactId || null,
        headcount,
        event_date: eventDate || null,
        notes: notes || null,
        tax_rate: taxRate,
        service_fee_rate: serviceFeeRate,
        delivery_fee_cents: Math.round(deliveryFee * 100),
        gratuity_rate: gratuityRate,
        discount_cents: Math.round(discount * 100),
        items: items.map((it) => ({
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          unit_price_cents: it.unit_price_cents,
          menu_item_id: it.menu_item_id ?? null,
        })),
      });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Event info</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contact" htmlFor="contact_id">
              <select
                id="contact_id"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={selectCls}
              >
                <option value="">— Select —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Event date" htmlFor="event_date">
              <input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Head count" htmlFor="headcount">
              <input
                id="headcount"
                type="number"
                min="0"
                value={headcount}
                onChange={(e) => setHeadcount(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" className="mt-4">
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={textareaCls}
            />
          </Field>
        </section>

        <section className="rounded-lg border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Line items</h2>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addItemFromMenu(e.target.value);
                    e.currentTarget.value = '';
                  }
                }}
                className={`${selectCls} h-9`}
                defaultValue=""
              >
                <option value="" disabled>
                  + Add from menu
                </option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {formatMoney(m.unit_price_cents, currency)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addBlank} className={buttonOutlineCls}>
                <Plus className="h-4 w-4" /> Custom
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items yet. Add from your menu or a custom line.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.key}
                  className="grid items-start gap-2 rounded-md border p-3 md:grid-cols-[1fr_90px_120px_100px_40px]"
                >
                  <div>
                    <input
                      value={it.name}
                      onChange={(e) => updateItem(it.key, { name: e.target.value })}
                      placeholder="Item name"
                      className={`${inputCls} h-9`}
                    />
                    <input
                      value={it.description ?? ''}
                      onChange={(e) => updateItem(it.key, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className={`${inputCls} mt-2 h-8 text-xs`}
                    />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.key, { quantity: Number(e.target.value) || 1 })
                    }
                    className={`${inputCls} h-9`}
                    aria-label="Quantity"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={(it.unit_price_cents / 100).toFixed(2)}
                    onChange={(e) =>
                      updateItem(it.key, {
                        unit_price_cents: Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className={`${inputCls} h-9`}
                    aria-label="Unit price"
                  />
                  <div className="px-2 py-2 text-right text-sm font-medium">
                    {formatMoney(it.quantity * it.unit_price_cents, currency)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Fees & taxes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tax rate (%)" htmlFor="tax">
              <input
                id="tax"
                type="number"
                step="0.001"
                min="0"
                max="100"
                value={(taxRate * 100).toFixed(3)}
                onChange={(e) => setTaxRate((Number(e.target.value) || 0) / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Service fee (%)" htmlFor="svc">
              <input
                id="svc"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(serviceFeeRate * 100).toFixed(2)}
                onChange={(e) => setServiceFeeRate((Number(e.target.value) || 0) / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Delivery fee ($)" htmlFor="delivery">
              <input
                id="delivery"
                type="number"
                step="0.01"
                min="0"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <Field label="Gratuity (%)" htmlFor="gratuity">
              <input
                id="gratuity"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={(gratuityRate * 100).toFixed(2)}
                onChange={(e) => setGratuityRate((Number(e.target.value) || 0) / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Discount ($)" htmlFor="discount">
              <input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className={inputCls}
              />
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <div className="sticky top-8 rounded-lg border bg-card p-6 text-sm">
          <h3 className="mb-3 font-semibold">Summary</h3>
          <dl className="space-y-1.5">
            <Row label="Subtotal" value={formatMoney(totals.subtotalCents, currency)} />
            {totals.discountCents > 0 && (
              <Row label="Discount" value={`−${formatMoney(totals.discountCents, currency)}`} />
            )}
            {totals.serviceFeeCents > 0 && (
              <Row label="Service fee" value={formatMoney(totals.serviceFeeCents, currency)} />
            )}
            {totals.deliveryFeeCents > 0 && (
              <Row label="Delivery" value={formatMoney(totals.deliveryFeeCents, currency)} />
            )}
            {totals.taxCents > 0 && (
              <Row label="Tax" value={formatMoney(totals.taxCents, currency)} />
            )}
            {totals.gratuityCents > 0 && (
              <Row label="Gratuity" value={formatMoney(totals.gratuityCents, currency)} />
            )}
            <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.totalCents, currency)}</span>
            </div>
          </dl>

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

          <button
            type="button"
            disabled={isPending}
            onClick={onSubmit}
            className={`${buttonPrimaryCls} mt-4 w-full`}
          >
            {isPending ? 'Saving…' : 'Save quote'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
