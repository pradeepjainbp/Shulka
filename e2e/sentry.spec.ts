import { expect, test } from '@playwright/test'

test.describe('Sentry error reporting — trip the boundary', () => {
  test('client ErrorBoundary catches render error and shows fallback', async ({ page }) => {
    await page.goto('/en/test/error-boundary')
    // ErrorBoundary should intercept the thrown render error and display fallback UI
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 10000 })
    // Confirm "Try again" button is present (part of the fallback)
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('server route captures exception via Sentry.captureException', async ({ request }) => {
    const res = await request.get('/api/test/sentry-server')
    expect(res.status()).toBe(200)
    const json = (await res.json()) as { captured: boolean }
    expect(json.captured).toBe(true)
  })
})
