import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { businesses, db } from '@shulka/db'
import { BusinessResponseSchema } from '@shulka/shared-types'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function validateGstin(gstin: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let val = CHARSET.indexOf(gstin.charAt(i))
    if ((i + 1) % 2 === 0) val *= 2
    sum += Math.floor(val / 36) + (val % 36)
  }
  return gstin[14] === CHARSET[(36 - (sum % 36)) % 36]
}

const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  gstin: z.string().refine(validateGstin, { message: 'Invalid GSTIN' }).optional(),
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
    .default('proprietorship'),
  compositionScheme: z.boolean().default(false),
})

export const GET = withErrorReporting(async () => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const rows = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.ownerUserId, userId), isNull(businesses.deletedAt)))
    .orderBy(desc(businesses.createdAt))

  const result = rows.map((row) =>
    BusinessResponseSchema.parse({
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
    }),
  )

  return NextResponse.json(result)
})

export const POST = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const body: unknown = await req.json()
  const parsed = CreateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const data = parsed.data

  const inserted = await db
    .insert(businesses)
    .values({
      ownerUserId: userId,
      name: data.name,
      legalName: data.legalName ?? null,
      gstin: data.gstin ?? null,
      pan: data.pan ?? null,
      stateCode: data.stateCode ?? null,
      address: data.address ?? null,
      registrationDate: data.registrationDate ?? null,
      type: data.type,
      compositionScheme: data.compositionScheme,
    })
    .returning()
  const row = inserted[0]
  if (!row) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

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

  return NextResponse.json(response, { status: 201 })
})
