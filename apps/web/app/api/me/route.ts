import { auth } from '@/auth'
import { db } from '@shulka/db'
import { users } from '@shulka/db/schema'
import { MeResponseSchema } from '@shulka/shared-types'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
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
    role: user.role,
  })

  return NextResponse.json(me)
}
