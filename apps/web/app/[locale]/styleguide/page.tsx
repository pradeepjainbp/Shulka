import { colors, shadow, type as typeScale } from '@shulka/design-tokens'

type ColorEntry = { name: string; value: string }

const colorEntries: ColorEntry[] = [
  { name: 'primary', value: colors.primary },
  { name: 'primary-50', value: colors.primary50 },
  { name: 'primary-100', value: colors.primary100 },
  { name: 'primary-500', value: colors.primary500 },
  { name: 'primary-700', value: colors.primary700 },
  { name: 'accent', value: colors.accent },
  { name: 'accent-50', value: colors.accent50 },
  { name: 'surface', value: colors.surface },
  { name: 'surface-alt', value: colors.surfaceAlt },
  { name: 'raised', value: colors.raised },
  { name: 'ink', value: colors.ink },
  { name: 'ink-soft', value: colors.inkSoft },
  { name: 'ink-muted', value: colors.inkMuted },
  { name: 'ink-disabled', value: colors.inkDisabled },
  { name: 'success', value: colors.success },
  { name: 'warning', value: colors.warning },
  { name: 'error', value: colors.error },
  { name: 'info', value: colors.info },
  { name: 'border', value: colors.border },
  { name: 'border-strong', value: colors.borderStrong },
]

type TypeEntry = { name: string; classes: string; sample: string }

const typeEntries: TypeEntry[] = [
  { name: 'display', classes: typeScale.display, sample: 'Display — ₹12,34,567' },
  { name: 'h1', classes: typeScale.h1, sample: 'Heading 1 — GST Summary' },
  { name: 'h2', classes: typeScale.h2, sample: 'Heading 2 — Invoice Details' },
  { name: 'h3', classes: typeScale.h3, sample: 'Heading 3 — Line Items' },
  {
    name: 'body',
    classes: typeScale.body,
    sample: 'Body — Regular paragraph text for descriptions.',
  },
  { name: 'bodyLg', classes: typeScale.bodyLg, sample: 'Body Large — Slightly larger body copy.' },
  { name: 'bodySm', classes: typeScale.bodySm, sample: 'Body Small — Supporting text and labels.' },
  { name: 'caption', classes: typeScale.caption, sample: 'Caption — Timestamps and metadata' },
  { name: 'metricLg', classes: typeScale.metricLg, sample: '₹12,34,567' },
  { name: 'metric', classes: typeScale.metric, sample: '₹4,567' },
  { name: 'number', classes: typeScale.number, sample: '18% GST — ₹1,234.56' },
]

type StatusPill = { label: string; bg: string; text: string }

const statusPills: StatusPill[] = [
  { label: 'Paid', bg: 'bg-success/10', text: 'text-success' },
  { label: 'Pending', bg: 'bg-warning/10', text: 'text-warning' },
  { label: 'Overdue', bg: 'bg-error/10', text: 'text-error' },
  { label: 'Draft', bg: 'bg-info/10', text: 'text-info' },
]

export default function StyleguidePage() {
  return (
    <div className="min-h-screen bg-surface p-8">
      <h1 className="text-[32px] leading-[1.15] tracking-[-0.015em] font-medium text-ink mb-2">
        Shulka Design System
      </h1>
      <p className="text-[15px] leading-[1.55] text-ink-muted mb-12">
        Visual smoke test — P0-05 tokens &amp; base components
      </p>

      {/* Color Palette */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Color Palette
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {colorEntries.map((c) => (
            <div key={c.name} className="flex flex-col gap-2">
              <div
                className="h-16 rounded-md border border-border"
                style={{ backgroundColor: c.value }}
              />
              <div>
                <p className="text-[13px] leading-[1.5] font-medium text-ink">{c.name}</p>
                <p className="text-[12px] leading-[1.4] tracking-[0.01em] text-ink-muted font-mono">
                  {c.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Type Scale */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Type Scale
        </h2>
        <div className="flex flex-col gap-6 bg-raised rounded-lg p-6 border border-border">
          {typeEntries.map((t) => (
            <div
              key={t.name}
              className="flex flex-col gap-1 border-b border-border pb-5 last:border-0 last:pb-0"
            >
              <span className="text-[12px] leading-[1.4] tracking-[0.01em] text-ink-muted font-mono">
                {t.name}
              </span>
              <span className={t.classes}>{t.sample}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="bg-primary text-white rounded-md px-4 py-2 text-[15px] font-medium
              hover:bg-primary-700 transition-colors duration-[150ms] cursor-pointer"
          >
            Primary Button
          </button>
          <button
            type="button"
            className="border border-border bg-raised text-ink rounded-md px-4 py-2 text-[15px] font-medium
              hover:bg-surface-alt transition-colors duration-[150ms] cursor-pointer"
          >
            Secondary Button
          </button>
        </div>
      </section>

      {/* Input */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Input
        </h2>
        <input
          type="text"
          placeholder="Enter GSTIN e.g. 27AAPFU0939F1ZV"
          className="border border-border bg-raised rounded-md px-3 py-2 text-[15px] text-ink
            placeholder:text-ink-disabled focus:outline-none focus:ring-2 focus:ring-primary/20
            focus:border-primary transition-colors duration-[150ms] w-full max-w-sm"
        />
      </section>

      {/* Card */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Card
        </h2>
        <div
          className="bg-raised rounded-lg p-6 border border-border max-w-sm"
          style={{ boxShadow: shadow.sm }}
        >
          <p className="text-[13px] leading-[1.5] text-ink-muted mb-1">Total GST Payable</p>
          <p className="text-[28px] leading-none tracking-[-0.015em] font-semibold tabular-nums text-ink">
            ₹18,540
          </p>
          <p className="text-[13px] leading-[1.5] text-ink-muted mt-2">15 Mar 2026</p>
        </div>
      </section>

      {/* Status Pills */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Status Pills
        </h2>
        <div className="flex flex-wrap gap-3">
          {statusPills.map((pill) => (
            <span
              key={pill.label}
              className={`rounded-pill px-3 py-1 text-[12px] font-medium ${pill.bg} ${pill.text}`}
            >
              {pill.label}
            </span>
          ))}
        </div>
      </section>

      {/* Shadows */}
      <section className="mb-12">
        <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
          Shadows
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {(Object.entries(shadow) as [string, string][]).map(([name, value]) => (
            <div key={name} className="flex flex-col gap-3 items-center">
              <div className="w-16 h-16 bg-raised rounded-lg" style={{ boxShadow: value }} />
              <span className="text-[12px] leading-[1.4] tracking-[0.01em] text-ink-muted font-mono">
                {name}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
