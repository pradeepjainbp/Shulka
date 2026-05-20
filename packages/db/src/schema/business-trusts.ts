import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { businesses } from './businesses'
import { users } from './users'

export const businessTrustStatusEnum = pgEnum('business_trust_status', [
  'pending',
  'trusted',
  'revoked',
])

export const businessTrusts = pgTable(
  'business_trusts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    trusterBusinessId: uuid('truster_business_id')
      .notNull()
      .references(() => businesses.id),

    trustedBusinessId: uuid('trusted_business_id')
      .notNull()
      .references(() => businesses.id),

    status: businessTrustStatusEnum('status').notNull().default('pending'),

    elevatedAt: timestamp('elevated_at', { withTimezone: true }),
    elevatedByUserId: uuid('elevated_by_user_id').references(() => users.id),

    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('business_trusts_pair_uidx').on(t.trusterBusinessId, t.trustedBusinessId),
    index('business_trusts_truster_idx').on(t.trusterBusinessId),
    index('business_trusts_trusted_idx').on(t.trustedBusinessId),
  ],
)

export type BusinessTrust = typeof businessTrusts.$inferSelect
export type NewBusinessTrust = typeof businessTrusts.$inferInsert
