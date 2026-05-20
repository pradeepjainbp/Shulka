import {
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
import { posKindEnum } from './sales-invoices'
import { users } from './users'

export { posKindEnum }

export const purchaseInvoiceStatusEnum = pgEnum('purchase_invoice_status', [
  'draft',
  'recorded',
  'paid',
  'partially_paid',
  'disputed',
  'cancelled',
])

export const purchaseInvoices = pgTable(
  'purchase_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id),

    partyId: uuid('party_id')
      .notNull()
      .references(() => parties.id),

    supplierInvoiceNumber: text('supplier_invoice_number').notNull(),
    fy: text('fy').notNull(), // e.g. "2026-27"

    invoiceDate: date('invoice_date').notNull(),
    dueDate: date('due_date'),

    placeOfSupplyState: text('place_of_supply_state').notNull(),
    posKind: posKindEnum('pos_kind').notNull().default('inter_state'),

    status: purchaseInvoiceStatusEnum('status').notNull().default('recorded'),

    notes: text('notes'),

    // All money values are bigint paise — SACRED RULE: never numeric/decimal/float for money
    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull().default(0),
    totalCgstPaise: bigint('total_cgst_paise', { mode: 'number' }).notNull().default(0),
    totalSgstPaise: bigint('total_sgst_paise', { mode: 'number' }).notNull().default(0),
    totalIgstPaise: bigint('total_igst_paise', { mode: 'number' }).notNull().default(0),
    totalCessPaise: bigint('total_cess_paise', { mode: 'number' }).notNull().default(0),
    roundOffPaise: bigint('round_off_paise', { mode: 'number' }).notNull().default(0),
    totalAmountPaise: bigint('total_amount_paise', { mode: 'number' }).notNull().default(0),

    // Network-effect linkage: plain uuid, no FK — sales_invoices already exists but a
    // cross-table FK here would create a circular dependency with sales_invoices.linked_purchase_invoice_id.
    // The FK constraint will be added via ALTER TABLE in a future migration (ADR-10).
    linkedSalesInvoiceId: uuid('linked_sales_invoice_id'),

    linkedFromBusinessId: uuid('linked_from_business_id').references(() => businesses.id),

    // Cancellation / reversal fields
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledByUserId: uuid('cancelled_by_user_id').references(() => users.id),

    // Self-referential: plain uuid to avoid circular type inference (same pattern as sales_invoices)
    reversedByInvoiceId: uuid('reversed_by_invoice_id'),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('purchase_invoices_number_uidx').on(
      t.businessId,
      t.partyId,
      t.supplierInvoiceNumber,
    ),
    index('purchase_invoices_business_status_idx').on(t.businessId, t.status),
    index('purchase_invoices_party_idx').on(t.partyId),
    index('purchase_invoices_linked_from_business_idx').on(t.linkedFromBusinessId),
    index('purchase_invoices_linked_sales_invoice_idx').on(t.linkedSalesInvoiceId),
  ],
)

export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect
export type NewPurchaseInvoice = typeof purchaseInvoices.$inferInsert
