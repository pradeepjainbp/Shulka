'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const BUSINESS_TYPES = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'pvt_ltd', label: 'Pvt Ltd' },
  { value: 'public_ltd', label: 'Public Ltd' },
  { value: 'huf', label: 'HUF' },
  { value: 'other', label: 'Other' },
]

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (old)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
]

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function validateGstin(gstin: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let val = GSTIN_CHARSET.indexOf(gstin.charAt(i))
    if ((i + 1) % 2 === 0) val *= 2
    sum += Math.floor(val / 36) + (val % 36)
  }
  return gstin[14] === GSTIN_CHARSET[(36 - (sum % 36)) % 36]
}

export default function NewBusinessPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [registrationDate, setRegistrationDate] = useState('')
  const [compositionScheme, setCompositionScheme] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gstinValid = gstin.length === 15 && validateGstin(gstin)
  const gstinInvalid = gstin.length >= 15 && !gstinValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Business name is required.')
      return
    }
    if (!businessType) {
      setError('Business type is required.')
      return
    }

    setLoading(true)

    const body: Record<string, unknown> = {
      name: name.trim(),
      type: businessType,
      compositionScheme,
    }
    if (legalName.trim()) body.legalName = legalName.trim()
    if (gstin) body.gstin = gstin
    if (pan) body.pan = pan
    if (stateCode) body.stateCode = stateCode
    if (registrationDate) body.registrationDate = registrationDate

    const res = await fetch('/api/businesses', {
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

    router.push('/en/businesses')
  }

  return (
    <main className="min-h-screen bg-surface p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link
            href="/en/dashboard"
            className="text-sm text-ink-muted hover:text-ink transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ink">Add Business</h1>
          <p className="text-sm text-ink-muted">Enter your business details to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium text-ink">
              Business Name <span className="text-error">*</span>
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sharma Traders"
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
              placeholder="e.g. Sharma Traders Pvt Ltd"
            />
            <p className="text-xs text-ink-muted">If different from trading name</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="businessType" className="text-sm font-medium text-ink">
              Business Type <span className="text-error">*</span>
            </label>
            <Select value={businessType} onValueChange={setBusinessType}>
              <SelectTrigger id="businessType">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
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
            <label htmlFor="pan" className="text-sm font-medium text-ink">
              PAN
            </label>
            <Input
              id="pan"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="e.g. AAPFU0939F"
              maxLength={10}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="stateCode" className="text-sm font-medium text-ink">
              State
            </label>
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger id="stateCode">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="registrationDate" className="text-sm font-medium text-ink">
              GST Registration Date
            </label>
            <input
              id="registrationDate"
              type="date"
              value={registrationDate}
              onChange={(e) => setRegistrationDate(e.target.value)}
              className={[
                'flex h-10 w-full rounded-md border border-border bg-raised px-3 py-2',
                'text-[15px] text-ink',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'transition-colors duration-[150ms]',
              ].join(' ')}
            />
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="compositionScheme"
              checked={compositionScheme}
              onCheckedChange={(checked) => setCompositionScheme(checked === true)}
            />
            <label
              htmlFor="compositionScheme"
              className="text-sm font-medium text-ink cursor-pointer"
            >
              Registered under Composition Scheme
            </label>
          </div>

          {error && (
            <p className="text-sm text-error rounded-md border border-error/30 bg-error/5 px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Save Business'}
          </Button>
        </form>
      </div>
    </main>
  )
}
