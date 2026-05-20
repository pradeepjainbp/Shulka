import { HsnSearchDemo } from '@/components/HsnSearchDemo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HSN / SAC Code Search — Shulka',
  description:
    'Search Harmonized System (HSN) and Service Accounting Codes (SAC) used in GST invoicing.',
}

export default function HsnPage() {
  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">HSN / SAC Code Search</h1>
          <p className="text-sm text-ink-muted">
            Search Harmonized System (HSN) and Service Accounting Codes (SAC) used in GST invoicing.
          </p>
        </div>
        <HsnSearchDemo />
      </div>
    </main>
  )
}
