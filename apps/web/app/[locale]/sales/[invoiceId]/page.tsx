import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { businesses, db, parties, salesInvoiceItems, salesInvoices } from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import { ArrowLeft, CheckCircle2, Clock, FileDown, XCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatINR(paise: number): string {
  return inrFormatter.format(paise / 100)
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

function formatDate(dateStr: string): string {
  return dateFormatter.format(new Date(dateStr))
}

type Props = { params: Promise<{ locale: string; invoiceId: string }> }

export default async function SalesInvoiceDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/en/sign-in')

  const { locale, invoiceId } = await params

  // Fetch invoice with ownership check via businesses join
  const rows = await db
    .select({
      invoice: salesInvoices,
      partyName: parties.name,
      partyGstin: parties.externalGstin,
    })
    .from(salesInvoices)
    .innerJoin(businesses, eq(salesInvoices.businessId, businesses.id))
    .innerJoin(parties, eq(salesInvoices.partyId, parties.id))
    .where(
      and(
        eq(salesInvoices.id, invoiceId),
        eq(businesses.ownerUserId, session.user.id),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) notFound()

  const { invoice, partyName, partyGstin } = row

  const items = await db
    .select()
    .from(salesInvoiceItems)
    .where(eq(salesInvoiceItems.salesInvoiceId, invoiceId))
    .orderBy(salesInvoiceItems.lineNo)

  const statusConfig = {
    draft: {
      label: 'Draft',
      icon: Clock,
      classes: 'bg-surface text-ink-muted border border-border',
    },
    final: { label: 'Final', icon: CheckCircle2, classes: 'bg-emerald-50 text-emerald-700' },
    cancelled: { label: 'Cancelled', icon: XCircle, classes: 'bg-red-50 text-red-600' },
  } as const

  const status = statusConfig[invoice.status]
  const StatusIcon = status.icon

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/${locale}/sales`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-[150ms]"
          >
            <ArrowLeft size={14} />
            Sales Invoices
          </Link>
          <h1 className="text-[28px] font-medium tracking-tight text-ink tabular-nums">
            {invoice.invoiceNumber}
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.classes}`}
            >
              <StatusIcon size={11} strokeWidth={2.5} />
              {status.label}
            </span>
            <span className="text-sm text-ink-muted">FY {invoice.fy}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === 'draft' && (
            <Button asChild>
              <Link href={`/${locale}/sales/${invoiceId}/finalise`}>Finalise Invoice</Link>
            </Button>
          )}
          {invoice.status === 'final' && (
            <Button variant="secondary" size="sm" asChild>
              <a
                href={`/api/sales/${invoiceId}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <FileDown size={14} strokeWidth={2} />
                Download PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Invoice meta */}
      <section className="rounded-lg border border-border bg-raised p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-ink-muted mb-0.5">Party</p>
          <p className="text-sm font-medium text-ink">{partyName}</p>
          {partyGstin && (
            <p className="text-xs font-mono tabular-nums text-ink-muted mt-0.5">{partyGstin}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-ink-muted mb-0.5">Invoice Date</p>
          <p className="text-sm font-medium text-ink">{formatDate(invoice.invoiceDate)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted mb-0.5">Due Date</p>
          <p className="text-sm font-medium text-ink">
            {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-muted mb-0.5">Place of Supply</p>
          <p className="text-sm font-medium text-ink tabular-nums">{invoice.placeOfSupplyState}</p>
        </div>
      </section>

      {/* Line items */}
      <section className="rounded-lg border border-border bg-raised overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h2 className="text-[14px] font-semibold text-ink">Line Items</h2>
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2 text-xs font-medium text-ink-muted border-b border-border bg-surface">
          <span>Description / HSN</span>
          <span className="text-right tabular-nums">Qty</span>
          <span className="text-right tabular-nums">Unit Price</span>
          <span className="text-right tabular-nums">Taxable</span>
          <span className="text-right tabular-nums">Tax</span>
          <span className="text-right tabular-nums">Total</span>
        </div>

        {items.map((item) => {
          const cgstRate = Number.parseFloat(item.cgstRatePct)
          const sgstRate = Number.parseFloat(item.sgstRatePct)
          const igstRate = Number.parseFloat(item.igstRatePct)
          const cessRate = Number.parseFloat(item.cessRatePct)

          const taxPaise = item.cgstPaise + item.sgstPaise + item.igstPaise + item.cessPaise

          const taxLabel =
            igstRate > 0
              ? `IGST ${igstRate}%`
              : cgstRate > 0
                ? `CGST ${cgstRate}% + SGST ${sgstRate}%`
                : cessRate > 0
                  ? `Cess ${cessRate}%`
                  : 'Exempt'

          return (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-1 sm:gap-3 px-5 py-3 border-b border-border last:border-0 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{item.description}</p>
                {(item.hsnCode ?? item.sacCode) && (
                  <p className="text-xs text-ink-muted font-mono tabular-nums mt-0.5">
                    {item.hsnCode ?? item.sacCode}
                  </p>
                )}
                <p className="text-xs text-ink-muted mt-0.5 sm:hidden">
                  {item.quantity} {item.unit} × {formatINR(item.unitPricePaise)}
                </p>
              </div>
              <p className="hidden sm:block text-right tabular-nums text-ink-muted">
                {item.quantity} {item.unit}
              </p>
              <p className="hidden sm:block text-right tabular-nums text-ink">
                {formatINR(item.unitPricePaise)}
              </p>
              <p className="hidden sm:block text-right tabular-nums text-ink">
                {formatINR(item.taxableValuePaise)}
              </p>
              <div className="hidden sm:block text-right">
                <p className="tabular-nums text-ink">{formatINR(taxPaise)}</p>
                <p className="text-xs text-ink-muted">{taxLabel}</p>
              </div>
              <p className="hidden sm:block text-right tabular-nums font-medium text-ink">
                {formatINR(item.totalPaise)}
              </p>
            </div>
          )
        })}
      </section>

      {/* Tax summary */}
      <section className="rounded-lg border border-border bg-raised p-5 ml-auto max-w-xs w-full space-y-2">
        <div className="flex justify-between text-sm text-ink-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatINR(invoice.subtotalPaise)}</span>
        </div>
        {invoice.totalCgstPaise > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>CGST</span>
            <span className="tabular-nums">{formatINR(invoice.totalCgstPaise)}</span>
          </div>
        )}
        {invoice.totalSgstPaise > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>SGST</span>
            <span className="tabular-nums">{formatINR(invoice.totalSgstPaise)}</span>
          </div>
        )}
        {invoice.totalIgstPaise > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>IGST</span>
            <span className="tabular-nums">{formatINR(invoice.totalIgstPaise)}</span>
          </div>
        )}
        {invoice.totalCessPaise > 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Cess</span>
            <span className="tabular-nums">{formatINR(invoice.totalCessPaise)}</span>
          </div>
        )}
        {invoice.roundOffPaise !== 0 && (
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Round off</span>
            <span className="tabular-nums">{formatINR(invoice.roundOffPaise)}</span>
          </div>
        )}
        <div className="border-t border-border pt-2 flex justify-between text-[16px] font-semibold text-ink">
          <span>Total</span>
          <span className="tabular-nums">{formatINR(invoice.totalAmountPaise)}</span>
        </div>
      </section>
    </main>
  )
}
