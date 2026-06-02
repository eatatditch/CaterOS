import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  bigint,
} from 'drizzle-orm/pg-core';
import { orgs, profiles, memberRoleEnum } from './orgs';
import { contacts } from './crm';

// ─── invitations ────────────────────────────────────────────────────────────
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  // DB column is `citext` (case-insensitive); represented here as text.
  email: text('email').notNull(),
  role: memberRoleEnum('role').notNull().default('sales'),
  token: text('token').notNull().unique(),
  invitedBy: uuid('invited_by').references(() => profiles.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── gmail_connections (org-level shared mailbox) ─────────────────────────────
export const gmailConnections = pgTable('gmail_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  // DB column is `citext` (case-insensitive); represented here as text.
  email: text('email').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: text('scopes').array().notNull().default([]),
  connectedBy: uuid('connected_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── email_messages (synced from Gmail) ───────────────────────────────────────
export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  gmailMessageId: text('gmail_message_id').notNull(),
  gmailThreadId: text('gmail_thread_id').notNull(),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  fromAddress: text('from_address').notNull(),
  toAddresses: text('to_addresses').array().notNull().default([]),
  ccAddresses: text('cc_addresses').array().notNull().default([]),
  subject: text('subject'),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  hasAttachments: boolean('has_attachments').notNull().default(false),
  // DB has a check constraint: direction in ('inbound', 'outbound')
  direction: text('direction').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── email_attachments (metadata; files live in storage bucket) ───────────────
export const emailAttachments = pgTable('email_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── password_resets (service-role only; no FK to auth) ───────────────────────
export const passwordResets = pgTable('password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  // DB column is `citext` (case-insensitive); represented here as text.
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invitationsRelations = relations(invitations, ({ one }) => ({
  org: one(orgs, { fields: [invitations.orgId], references: [orgs.id] }),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  contact: one(contacts, { fields: [emailMessages.contactId], references: [contacts.id] }),
}));
