import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// next-pwa ships no type declarations; use require to avoid TS error
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWAInit = require('next-pwa') as (
  opts: Record<string, unknown>,
) => (cfg: NextConfig) => NextConfig

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig: NextConfig = {}

export default withPWA(withNextIntl(nextConfig))
