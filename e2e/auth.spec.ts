import { expect, test } from '@playwright/test'

// Requires live DATABASE_URL + AUTH_SECRET + RESEND_API_KEY — not available in CI without secrets
test.describe('magic-link auth flow', () => {
  test.skip(
    !process.env.DATABASE_URL,
    'Skipped: DATABASE_URL not set (add GitHub secret to enable)',
  )

  test('signs in via magic link, /me returns user, sign-out returns 401', async ({
    page,
    request,
  }) => {
    // 1. Go to sign-in page
    await page.goto('/en/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to Shulka' })).toBeVisible()

    // 2. Submit email
    const testEmail = 'playwright-test@example.com'
    await page.getByPlaceholder('you@example.com').fill(testEmail)
    await page.getByRole('button', { name: 'Send magic link' }).click()

    // 3. Wait for "Check your email" confirmation (magic-link send may take up to 15s on cold DB)
    await expect(page.getByText('Check your email')).toBeVisible({ timeout: 15000 })

    // 4. Get the magic link URL from the test endpoint
    // Use the standalone request context (no auth needed for this endpoint)
    let magicUrl: string | null = null
    for (let i = 0; i < 10; i++) {
      const res = await request.get('/api/test/magic-link')
      if (res.ok()) {
        const json = (await res.json()) as { url: string }
        magicUrl = json.url
        break
      }
      await page.waitForTimeout(300)
    }
    expect(magicUrl).not.toBeNull()
    if (!magicUrl) throw new Error('Magic link URL was not captured')

    // 5. Navigate to the magic link to complete sign-in (uses page cookie store)
    await page.goto(magicUrl)

    // 6. Should be redirected to /en after sign-in
    await page.waitForURL(/\/en/)

    // 7. Assert /api/me returns the user using page.request (shares cookies with page)
    const meRes = await page.request.get('/api/me')
    expect(meRes.status()).toBe(200)
    const me = (await meRes.json()) as { email: string; id: string }
    expect(me.email).toBe(testEmail)
    expect(me.id).toBeTruthy()

    // 8. Sign out via the sign-out page (server action handles CSRF correctly)
    await page.goto('/en/sign-out')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/en$/, { timeout: 10000 })

    // 9. Assert /api/me returns 401
    const meAfterSignout = await page.request.get('/api/me')
    expect(meAfterSignout.status()).toBe(401)
  })
})
