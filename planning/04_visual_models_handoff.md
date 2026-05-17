# Shulka — Visual System, Model Routing, Handoff Protocol

Companion to `02_synthesis_and_decisions.md` and `03_phases_approvals_rulebook.md`. Locks the design language, the model routing strategy, and the cross-session continuity system.

## Design language: "Heritage Fintech"

Reference apps studied: Linear (motion), Stripe (forms + clarity), Cred (polish), Razorpay X (Indian fintech clarity), Apple Wallet (card animations), Notion (typography + restraint), Vercel (instant feel), Monzo (warmth in finance).

Shulka takes the best from each. Ignores Cred's coldness, Notion's weight, Linear's utilitarian neutrality.

### Color tokens

| Role | Hex | Notes |
|---|---|---|
| Primary | `#0F5C3F` | Deep emerald — premium, not supermarket green |
| Accent | `#E8A23F` | Marigold — warmth, Indian heritage, sparing use |
| Surface | `#FAF7EE` | Rich cream, warmer than white |
| Ink | `#1B1F1D` | Softer than pure black |
| Success | `#5B8A66` | Sage |
| Warning | `#D49B3F` | Amber |
| Error | `#C25E4A` | Terracotta |
| Info | `#5C6B7A` | Slate-blue |

Subtle gradients only on hero surfaces. No glassmorphism. No flat-design extremes.

### Typography

- Body + headers: **Geist** (free, premium)
- Numerals: **Geist Mono** (tabular figures — critical for finance columns)
- Type scale: 4 steps only (no overcomplication)

### Motion principles

- 60fps target; durations under 250ms; standard ease `cubic-bezier(0.4, 0, 0.2, 1)`
- View Transitions API for navigation (shared elements where possible)
- Optimistic UI on every write
- Skeleton loaders, never spinners
- Number counter animations on dashboard
- Page transitions: subtle slide+fade
- Haptic feedback (Capacitor) for primary mobile actions
- Pull-to-refresh on every list

### Interaction primitives (Day 1)

- Cmd-K command palette
- Sonner toast queue
- Bottom sheets on mobile, modals on desktop
- Long-press menus on mobile
- Inline form auto-save (drafts persist)
- Undo on destructive actions (10s window)
- Smart inputs: `10k`→`₹10,000`, `2cr`→`₹2,00,00,000`, paste GSTIN → auto-validate
- Number-to-words on invoices (Indian legal requirement + premium feel)
- Illustrated empty states with next-action CTA
- Branded 404/error pages

### Dashboard recipe

Big numerals (Razorpay X), breathing whitespace (Linear), gentle gradient hero card (Cred), tabular numerals so columns align (Stripe), inline sparklines, color-coded status pills.

## Indian-context defaults

| Element | Choice |
|---|---|
| Currency display | `₹2,45,000` lakh comma; `₹2.45 L` / `₹24.5 Cr` compact |
| Phone format | `+91 98765 43210` (auto-format on input) |
| GSTIN format | `22 AAAAA 0000A 1Z5` (auto-spaced, auto-upper) |
| PAN format | `ABCDE1234F` (auto-upper) |
| Date display | `15 Mar 2026` |
| Date input | `15/03/2026` |
| Time | 12-hour AM/PM |
| Time zone | IST hardcoded |
| Money storage | integer paise; render via `Intl.NumberFormat('en-IN')` |
| Number-to-words | bundled util for invoice rendering |
| State picker | all Indian states + UTs; PIN-code lookup |
| Festival warmth | subtle Diwali/Holi/New Year banner (off by default) |
| Language | English MVP; `next-intl` infra wired Day 0 |

## Model routing

Hard rule (carried from Bharat Stock X-Ray): **server computes every rupee; LLMs narrate only**. No LLM is asked "what is the GST on X" — only "phrase this pre-computed result."

| Work | Model |
|---|---|
| Master prompt, ADRs, voice/microcopy, decision-insight templates, Trust page, Privacy/ToS, email templates, onboarding copy | **Opus** |
| Daily code generation in Claude Code (90% of the build) | **Sonnet** |
| GST math engine, rule engine, schemas, API routes, components, tests, debugging | **Sonnet** |
| OCR (invoice image → structured JSON) — production runtime | **Gemini 2.5 Flash** (multimodal, free tier, via existing Worker proxy) |
| "Why this rate" narration, decision-insight rendering — production runtime | **Gemini 2.5 Flash** (anti-hallucination preserved) |
| Bank transaction categorization (Phase 7) — production runtime | **Gemini 2.5 Flash** |
| Smart input parsing, validation feedback | **Pure TypeScript** (never an LLM) |

## Progress & handoff system

Files at repo root, every session reads + writes:

```
P:\PradeepDev\AppsIcreated\Shulka\
├── README.md             — what Shulka is, how to set up
├── STATUS.md             — current phase, current task, % done, blockers
├── HANDOFF.md            — what just shipped, what's next, what's stuck
├── DECISIONS.md          — ADR log, every architectural call with date + reason
├── SACRED_RULES.md       — invariants Claude Code must never violate
├── PHASES.md             — phase ladder with acceptance criteria + tickets
└── MASTER_PROMPT.md      — the original master prompt, kept for reference
```

### Session protocol

1. Read STATUS.md → HANDOFF.md → SACRED_RULES.md
2. Pick next task from PHASES.md
3. Execute with Sonnet
4. If a major decision is made, append an ADR to DECISIONS.md
5. At session end: update STATUS.md, write fresh HANDOFF.md

### SACRED_RULES.md (preview)

- Server computes every rupee; LLMs narrate only
- No Firebase, Supabase, Vercel hosting, or paid runtime APIs
- All financial mutations go through the append-only audit log
- All rule lookups go through the rule engine (date-aware)
- Money stored as integer paise
- DPDP Act 2023 compliance is a feature requirement
- Every phase ships with tests; CI is green or you don't advance
- No LLM ever computes a tax rate, amount, or threshold — only narrates pre-computed values
