export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db, parties, recordEvent } from '@shulka/db'
import { isValidGstin } from '@shulka/gst-engine'
import { PartyResponseSchema } from '@shulka/shared-types'
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CreatePartySchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  externalGstin: z.string().refine(isValidGstin, { message: 'Invalid GSTIN' }).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.object({ text: z.string().max(500) }).optional(),
  partyKind: z.enum(['customer', 'supplier', 'both']).default('both'),
})

type RouteContext = { params: Promise<{ id: string }> }

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

function toPartyResponse(row: {
  id: string
  businessId: string
  name: string
  legalName: string | null
  externalGstin: string | null
  linkedBusinessId: string | null
  phone: string | null
  email: string | null
  address: unknown
  partyKind: 'customer' | 'supplier' | 'both'
  createdAt: Date
  updatedAt: Date
}) {
  return PartyResponseSchema.parse({
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    legalName: row.legalName ?? null,
    externalGstin: row.externalGstin ?? null,
    linkedBusinessId: row.linkedBusinessId ?? null,
    isOnShulka: row.linkedBusinessId !== null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: (row.address as { text: string } | null) ?? null,
    partyKind: row.partyKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

export const GET = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  const biz = await getOwnedBusiness(id, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const q = req.nextUrl.searchParams.get('q')

  const baseCondition = and(eq(parties.businessId, id), isNull(parties.deletedAt))
  const whereClause =
    q !== null && q.length > 0
      ? and(
          baseCondition,
          or(ilike(parties.name, `%${q}%`), ilike(parties.externalGstin, `%${q}%`)),
        )
      : baseCondition

  const rows = await db.select().from(parties).where(whereClause).orderBy(desc(parties.createdAt))

  return NextResponse.json(rows.map(toPartyResponse))
})

export const POST = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  const biz = await getOwnedBusiness(id, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const body: unknown = await req.json()
  const parsed = CreatePartySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  // Network-effect discovery: find if the external GSTIN belongs to another Shulka business
  let linkedBusinessId: string | null = null
  if (data.externalGstin) {
    const [linked] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.gstin, data.externalGstin), isNull(businesses.deletedAt)))
      .limit(1)
    linkedBusinessId = linked?.id ?? null
  }

  const inserted = await db
    .insert(parties)
    .values({
      businessId: id,
      name: data.name,
      legalName: data.legalName ?? null,
      externalGstin: data.externalGstin ?? null,
      linkedBusinessId,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      partyKind: data.partyKind,
    })
    .returning()

  const row = inserted[0]
  if (!row) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  await recordEvent({
    actorUserId: userId,
    businessId: id,
    kind: 'party.created',
    refTable: 'parties',
    refId: row.id,
    payload: {
      fields_changed: Object.keys(data).filter((k) => data[k as keyof typeof data] !== undefined),
    },
  })

  return NextResponse.json(toPartyResponse(row), { status: 201 })
})
