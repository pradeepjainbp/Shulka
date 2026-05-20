import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { businesses, db } from '@shulka/db'
import { and, count, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/en/sign-in')

  const roleLabel =
    session.user.role === 'chartered_accountant' ? 'Chartered Accountant' : 'Business Owner'

  const countResult = await db
    .select({ value: count() })
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, session.user.id), isNull(businesses.deletedAt)))

  const bizCount = countResult[0]?.value ?? 0

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">
            Welcome{session.user.name ? `, ${session.user.name}` : ''}
          </h1>
          <p className="text-sm text-ink-muted">
            Signed in as <span className="text-ink font-medium">{session.user.email}</span> &middot;{' '}
            {roleLabel}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">My Businesses</h2>
            {bizCount > 0 && (
              <Link href="/en/businesses" className="text-sm text-primary hover:underline">
                View all
              </Link>
            )}
          </div>

          {bizCount === 0 ? (
            <div className="rounded-lg border border-border bg-raised p-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-ink-muted">You haven&apos;t added a business yet.</p>
              <Button asChild size="sm">
                <Link href="/en/businesses/new">Create your first business</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-raised p-4">
              <p className="text-sm text-ink">
                You have <span className="font-semibold tabular-nums">{bizCount}</span>{' '}
                {bizCount === 1 ? 'business' : 'businesses'} on Shulka.
              </p>
              <Link
                href="/en/businesses"
                className="text-sm text-primary hover:underline mt-1 inline-block"
              >
                Manage businesses →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
