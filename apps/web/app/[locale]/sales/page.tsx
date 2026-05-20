import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { businesses, db, parties, salesInvoices } from '@shulka/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { FileDown, FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Sales Invoices — Shulka',
}

// ---------------------------------------------------------------------------
// Money formatter — tabular-nums, Indian lakh comma
// ---------------------------------------------------------------------------
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatINR(paise: number): string {
  return inrFormatter.format(Math.round(paise / 100))
}

// ---------------------------------------------------------------------------
// Date formatter — "15 Mar 2026" display (Sacred Rule §17)
// ---------------------------------------------------------------------------
const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
})

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return dateFormatter.format(d)
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface border border-border text-ink-muted',
  final: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
  cancelled: 'bg-red-50 border border-red-200 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  final: 'Final',
  cancelled: 'Cancelled',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none',
        STATUS_STYLES[status] ?? STATUS_STYLES.draft,
      ].join(' ')}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function SalesInvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/en/sign-in')

  const { locale } = await params

  // Resolve business
  const [biz] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, session.user.id), isNull(businesses.deletedAt)))
    .limit(1)

  if (!biz) {
    return (
      <main className="min-h-screen bg-surface p-6">
        <div className="max-w-2xl mx-auto rounded-lg border border-border bg-raised p-10 flex flex-col items-center gap-4 text-center">
          <FileText className="h-10 w-10 text-ink-muted" strokeWidth={1.5} />
          <div className="space-y-1">
            <p className="font-medium text-ink">No business found</p>
            <p className="text-sm text-ink-muted">
              Create a business before you can manage invoices.
            </p>
          </div>
          <Button asChild>
            <Link href={`/${locale}/businesses/new`}>Create a business</Link>
          </Button>
        </div>
      </main>
    )
  }

  // Fetch invoices with party name join, newest first
  const rows = await db
    .select({
      id: salesInvoices.id,
      invoiceNumber: salesInvoices.invoiceNumber,
      invoiceDate: salesInvoices.invoiceDate,
      dueDate: salesInvoices.dueDate,
      status: salesInvoices.status,
      totalAmountPaise: salesInvoices.totalAmountPaise,
      partyName: parties.name,
      partyGstin: parties.externalGstin,
    })
    .from(salesInvoices)
    .leftJoin(parties, eq(salesInvoices.partyId, parties.id))
    .where(eq(salesInvoices.businessId, biz.id))
    .orderBy(desc(salesInvoices.createdAt))

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink">
              Sales Invoices
            </h1>
            {biz.name && <p className="text-sm text-ink-muted mt-0.5">{biz.name}</p>}
          </div>
          <Button asChild>
            <Link href={`/${locale}/sales/new`} className="flex items-center gap-1.5">
              <Plus size={16} strokeWidth={2} />
              Create Invoice
            </Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          /* ---- Empty state (Sacred Rule §20) ---- */
          <div className="rounded-lg border border-border bg-raised p-12 flex flex-col items-center gap-5 text-center">
            <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center">
              <FileText className="h-7 w-7 text-ink-muted" strokeWidth={1.5} />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <p className="font-semibold text-ink text-[16px]">No invoices yet</p>
              <p className="text-sm text-ink-muted">
                Create your first sales invoice to start tracking revenue and GST.
              </p>
            </div>
            <Button asChild>
              <Link href={`/${locale}/sales/new`}>Create your first invoice</Link>
            </Button>
          </div>
        ) : (
          /* ---- Invoice list ---- */
          <div className="rounded-lg border border-border bg-raised overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-4 px-5 py-3 border-b border-border bg-surface">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-[0.04em]">
                Invoice
              </span>
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-[0.04em]">
                Party
              </span>
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-[0.04em]">
                Date
              </span>
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-[0.04em] text-right">
                Amount
              </span>
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-[0.04em] text-center">
                Status
              </span>
              <span />
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {rows.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_40px] gap-1 sm:gap-4 sm:items-center px-5 py-4 hover:bg-surface transition-colors duration-[150ms]"
                >
                  <Link href={`/${locale}/sales/${inv.id}`} className="contents">
                    {/* Invoice number */}
                    <div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        {inv.invoiceNumber}
                      </span>
                    </div>

                    {/* Party */}
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{inv.partyName ?? '—'}</p>
                      {inv.partyGstin && (
                        <p className="text-xs text-ink-muted font-mono tabular-nums truncate">
                          {inv.partyGstin}
                        </p>
                      )}
                    </div>

                    {/* Date */}
                    <div>
                      <span className="text-sm text-ink-soft tabular-nums">
                        {formatDate(inv.invoiceDate)}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="sm:text-right">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {formatINR(inv.totalAmountPaise)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="sm:flex sm:justify-center">
                      <StatusPill status={inv.status} />
                    </div>
                  </Link>

                  {/* PDF download — outside the link to avoid nested <a> */}
                  <div className="hidden sm:flex items-center justify-center">
                    {inv.status === 'final' && (
                      <a
                        href={`/api/sales/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        title="Download PDF"
                        className="text-ink-muted hover:text-ink transition-colors duration-[150ms]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileDown size={15} strokeWidth={1.8} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-border bg-surface text-xs text-ink-muted">
              {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
