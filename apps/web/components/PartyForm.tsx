'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isValidGstin } from '@shulka/gst-engine'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = { businessId: string }

export function PartyForm({ businessId }: Props) {
  const router = useRouter()

  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [partyKind, setPartyKind] = useState<'customer' | 'supplier' | 'both' | ''>('')
  const [gstin, setGstin] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shulkaMatch, setShulkaMatch] = useState(false)

  const gstinValid = gstin.length === 15 && isValidGstin(gstin)
  const gstinInvalid = gstin.length >= 15 && !gstinValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setShulkaMatch(false)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!partyKind) {
      setError('Party type is required.')
      return
    }

    setLoading(true)

    const body: Record<string, unknown> = {
      name: name.trim(),
      partyKind,
    }
    if (legalName.trim()) body.legalName = legalName.trim()
    if (gstin) body.externalGstin = gstin
    if (phone.trim()) body.phone = phone.trim()
    if (email.trim()) body.email = email.trim()
    if (address.trim()) body.address = { text: address.trim() }

    const res = await fetch(`/api/businesses/${businessId}/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string
        details?: unknown
      } | null
      setError(data?.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    const created = (await res.json()) as { linkedBusinessId: string | null }
    if (created.linkedBusinessId) {
      setShulkaMatch(true)
      setTimeout(() => {
        router.push(`/en/businesses/${businessId}/parties`)
      }, 1800)
    } else {
      router.push(`/en/businesses/${businessId}/parties`)
    }
  }

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link
            href={`/en/businesses/${businessId}/parties`}
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            ← Back to Parties
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">Add Party</h1>
          <p className="text-sm text-ink-muted">Add a customer or supplier to your address book.</p>
        </div>

        {shulkaMatch && (
          <div className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            This party is already on Shulka! They&apos;ve been linked to your address book.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-ink">
              Name <span className="text-error">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mehta Exports"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="legalName" className="text-sm font-medium text-ink">
              Legal Name
            </label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Mehta Exports Pvt Ltd"
            />
            <p className="text-xs text-ink-muted">If different from trading name</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="partyKind" className="text-sm font-medium text-ink">
              Party Type <span className="text-error">*</span>
            </label>
            <Select
              value={partyKind}
              onValueChange={(v) => setPartyKind(v as 'customer' | 'supplier' | 'both')}
            >
              <SelectTrigger id="partyKind">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gstin" className="text-sm font-medium text-ink">
              GSTIN
            </label>
            <div className="relative">
              <Input
                id="gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 27AAPFU0939F1ZV"
                maxLength={15}
                className={gstinInvalid ? 'border-error focus:border-error pr-10' : 'pr-10'}
              />
              {gstinValid && (
                <CheckCircle2
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success"
                  aria-label="Valid GSTIN"
                />
              )}
              {gstinInvalid && (
                <AlertTriangle
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-error"
                  aria-label="Invalid GSTIN"
                />
              )}
            </div>
            <p className="text-xs text-ink-muted">15-character GST Identification Number</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium text-ink">
              Phone
            </label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-ink">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. accounts@mehtaexports.in"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium text-ink">
              Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
              rows={3}
              className={[
                'flex w-full rounded-md border border-border bg-raised px-3 py-2',
                'text-[15px] text-ink placeholder:text-ink-muted/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'resize-none transition-colors duration-[150ms]',
              ].join(' ')}
            />
          </div>

          {error && (
            <p className="text-sm text-error rounded-md border border-error/30 bg-error/5 px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || shulkaMatch}>
            {loading ? 'Saving…' : 'Save Party'}
          </Button>
        </form>
      </div>
    </main>
  )
}
