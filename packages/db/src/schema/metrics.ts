import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  bigint,
  integer,
  jsonb,
  date,
} from 'drizzle-orm/pg-core';
import { orgs, locations, profiles } from './orgs';
import { deals, stages } from './crm';

export const prospectSegmentEnum = pgEnum('prospect_segment', [
  'corporate_office',
  'wedding_venue',
  'event_planner',
  'hospital',
  'school',
  'nonprofit',
  'other',
]);

export const prospectStatusEnum = pgEnum('prospect_status', [
  'cold',
  'warming',
  'converted_to_lead',
  'dead',
]);

export const adChannelEnum = pgEnum('ad_channel', ['meta', 'google', 'other']);

export const goalPeriodEnum = pgEnum('goal_period', ['weekly', 'monthly', 'quarterly']);

export const prospects = pgTable('prospects', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'set null' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name'),
  contactInfo: jsonb('contact_info').$type<Record<string, unknown>>().notNull().default({}),
  segment: prospectSegmentEnum('segment').notNull().default('other'),
  status: prospectStatusEnum('status').notNull().default('cold'),
  notes: text('notes'),
  convertedDealId: uuid('converted_deal_id').references(() => deals.id, { onDelete: 'set null' }),
  lastTouchedAt: timestamp('last_touched_at', { withTimezone: true }),
  nextTouchAt: timestamp('next_touch_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adSpend = pgTable('ad_spend', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  channel: adChannelEnum('channel').notNull(),
  campaignName: text('campaign_name'),
  spendCents: bigint('spend_cents', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('USD'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  externalRef: text('external_ref'),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').references(() => profiles.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'cascade' }),
  periodType: goalPeriodEnum('period_type').notNull(),
  periodStart: date('period_start').notNull(),
  revenueGoalCents: bigint('revenue_goal_cents', { mode: 'number' }).notNull().default(0),
  activityGoals: jsonb('activity_goals').$type<Record<string, number>>().notNull().default({}),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dealStageTransitions = pgTable('deal_stage_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  fromStageId: uuid('from_stage_id').references(() => stages.id, { onDelete: 'set null' }),
  toStageId: uuid('to_stage_id')
    .notNull()
    .references(() => stages.id, { onDelete: 'restrict' }),
  actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
});
