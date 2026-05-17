import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const sql = neon(process.env['DATABASE_URL']!)
    const result = await sql`SELECT 1 AS ok`
    return NextResponse.json({ status: 'ok', db: result[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
