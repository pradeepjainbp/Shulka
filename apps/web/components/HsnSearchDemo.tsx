'use client'

import { HsnSearch } from '@/components/HsnSearch'
import type { HsnEntry } from '@shulka/shared-types'
import { useState } from 'react'

export function HsnSearchDemo() {
  const [selected, setSelected] = useState<HsnEntry | null>(null)

  return (
    <div className="space-y-4">
      <HsnSearch value={selected} onChange={setSelected} />

      {selected && (
        <div className="rounded-lg border border-border bg-raised p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {selected.code}
            </span>
            <span
              className={[
                'shrink-0 text-[12px] font-medium rounded-sm px-2 py-1 leading-none',
                selected.type === 'HSN'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-ink-muted/10 text-ink-muted',
              ].join(' ')}
            >
              {selected.type}
            </span>
          </div>
          <p className="text-[14px] text-ink-soft leading-relaxed">{selected.description}</p>
        </div>
      )}
    </div>
  )
}
