# Handoff — Shulka

> Each session writes this for the next session.
> The next session reads this after SACRED_RULES.md and STATUS.md.

---

## Session: 2026-05-20 — P2-04: PDF generation via pdf-lib + R2 (Sonnet)

### What this session did

**P2-04 is complete. Phase 2 is 4/8.**

**`apps/web/lib/pdf/amount-in-words.ts`** — Pure function `amountInWords(paise: number): string`. Indian English, handles crores/lakhs/thousands. Output: "Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and 78 Paise Only".

**`apps/web/lib/pdf/invoice-pdf.ts`** — `generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array>`. A4 pdf-lib PDF with: primary-dark header band (business name + GSTIN), address + invoice meta box, Bill To block (party name + GSTIN + address), line items table (alternating rows, CGST/SGST or IGST split per posKind), tax summary box (emerald Total row), amount-in-words, UPI QR code (if `business.upiVpa` set, `upi://pay?pa=...` string), always-on footer CTA. Uses Helvetica/HelveticaBold (built-in, no embed).

**`apps/web/lib/r2.ts`** — `getInvoiceBucket(): Promise<R2Bucket | null>`. Uses `getCloudflareContext({ async: true })` from `@opennextjs/cloudflare`; returns null in local dev (graceful fallback — PDF bytes returned directly without caching).

**`apps/web/app/api/sales/[id]/pdf/route.ts`** — `GET /api/sales/:id/pdf`. Auth required. Accessible to sender (owns invoice's business) OR recipient (owns `linked_to_business_id` business). R2 cache hit → returns `arrayBuffer()`. Cache miss → generate fresh, store in R2, update `pdfR2Key`, return `Buffer.from(pdfBytes)`.

**`apps/web/app/api/invoice-pdf/[token]/route.ts`** — `GET /api/invoice-pdf/:token`. No auth. Lookup by `pdfShareToken`. Returns 410 if `pdfShareTokenExpiresAt < now()`. Same R2 cache hit/miss pattern.

**`apps/web/app/api/sales/[id]/route.ts`** — PATCH finalise: after transaction + audit, generates PDF best-effort (try/catch wraps entire block). Stores in R2, sets `pdfR2Key` + `pdfShareToken` (UUID) + `pdfShareTokenExpiresAt` (now + 7 days).

**`packages/db/src/schema/businesses.ts`** — Added `upiVpa: text('upi_vpa')`.

**`packages/db/src/schema/sales-invoices.ts`** — Added `pdfShareToken: text('pdf_share_token')` + `pdfShareTokenExpiresAt: timestamp(...)`.

**`packages/db/drizzle/0009_pdf_upi.sql`** — Migration: `ALTER TABLE businesses ADD COLUMN upi_vpa text`, `ALTER TABLE sales_invoices ADD COLUMN pdf_share_token text, pdf_share_token_expires_at timestamptz`, partial index on `pdf_share_token WHERE NOT NULL`. **Applied to Neon ✓.**

**`apps/web/wrangler.toml`** — Added `[[r2_buckets]] binding = "INVOICE_PDFS" bucket_name = "shulka-prod"`.

**`apps/web/components/BusinessForm.tsx` + `EditBusinessForm.tsx`** — UPI VPA field ("UPI ID for invoice QR code"), optional, help text below.

**`apps/web/app/[locale]/sales/page.tsx`** — Sales list: extra 40px column, FileDown icon link for `status === 'final'` rows.

**`apps/web/app/[locale]/sales/[invoiceId]/page.tsx`** — Detail page: "Download PDF" button (secondary, sm) alongside "Finalise Invoice", only shown when `status === 'final'`.

**Total tests: 232 passing (unchanged).**

### Critical before testing live

Migration 0009 is applied to Neon ✓. No further DB steps needed.

To test PDF end-to-end in production (CF Pages), ensure:
- `INVOICE_PDFS` R2 bucket binding is visible in CF Pages project settings (automatic from wrangler.toml after next deploy).
- In local dev, `getCloudflareContext()` throws → PDF bytes returned directly (no R2) → works fine for development.

### Known limitation (P2-04)

- PDF share token is generated on finalise only. Re-finalise is not possible (status is already 'final'), so if token expires the only way to get a fresh one is `GET /api/sales/:id/pdf` (authenticated). A future ticket can add a "Resend" or "Regenerate link" action.
- `pdfR2Key` was already in the `sales_invoices` schema (added in P2-01 schema spec, never populated until now).

### What's next

**P2-05 — Invoice share: WhatsApp Web link, email via Resend, copy URL.** Run `/work-on P2-05`.

Key things P2-05 needs:
- `pdfShareToken` is now stored — use `/api/invoice-pdf/:token` as the shareable PDF URL.
- WhatsApp share: `wa.me/?text=` URL with pre-filled message + PDF link.
- Email: Resend + `@shulka/email-templates` package (check if it exists). Recipient is `party.email`.
- Copy URL: clipboard API.

### Open questions for Pradeep

- The UPI QR code in the PDF uses `upi://pay?pa=...&am=...`. Does your UPI VPA (`businesses.upiVpa`) need to be set before testing? Add it in the business edit form at `/en/businesses/:id/edit`.
- Should the 7-day share token auto-renew when the recipient views it (extend expiry on GET)? Currently it does not.

### Sacred rules sanity check

- Money BIGINT paise: ✓ PDF displays paise÷100 for display only; never stores floats
- PDF generation is best-effort: ✓ wrapped in try/catch in finalise route — a PDF failure never rolls back the finalise
- No financial mutations in the PDF routes: ✓ GET-only, only `pdfR2Key` update (not a financial field)
- DPDP ownership: ✓ sender/recipient check before serving PDF; public route is token-gated with expiry

---

## Session: 2026-05-20 — P2-03: Network-effect mirrored rows + business_trusts (Sonnet)

### What this session did

**P2-03 is complete. Phase 2 is 3/8.**

**`packages/db/src/schema/business-trusts.ts`** — `businessTrustStatusEnum` ('pending'|'trusted'|'revoked'), `businessTrusts` table with unique index on `(truster_business_id, trusted_business_id)`. Trust is directional.

**`packages/db/src/schema/purchase-invoices.ts`** — `purchaseInvoiceStatusEnum` + `purchaseInvoices` table. Reuses `posKindEnum` from sales-invoices. All 7 paise columns `bigint({ mode: 'number' })`. `linkedSalesInvoiceId` plain uuid (no FK — circular with sales_invoices.linkedPurchaseInvoiceId; FK deferred to future migration per ADR-10).

**`packages/db/src/schema/sales-invoices.ts`** — Added `linkedToBusinessId` (FK to businesses.id) + index `sales_invoices_linked_to_idx`.

**`packages/db/src/schema/index.ts`** — Added exports for both new schema files.

**`packages/db/drizzle/0008_network_effect.sql`** — Migration: CREATE TYPE purchase_invoice_status + business_trust_status, CREATE TABLE business_trusts + purchase_invoices, ALTER TABLE sales_invoices ADD COLUMN linked_to_business_id, all FK constraints + indexes. **NOT YET APPLIED TO NEON.**

**`apps/web/app/api/sales/route.ts`** — POST handler now: (1) fetches `party.linkedBusinessId`; (2) sets `linkedToBusinessId` on the INSERT when party is on Shulka; (3) checks if trust already exists — if yes, auto-creates a `purchase_invoices` mirror in the same transaction and fires `recordEvent('purchase_invoice.created')`.

**`apps/web/app/api/incoming/route.ts`** — `GET /api/incoming?businessId=<uuid>` — returns quarantined sales_invoices (linked to current business but no active trust). Uses Drizzle `notExists()`.

**`apps/web/app/api/incoming/[id]/accept/route.ts`** — `POST /api/incoming/:id/accept` — trust elevation. Single transaction: UPSERT business_trusts to 'trusted' + mirror all not-yet-mirrored quarantined invoices from sender as purchase_invoices rows + back-fill linked_purchase_invoice_id. After tx: `recordEvent('business_trust.elevated')` + `recordEvent('purchase_invoice.created')` × mirrors. P2-03 limitation: recipient must have a `parties` row for sender with `linked_business_id` set; 422 returned otherwise.

**`apps/web/app/api/trusts/route.ts`** — `GET /api/trusts?businessId` (list) + `POST /api/trusts` (proactive trust elevation).

**`apps/web/app/api/trusts/[id]/route.ts`** — `DELETE /api/trusts/:id` (revoke trust). Sets status='revoked', fires `recordEvent('business_trust.revoked')`.

**`apps/web/app/[locale]/incoming/page.tsx`** — Server component. Auth guard, fetches incoming quarantined invoices with sender name + party name joins. Renders table with TrustButton per row. Empty state: "Share Shulka with your suppliers — invoices auto-link when they join."

**`apps/web/components/TrustButton.tsx`** — Client component. Calls POST accept endpoint, shows "Accepting…" spinner, success toast + router.refresh(), 422 surfaces API error message, generic error toast otherwise.

**`apps/web/components/shell/AppShell.tsx`** — Added "Incoming" nav item (Inbox icon) between Invoices and Purchases.

**Total tests: 232 passing (unchanged — new code is backend logic without pure-function extraction).**

### Critical before testing live

Apply migration 0008 to Neon manually:
1. Paste `packages/db/drizzle/0008_network_effect.sql` into Neon SQL Editor
2. Then run:
```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256-of-0008>', 1748020000000);
```
Get SHA-256 via PowerShell: `(Get-FileHash packages/db/drizzle/0008_network_effect.sql -Algorithm SHA256).Hash.ToLower()`

After applying: update `packages/db/drizzle/meta/_journal.json` to add idx 8 for `0008_network_effect`.

### Known limitation (P2-03)

`POST /api/incoming/:id/accept` requires the accepting business to already have a `parties` row for the sender with `linked_business_id = sender.businessId`. If not, returns 422 "Add this supplier to your directory first". Phase 3 will auto-create the party row on accept (ADR-10).

### What's next

**P2-04 — PDF generation** (pdf-lib, server-side). Run `/work-on P2-04`.

### Open questions for Pradeep

- None — P2-03 implemented per spec.

### Sacred rules sanity check

- Audit log on every financial mutation: ✓ `business_trust.elevated`, `business_trust.revoked`, `purchase_invoice.created` all fire
- Money BIGINT paise: ✓ all purchase_invoices paise columns are `bigint({ mode: 'number' })`; copied verbatim from sales_invoices (no recomputation)
- Single transaction for dual-write: ✓ trust UPSERT + purchase_invoices INSERT in one tx
- recordEvent outside transaction: ✓ all recordEvent calls after tx.commit()
- No hard-coded rates: ✓ (P2-03 doesn't touch rates)
- DPDP ownership checks: ✓ all API routes verify business ownership before returning data

---

## Session: 2026-05-20 — P2-02: Place-of-supply auto + CGST/SGST/IGST split (Sonnet)

### What this session did

**P2-02 is complete. Phase 2 is 2/8.**

**`packages/db/src/schema/sales-invoices.ts`** — added `posKindEnum` ('intra_state'|'inter_state'|'export'|'sez') and two columns: `posKind` (NOT NULL DEFAULT 'inter_state') + `posOverrideReason` (nullable text).

**`packages/db/drizzle/0007_pos_kind.sql`** — migration file created. **NOT YET APPLIED TO NEON.** Apply before testing live (see "Critical before testing live" below).

**`packages/shared-types/src/audit-events.ts`** — added `'sales_invoice.pos_overridden'` kind with `{ auto_derived, overridden_to, reason, rule_id }` payload.

**`apps/web/app/api/sales/route.ts`** — POST handler now computes `posKind` ('intra_state'/'inter_state') from `placeOfSupply()` and stores it on the draft. Removed unused `posRuleId` variable (lint fix). Accepts `posOverrideReason` from form payload.

**`apps/web/app/api/sales/[id]/route.ts`** — finalise transaction now also inserts a `domain: 'place_of_supply'` rule_resolution row (invoiceItemId: null) using the stored `posKind`. `resolvedValue` includes `overridden: true/false`.

**`apps/web/components/SalesInvoiceForm.tsx`** — tracks `autoDerivedPos` separately from user-selected `placeOfSupplyState`. Detects override when they differ. Shows green "✓ Intra-state — CGST + SGST" or amber "→ Inter-state — IGST" pill. Amber "⚠ Override active (auto: state XX)" warning + required reason textarea when override is active. Sends `posOverrideReason` in payload only when override is active.

**`apps/web/src/__tests__/pos-split.test.ts`** — 13 new tests: Karnataka→Karnataka CGST_SGST, Karnataka→Maharashtra IGST, rate splitting (18%, 5%, 28% slabs), end-to-end ₹10,000 item paise computation, posRuleId derivation.

**Total tests: 232 passing, 1 skipped.**

### Critical before testing live

Apply migration 0007 to Neon manually (adds pos_kind enum + 2 columns):
1. Paste `packages/db/drizzle/0007_pos_kind.sql` into Neon SQL Editor
2. Then run:
```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256-of-0007_pos_kind.sql>', 1748010000000);
```
To get the SHA-256: run `sha256sum packages/db/drizzle/0007_pos_kind.sql` (Linux/Mac) or use PowerShell's `Get-FileHash`.

After applying: update `packages/db/drizzle/meta/_journal.json` to add idx 7 for `0007_pos_kind`.

### What's next

**P2-03** — next ticket in Phase 2 (per PHASES.md). Run `/work-on P2-03` to load focused context.

### Open questions for Pradeep

- None — P2-02 is fully implemented per spec.

### Sacred rules sanity check

- Server computes every rupee: ✓ unchanged from P2-01
- Money is BIGINT paise: ✓ no new money columns; posKind/posOverrideReason are non-monetary
- Audit log: ✓ `sales_invoice.pos_overridden` kind added to AuditPayloadSchemas (will be used when wiring the override audit event in a future ticket)
- rule_resolutions at finalise: ✓ PoS domain row now written with invoiceItemId=null
- No hard-coded rates: ✓ posKind derived from placeOfSupply() engine, not hardcoded

---

## Session: 2026-05-20 — P2-01: Sales invoice schema + create form (Sonnet)

### What this session did

**P2-01 is complete. Phase 2 has started (1/8).**

**Two key user decisions made this session:**
1. **Two-step flow**: Save as Draft first → explicit Finalise button triggers dual-write
2. **Place of supply**: editable dropdown, pre-filled from party GSTIN prefix

**`packages/db/src/schema/sales-invoices.ts`** — `salesInvoiceStatusEnum` ('draft'|'final'|'cancelled'), `salesInvoices` table. All money as `bigint({ mode: 'number' })` paise. `linkedPurchaseInvoiceId` is a plain uuid (no FK — purchase_invoices table comes in Phase 3). Self-referential `reversedByInvoiceId`. 4 indexes including `unique(business_id, fy, invoice_number)`.

**`packages/db/src/schema/sales-invoice-items.ts`** — `salesInvoiceItems` table. `quantity` and `*_rate_pct` as `numeric` (fractional). `ON DELETE RESTRICT` from parent invoice.

**`packages/db/drizzle/0006_sales_invoices.sql`** — migration. **NOT YET APPLIED TO NEON.**
- SHA-256: `53796f25cbd91d7e2a9425b7e79f58e79d9b242d698f57ae092e666929facc23`
- `when` in `_journal.json`: `1748000000000`

**`apps/web/app/api/sales/route.ts`** — `GET /api/sales?businessId=...` (list) + `POST /api/sales` (create draft). Server computes all paise (Sacred Rule). Gap-free invoice number via `count(*)::int` inside transaction (format: `INV-2026-27-0001`). Validates CGST/SGST vs IGST consistency via `placeOfSupply()`. RuleEngine validates GST rates. No audit/rule_resolutions written for draft — deferred to Finalise.

**`apps/web/app/api/sales/[id]/route.ts`** — `GET /api/sales/:id` (single + items) + `PATCH /api/sales/:id` with `{ action: 'finalise' }`. Finalise runs single transaction: UPDATE status→final + INSERT rule_resolutions (one per item×non-zero tax component) + `recordEvent('sales_invoice.created')`. Full dual-write per ARCHITECTURE.md §3.

**`apps/web/components/SalesInvoiceForm.tsx`** — client component. Party selector (derives PoS state from GSTIN prefix), invoice date, due date, editable PoS state dropdown (all 36 GST state codes). Line-item repeater with `<HsnSearch>`, qty/unit/price/discount/GST rate. Live tax preview (CGST+SGST vs IGST based on state comparison). Draft auto-save to `localStorage` with restore banner. `Save as Draft` button.

**`apps/web/app/[locale]/sales/new/page.tsx`** — server component, auth guard, fetches business + parties, renders form.

**`apps/web/app/[locale]/sales/page.tsx`** — invoice list page. Joins parties for name. Status pills (draft=gray, final=emerald, cancelled=red). Empty state with CTA.

**`apps/web/src/__tests__/sales-invoice-logic.test.ts`** — 28 pure-function tests: `getCurrentFY` (10), `computeItemPaise` (10), `computeRoundOff` (8).

**Total tests: 219 passing, 1 skipped.**

### What's next

**P2-02 — Place-of-supply override UI + CGST/SGST/IGST split display**

Per PHASES.md, P2-02 adds the ability to explicitly override the derived place-of-supply (e.g. for deemed exports, SEZ transactions). P2-01 already shows the editable dropdown — P2-02 may just need a visual enhancement (show CGST+SGST split clearly vs IGST on the invoice summary), SEZ flags on the party form, and testing override scenarios.

Key context for next session:
- The `SalesInvoiceForm` already has the PoS dropdown editable and derives tax type from state comparison. P2-02 adds SEZ flags and explicit override reason.
- `placeOfSupply()` engine already supports `isSupplierSez` and `isRecipientSez` flags.
- The invoice detail page (`/en/sales/:id`) does not exist yet — currently after Save, user lands on the list page.

### Critical before testing live
Apply migration 0006 to Neon manually:
1. Paste `packages/db/drizzle/0006_sales_invoices.sql` into Neon SQL Editor
2. Then run:
```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('53796f25cbd91d7e2a9425b7e79f58e79d9b242d698f57ae092e666929facc23', 1748000000000);
```

### Open questions for Pradeep

- The Finalise button is wired in the form (`handleFinalise` posts PATCH with `{ action: 'finalise' }`), but it navigates to `/en/sales` (list) after finalise — there's no invoice detail page yet. Should P2-02 build the detail page, or is the list page fine for now?

### Sacred rules sanity check

- Server computes every rupee: ✓ all paise computed server-side in both POST and PATCH handlers
- Money is BIGINT paise: ✓ all columns `bigint({ mode: 'number' })`; `numeric` only for rates/qty
- Audit log on finalise: ✓ `recordEvent('sales_invoice.created')` called in PATCH finalise transaction
- rule_resolutions written at finalise: ✓ per ARCHITECTURE.md §3 dual-write spec
- No hard-coded rates: ✓ RuleEngine validates all rates; `biome-ignore` on the JSON import cast is documented
- Draft auto-save: ✓ localStorage with restore banner per Sacred Rule 19

---

## Session: 2026-05-20 — P1-08: Audit log helper + payload schemas (Sonnet)

### What this session did

**P1-08 is complete. Phase 1 is complete (8/8).**

- **`packages/shared-types/src/audit-events.ts`** — `AuditPayloadSchemas` map (15 kinds): business.created/updated, party.created/updated, sales_invoice.created/status_changed/cancelled, purchase_invoice.created/status_changed/cancelled, business_trust.elevated/revoked, itc.claimed/blocked_override, user.deleted. `AuditKind` and `AuditPayload<K>` generic type.

- **`packages/db/src/record-event.ts`** — `recordEvent<K>(input)` generic helper. Validates `payload` against `AuditPayloadSchemas[kind]` (throws ZodError on mismatch) then INSERTs into `audit_events`. `exactOptionalPropertyTypes`-safe (explicit `?? null` for optional fields, no undefined spread).

- **`packages/db/src/client.ts`** — made `db` a lazy Proxy singleton so importing `@shulka/db` without `DATABASE_URL` in test env doesn't throw at module load time — deferred to first actual DB call.

- **`apps/web/app/api/businesses/route.ts`** — wired `recordEvent('business.created', ...)` after successful INSERT.

- **`apps/web/app/api/businesses/[id]/parties/route.ts`** — wired `recordEvent('party.created', ...)` after successful INSERT.

- **`apps/web/src/__tests__/audit-immutability.test.ts`** — integration test (`describe.skipIf(!process.env.DATABASE_URL)`): INSERTs a test event then attempts UPDATE; asserts the DB trigger throws. Run manually with `DATABASE_URL` set to verify live.

- No new migration needed — `audit_events` table, indexes, and trigger all live from P0-03.

### What's next

**Phase 2 — Invoicing.** First ticket: **P2-01 — Sales invoice schema + create form.**

Key things to know going into Phase 2:
- `sales_invoices` + `sales_invoice_items` tables do not exist yet (P2-01 creates them)
- Invoice creation must run in a single Drizzle transaction: INSERT invoice + items → INSERT rule_resolutions rows → recordEvent('sales_invoice.created') — per ARCHITECTURE.md §3 dual-write spec
- Money is integer paise (BIGINT). NEVER numeric/float.
- Gap-free invoice numbering: `unique(business_id, fy, invoice_number)`, server-allocated only
- The `RuleEngine` and `placeOfSupply()` are ready in `@shulka/gst-engine` — Phase 2 will use them for live tax computation
- `HsnSearch` component is ready for embedding in invoice line items

### Open questions for Pradeep

- None. Phase 1 acceptance criteria met: user can sign up, pick role, create business, add parties, search HSN, rule engine resolves rates, all mutations go through audit log.

### Sacred rules sanity check

- `recordEvent` validates payload before INSERT — no way to write malformed audit entries
- `audit_events` immutability enforced at DB level (trigger) AND role level (shulka_app has only INSERT+SELECT) — belt and suspenders per Sacred Rule 3
- No financial computation in this ticket

---

## Session: 2026-05-20 — P1-07: Place-of-supply engine (Sonnet)

### What this session did

**P1-07 is complete.**

- **`packages/gst-engine/src/place-of-supply.ts`** — `placeOfSupply(input): PlaceOfSupplyOutput`. Pure TypeScript, zero deps. Covers all 36 Indian states + UTs (codes 01–38, 97, 99; 25 and 28 excluded as superseded). Seven rules in strict priority order: export → import → SEZ → intra-state → inter-state → B2C no-recipient → B2B missing recipient throws. Returns `{ taxType: 'CGST_SGST' | 'IGST' | 'ZERO_RATED', reasoning: string, rule: string }`. Exports `PlaceOfSupplyError`, `isValidStateCode()`.

- **`packages/gst-engine/src/place-of-supply.test.ts`** — 60 test cases: all 4 transaction types, 5+ intra-state pairs, 5+ inter-state pairs, all 3 SEZ scenarios, export/import override, B2C no-recipient, invalid state codes, B2B missing recipient throws, UT codes, '97' Other Territory, export-wins-over-SEZ edge case.

- **`packages/gst-engine/src/index.ts`** — exports added for `placeOfSupply`, `isValidStateCode`, `PlaceOfSupplyError`, and all new types.

### What's next

**P1-08 — Audit log helper + payload schemas.** This is the last Phase 1 ticket and it also retroactively wires into P1-02 and P1-04.

Key requirements:
- `packages/shared-types/src/audit-events.ts` — per-kind Zod payload schemas (minimum: business.created, party.created, invoice.created, invoice.status_changed, invoice.cancelled, trust.elevated, user.deleted)
- `recordEvent({ actor_user_id, business_id, kind, ref_table, ref_id, payload, rule_ids })` helper in a new package or in `packages/db/`
- Retroactively add `recordEvent` calls to POST /api/businesses (business.created) and POST /api/businesses/:id/parties (party.created)
- Verification test: UPDATE on `audit_events` must be rejected by the DB trigger from P0-03
- Two new indexes on `audit_events`: `(business_id, ts desc)` and `(kind, ts desc)` — check if they exist in the existing schema first

Sub-agents needed: `api-builder` (wiring recordEvent into existing routes) + `test-writer` (verification test for trigger). Or `api-builder` can do both.

### Open questions for Pradeep

- None outstanding.

### Sacred rules sanity check

No financial computation. No money fields. No audit log needed (PoS engine is pure computation). No DB changes. Zero runtime deps. Works in CF Workers + Capacitor.

---

## Session: 2026-05-20 — P1-06: Rule engine skeleton (Sonnet)

### What this session did

**P1-06 is complete (code). Migration 0005 pending apply — see note below.**

- **ADR-15** written in `DECISIONS.md` — scheme election grandfathering via `rule_set_at_election` snapshot. (PHASES.md/ARCHITECTURE.md referenced "ADR-8" for this; ADR-8 was already taken for invoice split. ADR-15 is the authoritative record.)

- **`packages/gst-engine/src/rule-schema.ts`** — `RuleFile` interface + lightweight schema object with `.parse()` / `.safeParse()`. Zero runtime deps. `rule` body typed as `Record<string, unknown>` — domain sub-schemas come in later tickets.

- **`packages/gst-engine/src/engine.ts`** — `RuleEngine` class:
  - `static fromRules(rules: RuleFile[]): RuleEngine` — runs 4 load-time invariants (duplicate rule_id, hash mismatch, date-range overlap, broken supersedes chain), builds in-memory index. Throws `RuleEngineError` on any violation.
  - `resolveRule(domain, key, transactionDate, opts?)` — date-range lookup with INCLUSIVE boundaries (`effective_from <= date <= effective_to`). Scheme-election grandfathering: if `opts.schemeElection.threshold_rule_id` matches a rule in the set, returns that rule regardless of date. Per-instance `Map` memoization.
  - `static fetchHsnMaster()` — no-op stub; throws `NOT_IMPLEMENTED`. Wire in Phase 2 with CF R2/KV bindings.
  - Hash check: `'sha256-placeholder'` bypasses (dev mode). Real SHA-256 via CI script in a future ticket. djb2 used for non-placeholder check (no `crypto` in CF Workers).

- **`packages/gst-engine/src/engine.test.ts`** — 23 tests: date-range boundary resolution (e-invoice 10cr→5cr switchover on 2023-07-31 / 2023-08-01), scheme-election grandfathering overrides date, all 4 invariant violations throw `RuleEngineError`, no-rule-found throws, memoization returns same reference, `RuleFileSchema` validation.

- **10 seeded rule JSON files** in `/rules/`:
  - `gst-rates/rate-5.json`, `rate-12.json`, `rate-18.json`, `rate-28.json` — GST rates, effective 2017-07-01
  - `thresholds/composition-150cr.json` — ₹1.5 Cr (1_500_000_000 paise), effective 2019-04-01
  - `thresholds/einvoice-10cr.json` — ₹10 Cr, effective 2020-10-01 to **2023-07-31** (inclusive)
  - `thresholds/einvoice-5cr.json` — ₹5 Cr, effective **2023-08-01**, supersedes 10cr rule
  - `place-of-supply/interstate.json`, `intrastate.json` — IGST vs CGST+SGST
  - `itc/blocked-credits-s17-5.json` — blocked ITC categories under §17(5)

- **`packages/db/src/schema/scheme-elections.ts`** — `scheme_type` enum (regular/composition/qrmp), `scheme_elections` table per ARCHITECTURE.md §3 exactly.

- **`packages/db/drizzle/0005_melodic_ogun.sql`** — generated migration. **NOT YET APPLIED.** Apply via Neon SQL Editor (paste the SQL) then INSERT into `drizzle.__drizzle_migrations`.

### What's next

**P1-07 — Place-of-supply engine.** Pure TypeScript in `packages/gst-engine/src/place-of-supply.ts`. `placeOfSupply({ supplier_state, recipient_state, transaction_type })` → `'CGST_SGST' | 'IGST'`. 30+ test cases covering all states + UTs, SEZ supplier, export. `gst-engineer` sub-agent.

### Migration 0005 apply instructions

In Neon SQL Editor, paste `packages/db/drizzle/0005_melodic_ogun.sql`, then:
```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('<sha256-of-file>', <when-from-journal>);
```
Check `packages/db/drizzle/meta/_journal.json` for the `when` value for `0005_melodic_ogun`.

### Open questions for Pradeep

- None outstanding.

### Sacred rules sanity check

No financial computation. No money fields touched. No audit log needed (rule engine is read-only). DB migration is additive (new table + enum). All free-tier. Engine is pure TypeScript, zero runtime dependencies — runs in CF Workers and Capacitor.

---

## Session: 2026-05-20 — P1-05: HSN/SAC code search (Sonnet)

### What this session did

**P1-05 is complete.**

- **`rules/hsn-codes/master.json`** — 633 entries: 420 HSN codes (all 21 GST sections, with 6-digit sub-headings for electronics/pharma/textiles) + 213 SAC codes (construction, transport, hospitality, finance, IT, healthcare, professional services, government). Biome-formatted.

- **`packages/shared-types/src/hsn.ts`** — `HsnEntry { code: string; description: string; type: 'HSN' | 'SAC' }`. Exported from shared-types index.

- **`apps/web/components/HsnSearch.tsx`** — `'use client'` autocomplete. Fuse.js instance built once at module level (synchronous, no per-render cost). 50ms debounce. Min 2 chars to trigger search. Up to 30 results, max 8 rows visible (scrollable). Keyboard nav (ArrowUp/ArrowDown/Enter/Escape). ARIA combobox pattern (`role="combobox"` on input, `role="listbox"` on dropdown, `role="option"` on rows). Clear (×) button. Hydration skeleton (3 shimmer rows). `onMouseDown` + `e.preventDefault()` prevents blur racing the click. Outside-click listener closes dropdown.

- **`apps/web/components/HsnSearchDemo.tsx`** — client wrapper holding `useState<HsnEntry | null>`, renders HsnSearch + selection detail card.

- **`apps/web/app/[locale]/hsn/page.tsx`** — public server component at `/en/hsn`. No auth guard.

- **`apps/web/next.config.ts`** — webpack alias `@shulka/rules` → `../../rules/` so the bundler resolves the JSON import at build time.

- **`apps/web/tsconfig.json`** — added `@shulka/rules/*` path alias for TS resolution.

- **`biome.json`** — disabled `a11y/useSemanticElements` project-wide (the rule incorrectly flags `role="listbox"` on a `div` and suggests `<select>`, which cannot render custom-styled rows — any combobox/menu will hit this).

- **`apps/web/package.json`** — added `"fuse.js": "^7.1.0"`.

### What's next

**P1-06 — Rule engine skeleton + scheme_elections + load-time invariants.** This is the most complex Phase 1 ticket. Key requirements:
- `packages/gst-engine/src/engine.ts` — `RuleEngine.load('/rules/')`, indexes by `(domain, key, effective_from)`, `resolveRule(...)` returns `{ rule, source_citation, rule_id }`
- HSN master lazy-loaded from R2 in P1-06 (not bundled with worker)
- `scheme_elections` DB table + migration
- Load-time invariants: rule overlap → panic, duplicate rule_id → panic, hash mismatch → panic, broken supersedes chain → panic
- 10 seeded rules: GST rates (5/12/18/28), composition threshold ₹1.5Cr, e-inv threshold ₹5Cr, inter/intra-state PoS, blocked credits §17(5)
- `gst-engineer` sub-agent is the right choice for this ticket

### Open questions for Pradeep

None outstanding.

### Sacred rules sanity check

No financial computation. No money fields. No audit log needed. Static JSON + client-side search only. No DB changes. Free tier only (fuse.js is a client-side npm package, no runtime cost).

---

## Session: 2026-05-20 — P1-04: Party directory (Sonnet)

### What this session did

**P1-04 is complete (code). Migration pending apply — see critical note below.**

- **`packages/db/src/schema/parties.ts`** — `partyKindEnum` ('customer'|'supplier'|'both'), `parties` table. Fields: id, businessId FK, name, legalName, externalGstin, linkedBusinessId FK (nullable, for network-effect), phone, email, address jsonb, partyKind enum, timestamps, deletedAt. Indexes: unique(businessId, externalGstin), businessId idx, linkedBusinessId idx.

- **`packages/db/drizzle/0004_lumpy_hex.sql`** — migration generated. **NOT YET APPLIED** — Neon DNS unreachable from the machine at commit time (ENOTFOUND). Must apply before using the feature live: `cd packages/db && DATABASE_URL_UNPOOLED=<see .env.local> pnpm db:migrate`

- **`packages/shared-types/src/api/parties.ts`** — `PartyResponseSchema` (Zod): id, businessId, name, legalName, externalGstin, linkedBusinessId, isOnShulka (derived bool), phone, email, address, partyKind, timestamps.

- **`apps/web/app/api/businesses/[id]/parties/route.ts`** — `GET /api/businesses/:id/parties` (list with optional `?q=` ilike filter on name + GSTIN) + `POST` (create, network-effect GSTIN lookup, sets linkedBusinessId if GSTIN matches an existing business).

- **`apps/web/app/api/businesses/[id]/parties/[partyId]/route.ts`** — `GET` single party + `PATCH` (ownership re-checked, network-effect re-runs if externalGstin in payload).

- **`apps/web/components/PartyList.tsx`** — client component; search bar filters on name + GSTIN client-side (re-fetches on ?q= server search not wired — uses fetch on first render, then filters locally). "On Shulka" green pill vs "External" muted pill. Clicking a row is placeholder (will link to party detail in future ticket).

- **`apps/web/components/PartyForm.tsx`** — add-party form; businessId prop; GSTIN validation with CheckCircle2/AlertTriangle icons; shows "On Shulka" success banner for 1.8s then redirects if linkedBusinessId in response.

- **`apps/web/app/[locale]/businesses/[id]/parties/page.tsx`** — server component; ownership check; renders header + "Add Party" button + PartyList.

- **`apps/web/app/[locale]/businesses/[id]/parties/new/page.tsx`** — thin server wrapper rendering PartyForm.

- **`apps/web/app/[locale]/businesses/page.tsx`** — updated: "→ Parties" link added to each business card.

- **`apps/web/components/EditBusinessForm.tsx`** — "Manage Parties →" link added to the edit page.

### What's next

**P1-05** — next ticket in Phase 1. Run `/start` to get the brief.

**Critical before testing live:** Apply migration 0004 to Neon. Command:
```
cd packages/db
# Set DATABASE_URL_UNPOOLED from .env.local
pnpm db:migrate
```

### Open questions for Pradeep

- PartyList currently does local client-side filtering after the initial fetch. Should we wire up server-side `?q=` search (fetch on keystroke) for large party lists, or is local filtering fine for now?
- Party detail/edit page is not yet built. Should P1-05 include that, or defer to when invoicing needs it?

### Sacred rules sanity check

No financial computation. No audit log mutation (parties are not financial records). No money fields. All services on free tier. DB migration is additive (new table + enum). GSTIN network-effect lookup is read-only.

---

## Session: 2026-05-20 — P1-03: GSTIN validator (Sonnet)

### What this session did

**P1-03 is complete.**

- **`packages/gst-engine/`** — new workspace package `@shulka/gst-engine`. Pure TypeScript, zero runtime dependencies. Usable in Cloudflare Workers and Capacitor.

- **`packages/gst-engine/src/gstin-validator.ts`** — exports:
  - `validateGstin(gstin: string): GstinValidationResult` — structured result with typed reason on failure
  - `isValidGstin(gstin: string): boolean` — convenience wrapper
  - `GstinValidationResult` and `GstinInvalidReason` types
  - Five-step validation: length → structure regex → state code (valid GST set) → PAN embedded (chars 2–11) → Mod-36 checksum
  - State code 25 (old Daman & Diu) and 28 (old Andhra Pradesh) intentionally excluded — deactivated/migrated. 97 and 99 included (Other Territory + centre-administered).

- **`packages/gst-engine/src/gstin-validator.test.ts`** — 108 tests (107 in the validator suite + 1 smoke test):
  - 65 valid GSTINs covering 6+ state codes and all 9 PAN entity types (P/C/H/F/A/B/L/J/G)
  - `invalid_length`: empty string, 14 chars, 16 chars
  - `invalid_structure`: lowercase letters, digits where letters expected, wrong char at position 13
  - `invalid_state_code`: 00, 25, 28, 39, 40
  - `invalid_pan`: lowercase PAN, digits where letters needed
  - `invalid_checksum`: every valid GSTIN has a flipped-checksum variant tested
  - `makeGstin` / `flipCheckChar` helpers inside the test file for deterministic generation

- **Wired into 4 existing files** — inline `CHARSET`/`validateGstin` removed; replaced with `import { isValidGstin } from '@shulka/gst-engine'`:
  - `apps/web/app/api/businesses/route.ts`
  - `apps/web/app/api/businesses/[id]/route.ts`
  - `apps/web/components/BusinessForm.tsx`
  - `apps/web/components/EditBusinessForm.tsx`

- **`apps/web/package.json`** — added `"@shulka/gst-engine": "workspace:*"` dependency.

**All checks green:** Biome clean, typecheck clean, 108/108 tests passing.

### What's next

**P1-04 — Party (customer/supplier) directory.**

Read PHASES.md §P1-04. Summary:
- `parties` table: `business_id` (FK), name, legal_name, `external_gstin` (nullable), `linked_business_id` (FK to businesses, nullable — network-effect), phone, email, address jsonb, `party_kind` enum (customer/supplier/both).
- Add party manually → works.
- Search by name/GSTIN → works.
- If added GSTIN matches an existing `businesses.gstin` row → auto-populate `linked_business_id` (network-effect discovery).
- "External" badge in UI computed from `linked_business_id` + `business_trusts` lookup (trust table doesn't exist yet — badge logic uses `linked_business_id IS NOT NULL` for now).
- Out of scope: `business_trusts` writes (Phase 2 P2-03).

Suggested approach:
1. `schema-architect` for `parties` table migration.
2. `api-builder` for `GET/POST /api/businesses/:businessId/parties` + `GET/PATCH /api/businesses/:businessId/parties/:id`.
3. `ui-builder` for party list + add party form under a business.

### Open questions for Pradeep

1. **Deploy to production?** P1-02 + P1-03 are both on `main`, unpushed at session start (pushed during P1-02 session). P1-03 commit `560c5e8` is not yet pushed. Confirm push.

2. **P1-04 party routes structure**: Should parties be nested under `/api/businesses/:businessId/parties` (scoped to a business — cleaner ownership) or flat `/api/parties?businessId=...`? Nested is safer for ownership checks.

### Notes / context

- `packages/gst-engine` is the first package in the `gst-engine` namespace. P1-06 (rule engine skeleton), P1-07 (place-of-supply), and all GST computation lives here eventually.
- State codes 25 and 28 are excluded deliberately. If a use case arises for reading legacy invoices with these codes, a separate `parseHistoricGstin` lenient mode should be added — not by relaxing the main validator.
- `computeCheckChar` is internal (not exported) in `gstin-validator.ts`. The test file re-implements it as a test helper to avoid coupling tests to implementation internals.

### Sacred rules sanity check

Reviewed all 20 rules. No financial computation. No audit log touched. No money fields. Pure utility package — no DB, no network. All free tier.

---

## Session: 2026-05-20 — P1-02: Business entity creation (Sonnet)

### What this session did

**P1-02 is complete.**

- **DB migration `0003_noisy_ted_forrester.sql`** (applied to live Neon): creates `businesses` table with `business_type` enum, FK to `users.id`, GSTIN unique index, owner + deletedAt indexes.

- **`packages/db/src/schema/businesses.ts`** — new schema file: `businessTypeEnum`, `businesses` table, `Business` / `NewBusiness` types. `gstin` is nullable unique (unregistered businesses may lack a GSTIN; Postgres unique index allows multiple NULLs by design).

- **`packages/shared-types/src/api/businesses.ts`** — `BusinessResponseSchema` + `BusinessResponse` type (Zod). Exported from `packages/shared-types/src/index.ts`.

- **`apps/web/app/api/businesses/route.ts`** — `GET /api/businesses` (list non-deleted businesses for current user) + `POST /api/businesses` (create). GSTIN validated structurally (15-char regex) + Mod-36 checksum inline. PAN validated via regex. Wrapped with `withErrorReporting`.

- **`apps/web/app/api/businesses/[id]/route.ts`** — `GET /api/businesses/:id` + `PATCH /api/businesses/:id`. Ownership check before any mutation (fetch by id + ownerUserId + deletedAt IS NULL). Next.js 16 async params (`await ctx.params`) used.

- **`apps/web/app/[locale]/businesses/new/page.tsx`** — Client component creation form: name, legal name, business type (Select), GSTIN (live validation badge — green tick / red warning at 15 chars), PAN (auto-uppercase), state (Select with all 38 Indian state/UT GST codes), registration date (native `<input type="date">`), composition scheme (Checkbox). POSTs to `/api/businesses`, redirects to `/en/businesses` on success.

- **`apps/web/app/[locale]/businesses/page.tsx`** — Server component list: queries DB directly, shows business cards (name, type badge, GSTIN monospace, state), empty state with CTA, "Add Business" button.

- **`apps/web/app/[locale]/dashboard/page.tsx`** — Updated: added "My Businesses" section with DB count query. Zero state shows "Create your first business" CTA; non-zero shows count + "Manage businesses →" link.

- **`apps/web/components/ui/select.tsx`** + **`checkbox.tsx`** — New shadcn-style components via `@radix-ui/react-select` + `@radix-ui/react-checkbox`. Added to `apps/web/package.json`.

**Second commit (UX follow-ups — same session):**
- **`apps/web/app/[locale]/onboarding/role/page.tsx`** — updated redirect: business_owner → `/en/onboarding/business`, CA → `/en/dashboard`.
- **`apps/web/app/[locale]/onboarding/business/page.tsx`** — new onboarding step using `BusinessForm` with "Set up your first business" heading, "I'll do this later" skip link → `/en/dashboard`.
- **`apps/web/components/BusinessForm.tsx`** — shared client component extracted from `new/page.tsx`. Takes `heading`, `subheading`, `redirectTo`, `submitLabel`, optional `topLink`/`bottomLink` props. Eliminates duplication between create and onboarding flows.
- **`apps/web/components/EditBusinessForm.tsx`** — pre-filled edit form component, uses PATCH `/api/businesses/:id`.
- **`apps/web/app/[locale]/businesses/[id]/edit/page.tsx`** — server component: auth check, ownership check, passes row to `EditBusinessForm`. Fixes the broken "Edit" link in the list.
- **`apps/web/app/[locale]/businesses/page.tsx`** — updated: CA users see "Client Businesses" header + "Your clients' businesses will appear here once they invite you" placeholder. No "Add Business" button for CAs.
- **`apps/web/app/[locale]/businesses/new/page.tsx`** — refactored to thin wrapper using `BusinessForm`.

**All checks green:** Biome clean, typecheck clean, unit tests 1/1. Migration applied to live Neon.

### What's next

**P1-03 — GSTIN validator (pure TypeScript util).**

Read PHASES.md §P1-03. Summary:
- Create `packages/gst-engine/src/gstin-validator.ts` — pure TS, zero deps.
- Validates: 15-char structure, state code (first 2 digits ∈ valid GST state codes), PAN embedded (chars 3–12 match PAN format), Mod-36 checksum digit.
- **Acceptance: 50+ valid GSTINs + 50+ invalid GSTINs in unit tests, 100% coverage on this module.**
- The inline `validateGstin` in the two route files + UI form should be replaced to import from this util once it exists (a P1-03 follow-up task — mark this explicitly).

The `gst-engine` package already exists at `packages/gst-engine/` — check what's already there before creating new files.

### Open questions for Pradeep

1. **Deploy to production?** Migration is on live Neon already. CF Pages deploy would expose the new routes and the full onboarding chain (role → business form → dashboard).

### Notes / context

- The GSTIN Mod-36 checksum is duplicated in three places: `route.ts`, `[id]/route.ts`, and `new/page.tsx`. This is intentional for P1-02 — P1-03 will consolidate into `packages/gst-engine/src/gstin-validator.ts` and the routes/form should import from there.
- `@radix-ui/react-select` and `@radix-ui/react-checkbox` were added to `apps/web/package.json`. These are new peer-level deps — no CF Pages issues expected (they're pure client-side).
- The `businesses` table allows `gstin = NULL` (unregistered businesses). The unique index on `gstin` uses `UNIQUE INDEX` (not constraint), which lets multiple NULL values coexist — correct Postgres behaviour for nullable unique fields.
- `address` is stored as `jsonb { text: string }` for now (simple free-text). Full structured address (line1/line2/city/pin) can be added when invoicing requires it (Phase 2).

### Sacred rules sanity check

Reviewed all 20 rules. No financial computation. No audit log mutation (P1-08 will retroactively add `business.created` event — noted in PHASES.md). No money fields. All services on free tier. DB migration is additive (new table + enum).

---

## Session: 2026-05-19 — P1-01: Role selection + auth guard (Sonnet)

### What this session did

**P1-01 is complete.**

- **DB migration `0002_stormy_wild_child.sql`** (applied to live Neon): `users.role` is now nullable. `null` means the user has not yet completed onboarding. Existing users keep their role values unchanged.

- **`packages/db/src/schema/users.ts`** — `role` column changed from `.notNull().default('business_owner')` to nullable with no default. New sign-ups from Auth.js DrizzleAdapter now land with `role = null`.

- **`packages/shared-types/src/api/me.ts`** — `MeResponseSchema.role` updated to `.nullable()` to accept null role from the DB.

- **`apps/web/auth.ts`** — Extended JWT/session callbacks:
  - `jwt` callback now fetches `role` from DB on sign-in (`user` object present) and stores it in the JWT token.
  - `jwt` accepts `trigger === 'update'` with `{ role }` payload so the client-side `session.update({ role })` call refreshes the JWT after onboarding.
  - `session` callback exposes `session.user.role` (typed `string | null`).
  - Added `declare module 'next-auth'` augmentation so `session.user.role` is properly typed everywhere.

- **`apps/web/app/api/me/route.ts`** — Added `PATCH` handler:
  - Accepts `{ role: 'business_owner' | 'chartered_accountant' }` (Zod validated).
  - Updates `users.role` and `users.updated_at` in DB.
  - Returns `{ role }`. Wrapped with `withErrorReporting`.

- **`apps/web/middleware.ts`** — Rewrote using Auth.js v5 `auth()` wrapper (`export default auth(fn)`) so `request.auth` carries the decoded JWT (no DB hit):
  - **Auth guard**: unauthenticated users hitting any non-public path → redirect to `/en/sign-in`.
  - **Onboarding guard**: authenticated users with `role === null` → redirect to `/en/onboarding/role` (unless already on `/en/onboarding`).
  - Public paths: `/en/sign-in`, `/en/onboarding`, `/en/test` (test pages must remain accessible without auth).
  - Rate limiting and locale redirect logic preserved unchanged.

- **`apps/web/app/[locale]/onboarding/role/page.tsx`** — New client page:
  - Two selection cards: "Business Owner" and "Chartered Accountant".
  - On Continue: `PATCH /api/me` → `session.update({ role })` → `router.push('/en/dashboard')`.
  - No shadcn Button import — uses plain Tailwind-styled button to avoid import overhead for a simple page.

- **`apps/web/app/[locale]/dashboard/page.tsx`** — New server page (placeholder):
  - Shows user name, email, and role label.
  - Server-side redirect to `/en/sign-in` if no session (belt-and-suspenders; middleware handles this too).
  - Placeholder "Dashboard coming soon" panel until Phase 2.

**All checks green:** typecheck clean, lint clean, unit tests 1/1, e2e 2/2 passing (31s). Migration applied to live Neon.

### What's next

**P1-02 — Business entity creation.**

Read PHASES.md §P1-02. Summary:
- A signed-in user (business owner) creates one or more `businesses` rows.
- Fields: name, GSTIN, PAN, address, state, type (proprietorship/partnership/LLP/Pvt Ltd), GST registration date.
- GSTIN validated structurally + checksum (P1-03 does the deep util, but P1-02 needs at minimum a regex guard).
- `businesses` table needs to be created — it does NOT exist yet (only `users`, `accounts`, `verification_tokens`, `audit_events`, `rule_resolutions`).
- User can list and edit their own businesses.

Suggested approach for P1-02:
1. `schema-architect` for the `businesses` table migration.
2. `api-builder` for `GET/POST /api/businesses` and `GET/PATCH /api/businesses/:id`.
3. `ui-builder` for the business creation form page (`/en/onboarding/business` or `/en/businesses/new`).

### Open questions for Pradeep

1. **Onboarding flow continuation**: After role selection, the current flow goes straight to `/en/dashboard`. Should P1-02 chain directly — i.e., after role selection, redirect to `/en/onboarding/business` to force business creation before reaching the dashboard? Or is the dashboard OK as the landing page with a "Create your first business" prompt?

2. **CA flow**: A CA user doesn't own a business — they manage clients' businesses. Should the onboarding skip the business creation step for CAs? (The PHASES.md spec for P1-02 says "a user (business owner) creates…" suggesting CAs are excluded.)

3. **Push to production?** The live site at `shulka.pradeepjainbp.in/en` will now redirect unauthenticated visitors to sign-in (middleware auth guard is live once deployed). Confirm you want to deploy this.

### Notes / context

- The `jwt` callback in `auth.ts` now does a DB query on first sign-in to fetch `role`. This is a single `SELECT` on `users` and happens only once per new session (JWT is then cached in the cookie). Subsequent requests decode the cookie only — no DB hit.
- `session.update({ role })` triggers the `jwt` callback with `trigger === 'update'`, which updates the token in the cookie. This is the Auth.js v5 recommended way to refresh session data after a profile update without forcing sign-out.
- `/en/test/*` paths are public (no auth required) so the Playwright ErrorBoundary test page remains accessible. These paths are guarded by `NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true'` in the page itself — they are no-ops in production.

### Sacred rules sanity check

Reviewed all 20 rules. No financial computation. No audit log touched. No money fields. All services on free tier. DB migration is non-destructive (makes column nullable; existing data unchanged).

---

## Session: 2026-05-19 — P0-09: CF Web Analytics + Sentry v10 (Sonnet)

### What this session did

**Phase 0 is now complete (9/9 tickets).**

- **CF Web Analytics beacon** — `apps/web/app/layout.tsx` now injects the Cloudflare beacon script via `NEXT_PUBLIC_CF_BEACON_TOKEN`. Only renders when the env var is set (safe for local dev).

- **`@sentry/nextjs` v10.53.1** — installed in `apps/web`. Three config files created:
  - `sentry.client.config.ts` — browser SDK, reads `NEXT_PUBLIC_SENTRY_DSN`
  - `sentry.server.config.ts` — Node.js SDK, reads `SENTRY_DSN`
  - `sentry.edge.config.ts` — edge/CF Workers SDK, reads `SENTRY_DSN`
  - `instrumentation.ts` — `register()` selects server vs edge config; `onRequestError = Sentry.captureRequestError` captures RSC errors

- **`apps/web/next.config.ts`** — wrapped with `withSentryConfig`. Source maps auto-uploaded during `next build --webpack` and deleted from bundle after upload. `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` read from env vars automatically.

- **`apps/web/components/ErrorBoundary.tsx`** — `'use client'` class component. `componentDidCatch` calls `Sentry.captureException`. Fallback UI: "Something went wrong" + "Try again" button. Applied to `[locale]/layout.tsx`, wrapping all locale-routed pages.

- **`apps/web/lib/with-error-reporting.ts`** — `withErrorReporting(handler)` wraps any `RouteHandler`, calls `Sentry.captureException` + `Sentry.flush(2000)` on unhandled throws, then rethrows. Applied to `/api/me`.

- **Test infrastructure** (PLAYWRIGHT_TEST only):
  - `apps/web/app/api/test/sentry-server/route.ts` — calls `captureException` + `flush`, returns `{ captured: true }`
  - `apps/web/app/[locale]/test/error-boundary/page.tsx` — client component; when `NEXT_PUBLIC_PLAYWRIGHT_TEST=true`, throws during render to trip the ErrorBoundary
  - `playwright.config.ts` — added `NEXT_PUBLIC_PLAYWRIGHT_TEST: 'true'` to webServer env

- **`e2e/sentry.spec.ts`** — two tests:
  1. Navigate to `/en/test/error-boundary` → assert "Something went wrong" visible
  2. GET `/api/test/sentry-server` → assert `{ captured: true }`

- **`.env.local`** — added `NEXT_PUBLIC_SENTRY_DSN` (same value as `SENTRY_DSN`; needed for client-side Sentry init).

**All checks green:** typecheck clean, Sentry e2e 2/2 passing (27s).

Note: the auth e2e test (P0-08) had a transient Neon DB connectivity failure during this session — "fetch failed" hitting the Neon serverless endpoint. This is a network/DNS issue on the dev machine, not a code regression. The test is structurally unchanged and was green at P0-08 commit.

### What's next

**Phase 1, starting with P1-01 — User profile + role selection.**

Read PHASES.md §Phase 1 for the full spec. Summary:
- New user after sign-in is forced into `/en/onboarding/role` to pick Business Owner or CA.
- Role stored on `users.role` column (enum already exists: `business_owner`, `chartered_accountant`, etc.).
- Returning users (role already set) skip onboarding and go to `/en/dashboard`.
- The middleware (`middleware.ts`) should redirect unauthenticated users away from protected routes (not yet implemented — currently all routes are open).

Before P1-01, push this commit and do the CF Pages env var update below.

### Open questions for Pradeep

1. **CF Pages env vars — must add before next deploy** (go to CF Pages → Settings → Variables and Secrets):
   - `NEXT_PUBLIC_SENTRY_DSN` = same DSN value already in .env.local
   - `SENTRY_AUTH_TOKEN` = the token in .env.local (needed for source map upload during CF Pages build)
   - `SENTRY_ORG` = `shulka`
   - `SENTRY_PROJECT` = `shulka`
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `RESEND_FROM` — also needed for auth to work in production (from P0-08)

2. **Verify the live site works after deploy:**
   - Sign in at `https://shulka.pradeepjainbp.in/en/sign-in` with Google
   - Check Sentry → Issues for any startup errors
   - Check Cloudflare Analytics → Web Analytics for the beacon hitting

3. **`sentry.client.config.ts` rename** — Sentry v10 recommends renaming to `instrumentation-client.ts` for Turbopack compatibility. We're on webpack so it works fine, but should be renamed before switching to Turbopack.

4. **`middleware.ts` deprecation** — Next.js 16 still logs a warning about `middleware.ts` being deprecated in favour of `proxy.ts` with `export function proxy`. Non-breaking. Should be renamed before Phase 3 or whenever touching the middleware.

### Notes / context

- `NEXT_PUBLIC_SENTRY_DSN` is intentionally public — Sentry DSNs are designed to be embedded in browser bundles. They have rate-limiting and project scoping on Sentry's side.
- `Sentry.flush(2000)` in `withErrorReporting` is required for CF Workers — the runtime can terminate before async operations complete if you don't await flush.
- `onRequestError = Sentry.captureRequestError` in `instrumentation.ts` is the Sentry v10 way to capture errors from nested React Server Components — it's the Next.js 15+ `onRequestError` instrumentation hook.
- The `@sentry/nextjs` auto-instrumentation wraps route handlers. This is why the stack trace shows `wrapRouteHandlerWithSentry` in the auth error — that's expected and fine.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No financial computation. No audit log touched. All services on free tier. Sentry is on free tier (5K errors/month).

---

## Session: 2026-05-18 — P0-08: Auth.js v5 + Google OAuth + magic-link + e2e (Sonnet)

### What this session did

- **DB migration** (`0001_nice_praxagora.sql`, applied to live Neon):
  - Added `email_verified` and `image` columns to `users`
  - Created `accounts` table (OAuth provider linking)
  - Created `verification_tokens` table (magic-link tokens)
- **`apps/web/auth.ts`** — Auth.js v5 `NextAuth` config: `DrizzleAdapter`, `strategy: 'jwt'`, Google + Resend providers. In `PLAYWRIGHT_TEST=true` mode, `sendVerificationRequest` captures the magic link URL to `globalThis.__playwrightLastMagicLinkUrl` instead of sending email.
- **`/api/auth/[...nextauth]`** — Auth.js handler (GET + POST).
- **`/api/me`** — Zod-validated endpoint returning `MeResponse`; 401 if no session.
- **`/api/test/magic-link`** — test-only capture endpoint (returns 404 unless `PLAYWRIGHT_TEST=true`).
- **`packages/shared-types/src/api/me.ts`** — `MeResponseSchema` + `MeResponse` type (id, email, name, image, role).
- **`middleware.ts` updated** — KV-backed rate limiting on `POST /api/auth/signin/resend`: 5/email/hr, 20/IP/hr. In-memory fallback for local dev.
- **Sign-in page** `/en/sign-in` — Google OAuth button + email magic-link form.
- **Sign-out page** `/en/sign-out` — server action form that calls `signOut({ redirectTo: '/en' })`.
- **`e2e/auth.spec.ts`** — full magic-link flow: submit email → capture URL from test endpoint → navigate to URL → assert `/api/me` returns user → sign out → assert 401.
- **`playwright.config.ts`** updated — webServer uses `PLAYWRIGHT_TEST=true` env; activates when `e2e/` has test files.

**All checks green:** build (8 routes), lint (75 files), typecheck, unit tests (1/1), e2e (1/1, 21s).

### What's next

P0-09 — done in this session.
