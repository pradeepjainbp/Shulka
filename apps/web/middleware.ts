/// <reference types="@cloudflare/workers-types" />

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { type NextRequest, NextResponse } from 'next/server'

const locales = ['en']
const defaultLocale = 'en'

// In-memory fallback for local dev (no KV available)
const memRateLimit = new Map<string, { count: number; resetAt: number }>()

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  let kv: KVNamespace | null = null

  try {
    const ctx = getCloudflareContext()
    kv = (ctx.env as Record<string, KVNamespace>).NEXT_CACHE_WORKERS_KV ?? null
  } catch {
    // local dev — no CF context
  }

  if (kv) {
    const raw = await kv.get(`rl:${key}`)
    const entry = raw ? (JSON.parse(raw) as { count: number; resetAt: number }) : null
    if (entry && entry.resetAt > now) {
      if (entry.count >= limit) return false
      await kv.put(
        `rl:${key}`,
        JSON.stringify({ count: entry.count + 1, resetAt: entry.resetAt }),
        {
          expirationTtl: Math.ceil((entry.resetAt - now) / 1000),
        },
      )
    } else {
      await kv.put(`rl:${key}`, JSON.stringify({ count: 1, resetAt: now + windowMs }), {
        expirationTtl: Math.ceil(windowMs / 1000),
      })
    }
    return true
  }

  // in-memory fallback
  const entry = memRateLimit.get(key)
  if (entry && entry.resetAt > now) {
    if (entry.count >= limit) return false
    memRateLimit.set(key, { count: entry.count + 1, resetAt: entry.resetAt })
  } else {
    memRateLimit.set(key, { count: 1, resetAt: now + windowMs })
  }
  return true
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit: magic-link sign-in POST
  if (request.method === 'POST' && pathname === '/api/auth/signin/resend') {
    const body = await request.clone().text()
    const params = new URLSearchParams(body)
    const email = params.get('email') ?? ''
    const ip =
      request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'

    const [emailOk, ipOk] = await Promise.all([
      checkRateLimit(`email:${email}`, 5, 60 * 60 * 1000),
      checkRateLimit(`ip:${ip}`, 20, 60 * 60 * 1000),
    ])

    if (!emailOk || !ipOk) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in an hour.' },
        { status: 429 },
      )
    }
  }

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Locale redirect
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )
  if (pathnameHasLocale) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
}
