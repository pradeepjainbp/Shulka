import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { businesses } from './businesses'

export const partyKindEnum = pgEnum('party_kind', ['customer', 'supplier', 'both'])

export const parties = pgTable(
  'parties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    externalGstin: text('external_gstin'),
    linkedBusinessId: uuid('linked_business_id').references(() => businesses.id),
    phone: text('phone'),
    email: text('email'),
    address: jsonb('address'),
    partyKind: partyKindEnum('party_kind').notNull().default('both'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('parties_business_gstin_uidx').on(t.businessId, t.externalGstin),
    index('parties_business_id_idx').on(t.businessId),
    index('parties_linked_business_id_idx').on(t.linkedBusinessId),
  ],
)

export type Party = typeof parties.$inferSelect
export type NewParty = typeof parties.$inferInsert
