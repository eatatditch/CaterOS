import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
} from 'drizzle-orm/pg-core';
import { orgs } from './orgs';
import { contacts, deals } from './crm';
import { menuItems } from './menu';

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
  'converted',
]);

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  number: text('number').notNull(), // e.g. Q-2026-0001
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  status: quoteStatusEnum('status').notNull().default('draft'),
  headcount: integer('headcount').notNull().default(0),
  eventDate: timestamp('event_date', { withTimezone: true }),
  subtotalCents: bigint('subtotal_cents', { mode: 'number' }).notNull().default(0),
  taxCents: bigint('tax_cents', { mode: 'number' }).notNull().default(0),
  serviceFeeCents: bigint('service_fee_cents', { mode: 'number' }).notNull().default(0),
  deliveryFeeCents: bigint('delivery_fee_cents', { mode: 'number' }).notNull().default(0),
  gratuityCents: bigint('gratuity_cents', { mode: 'number' }).notNull().default(0),
  discountCents: bigint('discount_cents', { mode: 'number' }).notNull().default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
  depositCents: bigint('deposit_cents', { mode: 'number' }).notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  notes: text('notes'),
  termsHtml: text('terms_html'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  publicToken: text('public_token').unique(),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quoteItems = pgTable('quote_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id').references(() => menuItems.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  quantity: integer('quantity').notNull().default(1),
  // Migration declares unit_price_cents as integer (not bigint).
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  totalCents: bigint('total_cents', { mode: 'number' }).notNull().default(0),
  position: integer('position').notNull().default(0),
  modifiers: jsonb('modifiers').$type<Array<Record<string, unknown>>>().notNull().default([]),
});

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  contact: one(contacts, { fields: [quotes.contactId], references: [contacts.id] }),
  deal: one(deals, { fields: [quotes.dealId], references: [deals.id] }),
  items: many(quoteItems),
}));
