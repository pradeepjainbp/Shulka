export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

// Sentry disabled — re-enable when upgrading to Workers Paid plan
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
