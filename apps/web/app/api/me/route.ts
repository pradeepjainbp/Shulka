import { auth } from '@/auth'
import { withErrorReporting } from '@/lib/with-error-reporting'
import { db } from '@shulka/db'
import { users } from '@shulka/db/schema'
import { MeResponseSchema } from '@shulka/shared-types'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const GET = withErrorReporting(async () => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const me = MeResponseSchema.parse({
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
  })

  return NextResponse.json(me)
})

const PatchMeSchema = z.object({
  role: z.enum(['business_owner', 'chartered_accountant']),
})

export const PATCH = withErrorReporting(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await req.json()
  const parsed = PatchMeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  await db
    .update(users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ role: parsed.data.role })
})
