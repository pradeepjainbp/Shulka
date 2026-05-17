import path from 'path'
import type { NextConfig } from 'next'

// Both turbopack.root and outputFileTracingRoot must match in a monorepo.
// The Vercel build system (used by @cloudflare/next-on-pages) sets
// outputFileTracingRoot to apps/web — we override both to the monorepo root.
const monorepoRoot = path.resolve(__dirname, '../..')

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
}

export default nextConfig
