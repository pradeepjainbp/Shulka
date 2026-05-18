'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await signIn('resend', { email, redirect: false })
    setSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-ink">Sign in to Shulka</h1>
          <p className="text-sm text-ink-muted">GST + Finance for Indian MSMEs</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-raised p-4 text-center space-y-2">
            <p className="text-sm font-medium text-ink">Check your email</p>
            <p className="text-sm text-ink-muted">We sent a sign-in link to {email}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => signIn('google', { callbackUrl: '/en' })}
            >
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-ink-muted">or</span>
              </div>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
