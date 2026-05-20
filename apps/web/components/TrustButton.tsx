'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface TrustButtonProps {
  invoiceId: string
  businessId: string
  senderName: string
}

export function TrustButton({ invoiceId, businessId, senderName }: TrustButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAccept() {
    setLoading(true)
    try {
      const res = await fetch(`/api/incoming/${invoiceId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId }),
      })

      if (res.ok) {
        toast.success(`Trusted ${senderName} — invoices added to your books`)
        router.refresh()
        return
      }

      if (res.status === 422) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        // Surface the 422 message if present, else fall back to the standard copy
        const msg =
          typeof data.error === 'string' && data.error.length > 0
            ? data.error
            : 'Add this supplier to your directory first'
        toast.error(msg)
        return
      }

      toast.error('Something went wrong. Please try again.')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAccept}
      disabled={loading}
      className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
      size="sm"
    >
      {loading ? 'Accepting…' : 'Trust Supplier & Accept'}
    </Button>
  )
}
