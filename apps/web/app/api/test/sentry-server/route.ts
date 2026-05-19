import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

// Only available in Playwright test runs (PLAYWRIGHT_TEST=true)
export async function GET() {
  if (process.env.PLAYWRIGHT_TEST !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const err = new Error('[Shulka] Sentry server-side test error from withErrorReporting')
  Sentry.captureException(err)
  await Sentry.flush(2000)

  return NextResponse.json({ captured: true })
}
