import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// clock_timestamp() per ARCHITECTURE.md §3 — NOT now() — order within a transaction matters
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ts: timestamp('ts', { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    actorUserId: uuid('actor_user_id').notNull(),
    businessId: uuid('business_id'),
    kind: text('kind').notNull(),
    refTable: text('ref_table'),
    refId: uuid('ref_id'),
    payload: jsonb('payload').notNull(),
    ruleIds: text('rule_ids').array(),
  },
  (t) => [
    index('audit_events_business_id_ts_idx').on(t.businessId, t.ts),
    index('audit_events_kind_ts_idx').on(t.kind, t.ts),
  ],
)

export type AuditEvent = typeof auditEvents.$inferSelect
export type NewAuditEvent = typeof auditEvents.$inferInsert
