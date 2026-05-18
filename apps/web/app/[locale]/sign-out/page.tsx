import { signOut } from '@/auth'

export default function SignOutPage() {
  return (
    <main className="min-h-screen bg-surface flex items-center justify-center">
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/en' })
        }}
      >
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
