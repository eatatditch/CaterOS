import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { orgs, profiles } from './orgs';
import { contacts } from './crm';

// ─── enums ────────────────────────────────────────────────────────────────
export const segmentKindEnum = pgEnum('segment_kind', ['dynamic', 'manual']);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
]);

export const sequenceTriggerEnum = pgEnum('sequence_trigger', [
  'inbound_lead',
  'quote_sent',
  'quote_accepted',
  'event_completed',
  'annual_rebook',
  'abandoned_quote',
  'manual',
]);

export const sequenceStatusEnum = pgEnum('sequence_status', ['draft', 'active', 'paused']);

// ─── segments ────────────────────────────────────────────────────────────────
export const segments = pgTable('segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  kind: segmentKindEnum('kind').notNull().default('dynamic'),
  filters: jsonb('filters').$type<Record<string, unknown>>().notNull().default({}),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const segmentMembers = pgTable(
  'segment_members',
  {
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.segmentId, t.contactId] }),
  }),
);

// ─── campaigns ────────────────────────────────────────────────────────────────
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),
  segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'set null' }),
  status: campaignStatusEnum('status').notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentCount: integer('sent_count').notNull().default(0),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaignSends = pgTable('campaign_sends', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  error: text('error'),
  gmailMessageId: text('gmail_message_id'),
});

// ─── sequences ────────────────────────────────────────────────────────────────
export const sequences = pgTable('sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  trigger: sequenceTriggerEnum('trigger').notNull().default('manual'),
  status: sequenceStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceSteps = pgTable('sequence_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  sequenceId: uuid('sequence_id')
    .notNull()
    .references(() => sequences.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  delayHours: integer('delay_hours').notNull().default(0),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sequenceEnrollments = pgTable('sequence_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  sequenceId: uuid('sequence_id')
    .notNull()
    .references(() => sequences.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  currentStep: integer('current_step').notNull().default(0),
  nextSendAt: timestamp('next_send_at', { withTimezone: true }),
  status: text('status').notNull().default('active'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const segmentsRelations = relations(segments, ({ one, many }) => ({
  org: one(orgs, { fields: [segments.orgId], references: [orgs.id] }),
  members: many(segmentMembers),
  campaigns: many(campaigns),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  org: one(orgs, { fields: [campaigns.orgId], references: [orgs.id] }),
  segment: one(segments, { fields: [campaigns.segmentId], references: [segments.id] }),
  sends: many(campaignSends),
}));

export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  org: one(orgs, { fields: [sequences.orgId], references: [orgs.id] }),
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}));
