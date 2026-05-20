'use client'

import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
// master.json lives at the monorepo root: rules/hsn-codes/master.json
// Resolved via the @shulka/rules webpack alias + tsconfig path
import masterData from '@shulka/rules/hsn-codes/master.json'
import type { HsnEntry } from '@shulka/shared-types'
import Fuse from 'fuse.js'
import { X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Fuse instance — built once at module level (synchronous, ~633 entries)
// ---------------------------------------------------------------------------
const fuse = new Fuse(masterData as HsnEntry[], {
  keys: ['code', 'description'],
  threshold: 0.35,
  minMatchCharLength: 2,
  includeScore: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = {
  value?: HsnEntry | null
  onChange?: (entry: HsnEntry | null) => void
  placeholder?: string
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function HsnSearch({
  value = null,
  onChange,
  placeholder = 'Search HSN / SAC code…',
  disabled = false,
}: Props) {
  const inputId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // div ref for the dropdown (Biome requires div for role="listbox")
  const listRef = useRef<HTMLDivElement>(null)

  // Show skeleton on first render before hydration settles
  const [hydrated, setHydrated] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HsnEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Sync input text when controlled value changes externally
  useEffect(() => {
    if (value) {
      setQuery(`${value.code} — ${value.description}`)
    } else if (value === null) {
      setQuery('')
    }
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const runSearch = useCallback((q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    const hits = fuse.search(trimmed, { limit: 30 }).map((r) => r.item as HsnEntry)
    setResults(hits)
    setIsOpen(hits.length > 0)
    setActiveIndex(-1)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)

    // Clear selection when user edits the field
    if (value && onChange) {
      onChange(null)
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(q)
    }, 50)
  }

  function selectEntry(entry: HsnEntry) {
    setQuery(`${entry.code} — ${entry.description}`)
    setIsOpen(false)
    setResults([])
    setActiveIndex(-1)
    onChange?.(entry)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setActiveIndex(-1)
    onChange?.(null)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0) {
          const entry = results[activeIndex]
          if (entry) selectEntry(entry)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }

  // Show 3 skeleton rows on first render (before hydration)
  if (!hydrated) {
    return (
      <div className="relative w-full">
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-raised shadow-md p-2 space-y-2">
          <Skeleton className="h-9 w-full rounded" />
          <Skeleton className="h-9 w-full rounded" />
          <Skeleton className="h-9 w-full rounded" />
        </div>
      </div>
    )
  }

  const showClear = Boolean(value ?? (query.length > 0 && results.length === 0))

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input row */}
      <div className="relative">
        <Input
          id={inputId}
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined}
          role="combobox"
          className="pr-9"
        />
        {/* Clear button */}
        {showClear && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className={[
              'absolute right-2.5 top-1/2 -translate-y-1/2',
              'rounded-sm p-0.5 text-ink-muted',
              'hover:text-ink transition-colors duration-[150ms]',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
            ].join(' ')}
            aria-label="Clear selection"
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Dropdown — ARIA combobox pattern (div + role="listbox"; native <select> cannot render custom rows) */}
      {isOpen && results.length > 0 && (
        <div
          id={`${inputId}-listbox`}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label="HSN/SAC code suggestions"
          className={[
            'absolute z-50 mt-1 w-full',
            'max-h-[288px] overflow-y-auto',
            'rounded-md border border-border bg-raised shadow-md',
            'py-1',
          ].join(' ')}
        >
          {results.slice(0, 30).map((entry, i) => (
            <div
              key={entry.code}
              id={`${inputId}-option-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                // Prevent blur from closing before click fires
                e.preventDefault()
                selectEntry(entry)
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={[
                'flex items-center gap-3 px-3 py-2 cursor-pointer',
                'transition-colors duration-[100ms]',
                i === activeIndex ? 'bg-primary/8 text-ink' : 'hover:bg-surface text-ink',
              ].join(' ')}
            >
              {/* Code — tabular nums for alignment */}
              <span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-ink w-14">
                {entry.code}
              </span>

              {/* Description */}
              <span className="flex-1 text-[13px] text-ink-soft truncate">
                {truncate(entry.description, 60)}
              </span>

              {/* Type pill */}
              <span
                className={[
                  'shrink-0 text-[11px] font-medium rounded-sm px-1.5 py-0.5 leading-none',
                  entry.type === 'HSN'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-ink-muted/10 text-ink-muted',
                ].join(' ')}
              >
                {entry.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
