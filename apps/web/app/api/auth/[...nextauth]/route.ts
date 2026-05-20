export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'

type NextAuthCtx = { params: Promise<{ nextauth: string[] }> }

export async function GET(req: NextRequest, ctx: NextAuthCtx) {
  const { handlers } = await import('@/auth')
  return handlers.GET(req, ctx as never)
}

export async function POST(req: NextRequest, ctx: NextAuthCtx) {
  const { handlers } = await import('@/auth')
  return handlers.POST(req, ctx as never)
}
