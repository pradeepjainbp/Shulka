'use client'

import { colors, shadow, type as typeScale } from '@shulka/design-tokens'
import { BarChart, LineChart } from '@tremor/react'
import { toast } from 'sonner'
import { AvatarFallback, AvatarImage, AvatarRoot } from '../../../components/ui/avatar'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Separator } from '../../../components/ui/separator'
import { Skeleton } from '../../../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'

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

const revenueData = [
  { month: 'Nov', Revenue: 45000 },
  { month: 'Dec', Revenue: 52000 },
  { month: 'Jan', Revenue: 48000 },
  { month: 'Feb', Revenue: 61000 },
  { month: 'Mar', Revenue: 55000 },
  { month: 'Apr', Revenue: 67000 },
]

const gstData = [
  { quarter: 'Q1', 'GST Collected': 18200, 'GST Paid': 14100 },
  { quarter: 'Q2', 'GST Collected': 22400, 'GST Paid': 16300 },
  { quarter: 'Q3', 'GST Collected': 19800, 'GST Paid': 15200 },
  { quarter: 'Q4', 'GST Collected': 27600, 'GST Paid': 19500 },
]

const inrFormatter = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[24px] leading-[1.2] tracking-[-0.01em] font-medium text-ink mb-6">
      {children}
    </h2>
  )
}

export default function StyleguidePage() {
  return (
    <div className="min-h-screen bg-surface p-8">
      <h1 className="text-[32px] leading-[1.15] tracking-[-0.015em] font-medium text-ink mb-2">
        Shulka Design System
      </h1>
      <p className="text-[15px] leading-[1.55] text-ink-muted mb-12">
        Visual smoke test — P0-07 shadcn/ui + Tremor + Sonner + Lucide
      </p>

      {/* Color Palette */}
      <section className="mb-12">
        <SectionHeading>Color Palette</SectionHeading>
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
        <SectionHeading>Type Scale</SectionHeading>
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
        <SectionHeading>Buttons</SectionHeading>
        <div className="flex flex-col gap-4">
          {(['default', 'secondary', 'ghost', 'destructive', 'link'] as const).map((variant) => (
            <div key={variant} className="flex flex-wrap items-center gap-3">
              <span className="text-[12px] font-mono text-ink-muted w-24">{variant}</span>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} size="default">
                Default
              </Button>
              <Button variant={variant} size="lg">
                Large
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Input */}
      <section className="mb-12">
        <SectionHeading>Input</SectionHeading>
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink" htmlFor="gstin-input">
              GSTIN
            </label>
            <Input id="gstin-input" placeholder="27AAPFU0939F1ZV" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-muted" htmlFor="disabled-input">
              Disabled
            </label>
            <Input id="disabled-input" placeholder="Not editable" disabled />
          </div>
        </div>
      </section>

      {/* Card */}
      <section className="mb-12">
        <SectionHeading>Card</SectionHeading>
        <Card className="max-w-sm" style={{ boxShadow: shadow.sm }}>
          <CardHeader>
            <CardTitle>Invoice #INV-001</CardTitle>
            <CardDescription>Raised on 15 Mar 2026</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[28px] leading-none tracking-[-0.015em] font-semibold tabular-nums text-ink">
              ₹18,540
            </p>
            <p className="text-[13px] text-ink-muted mt-1">Total GST Payable</p>
          </CardContent>
          <CardFooter className="gap-2">
            <Badge variant="success">Paid</Badge>
            <span className="text-[12px] text-ink-muted">Due 22 Mar 2026</span>
          </CardFooter>
        </Card>
      </section>

      {/* Badge */}
      <section className="mb-12">
        <SectionHeading>Badge</SectionHeading>
        <div className="flex flex-wrap gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Paid</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="error">Overdue</Badge>
          <Badge variant="outline">Draft</Badge>
        </div>
      </section>

      {/* Dialog */}
      <section className="mb-12">
        <SectionHeading>Dialog</SectionHeading>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Invoice Send</DialogTitle>
              <DialogDescription>
                This will send Invoice #INV-001 to Acme Corp (acme@example.com). This action cannot
                be undone once sent.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button variant="default">Send Invoice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* Tabs */}
      <section className="mb-12">
        <SectionHeading>Tabs</SectionHeading>
        <Tabs defaultValue="overview" className="max-w-lg">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                <p className="text-[15px] text-ink-muted">
                  Overview content — summary metrics and recent activity will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="invoices">
            <Card>
              <CardContent className="pt-6">
                <p className="text-[15px] text-ink-muted">
                  Invoices list — all sales invoices with status filters will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reports">
            <Card>
              <CardContent className="pt-6">
                <p className="text-[15px] text-ink-muted">
                  Reports — GSTR-1, GSTR-3B summaries and ITC reconciliation will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Tooltip */}
      <section className="mb-12">
        <SectionHeading>Tooltip</SectionHeading>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>GST rule ID: CGST-2017-S9(1)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </section>

      {/* Avatar */}
      <section className="mb-12">
        <SectionHeading>Avatar</SectionHeading>
        <div className="flex items-center gap-4">
          <AvatarRoot>
            <AvatarImage src="/placeholder-avatar.png" alt="Pradeep Jain" />
            <AvatarFallback>PJ</AvatarFallback>
          </AvatarRoot>
          <AvatarRoot className="h-12 w-12">
            <AvatarImage src="/placeholder-avatar.png" alt="Acme Corp" />
            <AvatarFallback>AC</AvatarFallback>
          </AvatarRoot>
          <AvatarRoot className="h-8 w-8">
            <AvatarImage src="/placeholder-avatar.png" alt="SM" />
            <AvatarFallback>SM</AvatarFallback>
          </AvatarRoot>
        </div>
      </section>

      {/* Skeleton */}
      <section className="mb-12">
        <SectionHeading>Skeleton</SectionHeading>
        <Card className="max-w-sm" style={{ boxShadow: shadow.sm }}>
          <CardHeader>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3.5 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-3.5 w-20" />
          </CardContent>
          <CardFooter className="gap-2">
            <Skeleton className="h-6 w-12 rounded-pill" />
            <Skeleton className="h-3.5 w-24" />
          </CardFooter>
        </Card>
      </section>

      {/* Toast */}
      <section className="mb-12">
        <SectionHeading>Toast</SectionHeading>
        <div className="flex flex-wrap gap-3">
          <Button variant="default" onClick={() => toast.success('Invoice sent!')}>
            Success Toast
          </Button>
          <Button variant="destructive" onClick={() => toast.error('Failed to send invoice.')}>
            Error Toast
          </Button>
          <Button variant="secondary" onClick={() => toast.warning('Invoice is overdue.')}>
            Warning Toast
          </Button>
        </div>
      </section>

      {/* Charts */}
      <section className="mb-12">
        <SectionHeading>Charts (Tremor)</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card style={{ boxShadow: shadow.sm }}>
            <CardHeader>
              <CardTitle>Revenue — Last 6 Months</CardTitle>
              <CardDescription>Monthly revenue in ₹</CardDescription>
            </CardHeader>
            <CardContent>
              <LineChart
                data={revenueData}
                index="month"
                categories={['Revenue']}
                colors={['emerald']}
                valueFormatter={inrFormatter}
                className="h-48"
              />
            </CardContent>
          </Card>

          <Card style={{ boxShadow: shadow.sm }}>
            <CardHeader>
              <CardTitle>GST — Quarterly</CardTitle>
              <CardDescription>GST collected vs GST paid in ₹</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={gstData}
                index="quarter"
                categories={['GST Collected', 'GST Paid']}
                colors={['emerald', 'amber']}
                valueFormatter={inrFormatter}
                className="h-48"
              />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Separator */}
      <section className="mb-12">
        <SectionHeading>Separator</SectionHeading>
        <div className="flex flex-col gap-3 max-w-sm bg-raised rounded-lg border border-border p-4">
          <p className="text-[15px] text-ink">Invoice #INV-001</p>
          <Separator />
          <p className="text-[15px] text-ink">Invoice #INV-002</p>
          <Separator />
          <p className="text-[15px] text-ink">Invoice #INV-003</p>
        </div>
      </section>

      {/* Shadows */}
      <section className="mb-12">
        <SectionHeading>Shadows</SectionHeading>
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
