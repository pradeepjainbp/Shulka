import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db } from '@shulka/db'
import { isValidGstin } from '@shulka/gst-engine'
import { BusinessResponseSchema } from '@shulka/shared-types'
import { and, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const PatchBusinessSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional(),
  gstin: z.string().refine(isValidGstin, { message: 'Invalid GSTIN' }).optional(),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN')
    .optional(),
  stateCode: z.string().length(2).optional(),
  address: z.object({ text: z.string().max(500) }).optional(),
  registrationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .optional(),
  type: z
    .enum(['proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd', 'huf', 'other'])
    .optional(),
  compositionScheme: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export const GET = withErrorReporting(async (_req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  const [row] = await db
    .select()
    .from(businesses)
    .where(
      and(eq(businesses.id, id), eq(businesses.ownerUserId, userId), isNull(businesses.deletedAt)),
    )
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const response = BusinessResponseSchema.parse({
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    legalName: row.legalName ?? null,
    gstin: row.gstin ?? null,
    pan: row.pan ?? null,
    stateCode: row.stateCode ?? null,
    address: (row.address as { text: string } | null) ?? null,
    registrationDate: row.registrationDate ?? null,
    type: row.type,
    compositionScheme: row.compositionScheme,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

  return NextResponse.json(response)
})

export const PATCH = withErrorReporting(async (req: NextRequest, ctx: unknown) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const { id } = await (ctx as RouteContext).params

  // Verify ownership before accepting the body
  const [existing] = await db
    .select()
    .from(businesses)
    .where(
      and(eq(businesses.id, id), eq(businesses.ownerUserId, userId), isNull(businesses.deletedAt)),
    )
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const body: unknown = await req.json()
  const parsed = PatchBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  const updated = await db
    .update(businesses)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, id))
    .returning()
  const row = updated[0]
  if (!row) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  const response = BusinessResponseSchema.parse({
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    legalName: row.legalName ?? null,
    gstin: row.gstin ?? null,
    pan: row.pan ?? null,
    stateCode: row.stateCode ?? null,
    address: (row.address as { text: string } | null) ?? null,
    registrationDate: row.registrationDate ?? null,
    type: row.type,
    compositionScheme: row.compositionScheme,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

  return NextResponse.json(response)
})
