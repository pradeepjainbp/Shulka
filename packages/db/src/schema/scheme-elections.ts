import { date, index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { businesses } from './businesses'

export const schemeEnum = pgEnum('scheme_type', ['regular', 'composition', 'qrmp'])

export const schemeElections = pgTable(
  'scheme_elections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    scheme: schemeEnum('scheme').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    ruleSetAtElection: jsonb('rule_set_at_election'), // { threshold_rule_id, rate_rules }
    declarationFiledOn: date('declaration_filed_on'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('scheme_elections_business_id_idx').on(t.businessId),
    index('scheme_elections_effective_from_idx').on(t.businessId, t.effectiveFrom),
  ],
)

export type SchemeElection = typeof schemeElections.$inferSelect
export type NewSchemeElection = typeof schemeElections.$inferInsert
