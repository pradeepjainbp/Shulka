import * as Sentry from '@sentry/nextjs'
import type { NextRequest } from 'next/server'

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<Response>

export function withErrorReporting(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      Sentry.captureException(err)
      await Sentry.flush(2000)
      throw err
    }
  }
}
