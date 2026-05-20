import { auth } from '@/auth'
import { SalesInvoiceForm } from '@/components/SalesInvoiceForm'
import { businesses, db, parties } from '@shulka/db'
import { and, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'New Sales Invoice — Shulka',
}

export default async function NewSalesInvoicePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/en/sign-in')

  const { locale } = await params

  // Single-business assumption for P2-01; multi-business in a future phase
  const [biz] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, session.user.id), isNull(businesses.deletedAt)))
    .limit(1)

  if (!biz) {
    return (
      <main className="min-h-screen bg-surface p-6">
        <div className="max-w-lg mx-auto rounded-lg border border-border bg-raised p-10 flex flex-col items-center gap-4 text-center">
          <p className="text-ink font-medium">No business found</p>
          <p className="text-sm text-ink-muted">
            You need to create a business before you can raise invoices.
          </p>
          <Link
            href={`/${locale}/businesses/new`}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary700 transition-colors duration-[150ms]"
          >
            Create a business
          </Link>
        </div>
      </main>
    )
  }

  // Fetch all parties for the party selector — customers and both-kind parties.
  // stateCode is not stored separately; UI derives it from the first 2 chars of externalGstin.
  const partyRows = await db
    .select({
      id: parties.id,
      name: parties.name,
      externalGstin: parties.externalGstin,
    })
    .from(parties)
    .where(and(eq(parties.businessId, biz.id), isNull(parties.deletedAt)))
    .orderBy(parties.name)

  return (
    <main className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Link
            href={`/${locale}/sales`}
            className="hover:text-ink transition-colors duration-[150ms]"
          >
            Sales
          </Link>
          <span>/</span>
          <span className="text-ink">New Invoice</span>
        </nav>

        <div className="flex items-center justify-between">
          <h1 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink">
            New Sales Invoice
          </h1>
          {biz.name && <span className="text-sm text-ink-muted">{biz.name}</span>}
        </div>

        <SalesInvoiceForm
          businessId={biz.id}
          businessStateCode={biz.stateCode ?? null}
          parties={partyRows}
          locale={locale}
        />
      </div>
    </main>
  )
}
