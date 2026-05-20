'use client'

import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useState } from 'react'

type PartyRow = {
  id: string
  name: string
  legalName: string | null
  externalGstin: string | null
  linkedBusinessId: string | null
  phone: string | null
  email: string | null
  partyKind: 'customer' | 'supplier' | 'both'
}

const KIND_LABELS: Record<PartyRow['partyKind'], string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  both: 'Both',
}

type Props = {
  parties: PartyRow[]
  businessId: string
}

export function PartyList({ parties, businessId }: Props) {
  const [search, setSearch] = useState('')

  const filtered =
    search.trim().length === 0
      ? parties
      : parties.filter((p) => {
          const q = search.toLowerCase()
          return (
            p.name.toLowerCase().includes(q) ||
            (p.externalGstin?.toLowerCase().includes(q) ?? false)
          )
        })

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name or GSTIN…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-raised p-12 flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-full bg-surface flex items-center justify-center text-3xl">
            🤝
          </div>
          <div className="space-y-1">
            <p className="font-medium text-ink">
              {search.trim().length > 0 ? 'No matches found' : 'No parties yet'}
            </p>
            <p className="text-sm text-ink-muted">
              {search.trim().length > 0
                ? 'Try a different name or GSTIN.'
                : 'Add your first customer or supplier.'}
            </p>
          </div>
          {search.trim().length === 0 && (
            <Link
              href={`/en/businesses/${businessId}/parties/new`}
              className="text-sm font-medium text-primary hover:underline"
            >
              Add Party
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((party) => (
            <div
              key={party.id}
              className="bg-raised border border-border rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-ink truncate">{party.name}</p>
                  <span className="inline-flex items-center rounded-full bg-surface border border-border text-ink-muted text-xs px-2 py-0.5 shrink-0">
                    {KIND_LABELS[party.partyKind]}
                  </span>
                  {party.linkedBusinessId !== null ? (
                    <span className="inline-flex items-center rounded-full bg-success/10 text-success border border-success/20 text-xs px-2 py-0.5 shrink-0">
                      On Shulka
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-surface text-ink-muted border border-border text-xs px-2 py-0.5 shrink-0">
                      External
                    </span>
                  )}
                </div>

                {party.externalGstin && (
                  <p className="font-mono tabular-nums text-ink-muted text-sm">
                    {party.externalGstin}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {party.phone && <p className="text-xs text-ink-muted">{party.phone}</p>}
                  {party.email && <p className="text-xs text-ink-muted">{party.email}</p>}
                </div>
              </div>

              <Link
                href={`/en/businesses/${businessId}/parties/${party.id}/edit`}
                className="text-sm text-primary hover:underline shrink-0 mt-0.5"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
