import { withSentryConfig } from '@sentry/nextjs'
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

const combinedConfig = withPWA(withNextIntl(nextConfig))

export default withSentryConfig(combinedConfig, {
  // org + project auto-read from SENTRY_ORG / SENTRY_PROJECT env vars
  // Only log Sentry build output in CI
  silent: !process.env.CI,
  // Upload wider set of source files so traces map correctly
  widenClientFileUpload: true,
  // Source maps are deleted after upload by default in v10
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  telemetry: false,
  webpack: { automaticVercelMonitors: false },
})
