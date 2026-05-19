'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Role = 'business_owner' | 'chartered_accountant'

const ROLES: { id: Role; title: string; description: string }[] = [
  {
    id: 'business_owner',
    title: 'Business Owner',
    description: 'Manage GST, invoices, and finances for your business.',
  },
  {
    id: 'chartered_accountant',
    title: 'Chartered Accountant',
    description: 'Handle GST compliance and filings for multiple clients.',
  },
]

export default function RoleSelectionPage() {
  const router = useRouter()
  const { update } = useSession()
  const [selected, setSelected] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    if (!selected) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selected }),
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Refresh the JWT so the new role is reflected in session.user.role
    await update({ role: selected })
    router.push('/en/dashboard')
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-ink">How do you use Shulka?</h1>
          <p className="text-sm text-ink-muted">Choose your role to personalise your experience.</p>
        </div>

        <div className="space-y-3">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelected(role.id)}
              className={[
                'w-full text-left p-4 rounded-lg border-2 transition-colors',
                selected === role.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-raised hover:border-primary/40',
              ].join(' ')}
            >
              <p className="font-medium text-ink">{role.title}</p>
              <p className="text-sm text-ink-muted mt-0.5">{role.description}</p>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-error text-center">{error}</p>}

        <button
          type="button"
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full py-2.5 px-4 rounded-md bg-primary text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </main>
  )
}
