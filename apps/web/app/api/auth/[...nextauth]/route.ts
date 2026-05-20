export const dynamic = 'force-dynamic'

import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { handlers } = await import('@/auth')
    return await handlers.GET(req)
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack}` : String(err)
    return new Response(msg, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { handlers } = await import('@/auth')
    return await handlers.POST(req)
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack}` : String(err)
    return new Response(msg, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
