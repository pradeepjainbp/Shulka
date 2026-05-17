/**
 * Pre-build patch for OpenNext on Cloudflare Pages.
 *
 * Next.js 16 uses a direct require() in getMiddlewareManifest() instead of
 * loadManifest(). In CF Workers dynamic require() throws at runtime.
 *
 * Fix: patch next-server.js to call _loadmanifestexternal.loadManifest()
 * (which OpenNext already inlines at build time) instead of require().
 * This runs BEFORE opennextjs-cloudflare build so OpenNext bundles the fixed code.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const NEXT_SERVER = 'node_modules/next/dist/server/next-server.js'

const src = readFileSync(NEXT_SERVER, 'utf-8')

const PATTERN = /const manifest = require\(this\.middlewareManifestPath\);/g

if (!PATTERN.test(src)) {
  console.log('patch-handler: require(this.middlewareManifestPath) not found — already patched or Next.js changed. Skipping.')
  process.exit(0)
}

PATTERN.lastIndex = 0
const patched = src.replace(PATTERN, 'const manifest = (0, _loadmanifestexternal.loadManifest)(this.middlewareManifestPath);')

writeFileSync(NEXT_SERVER, patched)
console.log('patch-handler: patched getMiddlewareManifest in next-server.js to use loadManifest ✓')
