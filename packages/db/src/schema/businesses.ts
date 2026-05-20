import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from './users'

export const businessTypeEnum = pgEnum('business_type', [
  'proprietorship',
  'partnership',
  'llp',
  'pvt_ltd',
  'public_ltd',
  'huf',
  'other',
])

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    gstin: text('gstin'),
    pan: text('pan'),
    stateCode: text('state_code'),
    address: jsonb('address'),
    registrationDate: date('registration_date'),
    type: businessTypeEnum('type').notNull().default('proprietorship'),
    compositionScheme: boolean('composition_scheme').notNull().default(false),
    upiVpa: text('upi_vpa'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('businesses_gstin_uidx').on(t.gstin),
    index('businesses_owner_user_id_idx').on(t.ownerUserId),
    index('businesses_deleted_at_idx').on(t.deletedAt),
  ],
)

export type Business = typeof businesses.$inferSelect
export type NewBusiness = typeof businesses.$inferInsert
