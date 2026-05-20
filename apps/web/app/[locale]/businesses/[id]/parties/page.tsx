import { auth } from '@/auth'
import { PartyList } from '@/components/PartyList'
import { Button } from '@/components/ui/button'
import { businesses, db, parties } from '@shulka/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type Props = { params: Promise<{ id: string }> }

export default async function PartiesPage({ params }: Props) {
  const [session, { id }] = await Promise.all([auth(), params])
  if (!session) redirect('/en/sign-in')

  const [biz] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, id),
        eq(businesses.ownerUserId, session.user.id),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1)

  if (!biz) redirect('/en/businesses')

  const rows = await db
    .select({
      id: parties.id,
      name: parties.name,
      legalName: parties.legalName,
      externalGstin: parties.externalGstin,
      linkedBusinessId: parties.linkedBusinessId,
      phone: parties.phone,
      email: parties.email,
      partyKind: parties.partyKind,
    })
    .from(parties)
    .where(and(eq(parties.businessId, id), isNull(parties.deletedAt)))
    .orderBy(desc(parties.createdAt))

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href="/en/businesses"
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            ← Back to Businesses
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <h1 className="text-2xl font-semibold text-ink truncate">Parties</h1>
            <p className="text-sm text-ink-muted truncate">{biz.name}</p>
          </div>
          <Button asChild size="sm">
            <Link href={`/en/businesses/${id}/parties/new`}>Add Party</Link>
          </Button>
        </div>

        <PartyList parties={rows} businessId={id} />
      </div>
    </main>
  )
}
