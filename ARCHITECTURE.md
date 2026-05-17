# Shulka — Architecture

Read this when designing schemas, APIs, file layout, or anything cross-cutting. For sacred invariants, see `SACRED_RULES.md`. For the phase ladder, `PHASES.md`.

---

## 1. System diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       USERS                                       │
│   Browser · PWA install · Capacitor Android · Capacitor iOS(L)   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ HTTPS
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│           CLOUDFLARE EDGE (Mumbai POP, free tier)                 │
│                                                                   │
│   Pages (Next.js SSR + static)   ←  primary surface              │
│   Workers (cron + heavy jobs)    ←  scheduled tasks              │
│   R2 (PDFs, GST notices, scans)  ←  zero egress                  │
│   KV (sessions, short cache)                                     │
│   Web Analytics                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │
            ┌───────────────────┼─────────────────────┐
            │                   │                     │
            ▼                   ▼                     ▼
   ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐
   │  Neon Postgres │  │  Gemini 2.5 Flash│  │  Resend (email) │
   │  AWS Mumbai    │  │  via Pradeep's    │  │  free 3K/mo     │
   │  free 0.5 GB   │  │  CF Worker proxy │  │                 │
   └────────────────┘  └──────────────────┘  └─────────────────┘
```

No part of this stack runs on Pradeep's laptop. The laptop is a code editor.

---

## 2. Repository layout

Monorepo via pnpm workspaces.

```
P:\PradeepDev\AppsIcreated\Shulka\
├── README.md
├── MASTER_PROMPT.md         ← Claude Code's entrypoint
├── SACRED_RULES.md
├── PHASES.md
├── ARCHITECTURE.md          ← this file
├── DESIGN_SYSTEM.md
├── DECISIONS.md             ← ADR log
├── STATUS.md                ← live status, every session updates
├── HANDOFF.md               ← session-to-session note
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .gitignore
├── .env.example
├── planning/                ← original research & decisions
│   ├── 01_original_brainstorm.md
│   ├── 02_synthesis_and_decisions.md
│   ├── 03_phases_approvals_rulebook.md
│   └── 04_visual_models_handoff.md
├── apps/
│   ├── web/                 ← Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (marketing)/   ← public pages: /, /trust, /privacy, /terms
│   │   │   ├── (auth)/        ← /sign-in, /verify
│   │   │   ├── (app)/         ← authenticated app shell
│   │   │   │   ├── dashboard/
│   │   │   │   ├── invoices/
│   │   │   │   ├── purchases/
│   │   │   │   ├── parties/
│   │   │   │   ├── reports/
│   │   │   │   ├── ca/        ← CA-only routes
│   │   │   │   └── settings/
│   │   │   └── api/           ← Next.js API routes (run as edge fns on CF)
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── workers/             ← standalone Cloudflare Workers
│   │   ├── cron/              ← scheduled jobs
│   │   └── heavy/             ← long-running tasks
│   └── mobile/              ← Capacitor wrapper (Phase 6+)
│       ├── android/
│       ├── ios/
│       └── capacitor.config.ts
├── packages/
│   ├── db/                  ← Drizzle ORM schema + migrations
│   │   ├── src/
│   │   │   ├── schema/        ← one file per domain (users, businesses, invoices…)
│   │   │   └── client.ts
│   │   └── drizzle.config.ts
│   ├── gst-engine/          ← pure TS, zero deps; usable in Worker AND Capacitor
│   │   ├── src/
│   │   │   ├── engine.ts
│   │   │   ├── place-of-supply.ts
│   │   │   ├── gstin-validator.ts
│   │   │   ├── computation.ts
│   │   │   ├── gstr-1.ts
│   │   │   ├── gstr-3b.ts
│   │   │   └── index.ts
│   │   └── tests/
│   ├── design-tokens/       ← colors, type, spacing
│   ├── ui/                  ← shared UI components (shadcn-based)
│   ├── shared-types/        ← Zod schemas, TS types shared across apps
│   ├── i18n/                ← next-intl messages
│   └── llm/                 ← Gemini Flash client (insight narration, OCR)
├── rules/                   ← THE GST RULE BOOK (versioned JSON)
│   ├── gst-rates/
│   ├── hsn-codes/
│   ├── place-of-supply/
│   ├── thresholds/
│   ├── reverse-charge/
│   ├── itc-rules/
│   ├── forms/
│   └── sources/             ← archived CBIC notification PDFs
└── scripts/
    ├── seed-data.ts
    ├── deploy.ts
    └── status.ts
```

---

## 3. Database schema (Postgres / Drizzle)

Logical groups. Full Drizzle schema lives in `packages/db/src/schema/*`.

### Identity

```ts
users(
  id uuid pk,
  email text unique,
  name text,
  phone text,
  avatar_url text,
  role enum('business_owner','chartered_accountant','rule_contributor','reviewer','admin'),
  language text default 'en',
  theme enum('light','dark','system') default 'system',
  notification_prefs jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz null   -- soft delete for DPDP right-to-erasure
)

businesses(
  id uuid pk,
  owner_user_id uuid fk users.id,
  name text,
  legal_name text,
  gstin text unique,             -- network-effect index
  pan text,
  state_code text,
  address jsonb,
  registration_date date,
  type enum('proprietorship','partnership','llp','pvt_ltd','public_ltd','huf','other'),
  composition_scheme bool default false,
  created_at, updated_at, deleted_at
)

ca_business_links(
  id uuid pk,
  ca_user_id uuid fk users.id,
  business_id uuid fk businesses.id,
  status enum('pending','approved','rejected','revoked'),
  invited_by uuid fk users.id,
  approved_at timestamptz null,
  unique(ca_user_id, business_id)
)
```

### Parties (address book — customers / suppliers)

`parties` is a pure address book. Trust between two Shulka businesses lives in `business_trusts` (see below) — see ADR-11.

```ts
parties(
  id uuid pk,
  business_id uuid fk businesses.id,           -- this address book entry belongs to whose books
  name text,
  legal_name text,
  external_gstin text null,                    -- if not on Shulka
  linked_business_id uuid fk businesses.id null, -- if on Shulka (network-effect discovery)
  phone text, email text, address jsonb,
  party_kind enum('customer','supplier','both') default 'both',
  created_at, updated_at, deleted_at
)

-- Index: (business_id, external_gstin), (business_id, linked_business_id)
```

### Network-effect trust (separate from address book)

```ts
business_trusts(
  id uuid pk,
  truster_business_id uuid fk businesses.id,    -- whose books grant the trust
  trusted_business_id uuid fk businesses.id,    -- the counterparty being trusted
  status enum('pending','trusted','revoked'),
  elevated_at timestamptz null,
  revoked_at timestamptz null,
  elevated_by_user_id uuid fk users.id null,
  revoked_by_user_id uuid fk users.id null,
  created_at, updated_at,
  unique(truster_business_id, trusted_business_id)
)
-- Trust is directional: B trusting A does not imply A trusts B.
-- Revocation flips status and timestamps; existing mirrored purchase_invoices stay (record of past truth).
```

### Invoicing

Sales and purchases are **separate tables** (see ADR-8). Sales enforce gap-free per-FY numbering (Indian GST law); purchases use the supplier's number which is unique only as `(business_id, party_id, supplier_invoice_number)` to prevent duplicate entry. Network-effect mirroring uses two rows joined by FK — see ADR-10.

```ts
sales_invoices(
  id uuid pk,
  business_id uuid fk businesses.id,
  party_id uuid fk parties.id,                  -- the customer
  invoice_number text,                           -- our number, gap-free per FY
  fy text,                                       -- e.g. "2026-27"
  invoice_date date,
  due_date date null,
  place_of_supply_state text,
  pos_kind enum('intra_state','inter_state','export','sez'),
  status enum('draft','sent','paid','partially_paid','overdue','cancelled'),
  notes text,
  -- totals (integer paise)
  subtotal_paise bigint,
  total_discount_paise bigint,
  total_taxable_paise bigint,
  total_cgst_paise bigint,
  total_sgst_paise bigint,
  total_igst_paise bigint,
  total_cess_paise bigint,
  round_off_paise bigint,
  total_amount_paise bigint,
  -- network-effect linkage (this sale's recipient is on Shulka)
  linked_to_business_id uuid fk businesses.id null,
  linked_purchase_invoice_id uuid fk purchase_invoices.id null,  -- B's mirror, set when trust elevated
  -- cancellation / reversal (per ADR-9)
  cancelled_at timestamptz null,
  cancelled_by_user_id uuid fk users.id null,
  reversed_by_invoice_id uuid fk sales_invoices.id null,         -- points to the reversing entry
  pdf_r2_key text null,
  created_by uuid fk users.id,
  created_at, updated_at,
  unique(business_id, fy, invoice_number)        -- gap-free numbering enforced
)

sales_invoice_items(
  id uuid pk,
  sales_invoice_id uuid fk sales_invoices.id on delete restrict,
  line_no int,
  description text,
  hsn_code text,
  sac_code text null,
  quantity numeric,
  unit text,
  rate_paise bigint,
  discount_pct numeric,
  taxable_paise bigint,
  cgst_rate_pct numeric, cgst_paise bigint,
  sgst_rate_pct numeric, sgst_paise bigint,
  igst_rate_pct numeric, igst_paise bigint,
  cess_rate_pct numeric, cess_paise bigint,
  rule_resolutions jsonb,        -- summary { rate_rule_id, pos_rule_id, ... } — full resolutions in rule_resolutions table
  total_paise bigint
)

purchase_invoices(
  id uuid pk,
  business_id uuid fk businesses.id,             -- whose books
  party_id uuid fk parties.id,                   -- the supplier
  supplier_invoice_number text,                  -- supplier's number — NOT our gap-free sequence
  fy text,
  invoice_date date,
  due_date date null,
  place_of_supply_state text,
  pos_kind enum('intra_state','inter_state','import','sez'),
  status enum('draft','recorded','paid','partially_paid','disputed','cancelled'),
  notes text,
  subtotal_paise bigint,
  total_discount_paise bigint,
  total_taxable_paise bigint,
  total_cgst_paise bigint,
  total_sgst_paise bigint,
  total_igst_paise bigint,
  total_cess_paise bigint,
  round_off_paise bigint,
  total_amount_paise bigint,
  -- network-effect linkage (this purchase mirrors a Shulka sale)
  linked_sales_invoice_id uuid fk sales_invoices.id null,
  linked_from_business_id uuid fk businesses.id null,
  -- cancellation / reversal
  cancelled_at timestamptz null,
  cancelled_by_user_id uuid fk users.id null,
  reversed_by_invoice_id uuid fk purchase_invoices.id null,
  created_by uuid fk users.id,
  created_at, updated_at,
  unique(business_id, party_id, supplier_invoice_number)  -- prevent duplicate entry of same supplier invoice
)

purchase_invoice_items(
  id uuid pk,
  purchase_invoice_id uuid fk purchase_invoices.id on delete restrict,
  line_no int,
  description text,
  hsn_code text,
  sac_code text null,
  quantity numeric,
  unit text,
  rate_paise bigint,
  discount_pct numeric,
  taxable_paise bigint,
  cgst_rate_pct numeric, cgst_paise bigint,
  sgst_rate_pct numeric, sgst_paise bigint,
  igst_rate_pct numeric, igst_paise bigint,
  cess_rate_pct numeric, cess_paise bigint,
  rule_resolutions jsonb,
  total_paise bigint
)
```

Shared TypeScript types (`BaseInvoice`, `BaseInvoiceItem`) live in `packages/shared-types` to dedupe code paths that don't care about the sales/purchase distinction (e.g., totals computation, PDF rendering for both kinds).

### ITC

```ts
itc_entries(
  id uuid pk,
  business_id uuid fk businesses.id,
  purchase_invoice_id uuid fk purchase_invoices.id,
  purchase_invoice_item_id uuid fk purchase_invoice_items.id,
  tax_kind enum('cgst','sgst','igst','cess'),
  amount_paise bigint,
  status enum('claimable','claimed','blocked','reversed'),
  blocked_rule_id text null,     -- when status=blocked, the rule that blocked it
  supplier_filing_known bool default false,
  supplier_filed bool default false,  -- manual until Phase 9 GSTR-2B
  claimed_in_period text null,   -- "2026-04" once claimed in 3B
  created_at, updated_at
)
```

### Composition / scheme elections (grandfathering — see ADR-8 in PHASES P1-06)

```ts
scheme_elections(
  id uuid pk,
  business_id uuid fk businesses.id,
  scheme enum('regular','composition','qrmp'),
  effective_from date,
  effective_to date null,                -- null = currently in force
  rule_set_at_election jsonb,            -- snapshot { threshold_rule_id, rate_rules: [...] } for grandfathering
  declaration_filed_on date null,        -- when the election was filed with GST authorities
  created_at, updated_at
)
-- Index: (business_id, effective_from desc)
-- Used by rule engine when resolving threshold-sensitive rules for a transaction date.
```

### Audit log (append-only)

```ts
audit_events(
  id uuid pk,
  ts timestamptz default clock_timestamp(),    -- NOT now() — chronological order within a transaction matters
  actor_user_id uuid fk users.id,
  business_id uuid fk businesses.id null,
  kind text,                     -- 'sales_invoice.created', 'party.trust_elevated', 'itc.claimed', ...
  ref_table text,                -- which table ref_id points into ('sales_invoices', 'purchase_invoices', 'business_trusts', ...)
  ref_id uuid null,              -- the row this event is about
  payload jsonb,                 -- shape per `kind` — see "Audit payload shapes" below
  rule_ids text[] null           -- summary of rule_ids resolved during this event; full citations live in rule_resolutions
)
-- Indexes: (business_id, ts desc), (kind, ts desc)
-- INSERT ONLY. Enforced via:
--   1. DB role grants — application connects as `shulka_app` which has only INSERT, SELECT.
--   2. BEFORE UPDATE OR DELETE trigger raising an exception — belt and suspenders against admin error.
```

#### Audit payload shapes (per `kind`)

Defined as Zod schemas in `packages/shared-types/src/audit-events.ts`. Initial set:

| `kind` | `ref_table` | `payload` shape |
|---|---|---|
| `sales_invoice.created` | `sales_invoices` | `{ total_amount_paise, party_id, invoice_number }` |
| `sales_invoice.status_changed` | `sales_invoices` | `{ from, to, reason? }` |
| `sales_invoice.cancelled` | `sales_invoices` | `{ reversing_invoice_id, reason }` |
| `purchase_invoice.created` | `purchase_invoices` | `{ total_amount_paise, party_id, supplier_invoice_number }` |
| `purchase_invoice.status_changed` | `purchase_invoices` | `{ from, to, reason? }` |
| `purchase_invoice.cancelled` | `purchase_invoices` | `{ reversing_invoice_id, reason }` |
| `party.created` / `party.updated` | `parties` | `{ fields_changed: string[] }` |
| `business_trust.elevated` | `business_trusts` | `{ trusted_business_id, prior_status }` |
| `business_trust.revoked` | `business_trusts` | `{ trusted_business_id, prior_status }` |
| `itc.claimed` | `itc_entries` | `{ amount_paise, period }` |
| `itc.blocked_override` | `itc_entries` | `{ original_blocked_rule_id, override_reason }` |
| `business.created` / `business.updated` | `businesses` | `{ fields_changed: string[] }` |
| `user.deleted` | `users` | `{ user_id }` (for DPDP erasure) |

New `kind` values require a Zod schema added to the same file.

### Rule resolutions (per-line-item frozen citations)

Separate from `audit_events` — see "Dual-write specification" below.

```ts
rule_resolutions(
  id uuid pk,
  ts timestamptz default clock_timestamp(),
  invoice_kind enum('sales','purchase'),
  invoice_item_id uuid null,                -- references sales_invoice_items.id OR purchase_invoice_items.id (depending on invoice_kind)
  domain text,                              -- 'gst_rate', 'pos', 'itc_block', ...
  rule_id text,                             -- references the rule_id in JSON files
  source_citation_json jsonb,               -- frozen copy of the source block at resolution time
  resolved_value jsonb                      -- the value returned (rate, cgst+sgst, etc.)
)
-- INSERT-ONLY. Same role grants + trigger as audit_events.
-- Indexes: (invoice_kind, invoice_item_id), (rule_id, ts desc)
-- Partition by month if needed at scale.
```

### Dual-write specification (audit_events + rule_resolutions)

When an invoice is finalized (sale or purchase moves from `draft`), the creation transaction runs in this order:

1. INSERT into `sales_invoices` / `purchase_invoices` (and items).
2. For each `(invoice_item × tax_kind)` computed by the rule engine: INSERT one `rule_resolutions` row capturing the frozen `source_citation_json` and `resolved_value`.
3. Call `recordEvent({ kind, ref_table, ref_id, payload, rule_ids })` which inserts one `audit_events` row. The `rule_ids` column is the summary array of rule_ids resolved in step 2; the full frozen citations live only in `rule_resolutions`.

`rule_resolutions` is written **only** by the invoice/purchase creation paths. `audit_events` is written by every state-changing operation (invoice creation, status change, cancellation, trust elevation, ITC claim, business edit, user deletion).

If the transaction fails at any step, all inserts roll back together. The application layer must wrap creation flows in a single Drizzle transaction.

### Rule book (read-only at runtime; source of truth in /rules/*.json)

Rules are *not* in the DB. They live in version-controlled JSON files in `/rules/`. The rule engine loads them at cold start. See `/planning/03_phases_approvals_rulebook.md` for the philosophy and rule-file shape.

The `rule_resolutions` DB table mirrors *what's been resolved* for traceability — schema and dual-write contract are specified above under "Audit log" + "Dual-write specification."

### Reminders & notifications

```ts
reminders(
  id uuid pk,
  business_id uuid fk businesses.id,
  user_id uuid fk users.id,
  kind enum('filing_deadline','document_upload','payment_due','custom'),
  title text, body text,
  due_at timestamptz,
  recurring enum('none','monthly','quarterly','yearly') default 'none',
  done_at timestamptz null
)

notifications(
  id uuid pk,
  user_id uuid fk users.id,
  channel enum('email','in_app','push'),
  title text, body text,
  link_url text,
  sent_at timestamptz,
  read_at timestamptz null
)
```

### CA messaging (Phase 5)

```ts
threads(
  id uuid pk,
  business_id uuid fk businesses.id,    -- the client business this thread is about
  created_at
)

messages(
  id uuid pk,
  thread_id uuid fk threads.id,
  sender_user_id uuid fk users.id,
  body text,
  attachments jsonb,                    -- [{ r2_key, filename, mime }]
  created_at,
  read_by_user_ids jsonb default '[]'
)
```

---

## 4. Auth flow

Auth.js v5 in the Next.js app:

1. User clicks "Continue with Google" → redirect → callback → `users` row upsert by email.
2. OR user enters email → magic link via Resend → callback → `users` row upsert.
3. JWT session stored in encrypted cookie (Auth.js default).
4. First sign-in routes to `/onboarding` (role selection + first business creation).
5. Existing user routes to `/dashboard`.

For Capacitor (Phase 6):
- Web's auth flow is reused inside the WebView for desktop-style flows.
- BUT the native Google Sign-In plugin gives a better UX. Plugin returns Google ID token → POST to `/api/auth/native-google` → server verifies with Google's JWKS → issues our session cookie.

---

## 5. Rule engine

Lives in `packages/gst-engine/`. Pure TypeScript, zero runtime deps. Imports JSON rules from `/rules/`.

### Public API

```ts
import { RuleEngine, resolveGstRate, computeInvoiceLine, placeOfSupply } from 'shulka-gst-engine'

const engine = await RuleEngine.load('/rules/')

const { rate, rule_id, source_citation } = engine.resolveGstRate({
  hsn: '8409',
  transaction_date: '2026-04-15'
})
// → { rate: 12, rule_id: 'GST_RATE_HSN_8409_v3', source_citation: {...} }
```

### Rule file shape

See `/planning/03_phases_approvals_rulebook.md` for the canonical shape. Recap:

```json
{
  "rule_id": "string (unique)",
  "effective_from": "ISO date",
  "effective_to": "ISO date | null",
  "supersedes": "rule_id | null",
  "source": { "type", "id", "council_meeting", "url", "archived_pdf", "summary" },
  "rule": { "kind": "...", "...domain-specific..." },
  "submitted_by": { "name", "membership_no", "user_id" },
  "approved_by": { "name", "membership_no", "user_id" },
  "approved_at": "ISO timestamp",
  "interpretation_note": "string | null",
  "tests": [ { ... golden test cases ... } ],
  "hash": "sha256 of canonicalized content"
}
```

### Loading & indexing

- At Cloudflare Worker cold start: GST rate / PoS / ITC / threshold rules are bundled as JSON modules. The HSN master (~12K codes) is **lazy-loaded from R2** and cached in KV after first fetch — keeps the worker bundle small.
- Built into in-memory indexes: by `(domain, key, effective_from desc)`.
- **Cold-start does only hash validation** of the bundled rule files (cheap; microseconds). Schema correctness and golden tests are CI's job, not runtime's.
- Resolution: index lookup by `(domain, key)`; among matches, pick the rule whose `[effective_from, effective_to)` interval contains the transaction date.
- Per-request resolution memoization (cleared between requests).

### Load-time invariants (hard-fail)

The engine panics at cold start, and CI fails, if any of these hold:
1. **Rule overlap.** Two rules with the same `(domain, key)` whose `[effective_from, effective_to)` intervals overlap. "Latest wins" is forbidden — if you want to supersede an old rule, the old rule's `effective_to` must be set to the new rule's `effective_from`.
2. **Duplicate `rule_id`.** Two rule files declaring the same `rule_id`.
3. **Hash mismatch.** A rule file whose content does not match its declared `hash` field.
4. **`supersedes` chain broken.** A rule that names `supersedes: X` where X does not exist or has `effective_to` later than this rule's `effective_from`.

These invariants make "which rule resolves" deterministic and reviewable.

### CI

- `pnpm test:rules` runs Zod schema validation on every rule file.
- All golden tests in every rule file run on every PR.
- The four load-time invariants above are checked in CI as well as at runtime.
- Block PRs that fail any check.

---

## 6. API surface (high level)

Next.js API routes under `apps/web/app/api/`. All TypeScript, all Zod-validated.

```
POST   /api/auth/*            (Auth.js managed)

GET    /api/me                  Current user + active business
PATCH  /api/me                  Update profile

GET    /api/businesses
POST   /api/businesses
GET    /api/businesses/:id
PATCH  /api/businesses/:id
DELETE /api/businesses/:id     (soft delete, DPDP)

GET    /api/parties
POST   /api/parties
PATCH  /api/parties/:id
DELETE /api/parties/:id        (soft delete)

GET    /api/trusts             List business_trusts where current business is truster
POST   /api/trusts             Elevate trust (truster_business_id, trusted_business_id)
DELETE /api/trusts/:id         Revoke trust (status → revoked)

GET    /api/sales              Sales invoices for current business
POST   /api/sales              Create sales invoice (server computes taxes; allocates gap-free number)
GET    /api/sales/:id
PATCH  /api/sales/:id          Drafts only for monetary fields; status/notes anytime (per ADR-9)
POST   /api/sales/:id/send
POST   /api/sales/:id/cancel   Status → cancelled + reversing entry (per ADR-9)
GET    /api/sales/:id/pdf      Returns R2 signed URL

GET    /api/purchases          Purchase invoices for current business
POST   /api/purchases          Manual entry (server computes taxes)
GET    /api/purchases/:id
PATCH  /api/purchases/:id
POST   /api/purchases/:id/cancel

GET    /api/incoming           Quarantined sales_invoices where linked_to_business_id = current business AND no trust
POST   /api/incoming/:id/accept  Elevate trust + create purchase_invoices mirror in current business's books

GET    /api/itc/summary
POST   /api/itc/:id/claim
POST   /api/itc/:id/block-override

GET    /api/reports/gstr-1?month=YYYY-MM
GET    /api/reports/gstr-3b?month=YYYY-MM
GET    /api/reports/export?format=json|xlsx&...

GET    /api/dashboard           Computed insights for current business

GET    /api/ca/clients
POST   /api/ca/clients/invite
GET    /api/ca/clients/:id/...  Mirror of business endpoints, scoped

GET    /api/audit?...           Filtered audit log

POST   /api/llm/insight         Server-side: pre-computed values in, narrative out
POST   /api/llm/ocr             Multipart: image, returns structured invoice JSON
```

---

## 7. Cron jobs (Cloudflare Workers Cron)

| Schedule | Job |
|---|---|
| `0 1 * * *` (1 AM IST) | Daily ITC-at-risk recompute, send reminders |
| `0 9 * * *` | Filing-due-date reminders (7d, 3d, 0d before) |
| `0 2 * * *` | Nightly DB→R2 backup |
| `*/15 * * * *` | Outbound email/notification flush |

All cron handlers live in `apps/workers/cron/`.

---

## 8. Environment variables

`.env.example` (committed):

```
# Auth
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM=Shulka <hello@shulka.pradeepjainbp.in>

# Database
DATABASE_URL=postgres://...neon.../neondb?sslmode=require

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
R2_BUCKET=shulka-files
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
KV_NAMESPACE_ID=

# LLM
GEMINI_PROXY_URL=https://...workers.dev/...
GEMINI_PROXY_TOKEN=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# Cloudflare Web Analytics
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=

# GitHub bot (for rule-contributor PRs in Phase 8)
GITHUB_BOT_TOKEN=
GITHUB_REPO=pradeepjainbp/Shulka
```

---

## 9. Performance targets

- First contentful paint < 1.5s on 3G (web)
- Time-to-interactive < 3s on mid-range Android via Capacitor
- API p95 latency < 200ms (mostly served from Mumbai edge)
- Invoice creation feels instant (optimistic UI; server confirmation < 800ms p95)
- PDF generation < 2s p95

---

## 10. What is not in this architecture

- No microservices. Monorepo, monolith API.
- No GraphQL. REST + Zod.
- No Redis. Cloudflare KV is the cache.
- No queue system in MVP. Cloudflare Workers Cron + direct invocation handles it. Add Queues if needed later.
- No Kubernetes. Cloudflare runs everything.
