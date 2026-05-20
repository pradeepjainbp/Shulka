import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { businesses, db } from '@shulka/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const TYPE_LABELS: Record<string, string> = {
  proprietorship: 'Proprietorship',
  partnership: 'Partnership',
  llp: 'LLP',
  pvt_ltd: 'Pvt Ltd',
  public_ltd: 'Public Ltd',
  huf: 'HUF',
  other: 'Other',
}

const STATE_NAMES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
}

export default async function BusinessesPage() {
  const session = await auth()
  if (!session) redirect('/en/sign-in')

  const rows = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, session.user.id), isNull(businesses.deletedAt)))
    .orderBy(desc(businesses.createdAt))

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">My Businesses</h1>
          <Button asChild size="sm">
            <Link href="/en/businesses/new">Add Business</Link>
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-raised p-12 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center text-3xl">
              🏢
            </div>
            <div className="space-y-1">
              <p className="font-medium text-ink">No businesses yet</p>
              <p className="text-sm text-ink-muted">
                Add your first business to start managing GST and invoices.
              </p>
            </div>
            <Button asChild>
              <Link href="/en/businesses/new">Add Business</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((biz) => (
              <div
                key={biz.id}
                className="bg-raised border border-border rounded-lg p-4 flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink truncate">{biz.name}</p>
                    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted border border-border shrink-0">
                      {TYPE_LABELS[biz.type] ?? biz.type}
                    </span>
                  </div>
                  {biz.gstin && (
                    <p className="text-sm text-ink-muted font-mono tabular-nums">{biz.gstin}</p>
                  )}
                  {biz.stateCode && (
                    <p className="text-xs text-ink-muted">
                      {STATE_NAMES[biz.stateCode] ?? biz.stateCode}
                    </p>
                  )}
                </div>
                <Link
                  href={`/en/businesses/${biz.id}/edit`}
                  className="text-sm text-primary hover:underline shrink-0 mt-0.5"
                >
                  Edit
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
