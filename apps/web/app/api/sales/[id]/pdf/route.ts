export const dynamic = 'force-dynamic'

/**
 * GET /api/sales/:id/pdf
 *
 * Authenticated PDF download. Accessible to:
 *   - The sender (user owns the invoice's business)
 *   - The recipient (user owns the business in linked_to_business_id)
 *
 * Flow:
 *   1. Auth guard
 *   2. Ownership check (sender or recipient)
 *   3. If pdfR2Key exists and R2 is available → stream from R2 (cache hit)
 *   4. Else → generate PDF, store in R2, update pdfR2Key, return bytes
 */

import { auth } from '@/auth'
import { generateInvoicePdf } from '@/lib/pdf/invoice-pdf'
import { getInvoiceBucket } from '@/lib/r2'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db, parties, salesInvoiceItems, salesInvoices } from '@shulka/db'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id: invoiceId } = await (ctx as RouteContext).params

  // --- Check ownership: sender OR recipient ---
  // Try sender first (user owns the invoice's business)
  const [senderRow] = await db
    .select({ invoice: salesInvoices })
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

  let invoice = senderRow?.invoice ?? null

  // If not sender, check recipient (user owns the business in linked_to_business_id)
  if (!invoice) {
    const [recipientRow] = await db
      .select({ invoice: salesInvoices })
      .from(salesInvoices)
      .innerJoin(
        businesses,
        and(
          eq(businesses.id, salesInvoices.linkedToBusinessId),
          eq(businesses.ownerUserId, userId),
          isNull(businesses.deletedAt),
        ),
      )
      .where(and(eq(salesInvoices.id, invoiceId), isNotNull(salesInvoices.linkedToBusinessId)))
      .limit(1)

    invoice = recipientRow?.invoice ?? null
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // --- Try R2 cache ---
  if (invoice.pdfR2Key) {
    const bucket = await getInvoiceBucket()
    if (bucket) {
      const obj = await bucket.get(invoice.pdfR2Key)
      if (obj) {
        const buf = await obj.arrayBuffer()
        return new Response(buf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
          },
        })
      }
    }
  }

  // --- Cache miss: generate fresh PDF ---
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, invoice.businessId))
    .limit(1)

  const [party] = await db.select().from(parties).where(eq(parties.id, invoice.partyId)).limit(1)

  const items = await db
    .select()
    .from(salesInvoiceItems)
    .where(eq(salesInvoiceItems.salesInvoiceId, invoiceId))

  if (!biz || !party) {
    return NextResponse.json({ error: 'Invoice data incomplete' }, { status: 500 })
  }

  const pdfBytes = await generateInvoicePdf({ invoice, items, business: biz, party })

  // Store in R2 and update pdfR2Key (best-effort)
  try {
    const r2Key = `invoices/${invoiceId}.pdf`
    const bucket = await getInvoiceBucket()
    if (bucket) {
      await bucket.put(r2Key, pdfBytes, {
        httpMetadata: { contentType: 'application/pdf' },
      })
      await db
        .update(salesInvoices)
        .set({ pdfR2Key: r2Key, updatedAt: new Date() })
        .where(eq(salesInvoices.id, invoiceId))
    }
  } catch (err) {
    console.error('[pdf] R2 store failed:', err)
  }

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  })
})
