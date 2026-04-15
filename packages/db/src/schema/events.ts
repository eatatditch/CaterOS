import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core';
import { orgs, locations, profiles } from './orgs';
import { contacts } from './crm';
import { quotes } from './quotes';

export const eventStatusEnum = pgEnum('event_status', [
  'tentative',
  'confirmed',
  'in_prep',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
]);

export const serviceTypeEnum = pgEnum('service_type', [
  'delivery',
  'pickup',
  'full_service',
  'drop_off',
  'buffet',
  'plated',
]);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: eventStatusEnum('status').notNull().default('tentative'),
  serviceType: serviceTypeEnum('service_type').notNull().default('delivery'),
  headcount: integer('headcount').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  setupAt: timestamp('setup_at', { withTimezone: true }),
  breakdownAt: timestamp('breakdown_at', { withTimezone: true }),
  venueName: text('venue_name'),
  venueAddress: text('venue_address'),
  venueNotes: text('venue_notes'),
  notes: text('notes'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const eventStaff = pgTable('event_staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  role: text('role').notNull(), // captain, server, chef, driver, etc.
  callTime: timestamp('call_time', { withTimezone: true }),
  releaseTime: timestamp('release_time', { withTimezone: true }),
  hourlyRateCents: integer('hourly_rate_cents'),
});

export const beos = pgTable('beos', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  pdfUrl: text('pdf_url'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  generatedBy: uuid('generated_by').references(() => profiles.id, { onDelete: 'set null' }),
});

export const eventsRelations = relations(events, ({ one, many }) => ({
  contact: one(contacts, { fields: [events.contactId], references: [contacts.id] }),
  quote: one(quotes, { fields: [events.quoteId], references: [quotes.id] }),
  location: one(locations, { fields: [events.locationId], references: [locations.id] }),
  staff: many(eventStaff),
  beos: many(beos),
}));
