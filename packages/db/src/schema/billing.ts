import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { contacts } from './crm';
import { events } from './events';
import { quotes } from './quotes';

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'open',
  'paid',
  'partially_paid',
  'past_due',
  'void',
  'refunded',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull().default(0),
  taxCents: bigint('tax_cents', { mode: 'number' }).notNull().default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
  amountPaidCents: bigint('amount_paid_cents', { mode: 'number' }).notNull().default(0),
  depositAmountCents: bigint('deposit_amount_cents', { mode: 'number' }).notNull().default(0),
  depositPaidAt: timestamp('deposit_paid_at', { withTimezone: true }),
  currency: text('currency').notNull().default('USD'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  stripeInvoiceId: text('stripe_invoice_id').unique(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id').unique(),
  publicToken: text('public_token').unique(),
  autoChargeBalance: boolean('auto_charge_balance').notNull().default(true),
  balanceChargeAttemptedAt: timestamp('balance_charge_attempted_at', { withTimezone: true }),
  balanceChargeFailedReason: text('balance_charge_failed_reason'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('USD'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  method: text('method'), // card, ach, cash, check, card_in_person, other
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  stripeChargeId: text('stripe_charge_id'),
  reference: text('reference'),
  note: text('note'),
  // References auth.users(id) in the DB (manual payments record the operator).
  recordedBy: uuid('recorded_by'),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  // Set when an off-Stripe payment is reversed (voided) from the ledger.
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  voidedBy: uuid('voided_by'), // references auth.users(id) in the DB
  voidReason: text('void_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Stripe webhook idempotency ledger (service-role only; no org_id / RLS policies).
export const stripeEvents = pgTable('stripe_events', {
  eventId: text('event_id').primaryKey(),
  type: text('type'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  contact: one(contacts, { fields: [invoices.contactId], references: [contacts.id] }),
  event: one(events, { fields: [invoices.eventId], references: [events.id] }),
  payments: many(payments),
}));
