import { sql } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const invoiceKindEnum = pgEnum('invoice_kind', ['sales', 'purchase'])

// clock_timestamp() per ARCHITECTURE.md §3
export const ruleResolutions = pgTable(
  'rule_resolutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ts: timestamp('ts', { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    invoiceKind: invoiceKindEnum('invoice_kind').notNull(),
    invoiceItemId: uuid('invoice_item_id'),
    domain: text('domain').notNull(),
    ruleId: text('rule_id').notNull(),
    sourceCitationJson: jsonb('source_citation_json').notNull(),
    resolvedValue: jsonb('resolved_value').notNull(),
  },
  (t) => [
    index('rule_resolutions_item_idx').on(t.invoiceKind, t.invoiceItemId),
    index('rule_resolutions_rule_id_ts_idx').on(t.ruleId, t.ts),
  ],
)

export type RuleResolution = typeof ruleResolutions.$inferSelect
export type NewRuleResolution = typeof ruleResolutions.$inferInsert
