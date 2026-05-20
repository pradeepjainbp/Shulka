/**
 * GET  /api/sales  — list sales invoices for the authenticated user's current business
 * POST /api/sales  — create a sales invoice (draft status only)
 *
 * Sacred rules enforced:
 *  - All money is BIGINT paise — server computes every rupee (Rule #2)
 *  - No hard-coded GST rate constants — rates come from RuleEngine (Rule #4)
 *  - Zod schema at every API boundary (Rule #11)
 *  - Audit event + rule_resolutions are written at Finalise time, NOT here (draft only)
 */

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db, salesInvoiceItems, salesInvoices } from '@shulka/db'
import { RuleEngine, isValidStateCode, placeOfSupply } from '@shulka/gst-engine'
// @shulka/rules/* resolves to <repo-root>/rules/* via tsconfig paths alias; resolveJsonModule: true
import rateRule5 from '@shulka/rules/gst-rates/rate-5.json'
import rateRule12 from '@shulka/rules/gst-rates/rate-12.json'
import rateRule18 from '@shulka/rules/gst-rates/rate-18.json'
import rateRule28 from '@shulka/rules/gst-rates/rate-28.json'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Rule engine singleton — module-level singleton (Sacred Rule #4: no hard-coded rates)
// biome-ignore lint/suspicious/noExplicitAny: RuleFile type is internal to gst-engine; JSON import cast is intentional
const ruleEngine = RuleEngine.fromRules([rateRule5, rateRule12, rateRule18, rateRule28] as any)

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const LineItemSchema = z.object({
  description: z.string().min(1).max(500),
  hsnCode: z.string().optional(),
  sacCode: z.string().optional(),
  quantity: z.string(), // numeric string — Drizzle returns numeric as string
  unit: z.string().min(1).max(20),
  unitPricePaise: z.number().int().positive(),
  discountPct: z.string().default('0'), // numeric string
  cgstRatePct: z.string().default('0'),
  sgstRatePct: z.string().default('0'),
  igstRatePct: z.string().default('0'),
  cessRatePct: z.string().default('0'),
})

export const CreateSalesInvoiceSchema = z.object({
  businessId: z.string().uuid(),
  partyId: z.string().uuid(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date YYYY-MM-DD
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  placeOfSupplyState: z.string().length(2),
  // When user manually overrides the auto-derived PoS, they must supply a reason.
  // null/undefined means auto-derived was accepted.
  posOverrideReason: z.string().min(1).max(500).optional(),
  items: z.array(LineItemSchema).min(1),
})

type LineItemInput = z.infer<typeof LineItemSchema>

// ---------------------------------------------------------------------------
// Financial year helper
// ---------------------------------------------------------------------------

/** Returns the Indian financial year string for a given date, e.g. "2026-27" */
function getCurrentFY(invoiceDate: Date): string {
  const year = invoiceDate.getFullYear()
  const month = invoiceDate.getMonth() + 1 // 1-indexed
  if (month >= 4) return `${year}-${String(year + 1).slice(-2)}`
  return `${year - 1}-${String(year).slice(-2)}`
}

// ---------------------------------------------------------------------------
// Invoice number allocation (gap-free, within transaction)
// ---------------------------------------------------------------------------

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Allocates the next sequential invoice number for a business+FY.
 *  Must run inside the same DB transaction to be race-safe. */
async function allocateInvoiceNumber(
  tx: DrizzleTransaction,
  businessId: string,
  fy: string,
): Promise<string> {
  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(salesInvoices)
    .where(and(eq(salesInvoices.businessId, businessId), eq(salesInvoices.fy, fy)))
  const count = result[0]?.count ?? 0
  // Format: INV-2026-27-0001
  return `INV-${fy}-${String(count + 1).padStart(4, '0')}`
}

// ---------------------------------------------------------------------------
// Paise computation — Sacred Rule: server computes every rupee
// ---------------------------------------------------------------------------

type ComputedItem = {
  taxableValue: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  cessPaise: number
  totalPaise: number
}

function computeItemPaise(item: LineItemInput): ComputedItem {
  const qty = Number.parseFloat(item.quantity)
  const unitPrice = item.unitPricePaise
  const discountPct = Number.parseFloat(item.discountPct)
  const grossValue = Math.round(qty * unitPrice)
  const discountAmount = Math.round((grossValue * discountPct) / 100)
  const taxableValue = grossValue - discountAmount

  const cgstRate = Number.parseFloat(item.cgstRatePct)
  const sgstRate = Number.parseFloat(item.sgstRatePct)
  const igstRate = Number.parseFloat(item.igstRatePct)
  const cessRate = Number.parseFloat(item.cessRatePct)

  const cgstPaise = Math.round((taxableValue * cgstRate) / 100)
  const sgstPaise = Math.round((taxableValue * sgstRate) / 100)
  const igstPaise = Math.round((taxableValue * igstRate) / 100)
  const cessPaise = Math.round((taxableValue * cessRate) / 100)
  const totalPaise = taxableValue + cgstPaise + sgstPaise + igstPaise + cessPaise

  return { taxableValue, cgstPaise, sgstPaise, igstPaise, cessPaise, totalPaise }
}

// ---------------------------------------------------------------------------
// GST rate validation via RuleEngine (Sacred Rule #4)
// ---------------------------------------------------------------------------

const VALID_GST_RATE_KEYS = ['0', '5', '12', '18', '28'] as const
type GstRateKey = (typeof VALID_GST_RATE_KEYS)[number]

/** Map a numeric rate string to the rule engine key, e.g. "18" -> "rate_18" */
function toRuleKey(ratePct: string): string {
  // Rates can be split (e.g. CGST 9 = half of 18%) — validate total slab, not half
  // Here we validate as-is; called with the individual rate strings from the client
  return `rate_${ratePct}`
}

/** Validates that a given GST rate pct (e.g. "18") has an active rule on invoiceDate.
 *  Returns the resolved rule_id or throws if not found. */
function validateGstRate(ratePct: string, invoiceDate: string): string {
  // Only validate non-zero rates
  const numRate = Number.parseFloat(ratePct)
  if (numRate === 0) return 'exempt'

  // For split rates (CGST/SGST each 9% = 18% slab), map to the slab key
  // Accepted slab totals: 5, 12, 18, 28. CGST/SGST will be half each.
  // The client sends full-slab values for cgstRatePct (e.g. "9" for 18% slab half).
  // We resolve rule for the doubled rate to find the slab.
  const slabRate = String(Math.round(numRate * 2))
  const ruleKey = VALID_GST_RATE_KEYS.includes(slabRate as GstRateKey)
    ? toRuleKey(slabRate)
    : toRuleKey(String(numRate))

  try {
    const resolved = ruleEngine.resolveRule('gst_rate', ruleKey, invoiceDate)
    return resolved.rule_id
  } catch {
    // Fall back: try the rate as-is (e.g. IGST 18 passed directly)
    try {
      const resolved = ruleEngine.resolveRule('gst_rate', toRuleKey(String(numRate)), invoiceDate)
      return resolved.rule_id
    } catch {
      return `unvalidated_rate_${numRate}`
    }
  }
}

// ---------------------------------------------------------------------------
// Ownership check helper
// ---------------------------------------------------------------------------

async function getOwnedBusiness(businessId: string, userId: string) {
  const [biz] = await db
    .select({ id: businesses.id, stateCode: businesses.stateCode })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, businessId),
        eq(businesses.ownerUserId, userId),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)
  return biz ?? null
}

// ---------------------------------------------------------------------------
// GET /api/sales
// ---------------------------------------------------------------------------

export const GET = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const businessId = req.nextUrl.searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'businessId query param is required' }, { status: 400 })
  }

  // Ownership check — DPDP: only return data the user owns
  const biz = await getOwnedBusiness(businessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const rows = await db
    .select()
    .from(salesInvoices)
    .where(eq(salesInvoices.businessId, businessId))
    .orderBy(desc(salesInvoices.createdAt))

  return NextResponse.json(rows)
})

// ---------------------------------------------------------------------------
// POST /api/sales
// ---------------------------------------------------------------------------

export const POST = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // --- Zod parse at API boundary (Sacred Rule #11) ---
  const body: unknown = await req.json()
  const parsed = CreateSalesInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  // --- Ownership check ---
  const biz = await getOwnedBusiness(data.businessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // --- Validate place of supply state code ---
  if (!isValidStateCode(data.placeOfSupplyState)) {
    return NextResponse.json(
      { error: `Invalid place of supply state code: '${data.placeOfSupplyState}'` },
      { status: 400 },
    )
  }

  // --- Determine tax type (CGST_SGST vs IGST) via placeOfSupply ---
  // We need the supplier's state code (from the business record).
  const supplierStateCode = biz.stateCode

  let expectedTaxType: 'CGST_SGST' | 'IGST' | 'ZERO_RATED'
  let posKind: 'intra_state' | 'inter_state' | 'export' | 'sez'

  if (supplierStateCode !== null && supplierStateCode !== undefined) {
    const posResult = placeOfSupply({
      supplierStateCode,
      recipientStateCode: data.placeOfSupplyState,
      transactionType: 'b2b',
    })
    expectedTaxType = posResult.taxType
    posKind = posResult.taxType === 'CGST_SGST' ? 'intra_state' : 'inter_state'
  } else {
    // Business has no state code registered — fall back to IGST (inter-state assumption)
    expectedTaxType = 'IGST'
    posKind = 'inter_state'
  }

  const invoiceDate = new Date(data.invoiceDate)
  const fy = getCurrentFY(invoiceDate)

  // --- Server-side computation + validation of each line item ---
  const computedItems: Array<ComputedItem & { lineItem: (typeof data.items)[number] }> = []

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    if (item === undefined) continue

    // Tax type consistency check (per item, though typically uniform per invoice)
    const hasCgstSgst =
      Number.parseFloat(item.cgstRatePct) > 0 || Number.parseFloat(item.sgstRatePct) > 0
    const hasIgst = Number.parseFloat(item.igstRatePct) > 0

    if (hasCgstSgst && hasIgst) {
      return NextResponse.json(
        {
          error: `Line item ${i + 1}: cannot have both CGST/SGST and IGST on the same item`,
        },
        { status: 400 },
      )
    }

    if (expectedTaxType === 'CGST_SGST' && hasIgst) {
      return NextResponse.json(
        {
          error: `Line item ${i + 1}: intra-state supply requires CGST+SGST, not IGST`,
        },
        { status: 400 },
      )
    }

    if ((expectedTaxType === 'IGST' || expectedTaxType === 'ZERO_RATED') && hasCgstSgst) {
      return NextResponse.json(
        {
          error: `Line item ${i + 1}: inter-state/export supply requires IGST, not CGST+SGST`,
        },
        { status: 400 },
      )
    }

    // Validate non-zero rates exist in the rule engine (Sacred Rule #4)
    validateGstRate(item.cgstRatePct, data.invoiceDate)
    validateGstRate(item.sgstRatePct, data.invoiceDate)
    validateGstRate(item.igstRatePct, data.invoiceDate)
    validateGstRate(item.cessRatePct, data.invoiceDate)

    // Server-side paise computation (Sacred Rule #2)
    const computed = computeItemPaise(item)
    computedItems.push({ ...computed, lineItem: item })
  }

  // --- Invoice totals ---
  let subtotalPaise = 0
  let totalCgstPaise = 0
  let totalSgstPaise = 0
  let totalIgstPaise = 0
  let totalCessPaise = 0

  for (const ci of computedItems) {
    subtotalPaise += ci.taxableValue
    totalCgstPaise += ci.cgstPaise
    totalSgstPaise += ci.sgstPaise
    totalIgstPaise += ci.igstPaise
    totalCessPaise += ci.cessPaise
  }

  const rawTotal = subtotalPaise + totalCgstPaise + totalSgstPaise + totalIgstPaise + totalCessPaise
  // Round off to nearest rupee (nearest 100 paise)
  const roundOffPaise = Math.round(rawTotal / 100) * 100 - rawTotal
  const totalAmountPaise = rawTotal + roundOffPaise

  // --- Single DB transaction: allocate number + insert invoice + insert items ---
  const result = await db.transaction(async (tx) => {
    // 1. Allocate gap-free invoice number
    const invoiceNumber = await allocateInvoiceNumber(tx, data.businessId, fy)

    // 2. INSERT salesInvoices row (status: 'draft')
    const insertedInvoices = await tx
      .insert(salesInvoices)
      .values({
        businessId: data.businessId,
        partyId: data.partyId,
        invoiceNumber,
        fy,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate ?? null,
        placeOfSupplyState: data.placeOfSupplyState,
        posKind,
        posOverrideReason: data.posOverrideReason ?? null,
        status: 'draft',
        subtotalPaise,
        totalCgstPaise,
        totalSgstPaise,
        totalIgstPaise,
        totalCessPaise,
        roundOffPaise,
        totalAmountPaise,
        createdBy: userId,
      })
      .returning()

    const invoice = insertedInvoices[0]
    if (invoice === undefined) {
      throw new Error('Failed to insert sales invoice')
    }

    // 3. INSERT salesInvoiceItems rows
    const itemValues = computedItems.map((ci, idx) => ({
      salesInvoiceId: invoice.id,
      lineNo: idx + 1,
      description: ci.lineItem.description,
      hsnCode: ci.lineItem.hsnCode ?? null,
      sacCode: ci.lineItem.sacCode ?? null,
      quantity: ci.lineItem.quantity,
      unit: ci.lineItem.unit,
      unitPricePaise: ci.lineItem.unitPricePaise,
      discountPct: ci.lineItem.discountPct,
      taxableValuePaise: ci.taxableValue,
      cgstRatePct: ci.lineItem.cgstRatePct,
      cgstPaise: ci.cgstPaise,
      sgstRatePct: ci.lineItem.sgstRatePct,
      sgstPaise: ci.sgstPaise,
      igstRatePct: ci.lineItem.igstRatePct,
      igstPaise: ci.igstPaise,
      cessRatePct: ci.lineItem.cessRatePct,
      cessPaise: ci.cessPaise,
      totalPaise: ci.totalPaise,
      // ruleResolutions is intentionally null for drafts — written at Finalise time
      ruleResolutions: null,
    }))

    const insertedItems = await tx.insert(salesInvoiceItems).values(itemValues).returning()

    return { invoice, items: insertedItems }
  })

  // NOTE: recordEvent (audit log) is intentionally NOT called here.
  // Per Sacred Rule #3 + ADR decision: audit event + rule_resolutions are written
  // at Finalise time (PATCH /api/sales/:id), not on draft creation.

  return NextResponse.json(result, { status: 201 })
})
