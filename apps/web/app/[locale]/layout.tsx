import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Toaster } from 'sonner'

const locales = ['en']

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale)) notFound()
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={messages}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'bg-raised border border-border text-ink shadow-md',
            success: 'border-l-4 border-l-success',
            error: 'border-l-4 border-l-error',
            warning: 'border-l-4 border-l-warning',
          },
        }}
      />
    </NextIntlClientProvider>
  )
}
