import { getLastMagicLinkUrl } from '@/auth'
import { NextResponse } from 'next/server'

export function GET() {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const url = getLastMagicLinkUrl()
  if (!url) {
    return NextResponse.json({ error: 'No magic link yet' }, { status: 404 })
  }
  return NextResponse.json({ url })
}
