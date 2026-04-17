'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
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

function NumericInput({
  value,
  onChange,
  className,
  ...rest
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  step?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const valueToText = (n: number) => (isFinite(n) && n !== 0 ? String(n) : '');
  const [text, setText] = useState(() => valueToText(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(valueToText(value));
  }, [value, focused]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={text}
      className={className}
      onFocus={() => setFocused(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(text);
        const next = isFinite(n) && n >= 0 ? n : 0;
        onChange(next);
        setText(valueToText(next));
      }}
    />
  );
}

export type ModifierOption = {
  id: string;
  name: string;
  price_delta_cents: number;
};

export type ModifierGroupDef = {
  group_id: string;
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
  options: ModifierOption[];
};

export type MenuItemForQuote = {
  id: string;
  name: string;
  description: string | null;
  unit_price_cents: number;
  unit: string;
  modifier_groups: ModifierGroupDef[];
};

type SelectedModifier = {
  group_id: string;
  group_name: string;
  modifier_id: string;
  name: string;
  price_delta_cents: number;
};

type LineItem = {
  key: string;
  menu_item_id?: string | null;
  name: string;
  description?: string;
  quantity: number;
  base_price_cents: number; // the package price before modifiers
  unit_price_cents: number; // base + sum(selected modifier deltas)
  modifier_groups: ModifierGroupDef[];
  selected_modifiers: SelectedModifier[];
  expanded: boolean;
};

export type InquiryPrefill = {
  deal_id: string;
  contact_id: string | null;
  event_date: string;
  headcount: number;
  service_type: string;
  location_id: string;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function QuoteBuilder({
  currency,
  contacts,
  menuItems,
  deals = [],
  locations = [],
  prefill = null,
}: {
  currency: string;
  contacts: { id: string; label: string }[];
  menuItems: MenuItemForQuote[];
  deals?: { id: string; label: string; subtitle: string }[];
  locations?: { id: string; name: string }[];
  prefill?: InquiryPrefill | null;
}) {
  const [dealId, setDealId] = useState(prefill?.deal_id ?? '');
  const [contactId, setContactId] = useState(prefill?.contact_id ?? '');
  const [headcount, setHeadcount] = useState(prefill?.headcount ?? 0);
  const [eventDate, setEventDate] = useState(prefill?.event_date ?? '');
  const [serviceType, setServiceType] = useState(prefill?.service_type ?? '');
  const [locationId, setLocationId] = useState(prefill?.location_id ?? '');
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
        base_price_cents: mi.unit_price_cents,
        unit_price_cents: mi.unit_price_cents,
        modifier_groups: mi.modifier_groups,
        selected_modifiers: [],
        expanded: mi.modifier_groups.length > 0,
      },
    ]);
  }

  function addBlank() {
    setItems((prev) => [
      ...prev,
      {
        key: uid(),
        name: '',
        description: '',
        quantity: 1,
        base_price_cents: 0,
        unit_price_cents: 0,
        modifier_groups: [],
        selected_modifiers: [],
        expanded: false,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function toggleModifier(itemKey: string, group: ModifierGroupDef, modifier: ModifierOption) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        const already = it.selected_modifiers.find(
          (s) => s.group_id === group.group_id && s.modifier_id === modifier.id,
        );
        let next: SelectedModifier[];
        if (already) {
          next = it.selected_modifiers.filter(
            (s) => !(s.group_id === group.group_id && s.modifier_id === modifier.id),
          );
        } else {
          const groupSelections = it.selected_modifiers.filter((s) => s.group_id === group.group_id);
          if (group.max_selections === 1) {
            // single-select: replace any existing
            next = [
              ...it.selected_modifiers.filter((s) => s.group_id !== group.group_id),
              {
                group_id: group.group_id,
                group_name: group.name,
                modifier_id: modifier.id,
                name: modifier.name,
                price_delta_cents: modifier.price_delta_cents,
              },
            ];
          } else if (groupSelections.length >= group.max_selections) {
            toast.error(`Max ${group.max_selections} selection${group.max_selections === 1 ? '' : 's'} for ${group.name}`);
            return it;
          } else {
            next = [
              ...it.selected_modifiers,
              {
                group_id: group.group_id,
                group_name: group.name,
                modifier_id: modifier.id,
                name: modifier.name,
                price_delta_cents: modifier.price_delta_cents,
              },
            ];
          }
        }
        const deltaSum = next.reduce((s, m) => s + m.price_delta_cents, 0);
        return {
          ...it,
          selected_modifiers: next,
          unit_price_cents: it.base_price_cents + deltaSum,
        };
      }),
    );
  }

  function validateItems(): string | null {
    for (const it of items) {
      if (!it.name.trim()) return 'Every line item needs a name.';
      for (const g of it.modifier_groups) {
        const count = it.selected_modifiers.filter((s) => s.group_id === g.group_id).length;
        if (g.is_required && count < g.min_selections) {
          return `"${it.name}" requires ${g.min_selections} selection${g.min_selections === 1 ? '' : 's'} for ${g.name}.`;
        }
      }
    }
    return null;
  }

  function onSubmit() {
    setError(null);
    if (!items.length) {
      setError('Add at least one line item.');
      return;
    }
    const problem = validateItems();
    if (problem) {
      setError(problem);
      toast.error(problem);
      return;
    }
    startTransition(async () => {
      const res = await createQuote({
        contact_id: contactId || null,
        deal_id: dealId || null,
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
          modifiers: it.selected_modifiers.map((s) => ({
            group_id: s.group_id,
            group_name: s.group_name,
            modifier_id: s.modifier_id,
            name: s.name,
            price_delta_cents: s.price_delta_cents,
          })),
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

          {deals.length > 0 ? (
            <Field
              label="Pull from inquiry"
              htmlFor="deal_id"
              className="mb-4"
              hint="Select an existing lead/deal to pre-fill date, guests, service type, and location."
            >
              <select
                id="deal_id"
                value={dealId}
                onChange={(e) => {
                  const next = e.target.value;
                  setDealId(next);
                  if (next) {
                    const params = new URLSearchParams(window.location.search);
                    params.set('deal', next);
                    window.location.search = params.toString();
                  }
                }}
                className={selectCls}
              >
                <option value="">— None —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                    {d.subtitle ? ` · ${d.subtitle}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

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
            <Field label="Guest count" htmlFor="headcount">
              <NumericInput
                min="0"
                value={headcount}
                onChange={(n) => setHeadcount(Math.max(0, Math.floor(n)))}
                className={inputCls}
              />
            </Field>
            <Field label="Service type" htmlFor="service_type">
              <select
                id="service_type"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className={selectCls}
              >
                <option value="">—</option>
                <option value="on_premise">On-premise</option>
                <option value="off_premise">Off-premise</option>
                <option value="full_service">Full service</option>
                <option value="drop_off">Drop off</option>
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
                <option value="buffet">Buffet</option>
                <option value="plated">Plated</option>
              </select>
            </Field>
            {locations.length > 0 ? (
              <Field label="Location" htmlFor="location_id">
                <select
                  id="location_id"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">—</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
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
                    {m.modifier_groups.length > 0 ? ' · customizable' : ''}
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
                <LineItemRow
                  key={it.key}
                  item={it}
                  currency={currency}
                  onUpdate={(patch) => updateItem(it.key, patch)}
                  onRemove={() => removeItem(it.key)}
                  onToggleModifier={(g, m) => toggleModifier(it.key, g, m)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Fees & taxes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tax rate (%)" htmlFor="tax">
              <NumericInput
                step="0.001"
                min="0"
                max="100"
                value={taxRate * 100}
                onChange={(pct) => setTaxRate(pct / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Service fee (%)" htmlFor="svc">
              <NumericInput
                step="0.01"
                min="0"
                max="100"
                value={serviceFeeRate * 100}
                onChange={(pct) => setServiceFeeRate(pct / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Delivery fee ($)" htmlFor="delivery">
              <NumericInput
                step="0.01"
                min="0"
                value={deliveryFee}
                onChange={setDeliveryFee}
                className={inputCls}
              />
            </Field>
            <Field label="Gratuity (%)" htmlFor="gratuity">
              <NumericInput
                step="0.01"
                min="0"
                max="100"
                value={gratuityRate * 100}
                onChange={(pct) => setGratuityRate(pct / 100)}
                className={inputCls}
              />
            </Field>
            <Field label="Discount ($)" htmlFor="discount">
              <NumericInput
                step="0.01"
                min="0"
                value={discount}
                onChange={setDiscount}
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

function LineItemRow({
  item,
  currency,
  onUpdate,
  onRemove,
  onToggleModifier,
}: {
  item: LineItem;
  currency: string;
  onUpdate: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
  onToggleModifier: (g: ModifierGroupDef, m: ModifierOption) => void;
}) {
  const hasGroups = item.modifier_groups.length > 0;

  return (
    <div className="rounded-md border">
      <div className="grid items-start gap-2 p-3 md:grid-cols-[1fr_90px_120px_100px_40px]">
        <div>
          <input
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Item name"
            className={`${inputCls} h-9`}
          />
          <input
            value={item.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Description (optional)"
            className={`${inputCls} mt-2 h-8 text-xs`}
          />
          {hasGroups ? (
            <button
              type="button"
              onClick={() => onUpdate({ expanded: !item.expanded })}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {item.expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {item.selected_modifiers.length > 0
                ? `${item.selected_modifiers.length} selection${item.selected_modifiers.length === 1 ? '' : 's'}`
                : 'Customize'}
            </button>
          ) : null}
        </div>
        <NumericInput
          min="1"
          value={item.quantity}
          onChange={(n) => onUpdate({ quantity: Math.max(1, Math.floor(n) || 1) })}
          className={`${inputCls} h-9`}
          aria-label="Quantity"
        />
        <NumericInput
          min="0"
          step="0.01"
          value={item.unit_price_cents / 100}
          onChange={(dollars) =>
            onUpdate({
              base_price_cents: Math.round(dollars * 100),
              unit_price_cents: Math.round(dollars * 100) + item.selected_modifiers.reduce((s, m) => s + m.price_delta_cents, 0),
            })
          }
          className={`${inputCls} h-9`}
          aria-label="Unit price"
          placeholder="0.00"
        />
        <div className="px-2 py-2 text-right text-sm font-medium">
          {formatMoney(item.quantity * item.unit_price_cents, currency)}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {hasGroups && item.expanded ? (
        <div className="space-y-3 border-t bg-muted/20 p-3">
          {item.modifier_groups.map((g) => {
            const selectedCount = item.selected_modifiers.filter((s) => s.group_id === g.group_id).length;
            const rangeLabel =
              g.min_selections === g.max_selections
                ? `choose ${g.min_selections}`
                : `choose ${g.min_selections}–${g.max_selections}`;
            const needMore = g.is_required && selectedCount < g.min_selections;
            return (
              <div key={g.group_id}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-xs font-medium">
                    {g.name}
                    <span className="ml-2 text-muted-foreground">({rangeLabel})</span>
                    {g.is_required ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : null}
                  </div>
                  <span
                    className={
                      'text-[10px] font-medium uppercase tracking-wider ' +
                      (needMore ? 'text-destructive' : 'text-muted-foreground')
                    }
                  >
                    {selectedCount}/{g.max_selections}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((opt) => {
                    const isSelected = item.selected_modifiers.some(
                      (s) => s.group_id === g.group_id && s.modifier_id === opt.id,
                    );
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onToggleModifier(g, opt)}
                        className={
                          'rounded-full border px-3 py-1 text-xs transition-colors ' +
                          (isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card hover:bg-accent')
                        }
                      >
                        {opt.name}
                        {opt.price_delta_cents > 0
                          ? ` (+${formatMoney(opt.price_delta_cents, currency)})`
                          : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
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
