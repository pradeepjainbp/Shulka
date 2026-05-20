'use client'

import { HsnSearch } from '@/components/HsnSearch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { HsnEntry } from '@shulka/shared-types'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Indian state codes — all 36 + UTs per GST Act schedule
// ---------------------------------------------------------------------------
const STATES: Array<{ code: string; name: string }> = [
  { code: '01', name: '01 — J&K' },
  { code: '02', name: '02 — Himachal Pradesh' },
  { code: '03', name: '03 — Punjab' },
  { code: '04', name: '04 — Chandigarh' },
  { code: '05', name: '05 — Uttarakhand' },
  { code: '06', name: '06 — Haryana' },
  { code: '07', name: '07 — Delhi' },
  { code: '08', name: '08 — Rajasthan' },
  { code: '09', name: '09 — Uttar Pradesh' },
  { code: '10', name: '10 — Bihar' },
  { code: '11', name: '11 — Sikkim' },
  { code: '12', name: '12 — Arunachal Pradesh' },
  { code: '13', name: '13 — Nagaland' },
  { code: '14', name: '14 — Manipur' },
  { code: '15', name: '15 — Mizoram' },
  { code: '16', name: '16 — Tripura' },
  { code: '17', name: '17 — Meghalaya' },
  { code: '18', name: '18 — Assam' },
  { code: '19', name: '19 — West Bengal' },
  { code: '20', name: '20 — Jharkhand' },
  { code: '21', name: '21 — Odisha' },
  { code: '22', name: '22 — Chhattisgarh' },
  { code: '23', name: '23 — Madhya Pradesh' },
  { code: '24', name: '24 — Gujarat' },
  { code: '26', name: '26 — D&NH + DD' },
  { code: '27', name: '27 — Maharashtra' },
  { code: '29', name: '29 — Karnataka' },
  { code: '30', name: '30 — Goa' },
  { code: '31', name: '31 — Lakshadweep' },
  { code: '32', name: '32 — Kerala' },
  { code: '33', name: '33 — Tamil Nadu' },
  { code: '34', name: '34 — Puducherry' },
  { code: '35', name: '35 — A&N Islands' },
  { code: '36', name: '36 — Telangana' },
  { code: '37', name: '37 — Andhra Pradesh' },
  { code: '38', name: '38 — Ladakh' },
  { code: '97', name: '97 — Other Territory' },
  { code: '99', name: '99 — Centre' },
]

const GST_RATES = ['0', '5', '12', '18', '28'] as const
type GstRate = (typeof GST_RATES)[number]

// ---------------------------------------------------------------------------
// Money formatter — Intl.NumberFormat with Indian locale (lakh comma)
// ---------------------------------------------------------------------------
const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
})

function formatINR(paise: number): string {
  return inrFormatter.format(paise / 100)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type LineItem = {
  id: string
  description: string
  hsn: HsnEntry | null
  qty: string
  unit: string
  unitPriceRupees: string
  discountPct: string
  gstRate: GstRate | ''
}

type Props = {
  businessId: string
  businessStateCode: string | null
  parties: Array<{ id: string; name: string; externalGstin?: string | null }>
  locale?: string
}

// ---------------------------------------------------------------------------
// Empty line item factory
// ---------------------------------------------------------------------------
function emptyItem(id?: string): LineItem {
  return {
    id: id ?? crypto.randomUUID(),
    description: '',
    hsn: null,
    qty: '1',
    unit: '',
    unitPriceRupees: '',
    discountPct: '0',
    gstRate: '',
  }
}

// ---------------------------------------------------------------------------
// Paise computation — UI-side preview only. Server recomputes authoritatively.
// ---------------------------------------------------------------------------
function computeRowPaise(item: LineItem): {
  taxableValue: number
  taxAmount: number
  total: number
} {
  const qty = Number.parseFloat(item.qty) || 0
  const unitPrice = Math.round((Number.parseFloat(item.unitPriceRupees) || 0) * 100)
  const discount = Number.parseFloat(item.discountPct) || 0
  const gstRate = Number.parseFloat(item.gstRate || '0') || 0

  const gross = Math.round(qty * unitPrice)
  const discountAmount = Math.round((gross * discount) / 100)
  const taxable = gross - discountAmount
  const tax = Math.round((taxable * gstRate) / 100)

  return { taxableValue: taxable, taxAmount: tax, total: taxable + tax }
}

// ---------------------------------------------------------------------------
// Derive CGST/SGST vs IGST split
// ---------------------------------------------------------------------------
function deriveTaxSplit(
  gstRate: GstRate | '',
  businessStateCode: string | null,
  placeOfSupplyState: string,
): { cgst: string; sgst: string; igst: string } {
  if (!gstRate || gstRate === '0') {
    return { cgst: '0', sgst: '0', igst: '0' }
  }
  const rate = Number.parseFloat(gstRate)
  const isIntraState =
    businessStateCode !== null &&
    businessStateCode !== '' &&
    placeOfSupplyState !== '' &&
    businessStateCode === placeOfSupplyState

  if (isIntraState) {
    const half = String(rate / 2)
    return { cgst: half, sgst: half, igst: '0' }
  }
  return { cgst: '0', sgst: '0', igst: gstRate }
}

// ---------------------------------------------------------------------------
// Draft auto-save helpers (Sacred Rule §19)
// ---------------------------------------------------------------------------
type DraftShape = {
  partyId: string
  invoiceDate: string
  dueDate: string
  placeOfSupplyState: string
  items: LineItem[]
}

function saveDraft(key: string, data: DraftShape) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // storage quota exceeded — silently skip
  }
}

function loadDraft(key: string): DraftShape | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as DraftShape
  } catch {
    return null
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Restore banner
// ---------------------------------------------------------------------------
function RestoreBanner({
  onRestore,
  onDismiss,
}: {
  onRestore: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink">
      <span>You have an unsaved draft for this invoice. Restore it?</span>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="font-medium text-primary hover:underline focus:outline-none"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink focus:outline-none"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton while businessId resolves (Sacred Rule §18)
// ---------------------------------------------------------------------------
function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-raised p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-raised p-5 space-y-3">
        <Skeleton className="h-5 w-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-6 gap-2">
            <Skeleton className="h-10 col-span-2" />
            <Skeleton className="h-10 col-span-2" />
            <Skeleton className="h-10 col-span-1" />
            <Skeleton className="h-10 col-span-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SalesInvoiceForm({ businessId, businessStateCode, parties, locale = 'en' }: Props) {
  const router = useRouter()
  const formId = useId()

  const today = new Date().toISOString().slice(0, 10)
  const draftKey = `draft_invoice_${businessId}`

  // -- Form state --
  const [partyId, setPartyId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  const [placeOfSupplyState, setPlaceOfSupplyState] = useState(businessStateCode ?? '')
  const [items, setItems] = useState<LineItem[]>([emptyItem()])

  // -- UI state --
  const [hydrated, setHydrated] = useState(false)
  const [showRestoreBanner, setShowRestoreBanner] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // -- Draft save timer --
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate — check for draft
  useEffect(() => {
    setHydrated(true)
    const draft = loadDraft(draftKey)
    if (draft) {
      setShowRestoreBanner(true)
    }
  }, [draftKey])

  // Auto-save on every form change (debounced 800ms, Sacred Rule §19)
  useEffect(() => {
    if (!hydrated) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveDraft(draftKey, { partyId, invoiceDate, dueDate, placeOfSupplyState, items })
    }, 800)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [hydrated, draftKey, partyId, invoiceDate, dueDate, placeOfSupplyState, items])

  // When party is selected, derive place-of-supply from their GSTIN prefix
  function handlePartyChange(id: string) {
    setPartyId(id)
    const party = parties.find((p) => p.id === id)
    if (party?.externalGstin && party.externalGstin.length >= 2) {
      const prefix = party.externalGstin.slice(0, 2)
      setPlaceOfSupplyState(prefix)
    }
    setFieldErrors((prev) => ({ ...prev, partyId: '' }))
  }

  function handleRestoreDraft() {
    const draft = loadDraft(draftKey)
    if (!draft) return
    setPartyId(draft.partyId)
    setInvoiceDate(draft.invoiceDate)
    setDueDate(draft.dueDate)
    setPlaceOfSupplyState(draft.placeOfSupplyState)
    setItems(draft.items.length > 0 ? draft.items : [emptyItem()])
    setShowRestoreBanner(false)
  }

  function handleDismissDraft() {
    clearDraft(draftKey)
    setShowRestoreBanner(false)
  }

  // -- Line item helpers --
  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // -- Totals (live, preview only) --
  let subtotalPaise = 0
  let totalCgstPaise = 0
  let totalSgstPaise = 0
  let totalIgstPaise = 0

  for (const item of items) {
    const { taxableValue } = computeRowPaise(item)
    const split = deriveTaxSplit(item.gstRate, businessStateCode, placeOfSupplyState)
    subtotalPaise += taxableValue
    totalCgstPaise += Math.round((taxableValue * Number.parseFloat(split.cgst)) / 100)
    totalSgstPaise += Math.round((taxableValue * Number.parseFloat(split.sgst)) / 100)
    totalIgstPaise += Math.round((taxableValue * Number.parseFloat(split.igst)) / 100)
  }

  const rawTotal = subtotalPaise + totalCgstPaise + totalSgstPaise + totalIgstPaise
  const roundOffPaise = Math.round(rawTotal / 100) * 100 - rawTotal
  const totalAmountPaise = rawTotal + roundOffPaise

  // -- Submit --
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    // Client-side validation
    const errors: Record<string, string> = {}
    if (!partyId) errors.partyId = 'Select a party.'
    if (!invoiceDate) errors.invoiceDate = 'Invoice date is required.'
    if (!placeOfSupplyState) errors.placeOfSupplyState = 'Place of supply is required.'
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item) continue
      if (!item.description.trim()) errors[`item_${i}_description`] = 'Description required.'
      if (!item.unitPriceRupees || Number.parseFloat(item.unitPriceRupees) <= 0)
        errors[`item_${i}_unitPrice`] = 'Unit price required.'
      if (!item.unit.trim()) errors[`item_${i}_unit`] = 'Unit required.'
      if (!item.qty || Number.parseFloat(item.qty) <= 0)
        errors[`item_${i}_qty`] = 'Quantity required.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)

    // Build API payload — convert UI-side rupees to paise for all items
    const apiItems = items.map((item) => {
      const split = deriveTaxSplit(item.gstRate, businessStateCode, placeOfSupplyState)
      const hsnOrSac =
        item.hsn?.type === 'HSN'
          ? { hsnCode: item.hsn.code }
          : item.hsn?.type === 'SAC'
            ? { sacCode: item.hsn.code }
            : {}
      return {
        description: item.description,
        ...hsnOrSac,
        quantity: item.qty,
        unit: item.unit,
        unitPricePaise: Math.round((Number.parseFloat(item.unitPriceRupees) || 0) * 100),
        discountPct: item.discountPct || '0',
        cgstRatePct: split.cgst,
        sgstRatePct: split.sgst,
        igstRatePct: split.igst,
        cessRatePct: '0',
      }
    })

    const body = {
      businessId,
      partyId,
      invoiceDate,
      dueDate: dueDate || undefined,
      placeOfSupplyState,
      items: apiItems,
    }

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
        } | null

        if (res.status === 400 && data?.details?.fieldErrors) {
          const fe: Record<string, string> = {}
          for (const [k, v] of Object.entries(data.details.fieldErrors)) {
            fe[k] = Array.isArray(v) ? (v[0] ?? '') : String(v)
          }
          setFieldErrors(fe)
        } else {
          setError(data?.error ?? 'Something went wrong. Please try again.')
        }
        setSaving(false)
        return
      }

      const saved = (await res.json()) as { invoice?: { id?: string } }
      clearDraft(draftKey)
      const invoiceId = saved.invoice?.id
      router.push(invoiceId ? `/${locale}/sales/${invoiceId}` : `/${locale}/sales`)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSaving(false)
    }
  }

  // -- Render skeleton before hydration --
  if (!hydrated) {
    return <FormSkeleton />
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      {/* Draft restore banner */}
      {showRestoreBanner && (
        <RestoreBanner onRestore={handleRestoreDraft} onDismiss={handleDismissDraft} />
      )}

      {/* Global error banner */}
      {error && (
        <div className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Invoice header                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-lg border border-border bg-raised p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">Invoice Details</h2>

        {/* Party selector */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">
            Party <span className="text-error">*</span>
          </p>
          <Select value={partyId} onValueChange={handlePartyChange}>
            <SelectTrigger className={fieldErrors.partyId ? 'border-error' : ''}>
              <SelectValue placeholder="Select customer / party" />
            </SelectTrigger>
            <SelectContent>
              {parties.length === 0 ? (
                <div className="px-3 py-4 text-sm text-ink-muted text-center">
                  No parties found. Add a party first.
                </div>
              ) : (
                parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    {p.externalGstin && (
                      <span className="ml-2 text-xs text-ink-muted font-mono tabular-nums">
                        {p.externalGstin}
                      </span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {fieldErrors.partyId && <p className="text-xs text-error">{fieldErrors.partyId}</p>}
        </div>

        {/* Dates + Place of supply */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Invoice date */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">
              Invoice Date <span className="text-error">*</span>
            </p>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => {
                setInvoiceDate(e.target.value)
                setFieldErrors((prev) => ({ ...prev, invoiceDate: '' }))
              }}
              className={fieldErrors.invoiceDate ? 'border-error' : ''}
            />
            {fieldErrors.invoiceDate && (
              <p className="text-xs text-error">{fieldErrors.invoiceDate}</p>
            )}
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">Due Date</p>
            <Input
              type="date"
              value={dueDate}
              min={invoiceDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Place of supply */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink">
              Place of Supply <span className="text-error">*</span>
            </p>
            <Select
              value={placeOfSupplyState}
              onValueChange={(v) => {
                setPlaceOfSupplyState(v)
                setFieldErrors((prev) => ({ ...prev, placeOfSupplyState: '' }))
              }}
            >
              <SelectTrigger className={fieldErrors.placeOfSupplyState ? 'border-error' : ''}>
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.placeOfSupplyState && (
              <p className="text-xs text-error">{fieldErrors.placeOfSupplyState}</p>
            )}
            {businessStateCode &&
              placeOfSupplyState &&
              placeOfSupplyState !== businessStateCode && (
                <p className="text-xs text-ink-muted">Inter-state — IGST will apply</p>
              )}
            {businessStateCode &&
              placeOfSupplyState &&
              placeOfSupplyState === businessStateCode && (
                <p className="text-xs text-ink-muted">Intra-state — CGST + SGST will apply</p>
              )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Line items                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-lg border border-border bg-raised p-5 space-y-4">
        <h2 className="text-[15px] font-semibold text-ink">Line Items</h2>

        <div className="space-y-4">
          {items.map((item, idx) => {
            const row = computeRowPaise(item)
            const split = deriveTaxSplit(item.gstRate, businessStateCode, placeOfSupplyState)
            const taxTypePill =
              split.igst !== '0'
                ? `IGST ${item.gstRate}%`
                : split.cgst !== '0'
                  ? `CGST ${split.cgst}% + SGST ${split.sgst}%`
                  : null

            return (
              <div
                key={item.id}
                className="rounded-md border border-border bg-surface p-4 space-y-3 relative"
              >
                {/* Row header */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">
                    Item {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label={`Remove item ${idx + 1}`}
                      className="rounded p-1 text-ink-muted hover:text-error hover:bg-error/5 transition-colors duration-[150ms] focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>

                {/* Row 1: Description */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-ink-muted">Description *</p>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="e.g. Software development services"
                    className={fieldErrors[`item_${idx}_description`] ? 'border-error' : ''}
                  />
                  {fieldErrors[`item_${idx}_description`] && (
                    <p className="text-xs text-error">{fieldErrors[`item_${idx}_description`]}</p>
                  )}
                </div>

                {/* Row 2: HSN/SAC */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-ink-muted">HSN / SAC Code</p>
                  <HsnSearch
                    value={item.hsn}
                    onChange={(entry) => updateItem(idx, { hsn: entry })}
                  />
                </div>

                {/* Row 3: Qty, Unit, Unit Price, Discount */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">Qty *</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={item.qty}
                      onChange={(e) => updateItem(idx, { qty: e.target.value })}
                      className={[
                        'tabular-nums',
                        fieldErrors[`item_${idx}_qty`] ? 'border-error' : '',
                      ].join(' ')}
                    />
                    {fieldErrors[`item_${idx}_qty`] && (
                      <p className="text-xs text-error">{fieldErrors[`item_${idx}_qty`]}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">Unit *</p>
                    <Input
                      value={item.unit}
                      onChange={(e) => updateItem(idx, { unit: e.target.value })}
                      placeholder="kg / pcs / hr"
                      className={fieldErrors[`item_${idx}_unit`] ? 'border-error' : ''}
                    />
                    {fieldErrors[`item_${idx}_unit`] && (
                      <p className="text-xs text-error">{fieldErrors[`item_${idx}_unit`]}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">Unit Price (₹) *</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-[13px] select-none">
                        ₹
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.unitPriceRupees}
                        onChange={(e) => updateItem(idx, { unitPriceRupees: e.target.value })}
                        placeholder="0.00"
                        className={[
                          'pl-7 tabular-nums',
                          fieldErrors[`item_${idx}_unitPrice`] ? 'border-error' : '',
                        ].join(' ')}
                      />
                    </div>
                    {fieldErrors[`item_${idx}_unitPrice`] && (
                      <p className="text-xs text-error">{fieldErrors[`item_${idx}_unitPrice`]}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">Discount %</p>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={item.discountPct}
                      onChange={(e) => updateItem(idx, { discountPct: e.target.value })}
                      className="tabular-nums"
                    />
                  </div>
                </div>

                {/* Row 4: GST rate */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">GST Rate</p>
                    <Select
                      value={item.gstRate}
                      onValueChange={(v) => updateItem(idx, { gstRate: v as GstRate })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rate" />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_RATES.map((rate) => (
                          <SelectItem key={rate} value={rate}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {taxTypePill && (
                    <div className="sm:col-span-1 flex items-end pb-0.5">
                      <span className="inline-flex items-center rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary">
                        {taxTypePill}
                      </span>
                    </div>
                  )}

                  {/* Row computed preview */}
                  {row.taxableValue > 0 && (
                    <div className="sm:col-span-2 flex items-end justify-end gap-4 text-sm pb-0.5">
                      <span className="text-ink-muted">
                        Taxable:{' '}
                        <span className="text-ink tabular-nums font-medium">
                          {formatINR(row.taxableValue)}
                        </span>
                      </span>
                      {row.taxAmount > 0 && (
                        <span className="text-ink-muted">
                          Tax:{' '}
                          <span className="text-ink tabular-nums font-medium">
                            {formatINR(row.taxAmount)}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-1"
        >
          + Add line item
        </button>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Tax preview (read-only, live)                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="rounded-lg border border-border bg-raised p-5 space-y-3">
        <h2 className="text-[15px] font-semibold text-ink">Tax Summary</h2>

        <div className="space-y-2 text-sm">
          <TaxRow label="Subtotal" value={subtotalPaise} />
          <TaxRow label="CGST" value={totalCgstPaise > 0 ? totalCgstPaise : null} />
          <TaxRow label="SGST" value={totalSgstPaise > 0 ? totalSgstPaise : null} />
          <TaxRow label="IGST" value={totalIgstPaise > 0 ? totalIgstPaise : null} />
          {roundOffPaise !== 0 && <TaxRow label="Round off" value={roundOffPaise} />}
          <div className="border-t border-border pt-2 mt-2" />
          <div className="flex justify-between items-baseline">
            <span className="text-[15px] font-semibold text-ink">Total</span>
            <span className="text-[18px] font-semibold text-ink tabular-nums">
              {formatINR(totalAmountPaise)}
            </span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Actions                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-3 justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${locale}/sales`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save as Draft'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Helper: single tax summary row
// ---------------------------------------------------------------------------
function TaxRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="tabular-nums text-ink">{value !== null ? formatINR(value) : '—'}</span>
    </div>
  )
}
