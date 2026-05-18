import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@shulka/db'
import { accounts, users, verificationTokens } from '@shulka/db/schema'
import NextAuth, { type NextAuthResult } from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'

// In test mode, capture the last magic link URL instead of sending email.
// Use globalThis so the value is shared across all Next.js route module instances
// in the same Node.js process (module isolation would otherwise prevent sharing).
declare global {
  var __playwrightLastMagicLinkUrl: string | null
}
globalThis.__playwrightLastMagicLinkUrl = globalThis.__playwrightLastMagicLinkUrl ?? null

export function getLastMagicLinkUrl() {
  return globalThis.__playwrightLastMagicLinkUrl
}

const result: NextAuthResult = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.RESEND_FROM ?? 'noreply@pradeepjainbp.in',
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        if (process.env.PLAYWRIGHT_TEST === 'true') {
          globalThis.__playwrightLastMagicLinkUrl = url
          return
        }
        const { Resend: ResendClient } = await import('resend')
        const client = new ResendClient(provider.apiKey)
        await client.emails.send({
          from: provider.from as string,
          to: identifier,
          subject: 'Sign in to Shulka',
          html: `<p>Click <a href="${url}">here</a> to sign in to Shulka.</p><p>Link expires in 10 minutes.</p>`,
        })
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/en/sign-in',
  },
})

export const { handlers, signIn, signOut, auth } = result
