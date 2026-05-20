import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// DISABLED (bundle size): next-pwa and Sentry removed to stay under CF free-tier
// 3 MiB worker limit. Re-enable both when upgrading to Workers Paid plan.
// withPWAInit + withSentryConfig imports removed intentionally.

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      '@shulka/rules': path.resolve(__dirname, '../../rules'),
    }
    return config
  },
}

export default withNextIntl(nextConfig)
