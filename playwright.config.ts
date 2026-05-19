import { readdirSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const hasTests = (() => {
  try {
    return readdirSync('./e2e').some((f) => f.endsWith('.ts') || f.endsWith('.js'))
  } catch {
    return false
  }
})()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(hasTests && {
    webServer: {
      command: 'pnpm --filter @shulka/web exec next dev --webpack',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PLAYWRIGHT_TEST: 'true', NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true' },
    },
  }),
})
