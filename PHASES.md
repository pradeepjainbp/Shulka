# Shulka — Phase Ladder & Tickets

This is your ticket queue. Pull tasks from here, set them in-progress in `STATUS.md`, ship, mark complete.

Ticket ID format: `P{phase}-{number}` e.g., `P0-03`.

Each ticket has: **Goal**, **Acceptance** (must pass to mark done), **Out of scope** (explicitly *not* this ticket).

---

## PHASE 0 — Setup (≈1 week)

**Goal:** Repo initialized, design system in place, auth working, "hello Shulka" deployed at `shulka.pradeepjainbp.in`. Pradeep can sign in and see his own name. DB foundation, audit log, role enforcement, backups, i18n + PWA scaffold all in place.

**Phase 0 ticket order was revised on 2026-05-02 — see HANDOFF.md for the audit findings that drove this. The revised order has nine tickets executing strictly in sequence.**

### P0-01 — Initialize monorepo + tooling
- **Goal:** pnpm monorepo, Next.js 14 app, Biome, Vitest, Playwright, GitHub Actions CI scaffolded.
- **Acceptance:** `pnpm install` works · `pnpm test` runs · `pnpm dev` starts on `localhost:3000` · push to `main` triggers GitHub Action that runs lint+test (no deploy yet).
- **Out of scope:** any UI, any auth, any DB.

### P0-02 — Repo config files (formerly P0-07)
- **Goal:** All config / governance files in place from Day 1. Tracker files (`STATUS.md`, `HANDOFF.md`, `DECISIONS.md`, `SACRED_RULES.md`, `MASTER_PROMPT.md`, `PHASES.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `CONTEXT_STRATEGY.md`) are already populated; this ticket adds `.gitignore` (with secret patterns), `.env.example` (full key list, no values), `LICENSE` (proprietary all-rights-reserved at root; CC0 in `/rules/` so the rule book stays open), `CONTRIBUTING.md`, and a populated `README.md`.
- **Acceptance:** All files exist · `.gitignore` blocks `.env*` (except `.env.example`), `node_modules`, `.next`, `dist`, OS files · two LICENSE files (root + `/rules/`) · CI step verifies these files exist (basic header check).
- **Why this slot:** secrets must not leak into the very first commits. This must execute immediately after P0-01.
- **Out of scope:** any code.

### P0-03 — Cloudflare Pages + Neon + R2 + KV + Drizzle + audit foundation + backups
- **Goal:** All infra live and the DB foundation laid. This is the largest P0 ticket and is intentionally not split — it's all "infra + DB foundation" and ordering bugs are easy if separated.
- **Acceptance:**
  - Project on Cloudflare Pages with preview URL working · Neon DB on AWS Mumbai · R2 bucket · KV namespace · secrets in `.env.local` (not committed).
  - `packages/db/` set up with Drizzle ORM + Neon HTTP driver + `drizzle.config.ts` + migration runner (`pnpm db:migrate`).
  - Initial migration applies these tables: `users`, `audit_events`, `rule_resolutions` (schemas per ARCHITECTURE.md §3).
  - Two Postgres roles created: `shulka_owner` (owns schema, runs migrations) and `shulka_app` (application connection, INSERT+SELECT on `audit_events` and `rule_resolutions`, full CRUD on other tables). Application uses `shulka_app`.
  - `BEFORE UPDATE OR DELETE` triggers on `audit_events` and `rule_resolutions` raise an exception (belt-and-suspenders enforcement of Sacred Rule 3).
  - `audit_events.ts` and `rule_resolutions.ts` columns default to `clock_timestamp()`, not `now()`.
  - Neon PITR confirmed enabled in console (document the recovery window in `README.md`).
  - Nightly cron Worker stub in `apps/workers/cron/db-backup.ts` writes a placeholder file to R2 (real `pg_dump` invocation can be wired in Phase 4 when there's data worth backing up — but the cron, the Worker, and the R2 path exist Day 1).
  - DB connection via Neon HTTP driver verified in a hello-world API route.
- **Out of scope:** custom domain (next ticket).

### P0-04 — DNS: `shulka.pradeepjainbp.in` → Cloudflare Pages
- **Goal:** Subdomain on Pradeep's existing site routes to the Pages project. HTTPS works.
- **Acceptance:** `https://shulka.pradeepjainbp.in` returns the hello-world page with valid cert · `main` branch auto-deploys via Cloudflare Pages Git integration (verified by pushing a trivial change).
- **Out of scope:** redirects, www variants.

### P0-05 — Design tokens + Geist font + base layout
- **Goal:** `packages/design-tokens` with the locked palette (primary `#0F5C3F`, accent `#E8A23F`, surface `#FAF7EE`, ink `#1B1F1D`, plus status colors). Geist + Geist Mono via `next/font`. App shell with header + sidebar/bottom-nav per breakpoint.
- **Acceptance:** A `/styleguide` route (not Storybook — keep Phase 0 light) shows tokens, type scale, primary button, input, card. Visual feel matches `DESIGN_SYSTEM.md` reference.
- **Out of scope:** dark mode, additional locales (P0-06 wires the locale infra).

### P0-06 — i18n (next-intl) + PWA scaffold
- **Goal:** i18n and PWA infra wired Day 1 per Sacred Rule 17 and ADR-1. `next-intl` configured with `en` as the only locale; locale routing via `[locale]/...` segment in App Router; messages package at `packages/i18n/`. `manifest.json` + service worker (via `next-pwa`) + install prompt + Shulka icon set (placeholder generated by AI for now; production icons in Phase 8).
- **Acceptance:** Pages render under `/en/...` · `pnpm build` produces a service worker · "Install Shulka" prompt appears in Chrome desktop after the install criterion fires · `manifest.json` validates.
- **Out of scope:** additional locales (Hindi etc. — i18n infra is wired but not populated until v1.1).

### P0-07 — shadcn/ui + Tremor + Sonner + Lucide installed and themed
- **Goal:** All four libraries integrated, themed to Shulka tokens. A demo page proves Button, Input, Dialog, Card, Toast, LineChart, BarChart.
- **Acceptance:** `/styleguide` page renders all components correctly themed.

### P0-08 — Auth.js v5: Google OAuth + Email magic link via Resend
- **Goal:** Both providers working. User row created in `users` table on first sign-in.
- **Pre-flight:** Before this ticket starts, do a 30-minute throwaway POC confirming Auth.js v5 + Drizzle adapter + Neon HTTP + Cloudflare Pages edge runtime work end-to-end with Google OAuth. If they don't: fall back to JWT-only sessions per ADR-14 and document it.
- **Acceptance:**
  - Google sign-in works · Email magic-link works (test against Pradeep's Gmail) · `users` row upsert on first sign-in · `/me` API returns the session user matching the Zod schema in `packages/shared-types/src/api/me.ts` (does not return `notification_prefs`, `phone`, or other fields not needed for the shell) · sign-out works.
  - **Rate limiting on magic-link endpoint:** KV-backed token bucket. 5 sends per email per hour; 20 sends per IP per hour. Reject with HTTP 429.
  - **Playwright e2e test** (satisfies Sacred Rule 10 for Phase 0): signs in via magic-link with a mocked Resend webhook, asserts `/me` returns the user, signs out, asserts `/me` returns 401.
- **Out of scope:** WhatsApp OTP (v1.1) · phone-number capture (Phase 1).

### P0-09 — Cloudflare Web Analytics + Sentry hookup
- **Goal:** Analytics + comprehensive error tracking flowing.
- **Acceptance:**
  - Page views land in Cloudflare Web Analytics.
  - React error boundary at the app shell catches client-side errors and reports to Sentry.
  - Server-side `withErrorReporting()` wrapper around API routes catches unhandled errors and reports to Sentry.
  - A "trip the boundary" script verifies BOTH paths land in Sentry — not just `throw new Error('test')` in one handler.
  - Sentry source maps uploaded as part of the deploy pipeline.

**Phase 0 done when:** Pradeep can sign in at `shulka.pradeepjainbp.in`, see his name, sign out. `/styleguide` reachable. CI green. All tracker files initialized. Audit log foundation (DB roles + triggers) verified by attempting an UPDATE and seeing it rejected. PWA installable. e2e auth test passing in CI.

---

## PHASE 1 — Identity & Foundation (≈2 weeks)

**Goal:** A Shulka user can complete onboarding (role, business profile, GSTIN), build a customer/supplier directory, search HSN codes. The rule engine exists with a minimal seeded rule set.

### P1-01 — User profile + role selection
- **Goal:** Onboarding flow: "Are you a Business Owner or a CA?" → save role on user.
- **Acceptance:** New user is forced into role selection · returning user goes to dashboard · role stored in `users.role`.
- **Roles seeded:** `business_owner`, `chartered_accountant`, `rule_contributor`, `reviewer`, `admin`. Default new sign-up gets `business_owner` or `chartered_accountant`.

### P1-02 — Business entity creation
- **Goal:** A user (business owner) creates one or more `business` rows. Each has name, GSTIN, PAN, address, state, type (proprietorship/partnership/LLP/Pvt Ltd), GST registration date.
- **Acceptance:** Form validates GSTIN structurally + checksum · saves to `businesses` table · user can list/edit own businesses.
- **Network-effect note:** the GSTIN is what links incoming invoices. Index uniquely.

### P1-03 — GSTIN validator (15-char + Mod-36 checksum)
- **Goal:** Pure-TypeScript util in `packages/gst-engine/src/gstin-validator.ts`. Validates 15-char structure, state code (first 2 digits ∈ valid state codes), PAN embedded (chars 3–12), checksum digit.
- **Acceptance:** Unit tests with 50+ valid GSTINs and 50+ invalid GSTINs (including all known failure modes). 100% coverage on this module.

### P1-04 — Party (customer/supplier) directory
- **Goal:** Users add parties manually or link to existing Shulka businesses by GSTIN. `parties` is a pure address book per ARCHITECTURE.md §3 — trust state lives in `business_trusts`, not on `parties`.
- **Acceptance:** Add party manually works · search by name/GSTIN works · adding a party whose GSTIN matches an existing Shulka `businesses` row populates `parties.linked_business_id` (network-effect discovery) · the "External" badge in the UI is computed from `linked_business_id` + `business_trusts` lookup, not from a column on `parties`.
- **Out of scope:** trust elevation flow and `business_trusts` writes (Phase 2 P2-03).

### P1-05 — HSN/SAC code search
- **Goal:** Bundle ~12,000 HSN codes + ~600 SAC codes as static JSON. Build an autocomplete searcher with prefix + fuzzy matching.
- **Acceptance:** Type "computer" → relevant HSN codes show in <100ms · type "8471" → exact code matches show.
- **Source:** CBIC's published HSN master list (commit the JSON to `/rules/hsn-codes/master.json`).

### P1-06 — Rule engine skeleton + scheme_elections + load-time invariants
- **Goal:** `packages/gst-engine/src/engine.ts` loads JSON rules from `/rules/`, indexes by domain + key + effective_from, exposes `resolveRule(domain, key, transactionDate, opts?)` returning `{ rule, source_citation, rule_id }`. Also creates the `scheme_elections` table for grandfathering (composition / QRMP).
- **Acceptance:**
  - Load 10 seeded rules · resolve one for a date in 2024 vs 2026 → returns correct version.
  - HSN master is lazy-loaded from R2 (not bundled) per ARCHITECTURE.md §5; cached in KV after first fetch.
  - **Load-time invariants** (per ARCHITECTURE.md §5) enforced at cold start AND in CI: rule overlap → panic, duplicate rule_id → panic, hash mismatch → panic, broken supersedes chain → panic.
  - `scheme_elections` table migration applied. Engine accepts an optional `scheme_election` argument and uses `rule_set_at_election` to grandfather threshold-sensitive rules.
  - Cold-start does only hash validation; Zod validation runs in CI only.
- **Seed rules:** initial GST rate set (5/12/18/28), composition threshold ₹1.5 Cr, e-invoicing threshold ₹5 Cr (current), inter-state vs intra-state PoS rules, blocked credits Section 17(5) basics.

### P1-07 — Place-of-supply engine
- **Goal:** `placeOfSupply({ supplier_state, recipient_state, transaction_type })` → returns `'CGST_SGST' | 'IGST'` plus reasoning.
- **Acceptance:** All 28 states + 8 UTs covered · SEZ supplier flag → IGST · export → IGST/zero-rated · 30+ test cases.

### P1-08 — Audit log helper + payload schemas
- **Goal:** The `audit_events` and `rule_resolutions` tables are already created in P0-03. This ticket builds the application-layer helper and the per-`kind` Zod payload schemas. Helper signature: `recordEvent({ actor_user_id, business_id, kind, ref_table, ref_id, payload, rule_ids })`. All downstream code uses this helper exclusively.
- **Acceptance:**
  - Per-`kind` Zod schemas in `packages/shared-types/src/audit-events.ts` — minimum the set listed in ARCHITECTURE.md §3 "Audit payload shapes."
  - `recordEvent` validates `payload` against the matching `kind` schema before INSERT; throws on mismatch.
  - Retroactively wired into P1-02 (business.created event) and P1-04 (party.created event) — go back and add the calls.
  - **Verification test:** an integration test attempts an UPDATE on `audit_events` and asserts the trigger from P0-03 raises an exception.
  - Event stream queryable by `(business_id, ts desc)` and `(kind, ts desc)` indexes.

**Phase 1 done when:** A new user signs up, picks a role, creates a business, adds 3 parties (one of which is another Shulka user), searches HSN, all data flows through audit log. Rule engine resolves a rate for a sample HSN+date.

---

## PHASE 2 — Invoicing (≈3–4 weeks)

**Goal:** A user creates a B2B invoice for either a Shulka-internal party (network-effect) or external GSTIN, with auto place-of-supply, auto CGST/SGST/IGST split via the rule engine, downloadable PDF, shareable via WhatsApp/email/UPI link.

### P2-01 — Sales invoice schema + create form
- **Goal:** `sales_invoices` + `sales_invoice_items` tables (per ADR-8 — sales and purchases are separate tables). Sequential numbering per business per FY enforced by `unique(business_id, fy, invoice_number)`. Server-side number allocation only (no client-side number guessing — see ADR-13).
- **Acceptance:** Migration applies both tables · form lets user select party, add items (HSN, qty, rate, discount), preview tax computation in real-time via the rule engine · saves correctly · numbering gap-free · creation flow runs in a single Drizzle transaction that also writes `rule_resolutions` rows and one `audit_events` row per the dual-write contract in ARCHITECTURE.md §3.

### P2-02 — Place-of-supply auto + CGST/SGST/IGST split
- **Goal:** When user picks party with state X and items, engine auto-decides intra vs inter-state and splits tax. User can override with reasoning (logged).
- **Acceptance:** Karnataka business + Karnataka party + 18% slab → 9% CGST + 9% SGST · same business + Maharashtra party → 18% IGST · audit event records rule_id used.

### P2-03 — Network-effect: mirrored rows + `business_trusts`
- **Goal:** Implement the mirrored-row linking pattern (ADR-10) and the `business_trusts` table (ADR-11). Quarantine-then-elevate flow.
- **Acceptance:**
  - `business_trusts` table migration applied.
  - When a sales invoice is created and `parties.linked_business_id` is set (recipient is on Shulka), `sales_invoices.linked_to_business_id` is populated automatically.
  - `/incoming` API returns `sales_invoices` rows where `linked_to_business_id = current_business_id` AND no `business_trusts` row with `(truster=current, trusted=sender, status='trusted')`.
  - "Trust this supplier" action: in a single transaction, INSERT/UPDATE the `business_trusts` row to `trusted` AND create `purchase_invoices` mirror rows in B's books for this invoice and any prior quarantined invoices from the same sender. Cross-link `linked_purchase_invoice_id` ↔ `linked_sales_invoice_id`.
  - "Revoke trust" action (in settings): `business_trusts` row → `revoked`. Existing `purchase_invoices` mirrors stay (record of past truth). Future incoming invoices from that sender go back to quarantine.
  - Audit events: `business_trust.elevated`, `business_trust.revoked`, plus `purchase_invoice.created` for each auto-mirrored row.
- **Reference:** ADR-10, ADR-11, ADR-12 (DPDP justification for the silent GSTIN lookup).

### P2-04 — PDF generation (pdf-lib, server-side)
- **Goal:** Branded GST-compliant invoice PDF. Includes: business letterhead, GSTIN, invoice number/date, party details, line items, HSN, taxable value, CGST/SGST/IGST split, total, **amount in words** (Indian English), QR code for UPI payment, "Sign up for Shulka" CTA in footer (only when recipient is non-Shulka).
- **Acceptance:** PDF renders correctly · stored in R2 · public link expires after 7 days for non-recipients · always-accessible link for sender + recipient (both authenticated).

### P2-05 — Invoice share: WhatsApp Web link, email via Resend, copy URL
- **Goal:** Share button opens: WhatsApp Web (with pre-filled message), Email (Resend templated), Copy URL.
- **Acceptance:** All three paths produce a working link to the PDF · email is branded via the email-template package.
- **Note:** WhatsApp Cloud API integration is v1.1 (after dedicated business number); for now WhatsApp share is via `wa.me` URL scheme.

### P2-06 — UPI payment link on invoice
- **Goal:** Invoice has an embedded UPI link (`upi://pay?pa=...&pn=...&am=...`). QR code in PDF. Web invoice view has "Pay now" button.
- **Acceptance:** Link renders correct UPI deep-link · QR scans → opens any UPI app pre-filled.
- **Out of scope:** payment confirmation tracking (Phase 3+).

### P2-07 — Invoice list + filters + draft auto-save
- **Goal:** `/invoices` lists all invoices with status (draft/sent/paid/cancelled). Filters: party, date range, status, amount range. Drafts auto-save every 5s.
- **Acceptance:** Lists · filters · drafts persist on page refresh.

### P2-08 — "Why this rate" affordance (trust layer)
- **Goal:** Every tax line item on an invoice has an `ⓘ` icon. Clicking shows: rule_id, source notification, reviewer name, "Times used" count.
- **Acceptance:** Modal shows correct info pulled from `rule_resolutions` table (frozen citation) + reviewer info from the rule file.

### P2-09 — Cancellation via reversing entry (per ADR-9)
- **Goal:** Implement the "status mutable, monetary fields immutable" pattern. Cancelling a sent sales invoice = status transition to `cancelled` PLUS a reversing entry (a new `sales_invoices` row with negated totals, `reversed_by_invoice_id` pointing back).
- **Acceptance:**
  - `POST /api/sales/:id/cancel` runs in one transaction: UPDATE original row's `status='cancelled'`, `cancelled_at`, `cancelled_by_user_id`; INSERT reversing row with negated totals and a new gap-free invoice number; cross-link `reversed_by_invoice_id`; emit `sales_invoice.cancelled` audit event.
  - Same flow for purchases via `POST /api/purchases/:id/cancel`.
  - Attempting to cancel an already-cancelled invoice returns 409.
  - Test asserts that monetary fields on the original cancelled row are NOT modified — only status fields.

**Phase 2 done when:** Pradeep can create an invoice from himself to a test customer, share it, the customer (if on Shulka) sees it in their Incoming feed and can elevate trust to mirror it as a purchase; PDF looks production-quality; cancellation produces a reversing entry not a delete.

---

## PHASE 3 — Purchases & ITC (≈2–3 weeks)

**Goal:** User records purchases. ITC ledger tracks claimable credit. "ITC at risk" detector flags credit blocked by supplier non-compliance.

### P3-01 — Purchase invoice entry (manual)
- **Goal:** Form for recording a purchase manually (i.e., the supplier is not on Shulka or trust hasn't been elevated, so no auto-mirror exists). Writes to `purchase_invoices` + `purchase_invoice_items` (per ADR-8). Supplier must be a `parties` row.
- **Acceptance:** Form works · creation runs in a single transaction with `rule_resolutions` writes and a `purchase_invoice.created` audit event · ITC entries computed via rule engine and inserted into `itc_entries` (per P3-02 schema) · `unique(business_id, party_id, supplier_invoice_number)` prevents accidental duplicate entry of the same supplier invoice.

### P3-02 — ITC ledger
- **Goal:** Schema `itc_entries` (one row per invoice item × tax kind). Status: `claimable | claimed | blocked | reversed`.
- **Acceptance:** Each purchase line creates ITC entries · running balance per tax kind (CGST/SGST/IGST) shown on dashboard.

### P3-03 — Section 17(5) blocked-credit checker
- **Goal:** Rule engine has `/rules/itc-rules/blocked-credits-17-5.json`. When a purchase HSN/category falls in blocked list, the ITC entries are auto-marked `blocked` with the rule citation.
- **Acceptance:** Test cases for motor vehicle ITC, food/beverage, club membership all correctly blocked. Override allowed with reasoning logged.

### P3-04 — "ITC at risk" detector + alert
- **Goal:** Background job checks: for each claimable ITC entry, has the supplier filed GSTR-1 covering this invoice? (Stub for now: a flag on suppliers indicating "filing status known/unknown" — real GSTR-2B fetch is Phase 9.) For now, allow user to manually mark "supplier filed?" yes/no.
- **Acceptance:** Dashboard shows "₹X ITC at risk because suppliers haven't filed" · drilldown to specific invoices.
- **Note:** This is the differentiating insight. The full automated version comes in Phase 9 with GSP. The Phase 3 version is the manual-input scaffold.

### P3-05 — Purchase list + filters
- **Goal:** Same as P2-07 but for purchases. Plus filter "ITC status".
- **Acceptance:** Works.

**Phase 3 done when:** User has both sales and purchases logged, ITC ledger shows running balance, "ITC at risk" surfaces a real number on the dashboard.

---

## PHASE 4 — Summaries, Insights, Exports (≈2 weeks)

**Goal:** GSTR-1 + GSTR-3B can be computed for any month and exported in JSON (portal-uploadable) and Excel. Dashboard shows decision insights.

### P4-01 — GSTR-1 computation
- **Goal:** Aggregate sales for a month into GSTR-1 sections (B2B, B2C-Large, B2C-Small, Exports, Credit/Debit Notes, HSN summary).
- **Acceptance:** Test case: 20 sample invoices → expected GSTR-1 sections produced. Schema follows GST Council JSON spec (`/rules/forms/gstr-1.schema.json`).

### P4-02 — GSTR-3B computation
- **Goal:** Output tax liability + ITC + net payable per tax kind.
- **Acceptance:** Test case verified.

### P4-03 — JSON export (portal-uploadable)
- **Goal:** Export GSTR-1 / GSTR-3B as JSON in the format the GST portal accepts for upload.
- **Acceptance:** Format validates against the schema.

### P4-04 — Excel export
- **Goal:** Both summaries downloadable as styled .xlsx (via `exceljs`).
- **Acceptance:** Opens cleanly, has Shulka branding.

### P4-05 — Dashboard with 10–15 decision insights
- **Goal:** Home screen shows real, computed insights (not generic "top expenses"). Examples to implement:
  - "₹X of ITC will lapse if not claimed by [date]" (based on time-limit rule)
  - "Y of your suppliers haven't been confirmed as filed; ₹Z ITC at risk"
  - "Your effective tax rate this month: A% (vs B% last month)"
  - "Customer X has ₹Y outstanding for D days (your average: E)"
  - "Cash position next 14 days projected: ..." (uses scheduled inflows/outflows)
  - "GST payable on the 20th: ₹Z (current cash bal: ₹W → suggest move ₹V to GST pool)"
  - … (Pradeep + Opus to finalize the 15 templates; this ticket includes the *rendering* infrastructure, with placeholder copy from Sonnet to be replaced with Opus output)
- **Acceptance:** All 15 cards render with real data on a populated test account.
- **Opus handoff:** Insight microcopy is Opus's job; raise via `HANDOFF.md` when the rendering shell is done.

### P4-06 — Charts (Tremor)
- **Goal:** Sales trend, GST liability trend, ITC trend, top customers, top HSN codes.
- **Acceptance:** All render on dashboard with real data.

**Phase 4 done when:** A user can complete a month's bookkeeping in Shulka, see the dashboard with insights, export GSTR-1 + GSTR-3B as JSON for manual portal upload.

---

## PHASE 5 — CA Multi-client (≈2 weeks)

**Goal:** A CA can manage 50+ business clients from one dashboard. Switch contexts. Run batch operations.

### P5-01 — CA-client linking
- **Goal:** Business owner sends invite to CA's email/phone. CA accepts. Link recorded in `ca_business_links` table.
- **Acceptance:** Invite flow works · CA dashboard lists linked businesses.

### P5-02 — CA dashboard
- **Goal:** Summary cards (total clients, pending reviews, due this week, overdue). Searchable client list with status pills.
- **Acceptance:** Works on real data.

### P5-03 — Context switching
- **Goal:** CA picks a client → enters that business's full Shulka view (impersonation under audit). Audit event records every CA action on a client's data.
- **Acceptance:** Switch is fast (<300ms) · visible "viewing as: X Pvt Ltd" banner · audit captured.

### P5-04 — Batch operations
- **Goal:** "Generate GSTR-1 for all clients for May 2026" → kicks off background job, results in a downloadable bundle.
- **Acceptance:** Works for 10 clients · job is async · CA gets notified when done.

### P5-05 — In-app messaging (CA ↔ client)
- **Goal:** Threaded messages tied to a client. Document attach. Read receipts.
- **Acceptance:** Both sides can message · attachments stored in R2.

### P5-06 — Notifications: due date reminders
- **Goal:** Cron worker daily: any client with GSTR-1 due in 7/3/0 days → notify CA + business owner via email + in-app.
- **Acceptance:** Verified across timezones (IST).

**Phase 5 done when:** Rakesh-persona test account has 5 client businesses, can see all, switch, batch-export, message, and gets reminders.

---

## PHASE 6 — Android shell (≈1 week)

**Goal:** Capacitor-wrapped Android APK, native plugins for camera/share/push, internal Play Store track.

### P6-01 — Capacitor setup + production build pipeline
- **Goal:** Capacitor 6+ wrapping the Next.js production export. Android Studio project generated.
- **Acceptance:** APK builds locally · runs on Pradeep's phone (or emulator) · loads `shulka.pradeepjainbp.in` in the wrapper with proper deep-link handling.

### P6-02 — Native plugins: camera, share, biometric (optional)
- **Goal:** Camera plugin for invoice scan. Share plugin for native share sheet (WhatsApp from Android). Biometric for re-auth.
- **Acceptance:** All three work on a real device.

### P6-03 — Push notifications setup
- **Goal:** Web Push for browsers, Capacitor Push for native (FCM under the hood — free tier).
- **Acceptance:** Test push delivers to the device.

### P6-04 — Play Store internal track
- **Goal:** Signed APK uploaded, internal-track release with Pradeep + 1–2 testers.
- **Acceptance:** Tester can install from Play Store internal link.

**Phase 6 done when:** Pradeep is running Shulka on his phone via Play Store internal track. Camera scan, native share, biometric re-auth all work.

---

## PHASE 7 — Bank statement parsing (≈2 weeks)

(Scope detail to be expanded when work begins; PDF parsing per major Indian banks, transaction extraction, GST-relevance categorization via Gemini, payment-to-invoice matching.)

---

## PHASE 8 — Public beta + Rule contributor UI (≈2 weeks)

(Scope detail to be expanded; DPDP-compliant launch checklist, Privacy/ToS, Trust page, support flow, the form-based contributor UX described in `/planning/03_phases_approvals_rulebook.md` §3.)

---

## PHASE 9 — GSP integration (TBD)

(Blocked on commercial agreement with Masters India / Cygnet / IRIS / GSTZen. Pradeep starts outreach during Phase 5.)

---

## PHASE 10 — iOS + e-Invoicing + e-Way Bill (TBD)

(Blocked on Mac/Apple Developer account + first user above e-invoicing threshold.)

---

## NON-CODE TRACK (Pradeep's tasks, not Claude Code's)

These run in parallel; surface in `HANDOFF.md` when blocked or when status changes:

- **Phase 0:** Set up Cloudflare account, Neon account, Resend account, Google Cloud project + OAuth client IDs (web + Android), Sentry account, GitHub repo creation.
- **Phase 0:** Privacy policy + ToS draft (Opus to write; Pradeep to legal-review).
- **Phase 5:** Begin GSP outreach (Masters India + Cygnet first).
- **Phase 6:** Google Play Console developer account (₹2,000 one-time).
- **Phase 8:** Procure dedicated phone number for Shulka (for WhatsApp Cloud API in v1.1).
- **Phase 8:** Meta Business account verification.
- **v1.1+:** Trademark registration for "Shulka" (~₹4.5K + lawyer).
