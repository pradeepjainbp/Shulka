import { bigint, index, integer, jsonb, numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { salesInvoices } from './sales-invoices'

export const salesInvoiceItems = pgTable(
  'sales_invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    salesInvoiceId: uuid('sales_invoice_id')
      .notNull()
      .references(() => salesInvoices.id, { onDelete: 'restrict' }),

    lineNo: integer('line_no').notNull(),
    description: text('description').notNull(),

    hsnCode: text('hsn_code'),
    sacCode: text('sac_code'),

    // quantity is fractional (e.g. 2.5 kg) — numeric, NOT bigint
    quantity: numeric('quantity').notNull(),
    unit: text('unit').notNull(), // e.g. "kg", "pcs", "hr"

    // All money values are bigint paise — SACRED RULE: never numeric/decimal/float for money
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),

    // Percentage fields use numeric (fractional rates like 2.5 %)
    discountPct: numeric('discount_pct').notNull().default('0'),

    taxableValuePaise: bigint('taxable_value_paise', { mode: 'number' }).notNull(),

    cgstRatePct: numeric('cgst_rate_pct').notNull().default('0'),
    cgstPaise: bigint('cgst_paise', { mode: 'number' }).notNull().default(0),

    sgstRatePct: numeric('sgst_rate_pct').notNull().default('0'),
    sgstPaise: bigint('sgst_paise', { mode: 'number' }).notNull().default(0),

    igstRatePct: numeric('igst_rate_pct').notNull().default('0'),
    igstPaise: bigint('igst_paise', { mode: 'number' }).notNull().default(0),

    cessRatePct: numeric('cess_rate_pct').notNull().default('0'),
    cessPaise: bigint('cess_paise', { mode: 'number' }).notNull().default(0),

    // Compact summary of rule resolutions used to derive rates for this line.
    // Full resolution records live in the rule_resolutions table.
    ruleResolutions: jsonb('rule_resolutions'),

    totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
  },
  (t) => [index('sales_invoice_items_invoice_idx').on(t.salesInvoiceId)],
)

export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect
export type NewSalesInvoiceItem = typeof salesInvoiceItems.$inferInsert
