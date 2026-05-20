export const dynamic = 'force-dynamic'

import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = process.env.DATABASE_URL
    if (!url)
      return NextResponse.json(
        { status: 'error', message: 'DATABASE_URL not set' },
        { status: 500 },
      )
    const sql = neon(url)
    const result = await sql`SELECT 1 AS ok`
    return NextResponse.json({ status: 'ok', db: result[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
