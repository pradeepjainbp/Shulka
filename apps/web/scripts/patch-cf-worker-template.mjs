import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Walk up to find the pnpm store entry for @opennextjs/cloudflare
function findTemplate(dir, depth = 0) {
  if (depth > 6) return null
  const pnpmStore = path.join(dir, 'node_modules/.pnpm')
  try {
    const entries = readdirSync(pnpmStore)
    const match = entries.find((e) => e.startsWith('@opennextjs+cloudflare@'))
    if (match) {
      const candidate = path.join(pnpmStore, match, 'node_modules/@opennextjs/cloudflare/dist/cli/templates/worker.js')
      try { statSync(candidate); return candidate } catch {}
    }
  } catch {}
  return findTemplate(path.dirname(dir), depth + 1)
}

const templatePath = findTemplate(__dirname)
if (!templatePath) {
  console.error('patch-cf-worker-template: could not locate @opennextjs/cloudflare worker template')
  process.exit(1)
}

const src = readFileSync(templatePath, 'utf-8')

const TARGET = 'const url = new URL(request.url);'
const PATCH = `const url = new URL(request.url);
            // Serve Next.js static assets via CF Pages ASSETS binding (Advanced Mode)
            if (env.ASSETS) {
              const staticPrefixes = ['/_next/static/', '/_next/image/', '/favicon']
              if (staticPrefixes.some((p) => url.pathname.startsWith(p))) {
                const assetRes = await env.ASSETS.fetch(request)
                if (assetRes.status !== 404) return assetRes
              }
            }`

if (src.includes(PATCH)) {
  console.info('patch-cf-worker-template: already patched, skipping.')
  process.exit(0)
}

if (!src.includes(TARGET)) {
  console.error('patch-cf-worker-template: target string not found — OpenNext version changed?')
  process.exit(1)
}

writeFileSync(templatePath, src.replace(TARGET, PATCH))
console.info('patch-cf-worker-template: added env.ASSETS static serving to OpenNext worker template ✓')
