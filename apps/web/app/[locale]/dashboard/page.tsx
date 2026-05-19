import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/en/sign-in')

  const roleLabel =
    session.user.role === 'chartered_accountant' ? 'Chartered Accountant' : 'Business Owner'

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold text-ink">
          Welcome{session.user.name ? `, ${session.user.name}` : ''}
        </h1>
        <p className="text-sm text-ink-muted">
          Signed in as <span className="text-ink font-medium">{session.user.email}</span> &middot;{' '}
          {roleLabel}
        </p>
        <div className="rounded-lg border border-border bg-raised p-6 text-center text-ink-muted text-sm">
          Dashboard coming soon — Phase 1 in progress.
        </div>
      </div>
    </main>
  )
}
