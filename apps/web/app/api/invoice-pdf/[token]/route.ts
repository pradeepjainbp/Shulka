export const dynamic = 'force-dynamic'

/**
 * GET /api/invoice-pdf/:token
 *
 * Public shareable PDF link. No auth required. Expires after 7 days.
 *
 * Flow:
 *   1. Look up invoice by pdfShareToken
 *   2. Check pdfShareTokenExpiresAt — return 410 if expired
 *   3. Stream from R2 (cache hit) or regenerate (cache miss)
 */

import { generateInvoicePdf } from '@/lib/pdf/invoice-pdf'
import { getInvoiceBucket } from '@/lib/r2'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db, parties, salesInvoiceItems, salesInvoices } from '@shulka/db'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ token: string }> }

export const GET = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const { token } = await (ctx as RouteContext).params

  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 })
  }

  // --- Look up invoice by share token ---
  const [invoice] = await db
    .select()
    .from(salesInvoices)
    .where(eq(salesInvoices.pdfShareToken, token))
    .limit(1)

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // --- Check expiry ---
  if (invoice.pdfShareTokenExpiresAt && invoice.pdfShareTokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This link has expired. Ask the sender to resend the invoice.' },
      { status: 410 },
    )
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

  // --- Cache miss: regenerate ---
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, invoice.businessId))
    .limit(1)

  const [party] = await db.select().from(parties).where(eq(parties.id, invoice.partyId)).limit(1)

  const items = await db
    .select()
    .from(salesInvoiceItems)
    .where(eq(salesInvoiceItems.salesInvoiceId, invoice.id))

  if (!biz || !party) {
    return NextResponse.json({ error: 'Invoice data incomplete' }, { status: 500 })
  }

  const pdfBytes = await generateInvoicePdf({ invoice, items, business: biz, party })

  // Re-cache in R2
  try {
    const r2Key = `invoices/${invoice.id}.pdf`
    const bucket = await getInvoiceBucket()
    if (bucket) {
      await bucket.put(r2Key, pdfBytes, {
        httpMetadata: { contentType: 'application/pdf' },
      })
      await db
        .update(salesInvoices)
        .set({ pdfR2Key: r2Key, updatedAt: new Date() })
        .where(eq(salesInvoices.id, invoice.id))
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
