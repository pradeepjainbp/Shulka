import {
  type AnyPgColumn,
  bigint,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { businesses } from './businesses'
import { parties } from './parties'
import { users } from './users'

export const posKindEnum = pgEnum('pos_kind', ['intra_state', 'inter_state', 'export', 'sez'])

export const salesInvoiceStatusEnum = pgEnum('sales_invoice_status', [
  'draft',
  'final',
  'cancelled',
])

export const salesInvoices = pgTable(
  'sales_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),

    partyId: uuid('party_id')
      .notNull()
      .references(() => parties.id),

    // Gap-free per financial year; uniqueness enforced by sales_invoices_number_uidx
    invoiceNumber: text('invoice_number').notNull(),
    fy: text('fy').notNull(), // e.g. "2026-27"

    invoiceDate: date('invoice_date').notNull(),
    dueDate: date('due_date'),

    placeOfSupplyState: text('place_of_supply_state').notNull(),

    posKind: posKindEnum('pos_kind').notNull().default('inter_state'),
    posOverrideReason: text('pos_override_reason'),

    status: salesInvoiceStatusEnum('status').notNull().default('draft'),

    // All money values are bigint paise — SACRED RULE: never numeric/decimal/float for money
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    totalCgstPaise: bigint('total_cgst_paise', { mode: 'number' }).notNull().default(0),
    totalSgstPaise: bigint('total_sgst_paise', { mode: 'number' }).notNull().default(0),
    totalIgstPaise: bigint('total_igst_paise', { mode: 'number' }).notNull().default(0),
    totalCessPaise: bigint('total_cess_paise', { mode: 'number' }).notNull().default(0),
    roundOffPaise: bigint('round_off_paise', { mode: 'number' }).notNull().default(0),
    totalAmountPaise: bigint('total_amount_paise', { mode: 'number' }).notNull().default(0),

    // FK to purchase_invoices — table does not exist yet (created in Phase 3).
    // Deliberately stored as a plain uuid with no FK constraint; the constraint
    // will be added via ALTER TABLE in the P3 migration (ADR-10 network-effect linkage).
    linkedPurchaseInvoiceId: uuid('linked_purchase_invoice_id'),

    // Network-effect: the business whose purchase-side receives this invoice.
    // Populated when a supplier shares their sales invoice to a buyer on the network.
    // Indexed for fast /api/incoming queries (ADR-10).
    linkedToBusinessId: uuid('linked_to_business_id').references(() => businesses.id),

    // Cancellation / reversal fields (ADR-9)
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id),

    // Self-referential FK: points to the credit-note / reversing invoice.
    // AnyPgColumn return type annotation breaks the circular type inference (TS7022/TS7024).
    reversedByInvoiceId: uuid('reversed_by_invoice_id').references(
      (): AnyPgColumn => salesInvoices.id,
    ),

    pdfR2Key: text('pdf_r2_key'),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Gap-free invoice numbering: (business, FY, number) must be unique
    uniqueIndex('sales_invoices_number_uidx').on(t.businessId, t.fy, t.invoiceNumber),
    index('sales_invoices_business_status_idx').on(t.businessId, t.status),
    index('sales_invoices_party_idx').on(t.partyId),
    index('sales_invoices_business_id_idx').on(t.businessId),
    index('sales_invoices_linked_to_idx').on(t.linkedToBusinessId),
  ],
)

export type SalesInvoice = typeof salesInvoices.$inferSelect
export type NewSalesInvoice = typeof salesInvoices.$inferInsert
