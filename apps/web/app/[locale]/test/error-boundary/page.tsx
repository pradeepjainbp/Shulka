'use client'

import { useEffect, useState } from 'react'

// Only throws in Playwright test runs (NEXT_PUBLIC_PLAYWRIGHT_TEST=true)
export default function ErrorBoundaryTestPage() {
  const [shouldThrow, setShouldThrow] = useState(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true') {
      setShouldThrow(true)
    }
  }, [])

  if (shouldThrow) {
    throw new Error('[Shulka] Test error to trip the React error boundary')
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-ink-muted text-sm">Error boundary test page (inactive outside tests)</p>
    </div>
  )
}
