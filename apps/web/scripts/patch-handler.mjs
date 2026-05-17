/**
 * Post-build patch for OpenNext on Cloudflare Pages.
 *
 * Next.js 16 added a direct `require(this.middlewareManifestPath)` call in
 * `getMiddlewareManifest()`. That bypasses OpenNext's loadManifest patch
 * (which inlines JSON) and hits the CF Workers dynamic-require guard instead,
 * causing an "Internal Server Error" on every request.
 *
 * Fix: replace the dynamic require with the manifest JSON inlined at build time.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const HANDLER = '.open-next/server-functions/default/apps/web/handler.mjs'
const MANIFEST = '.open-next/server-functions/default/apps/web/.next/server/middleware-manifest.json'

const handler = readFileSync(HANDLER, 'utf-8')
const manifest = JSON.stringify(JSON.parse(readFileSync(MANIFEST, 'utf-8')))

const PATTERN = 'getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}'
const REPLACEMENT = `getMiddlewareManifest(){return this.minimalMode?null:${manifest}}`

if (!handler.includes(PATTERN)) {
  console.error('patch-handler: pattern not found — OpenNext may have changed its output. Check the patch.')
  process.exit(1)
}

writeFileSync(HANDLER, handler.replace(PATTERN, REPLACEMENT))
console.log('patch-handler: inlined middleware-manifest.json into getMiddlewareManifest ✓')
