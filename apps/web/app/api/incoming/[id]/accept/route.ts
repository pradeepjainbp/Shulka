/**
 * POST /api/incoming/:id/accept
 *
 * "Trust this supplier" action. The :id is the sales_invoice.id that arrived in the
 * quarantine inbox (linked_to_business_id = current business).
 *
 * Steps:
 *  1. Auth guard
 *  2. Fetch sales invoice; verify linked_to_business_id = currentBusiness
 *  3. Guard: invoice must be 'final' (do not trust from draft)
 *  4. In a single transaction:
 *     a. UPSERT business_trusts — INSERT or UPDATE status to 'trusted'
 *     b. Find all quarantined (not-yet-mirrored) invoices from same sender
 *     c. For each, create a purchase_invoices mirror row
 *     d. UPDATE sales_invoices.linked_purchase_invoice_id for each mirrored invoice
 *  5. After transaction: fire audit events
 *
 * Limitation (P2-03): the recipient must already have a parties row for the sender
 * (identified by parties.linked_business_id = senderBusinessId). If not, a 422 is
 * returned — "Add this supplier to your directory first". Phase 3 will auto-create
 * the party row on accept (ADR-10).
 *
 * Sacred rules enforced:
 *  - Zod schema at every API boundary (Rule #11)
 *  - Every financial mutation calls recordEvent (Rule #3)
 *  - All mutations in a single Drizzle transaction (Rule #3)
 *  - DPDP: ownership check before any mutation (Rule #8)
 *  - Money is BIGINT paise — copied verbatim from sales invoice (Rule #2)
 *  - withErrorReporting wraps the handler
 */

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import {
  businessTrusts,
  businesses,
  db,
  parties,
  purchaseInvoices,
  recordEvent,
  salesInvoices,
} from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const AcceptIncomingInvoiceSchema = z.object({
  businessId: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Route context
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Ownership helper — verify the business belongs to this user
// ---------------------------------------------------------------------------

async function getOwnedBusiness(businessId: string, userId: string) {
  const [biz] = await db
    .select({ id: businesses.id })
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
// POST /api/incoming/:id/accept
// ---------------------------------------------------------------------------

export const POST = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id: invoiceId } = await (ctx as RouteContext).params

  // --- Zod validation at API boundary ---
  const body: unknown = await req.json()
  const parsed = AcceptIncomingInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { businessId: currentBusinessId } = parsed.data

  // --- DPDP ownership check ---
  const biz = await getOwnedBusiness(currentBusinessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // --- Fetch the triggering invoice ---
  const [triggerInvoice] = await db
    .select()
    .from(salesInvoices)
    .where(eq(salesInvoices.id, invoiceId))
    .limit(1)

  if (!triggerInvoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // --- Verify this invoice is addressed to the current business ---
  if (triggerInvoice.linkedToBusinessId !== currentBusinessId) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // --- Guard: must be 'final' (cannot trust from a draft invoice) ---
  if (triggerInvoice.status !== 'final') {
    return NextResponse.json(
      {
        error: `Cannot accept a non-final invoice. Current status: '${triggerInvoice.status}'`,
      },
      { status: 422 },
    )
  }

  const senderBusinessId = triggerInvoice.businessId

  // --- Look up recipient's party row for the sender (P2-03 limitation) ---
  // The recipient must have a parties row in their address book where
  // linked_business_id = senderBusinessId. If not, we return 422.
  // Phase 3 will auto-create this party row on accept.
  const [recipientPartyRow] = await db
    .select({ id: parties.id })
    .from(parties)
    .where(
      and(
        eq(parties.businessId, currentBusinessId),
        eq(parties.linkedBusinessId, senderBusinessId),
        isNull(parties.deletedAt),
      ),
    )
    .limit(1)

  if (!recipientPartyRow) {
    return NextResponse.json(
      {
        error:
          'Add this supplier to your directory first. ' +
          'Go to Parties → Add Supplier and link their business.',
      },
      { status: 422 },
    )
  }

  // --- Fetch all quarantined invoices from this sender to this recipient ---
  // Quarantined = linked_to_business_id = currentBusiness, sender = senderBusiness,
  //               status = 'final', and not yet mirrored (linkedPurchaseInvoiceId IS NULL).
  const quarantinedInvoices = await db
    .select()
    .from(salesInvoices)
    .where(
      and(
        eq(salesInvoices.linkedToBusinessId, currentBusinessId),
        eq(salesInvoices.businessId, senderBusinessId),
        eq(salesInvoices.status, 'final'),
        isNull(salesInvoices.linkedPurchaseInvoiceId),
      ),
    )

  // The triggering invoice should be in this list but guard in case it was already mirrored.
  // Make sure the trigger invoice is included (it may have been excluded if linkedPurchaseInvoiceId
  // is already set in a race — idempotency: skip if already mirrored).
  const invoicesToMirror = quarantinedInvoices.some((inv) => inv.id === invoiceId)
    ? quarantinedInvoices
    : [...quarantinedInvoices, triggerInvoice]

  // --- Capture prior trust status for audit event ---
  const [existingTrustRow] = await db
    .select({ id: businessTrusts.id, status: businessTrusts.status })
    .from(businessTrusts)
    .where(
      and(
        eq(businessTrusts.trusterBusinessId, currentBusinessId),
        eq(businessTrusts.trustedBusinessId, senderBusinessId),
      ),
    )
    .limit(1)

  const priorTrustStatus = existingTrustRow?.status ?? 'none'

  // --- Single transaction: upsert trust + create all mirrors ---
  const txResult = await db.transaction(async (tx) => {
    // 4a. UPSERT business_trusts
    let trust: typeof businessTrusts.$inferSelect

    if (existingTrustRow) {
      // Row already exists — UPDATE to 'trusted'
      const [updated] = await tx
        .update(businessTrusts)
        .set({
          status: 'trusted',
          elevatedAt: new Date(),
          elevatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(businessTrusts.id, existingTrustRow.id))
        .returning()

      if (!updated) throw new Error('Failed to update business trust')
      trust = updated
    } else {
      // New row
      const [inserted] = await tx
        .insert(businessTrusts)
        .values({
          trusterBusinessId: currentBusinessId,
          trustedBusinessId: senderBusinessId,
          status: 'trusted',
          elevatedAt: new Date(),
          elevatedByUserId: userId,
        })
        .returning()

      if (!inserted) throw new Error('Failed to insert business trust')
      trust = inserted
    }

    // 4b-d. Create purchase_invoices mirror rows for all quarantined invoices
    const createdPurchaseInvoices: Array<typeof purchaseInvoices.$inferSelect> = []

    for (const inv of invoicesToMirror) {
      // Idempotency: skip if already mirrored
      if (inv.linkedPurchaseInvoiceId !== null) continue

      const [mirror] = await tx
        .insert(purchaseInvoices)
        .values({
          businessId: currentBusinessId,
          partyId: recipientPartyRow.id,
          supplierInvoiceNumber: inv.invoiceNumber,
          fy: inv.fy,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate ?? null,
          placeOfSupplyState: inv.placeOfSupplyState,
          posKind: inv.posKind,
          status: 'recorded',
          // Copy all paise totals verbatim — Sacred Rule #2: money stays as integer paise
          subtotalPaise: inv.subtotalPaise,
          totalCgstPaise: inv.totalCgstPaise,
          totalSgstPaise: inv.totalSgstPaise,
          totalIgstPaise: inv.totalIgstPaise,
          totalCessPaise: inv.totalCessPaise,
          roundOffPaise: inv.roundOffPaise,
          totalAmountPaise: inv.totalAmountPaise,
          linkedSalesInvoiceId: inv.id,
          linkedFromBusinessId: senderBusinessId,
          createdBy: userId,
        })
        .returning()

      if (!mirror) throw new Error(`Failed to mirror invoice ${inv.id}`)
      createdPurchaseInvoices.push(mirror)

      // UPDATE the sales invoice to point back to its purchase mirror
      await tx
        .update(salesInvoices)
        .set({ linkedPurchaseInvoiceId: mirror.id, updatedAt: new Date() })
        .where(eq(salesInvoices.id, inv.id))
    }

    return { trust, createdPurchaseInvoices }
  })

  // --- Audit events (outside transaction — Sacred Rule #3 pattern) ---
  await recordEvent({
    actorUserId: userId,
    businessId: currentBusinessId,
    kind: 'business_trust.elevated',
    refTable: 'business_trusts',
    refId: txResult.trust.id,
    payload: {
      trusted_business_id: senderBusinessId,
      prior_status: priorTrustStatus,
    },
  })

  for (const pi of txResult.createdPurchaseInvoices) {
    await recordEvent({
      actorUserId: userId,
      businessId: currentBusinessId,
      kind: 'purchase_invoice.created',
      refTable: 'purchase_invoices',
      refId: pi.id,
      payload: {
        total_amount_paise: pi.totalAmountPaise,
        party_id: pi.partyId,
        supplier_invoice_number: pi.supplierInvoiceNumber,
      },
    })
  }

  return NextResponse.json(
    {
      trust: txResult.trust,
      purchaseInvoiceIds: txResult.createdPurchaseInvoices.map((pi) => pi.id),
    },
    { status: 200 },
  )
})
