# Shulka — Design System

> "Heritage Fintech." Premium without being clinical, warm without being cute. The visual feel of a Taj concierge desk, not a Tally screen.

---

## Reference apps studied

Linear (motion + speed), Stripe (forms + clarity), Cred (premium polish), Razorpay X (Indian fintech clarity), Apple Wallet (card animations), Notion (typography + restraint), Vercel (instant feel), Monzo (warmth in finance). We take the best of each. We avoid Cred's coldness, Notion's weight, Linear's neutrality.

---

## 1. Color tokens

```ts
// packages/design-tokens/src/colors.ts
export const colors = {
  // Brand
  primary:   '#0F5C3F',  // deep emerald
  primary50: '#E8F2EC',
  primary100:'#C4DDCC',
  primary500:'#0F5C3F',
  primary700:'#0A4530',

  accent:    '#E8A23F',  // marigold (sparingly)
  accent50:  '#FCF3E5',

  // Surfaces
  surface:   '#FAF7EE',  // rich cream
  surfaceAlt:'#F2EEE0',
  raised:    '#FFFFFF',

  // Ink
  ink:       '#1B1F1D',
  inkSoft:   '#3A4341',
  inkMuted:  '#7B8784',
  inkDisabled:'#B5BDB9',

  // Status
  success:   '#5B8A66',  // sage
  warning:   '#D49B3F',  // amber
  error:     '#C25E4A',  // terracotta
  info:      '#5C6B7A',  // slate-blue

  // Borders
  border:    '#E5DFD0',
  borderStrong:'#CFC8B5',
} as const
```

### Usage

- **Primary** — single CTAs, key data points (GST payable amount), brand surfaces. Don't overuse.
- **Accent (marigold)** — celebratory moments only (success toasts, completed-flow checkmarks, festival banners).
- **Surface** — page background. Cream, not white.
- **Raised** — cards, modals, elevated surfaces. Pure white against cream surface gives subtle depth.
- **Status colors** — exclusive to status pills, alerts, validation messages. Never decorative.

### Dark mode (Phase 1+)

```ts
export const darkColors = {
  primary:   '#5BA77E',
  primary50: '#102B20',
  surface:   '#0E1411',
  surfaceAlt:'#15201B',
  raised:    '#1B2823',
  ink:       '#E9EFEC',
  inkSoft:   '#B8C2BE',
  inkMuted:  '#7E8884',
  // ... mirror status with elevated luminance
} as const
```

System-default detection via `next-themes`.

---

## 2. Typography

```ts
// packages/design-tokens/src/typography.ts
import { Geist, Geist_Mono } from 'next/font/google'

export const fontSans = Geist({ subsets: ['latin'] })
export const fontMono = Geist_Mono({ subsets: ['latin'] })

export const type = {
  display: 'text-[44px] leading-[1.1] tracking-[-0.02em] font-medium',
  h1:      'text-[32px] leading-[1.15] tracking-[-0.015em] font-medium',
  h2:      'text-[24px] leading-[1.2] tracking-[-0.01em] font-medium',
  h3:      'text-[18px] leading-[1.3] font-medium',
  body:    'text-[15px] leading-[1.55]',
  bodyLg:  'text-[16px] leading-[1.55]',
  bodySm:  'text-[13px] leading-[1.5]',
  caption: 'text-[12px] leading-[1.4] tracking-[0.01em] text-ink-muted',
  metricLg:'text-[40px] leading-none tracking-[-0.02em] font-semibold tabular-nums',
  metric:  'text-[28px] leading-none tracking-[-0.015em] font-semibold tabular-nums',
  number:  'tabular-nums', // applied alongside any size for financial figures
} as const
```

**Critical:** all financial numerals use `tabular-nums` (Geist Mono or `font-feature-settings: 'tnum'` on sans). Columns of rupees must align character-for-character.

---

## 3. Spacing & radius

```ts
export const space = {
  // 4-step rhythm
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  6: '24px',
  8: '32px',
  10:'40px',
  12:'48px',
  16:'64px',
} as const

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  pill: '999px',
} as const
```

---

## 4. Shadows

Premium feel needs careful elevation, not heavy drop shadows.

```ts
export const shadow = {
  none: 'none',
  // Subtle separation
  xs:  '0 1px 0 rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.04)',
  // Cards
  sm:  '0 1px 2px rgba(0,0,0,0.04), 0 4px 8px -2px rgba(0,0,0,0.04)',
  // Raised hover / dropdowns
  md:  '0 4px 8px -2px rgba(0,0,0,0.06), 0 12px 24px -4px rgba(0,0,0,0.06)',
  // Modals
  lg:  '0 20px 40px -12px rgba(0,0,0,0.12), 0 8px 16px -8px rgba(0,0,0,0.06)',
  // Floating elements
  xl:  '0 32px 64px -16px rgba(0,0,0,0.16), 0 12px 24px -12px rgba(0,0,0,0.08)',
} as const
```

---

## 5. Motion

```ts
export const ease = {
  // Default: Material standard easing — natural feel
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Decelerate: entries
  out:      'cubic-bezier(0, 0, 0.2, 1)',
  // Accelerate: exits
  in:       'cubic-bezier(0.4, 0, 1, 1)',
  // Spring: optimistic UI confirmations
  spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const

export const duration = {
  instant: '80ms',
  fast:    '150ms',
  base:    '200ms',
  slow:    '320ms',
  longest: '480ms',  // never longer
} as const
```

### Motion principles

- **Every interaction has a state transition.** Hover = `instant`. Press = `fast`. Page change = `base`. Modal entry = `slow` with `out` ease.
- **Optimistic confirmations use `spring` ease** — gives a subtle bounce that says "done."
- **Skeleton loaders shimmer** at `2s` linear-infinite. Never spin.
- **Number-counter animations** on metric cards run at `slow` with `out` ease, on first load only.
- **View Transitions API** for navigation between major routes (dashboard ↔ invoice detail).
- **Haptic feedback** (Capacitor) on primary actions (invoice send, payment confirm, trust elevation).

---

## 6. Components (shadcn/ui base, themed)

Install via shadcn CLI; theme via `tailwind.config.ts` extending tokens.

### Base set (Phase 0)
- Button (variants: primary, secondary, ghost, destructive, link)
- Input, Textarea, Select, Checkbox, Radio, Switch
- Card (with `<Card.Header>`, `<Card.Body>`, `<Card.Footer>`)
- Dialog (modal), Sheet (drawer), Drawer (mobile bottom sheet)
- Toast (Sonner)
- Tooltip
- Avatar
- Badge, StatusPill (custom — pill with status color)
- Separator
- Tabs, Accordion
- Skeleton

### Forms (Phase 1)
- FormField (RHF + Zod integration)
- DatePicker (Indian DD/MM/YYYY input, "15 Mar 2026" display)
- CurrencyInput (smart parsing: "10k" → ₹10,000; integer paise on submit)
- GstinInput (auto-uppercase, auto-space `22 AAAAA 0000A 1Z5`, live validation badge)
- PanInput
- PhoneInput (+91 fixed, formatted)
- HsnSearch (autocomplete with 12k codes)
- StatePicker (28 states + 8 UTs)

### App-specific
- MetricCard (large number + sparkline + delta)
- InsightCard (decision insight with action button)
- InvoiceLineRow (HSN + qty + rate + auto-computed taxes)
- PartyChip (avatar + name + trust badge)
- AuditTrailDrawer (right-side drawer with rule_id source citations)
- WhyThisRateModal (the trust-layer affordance — see PHASES.md P2-08)
- NetworkEffectInbox (incoming invoices with quarantine/trust states)
- ItcAtRiskCard
- CommandPalette (Cmd-K)

---

## 7. Layout

### Desktop (≥1024px)
```
┌──────────────────────────────────────────────────┐
│  Header (logo · search · user menu)              │
├──────┬───────────────────────────────────────────┤
│      │                                            │
│ Side │           Main content                     │
│  nav │           (max-width 1280px)               │
│      │                                            │
│      │                                            │
└──────┴───────────────────────────────────────────┘
```

### Tablet (768–1023)
- Side nav collapses to icon rail (60px wide)
- Main content uses full width

### Mobile (≤767)
- Side nav becomes bottom navigation (5 icons max)
- Header sticky, abbreviated
- Sheets/Drawers replace modals
- All forms single-column

### PWA install prompt
- After 3rd visit, show subtle "Install Shulka on your phone" banner.

---

## 8. Indian-context UI patterns

| Pattern | Implementation |
|---|---|
| Currency display | `<Money paise={245000_00} />` → `₹2,45,000` (lakh comma) |
| Compact currency | `<Money paise={...} compact />` → `₹2.45 L` / `₹24.5 Cr` |
| Date display | `<DateLabel value={date} />` → `15 Mar 2026` |
| Date input | `<DatePicker />` accepts `15/03/2026`, validates, returns ISO |
| Time display | `<TimeLabel />` → `3:45 PM IST` |
| GSTIN | `<GstinDisplay value="22AAAAA0000A1Z5" />` → `22 AAAAA 0000A 1Z5` (spaced) |
| Phone | `<PhoneDisplay value="+919876543210" />` → `+91 98765 43210` |
| Number to words | `<MoneyInWords paise={...} />` → `Two Lakh Forty-Five Thousand Rupees Only` (legally required on invoices) |
| State picker | bundled list, sorted alphabetically, with state codes |
| PIN code | live lookup → city/state suggestion (uses bundled JSON) |
| Festival banner | subtle on Diwali/Holi/New Year only; off by default in settings |

---

## 9. Empty states

Every list view has an illustrated empty state with a single action. Examples:

- **No invoices yet** — illustration + "Create your first invoice" button
- **No incoming invoices** — illustration + "Share Shulka with your suppliers — invoices auto-link"
- **No insights yet** — "Add a few invoices and we'll start surfacing decisions"
- **No clients yet (CA)** — "Send an invite to your first client"
- **404** — "We couldn't find that page. [Back to dashboard]"
- **500** — "Something broke. We've been notified. [Retry]"

Illustrations come later (Phase 8). Use simple Lucide icons + careful copy in the meantime.

---

## 10. Voice

Microcopy is Opus's job (see `MASTER_PROMPT.md` §7). Until Opus ships final copy, use Sonnet placeholders that are:
- **Clear over clever.** "Create invoice" beats "Spin up a new bill."
- **Indian-English natural.** "Add a customer" not "Onboard a new client entity."
- **Active voice. Short sentences.**
- **Numbers always in Indian format.**
- **Never use emojis in product UI** (only in OS-level notifications where appropriate).
