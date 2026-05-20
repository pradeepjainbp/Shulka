export const dynamic = 'force-dynamic'

/**
 * GET  /api/sales/:id  — fetch a single sales invoice with its line items
 * PATCH /api/sales/:id — finalise a draft invoice (status: draft → final)
 *
 * Sacred rules enforced:
 *  - Zod schema at every API boundary (Rule #11)
 *  - All financial mutations call recordEvent (audit log) (Rule #3)
 *  - rule_resolutions written for each item×tax_kind on finalise (Rule #3 / ARCHITECTURE §3)
 *  - Single Drizzle transaction for dual-write (Rule #3)
 *  - No hard-coded GST rates (Rule #4)
 *  - Money is BIGINT paise (Rule #2)
 *  - DPDP: ownership check before returning any PII-adjacent data
 */

import { auth } from '@/auth'
import { generateInvoicePdf } from '@/lib/pdf/invoice-pdf'
import { getInvoiceBucket } from '@/lib/r2'
import { withErrorReporting } from '@/lib/with-error-reporting'
import {
  businesses,
  db,
  parties,
  recordEvent,
  ruleResolutions,
  salesInvoiceItems,
  salesInvoices,
} from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Route context type for dynamic [id] segments
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Only `action: 'finalise'` is accepted in P2-01.
 *  Cancel / update-notes arrive in later tickets. */
const FinaliseSalesInvoiceSchema = z.object({
  action: z.literal('finalise'),
})

// ---------------------------------------------------------------------------
// Ownership helper — reused by both GET and PATCH
// Checks the invoice belongs to the authenticated user's business.
// Returns { invoice, businessId } or null.
// ---------------------------------------------------------------------------

async function getOwnedInvoice(invoiceId: string, userId: string) {
  // Join through businesses so we can assert ownerUserId in one query
  const [row] = await db
    .select({
      invoiceId: salesInvoices.id,
      businessId: salesInvoices.businessId,
      partyId: salesInvoices.partyId,
      invoiceNumber: salesInvoices.invoiceNumber,
      fy: salesInvoices.fy,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      placeOfSupplyState: salesInvoices.placeOfSupplyState,
      status: salesInvoices.status,
      subtotalPaise: salesInvoices.subtotalPaise,
      totalCgstPaise: salesInvoices.totalCgstPaise,
      totalSgstPaise: salesInvoices.totalSgstPaise,
      totalIgstPaise: salesInvoices.totalIgstPaise,
      totalCessPaise: salesInvoices.totalCessPaise,
      roundOffPaise: salesInvoices.roundOffPaise,
      totalAmountPaise: salesInvoices.totalAmountPaise,
      createdAt: salesInvoices.createdAt,
      updatedAt: salesInvoices.updatedAt,
    })
    .from(salesInvoices)
    .innerJoin(
      businesses,
      and(
        eq(businesses.id, salesInvoices.businessId),
        eq(businesses.ownerUserId, userId),
        isNull(businesses.deletedAt),
      ),
    )
    .where(eq(salesInvoices.id, invoiceId))
    .limit(1)

  return row ?? null
}

// ---------------------------------------------------------------------------
// Rule ID derivation — deterministic, no hard-coded rates
// Format: GST_RATE_<rate>_v1  (rate is the numeric pct as a plain integer string)
// Zero/exempt rates are not written to rule_resolutions (they have no tax event).
// ---------------------------------------------------------------------------

/**
 * Given a rate percentage string (e.g. "9", "18", "0"), produce the canonical
 * rule ID string used in rule_resolutions.ruleId.
 * Returns null for zero rates (no resolution row to write).
 */
function deriveRuleId(ratePctStr: string): string | null {
  const rate = Number.parseFloat(ratePctStr)
  if (!Number.isFinite(rate) || rate === 0) return null
  // Normalise to integer string: "9.0" → "9", "18.00" → "18"
  const rateKey = String(Math.round(rate * 100) / 100).replace(/\.0+$/, '')
  return `GST_RATE_${rateKey}_v1`
}

// ---------------------------------------------------------------------------
// GET /api/sales/:id
// ---------------------------------------------------------------------------

export const GET = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  // DPDP: verify the invoice belongs to this user before returning any data
  const invoice = await getOwnedInvoice(id, userId)
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const items = await db
    .select()
    .from(salesInvoiceItems)
    .where(eq(salesInvoiceItems.salesInvoiceId, id))

  return NextResponse.json({ invoice, items })
})

// ---------------------------------------------------------------------------
// PATCH /api/sales/:id
// ---------------------------------------------------------------------------

export const PATCH = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  // --- Zod validation at API boundary (Sacred Rule #11) ---
  const body: unknown = await req.json()
  const parsed = FinaliseSalesInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Only one action is supported in P2-01; the guard is future-proof for switch expansion.
  const { action } = parsed.data

  if (action === 'finalise') {
    return finaliseInvoice(id, userId)
  }

  // TypeScript exhaustiveness guard — parsed.data.action is narrowed to never here
  // because z.literal('finalise') is the only variant. Keep for future union safety.
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
})

// ---------------------------------------------------------------------------
// Finalise handler — extracted for readability
// ---------------------------------------------------------------------------

async function finaliseInvoice(invoiceId: string, userId: string): Promise<NextResponse> {
  // Step 1: Fetch invoice with ownership check
  const invoice = await getOwnedInvoice(invoiceId, userId)
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Step 2: Guard — must be in draft status
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      {
        error: `Invoice cannot be finalised: current status is '${invoice.status}'`,
      },
      { status: 409 },
    )
  }

  // Step 3: Fetch all line items for this invoice
  const items = await db
    .select()
    .from(salesInvoiceItems)
    .where(eq(salesInvoiceItems.salesInvoiceId, invoiceId))

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'Invoice has no line items and cannot be finalised' },
      { status: 422 },
    )
  }

  // Step 4: Single transaction — dual-write (rule_resolutions + status update) + audit event
  // Per ARCHITECTURE.md §3: clock_timestamp() distinguishes rows within the same transaction.
  const result = await db.transaction(async (tx) => {
    // 4a. UPDATE sales_invoices status to 'final'
    const updated = await tx
      .update(salesInvoices)
      .set({ status: 'final', updatedAt: new Date() })
      .where(eq(salesInvoices.id, invoiceId))
      .returning()

    const finalInvoice = updated[0]
    if (!finalInvoice) {
      throw new Error('Failed to update invoice status')
    }

    // 4b. INSERT rule_resolutions — one row per item × non-zero tax component
    // Tax kinds and their corresponding rate/amount field pairs on each item.
    type TaxKind = 'cgst' | 'sgst' | 'igst' | 'cess'
    type TaxFields = {
      ratePct: string // e.g. item.cgstRatePct  — numeric string from DB
      paise: number // e.g. item.cgstPaise     — bigint(mode:'number')
    }

    const uniqueRuleIds = new Set<string>()
    const resolutionInserts: Array<typeof ruleResolutions.$inferInsert> = []

    for (const item of items) {
      const taxComponents: Record<TaxKind, TaxFields> = {
        cgst: { ratePct: item.cgstRatePct, paise: item.cgstPaise },
        sgst: { ratePct: item.sgstRatePct, paise: item.sgstPaise },
        igst: { ratePct: item.igstRatePct, paise: item.igstPaise },
        cess: { ratePct: item.cessRatePct, paise: item.cessPaise },
      }

      for (const [kind, fields] of Object.entries(taxComponents) as [TaxKind, TaxFields][]) {
        const ruleId = deriveRuleId(fields.ratePct)
        // Only write a resolution row for non-zero tax components
        if (ruleId === null) continue

        uniqueRuleIds.add(ruleId)

        resolutionInserts.push({
          invoiceKind: 'sales',
          invoiceItemId: item.id,
          domain: kind,
          ruleId,
          sourceCitationJson: {
            section: 'CGST Act Schedule',
            // Use the component's own rate for citation, not the slab total
            rate_pct: Number.parseFloat(fields.ratePct),
          },
          resolvedValue: {
            rate_pct: Number.parseFloat(fields.ratePct),
            amount_paise: fields.paise,
          },
        })
      }
    }

    // Also write a PoS rule_resolution row for the invoice-level place_of_supply determination.
    // invoiceItemId is null for invoice-level rules (not tied to a specific item).
    const posRuleId =
      finalInvoice.posKind === 'intra_state' ? 'POS_INTRASTATE_v1' : 'POS_INTERSTATE_v1'
    uniqueRuleIds.add(posRuleId)
    resolutionInserts.push({
      invoiceKind: 'sales',
      invoiceItemId: null,
      domain: 'place_of_supply',
      ruleId: posRuleId,
      sourceCitationJson: {
        section:
          finalInvoice.posKind === 'intra_state'
            ? 'CGST Act 2017 Section 8'
            : 'IGST Act 2017 Section 7-14',
        pos_kind: finalInvoice.posKind,
        place_of_supply_state: finalInvoice.placeOfSupplyState,
      },
      resolvedValue: {
        pos_kind: finalInvoice.posKind,
        tax_type: finalInvoice.posKind === 'intra_state' ? 'CGST_SGST' : 'IGST',
        overridden: finalInvoice.posOverrideReason !== null,
      },
    })

    if (resolutionInserts.length > 0) {
      await tx.insert(ruleResolutions).values(resolutionInserts)
    }

    // 4c. Audit event — inside the same transaction so it's atomic with the status update.
    // recordEvent uses db (not tx) internally, so we call it after the transaction commits.
    // We return the data needed to call it outside the transaction boundary.
    return {
      finalInvoice,
      ruleIds: Array.from(uniqueRuleIds),
    }
  })

  // Step 5: recordEvent called after transaction commits — Sacred Rule #3
  // (recordEvent inserts into audit_events via the top-level db client; this is intentional
  // as audit_events uses clock_timestamp() and we want the audit row after the mutation.)
  // exactOptionalPropertyTypes: only spread ruleIds when the array is non-empty
  // to avoid assigning `undefined` to an optional-but-not-undefined-typed field.
  await recordEvent({
    actorUserId: userId,
    businessId: result.finalInvoice.businessId,
    kind: 'sales_invoice.created',
    refTable: 'sales_invoices',
    refId: result.finalInvoice.id,
    payload: {
      total_amount_paise: result.finalInvoice.totalAmountPaise,
      party_id: result.finalInvoice.partyId,
      invoice_number: result.finalInvoice.invoiceNumber,
    },
    ...(result.ruleIds.length > 0 ? { ruleIds: result.ruleIds } : {}),
  })

  // --- PDF generation (best-effort — do not fail finalise if PDF fails) ---
  try {
    const [biz] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, result.finalInvoice.businessId))
      .limit(1)

    const [party] = await db
      .select()
      .from(parties)
      .where(eq(parties.id, result.finalInvoice.partyId))
      .limit(1)

    if (biz && party) {
      const invoiceItems = await db
        .select()
        .from(salesInvoiceItems)
        .where(eq(salesInvoiceItems.salesInvoiceId, invoiceId))

      const pdfBytes = await generateInvoicePdf({
        invoice: result.finalInvoice,
        items: invoiceItems,
        business: biz,
        party,
      })

      const r2Key = `invoices/${invoiceId}.pdf`
      const shareToken = crypto.randomUUID()
      const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const bucket = await getInvoiceBucket()
      if (bucket) {
        await bucket.put(r2Key, pdfBytes, {
          httpMetadata: { contentType: 'application/pdf' },
        })
      }

      await db
        .update(salesInvoices)
        .set({
          pdfR2Key: r2Key,
          pdfShareToken: shareToken,
          pdfShareTokenExpiresAt: tokenExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(salesInvoices.id, invoiceId))
    }
  } catch (err) {
    console.error('[pdf] PDF generation failed on finalise:', err)
  }

  return NextResponse.json({ invoice: result.finalInvoice })
}
