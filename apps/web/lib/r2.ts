/**
 * r2.ts — Cloudflare R2 bucket accessor.
 *
 * Returns null in local dev (where getCloudflareContext throws) so callers can
 * degrade gracefully: PDF bytes are returned directly without R2 caching.
 */

import type { R2Bucket } from '@cloudflare/workers-types'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getInvoiceBucket(): Promise<R2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true })
    return ((env as Record<string, unknown>).INVOICE_PDFS as R2Bucket) ?? null
  } catch {
    return null
  }
}
