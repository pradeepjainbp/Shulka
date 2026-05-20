export const dynamic = 'force-dynamic'

import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db, parties } from '@shulka/db'
import { isValidGstin } from '@shulka/gst-engine'
import { PartyResponseSchema } from '@shulka/shared-types'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PatchPartySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional(),
  externalGstin: z.string().refine(isValidGstin, { message: 'Invalid GSTIN' }).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.object({ text: z.string().max(500) }).optional(),
  partyKind: z.enum(['customer', 'supplier', 'both']).optional(),
})

type RouteContext = { params: Promise<{ id: string; partyId: string }> }

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

export const GET = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id, partyId } = await (ctx as RouteContext).params

  const biz = await getOwnedBusiness(id, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const [row] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, partyId), eq(parties.businessId, id), isNull(parties.deletedAt)))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 })
  }

  return NextResponse.json(toPartyResponse(row))
})

export const PATCH = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id, partyId } = await (ctx as RouteContext).params

  const biz = await getOwnedBusiness(id, userId)
  if (!biz) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Verify party belongs to this business and is not deleted
  const [existing] = await db
    .select()
    .from(parties)
    .where(and(eq(parties.id, partyId), eq(parties.businessId, id), isNull(parties.deletedAt)))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Party not found' }, { status: 404 })
  }

  const body: unknown = await req.json()
  const parsed = PatchPartySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  // Re-run network-effect discovery if externalGstin is being updated
  let linkedBusinessId: string | null | undefined
  if ('externalGstin' in data) {
    if (data.externalGstin) {
      const [linked] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.gstin, data.externalGstin), isNull(businesses.deletedAt)))
        .limit(1)
      linkedBusinessId = linked?.id ?? null
    } else {
      linkedBusinessId = null
    }
  }

  const updateValues: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  }
  if (linkedBusinessId !== undefined) {
    updateValues.linkedBusinessId = linkedBusinessId
  }

  const updated = await db
    .update(parties)
    .set(updateValues)
    .where(eq(parties.id, partyId))
    .returning()

  const row = updated[0]
  if (!row) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json(toPartyResponse(row))
})
