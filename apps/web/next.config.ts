import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Turbopack to resolve workspace packages outside apps/web/
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
}

export default nextConfig
