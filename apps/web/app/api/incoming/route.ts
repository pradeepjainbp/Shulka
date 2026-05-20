/**
 * GET /api/incoming?businessId=<uuid>
 *
 * Returns sales invoices that are "linked" to the current business (i.e., sent to this
 * business via the network-effect), but for which no active trust relationship exists
 * (status != 'trusted'). These invoices sit in the "quarantine inbox" until accepted.
 *
 * Sacred rules enforced:
 *  - Zod schema at every API boundary (Rule #11)
 *  - DPDP: ownership check before returning any data (Rule #8)
 *  - withErrorReporting wraps the handler
 */

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businessTrusts, businesses, db, parties, salesInvoices } from '@shulka/db'
import { and, desc, eq, isNull, ne, notExists } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const ListIncomingInvoicesSchema = z.object({
  businessId: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Ownership helper
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
// GET /api/incoming
// ---------------------------------------------------------------------------

export const GET = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // --- Zod validation at API boundary ---
  const rawBusinessId = req.nextUrl.searchParams.get('businessId')
  const parsed = ListIncomingInvoicesSchema.safeParse({ businessId: rawBusinessId })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { businessId } = parsed.data

  // --- DPDP ownership check ---
  const biz = await getOwnedBusiness(businessId, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // --- Query: quarantined invoices for this business ---
  // Returns sales_invoices rows where:
  //   1. linked_to_business_id = currentBusinessId (this invoice was sent to us)
  //   2. status != 'cancelled'
  //   3. No active 'trusted' business_trusts row exists for (truster=us, trusted=sender)
  //
  // The NOT EXISTS sub-select is expressed via Drizzle's notExists() helper.
  const rows = await db
    .select({
      // Sales invoice fields
      id: salesInvoices.id,
      businessId: salesInvoices.businessId,
      partyId: salesInvoices.partyId,
      invoiceNumber: salesInvoices.invoiceNumber,
      fy: salesInvoices.fy,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      placeOfSupplyState: salesInvoices.placeOfSupplyState,
      posKind: salesInvoices.posKind,
      status: salesInvoices.status,
      subtotalPaise: salesInvoices.subtotalPaise,
      totalCgstPaise: salesInvoices.totalCgstPaise,
      totalSgstPaise: salesInvoices.totalSgstPaise,
      totalIgstPaise: salesInvoices.totalIgstPaise,
      totalCessPaise: salesInvoices.totalCessPaise,
      roundOffPaise: salesInvoices.roundOffPaise,
      totalAmountPaise: salesInvoices.totalAmountPaise,
      linkedPurchaseInvoiceId: salesInvoices.linkedPurchaseInvoiceId,
      createdAt: salesInvoices.createdAt,
      // Join fields for display
      senderBusinessName: businesses.name,
      partyName: parties.name,
    })
    .from(salesInvoices)
    .innerJoin(businesses, eq(businesses.id, salesInvoices.businessId))
    .innerJoin(parties, eq(parties.id, salesInvoices.partyId))
    .where(
      and(
        eq(salesInvoices.linkedToBusinessId, businessId),
        ne(salesInvoices.status, 'cancelled'),
        // Exclude invoices that already have an active trust (already accepted)
        notExists(
          db
            .select({ _: businessTrusts.id })
            .from(businessTrusts)
            .where(
              and(
                eq(businessTrusts.trusterBusinessId, businessId),
                eq(businessTrusts.trustedBusinessId, salesInvoices.businessId),
                eq(businessTrusts.status, 'trusted'),
              ),
            ),
        ),
      ),
    )
    .orderBy(desc(salesInvoices.createdAt))

  return NextResponse.json(rows)
})
