# Architectural Decision Records (ADRs) — Shulka

> Append-only log. Each major architectural decision gets one entry.
> When you make a decision that affects future code, append a new ADR *before* implementing.

Format:
- **ADR-N | YYYY-MM-DD | <subject>**
- **Context:** what problem
- **Decision:** what we chose
- **Consequences:** good and bad
- **Alternatives considered:** what we ruled out and why

---

## ADR-1 | 2026-05-02 | Web-first multi-platform via Next.js + Capacitor

**Context:** Shulka must serve web, Android, and (later) iOS users. Solo developer. Free-tier infrastructure.

**Decision:** Single Next.js 14 codebase. Capacitor wraps the production web build into Android (Phase 6) and iOS (Phase 10) shells. PWA support enabled Day 1 for installable web experience before native ships.

**Consequences:**
- ✅ ~60% effort savings vs separate native codebases.
- ✅ Same UI, same logic, same source of truth for all three platforms.
- ✅ Web SEO benefits the network-effect mechanic (public seller profiles).
- ❌ Some native-feel polish requires Capacitor plugin work (camera, share, biometric).
- ❌ App-store review processes apply to the native shells.

**Alternatives considered:**
- Native Kotlin + Native Swift + Web — too expensive for solo developer.
- Flutter for all three — single codebase but loses the web SEO and Tailwind/shadcn ecosystem.
- React Native — same complexity as Capacitor but smaller browser-API ecosystem.

---

## ADR-2 | 2026-05-02 | Neon Postgres over Turso/SQLite

**Context:** Multi-tenant financial app with concurrent writes, ITC matching across thousands of supplier-buyer pairs, network-effect joins on shared invoice tables.

**Decision:** Neon Postgres in AWS Mumbai region.

**Consequences:**
- ✅ Real Postgres: row-level security, window functions for ageing/ITC, JSONB queries.
- ✅ Branching for prod/dev workflows.
- ✅ India residency.
- ✅ Free tier 0.5 GB sufficient for MVP.
- ❌ Slightly more ops than SQLite. Migration tooling required (we use Drizzle).

**Alternatives considered:**
- Turso (libSQL/SQLite) — used in Pradeep's other project. Multi-tenant concurrent writes possible but cross-tenant aggregations less mature than Postgres.
- Supabase — Pradeep already used 2 free projects.
- Firebase Firestore — explicit rule of the project: no Firebase.
- Cloudflare D1 — SQLite, single-region, less mature than Neon for this scope.

---

## ADR-3 | 2026-05-02 | Cloudflare-everything for compute and storage

**Context:** Free-tier discipline + India edge presence + zero-egress storage requirement (PDFs).

**Decision:** Cloudflare Pages (web), Workers (cron + heavy jobs), R2 (file storage), KV (cache/sessions), DNS, Web Analytics.

**Consequences:**
- ✅ Mumbai POP for Indian latency.
- ✅ R2 zero egress = serving 10K invoice PDFs/month is free.
- ✅ Single vendor for ops simplicity.
- ❌ Ties us to Cloudflare's runtime (Workers limits — 10ms CPU on free, 30s on paid).
- ❌ Edge runtime is a subset of Node.js — some npm packages unsupported.

**Alternatives considered:**
- Vercel + Vercel Postgres — explicit rule: no Vercel hosting (cost, free-tier limits).
- AWS Lambda + S3 + CloudFront — paid runtime APIs not aligned with free-tier-only.
- Fly.io — alternative serverless container; not as cost-favorable for this use case.

---

## ADR-4 | 2026-05-02 | Versioned JSON rule book in repo, time-aware engine

**Context:** GST changes constantly (~7–12 CBIC notifications/quarter). Need an audit trail that can answer "why did Shulka compute X% on this invoice 2 years ago" — both for users and for tax authority disputes.

**Decision:** Rules live as version-controlled JSON files in `/rules/`, organized by domain. Each rule file has effective_from/effective_to dates, source citation, golden test cases, and a sha256 hash. A pure-TypeScript rule engine in `packages/gst-engine` loads them at cold start, indexes by date, resolves the rule effective on the transaction's date.

Audit log mirrors every resolution with a frozen copy of the source citation at resolution time.

**Consequences:**
- ✅ Git history = audit trail of who changed what rule and when.
- ✅ Mobile (Capacitor) gets offline GST math by bundling the JSON.
- ✅ CI runs golden tests on every rule on every PR.
- ✅ Rule changes are PRs, reviewable.
- ✅ Phase 8 contributor UI generates these JSON files via form input — no human ever edits JSON directly.
- ❌ A rule update is a deploy, not a DB write. (Acceptable; Cloudflare deploys are <60s.)

**Alternatives considered:**
- Rules in DB — no git history, requires migration for every rule change, no offline support.
- Hybrid (JSON source, DB cache) — over-engineered for MVP scale.

---

## ADR-5 | 2026-05-02 | Network-effect linking via silent auto-link with trust elevation

**Context:** Two Shulka users transact (A invoices B). How do their books get linked?

**Decision:** When invoice party's GSTIN matches an existing Shulka business, the invoice auto-appears in the recipient's "Incoming" feed with a "External" badge. Recipient one-taps "Trust [Sender]" to elevate. Without elevation, invoices remain quarantined but visible.

**Consequences:**
- ✅ Zero cold-start friction (no "send a link request, wait for approval").
- ✅ Spam protection (trust elevation gates auto-acceptance into ledger).
- ✅ Recipient is in control of their own books.
- ❌ Slightly more nuanced UX than "explicit invite" — needs careful copy.

**Alternatives considered:**
- Explicit "send connection request" — kills cold-start dynamics.
- Fully automatic link — risk of malicious or mistaken invoices polluting buyer ledgers.

---

## ADR-6 | 2026-05-02 | Auth.js v5 with Google + Email magic-link; defer WhatsApp OTP

**Context:** Need user auth that works for web + Capacitor, free, India-friendly.

**Decision:** Auth.js v5 with two providers — Google OAuth (primary, fastest UX for Indian Gmail users) and Email magic-link via Resend (fallback). WhatsApp OTP added in v1.1 once a dedicated business phone number is procured.

**Consequences:**
- ✅ Both providers free.
- ✅ Auth.js handles JWT/session correctly with edge runtime.
- ✅ Capacitor's native Google Sign-In plugin gives best mobile UX in Phase 6.
- ❌ No phone OTP at MVP — small fraction of users may prefer phone.

**Alternatives considered:**
- Firebase Auth — explicit rule: no Firebase.
- Clerk — paid above free tier; vendor lock-in.
- Custom rolled — too much surface for solo dev.

---

## ADR-7 | 2026-05-02 | Anti-hallucination: server computes every rupee, LLM narrates only

**Context:** Tax software cannot tolerate LLM-confabulated numbers. Audit defense and accuracy demand deterministic compute.

**Decision:** All financial computations happen in TypeScript on the server (rule engine + computation module). LLMs (Gemini Flash, Sonnet, Opus) are *only* used to:
- Extract structured data from images (OCR, with confidence badges; user must confirm)
- Wrap pre-computed numbers in friendly sentences ("₹2.4L of ITC will lapse by Nov 30")
- Help the developer write code, copy, and tests

LLMs are never asked "what is the GST on X?"

**Consequences:**
- ✅ Auditable, reproducible computations.
- ✅ Lower LLM token cost.
- ✅ Compatible with offline mobile (no LLM call needed for math).
- ❌ Slightly more code-side validation work.

**Alternatives considered:** none. This is a hard rule, carried from Pradeep's Bharat Stock X-Ray project.

---

## ADR-8 | 2026-05-02 | Split `invoices` into `sales_invoices` and `purchase_invoices`

**Context:** Original schema had a single `invoices` table with `is_purchase bool` discriminator and `unique(business_id, fy, invoice_number)` constraint. Two problems: (a) Indian GST law requires gap-free numbering only on sales — purchases use the supplier's number, which can collide across suppliers; (b) sales and purchases have different lifecycles, status enums, and immutability scopes.

**Decision:** Two separate tables. `sales_invoices` enforces gap-free per-FY numbering; `purchase_invoices` enforces uniqueness only as `(business_id, party_id, supplier_invoice_number)` to prevent duplicate entry. Line items split into `sales_invoice_items` and `purchase_invoice_items`. Shared TypeScript types via a `BaseInvoice` interface in `packages/shared-types`.

**Consequences:**
- ✅ Gap-free numbering invariant is correct and enforceable.
- ✅ Different lifecycles (`sent`/`paid` vs `recorded`/`disputed`) modeled cleanly.
- ✅ FK relationships from ITC entries are explicit (`purchase_invoice_id`, never ambiguous).
- ❌ Some duplicated DDL between the two tables. Acceptable; code dedup via shared types.

**Alternatives considered:**
- Single table with `WHERE is_purchase = false` partial unique index — works but conflates two semantically different documents. Future ITC, e-invoicing, and reconciliation logic would all need `if (is_purchase)` branches.

---

## ADR-9 | 2026-05-02 | Sacred Rule 3 amended — status mutable, monetary fields immutable

**Context:** Original Sacred Rule 3 ("Never UPDATE an invoice's amount; never DELETE; issue a reversing entry") was strict-readable as forbidding all UPDATEs to the `invoices` table. But the lifecycle requires `status` transitions (`sent → paid`, `sent → cancelled`) which are by definition UPDATEs. The schema also has `updated_at`. Strict reading would make the first paid-invoice PR illegal.

**Decision:** Amend Rule 3. Once a financial document leaves `draft` state: monetary fields and line items are **immutable**. Status, payment metadata, due dates, and notes are **mutable** with mandatory audit-event entries. Cancellation = status transition (`status='cancelled'`) PLUS a reversing-entry invoice (`reversed_by_invoice_id` set on the cancelled row, pointing to a new sales/purchase invoice with negated totals and `kind='reversal'` in the audit event). Never DELETE.

**Consequences:**
- ✅ Lifecycle is implementable without violating the sacred rule.
- ✅ Audit log captures every mutation (status, payment, notes).
- ✅ Reversing-entry pattern preserves the "no silent change to money" intent.
- ❌ Implementers must remember: if you find yourself UPDATEing a monetary column post-draft, you have a bug.

**Alternatives considered:**
- Status-as-event-stream (no status column; derive from audit log) — over-engineered for MVP; querying current state becomes joins.
- Soft-delete-only (set `cancelled_at`, no reversing entry) — loses the bookkeeping trail an auditor expects.

---

## ADR-10 | 2026-05-02 | Network-effect linking via mirrored rows

**Context:** When A invoices B and B is on Shulka, the invoice must appear in B's purchase ledger. Two implementation patterns: (a) one shared row in a single `invoices` table with `linked_to_business_id`, queried by both sides; (b) mirrored rows — A's `sales_invoices` row plus a separate `purchase_invoices` row in B's books, joined by FK. Pattern (a) requires Postgres RLS gymnastics and prevents B from independently re-categorizing HSN, blocking ITC, or adding notes without forking. Pattern (b) gives each side a real, owned row.

**Decision:** Mirrored rows.
- A creates a `sales_invoices` row at send time with `linked_to_business_id = B.id`. B sees it in `/incoming` (quarantined) by querying sales_invoices for `linked_to_business_id = B.id` AND no matching `business_trusts` record OR trust = pending/revoked.
- On B's "Trust this supplier" action: a `purchase_invoices` row is created in B's books mirroring A's invoice, and `business_trusts` row is created/elevated. A's `sales_invoices.linked_purchase_invoice_id` is set to B's new row; B's `purchase_invoices.linked_sales_invoice_id` is set to A's row.
- Future invoices from A to B auto-create the B-side mirror row immediately at send time (because trust exists).

**Consequences:**
- ✅ Each business owns its own row; HSN re-categorization, ITC blocking, notes are independent.
- ✅ Audit log on each side reflects that side's actions only.
- ✅ Simple tenancy — no cross-tenant queries except the `/incoming` quarantine view.
- ❌ Two-row write pattern. Wrap in a transaction; both rows commit or neither.
- ❌ Drift risk if A edits monetary fields (forbidden by ADR-9 anyway, so contained).

**Alternatives considered:**
- Shared row with RLS — outlined above; rejected for tenancy and editability reasons.

---

## ADR-11 | 2026-05-02 | `business_trusts` as a separate table; remove `parties.trust_status`

**Context:** Trust between two Shulka businesses is a transactional relationship with its own lifecycle (pending → trusted → revoked, with timestamps and actor attribution). Storing it on `parties.trust_status` overloads the address book (`parties`) with relationship state and creates the asymmetry problem: when A first invoices B, B has no `parties` row for A — but trust must be storable.

**Decision:** New `business_trusts(truster_business_id, trusted_business_id, status, elevated_at, revoked_at, elevated_by_user_id, revoked_by_user_id, ...)` table. Unique on `(truster, trusted)`. Remove `trust_status`, `trust_elevated_at` from `parties`. The `parties` table goes back to being purely an address book.

Trust elevation flow:
1. B taps "Trust this supplier" on a quarantined incoming invoice from A.
2. Server inserts/updates `business_trusts` row: `(truster=B, trusted=A, status='trusted', elevated_at=now, elevated_by_user_id=B's user)`.
3. Server creates B's `purchase_invoices` mirror row for that invoice and any prior quarantined invoices from A.
4. Audit event `party.trust_elevated`.

Revocation flow:
1. B taps "Revoke trust" in settings.
2. Server updates `business_trusts` row to `status='revoked'`, `revoked_at=now`.
3. Existing `purchase_invoices` rows stay (record of past truth).
4. Future incoming invoices from A go back to quarantine.
5. Audit event `party.trust_revoked`.

**Consequences:**
- ✅ Clean separation: `parties` is address book, `business_trusts` is relationship state.
- ✅ Revocation is a natural status transition.
- ✅ No party-row asymmetry to resolve.
- ✅ Trust is bidirectional-aware (B trusts A; A doesn't necessarily trust B for the reverse direction — uniqueness on the ordered pair, not the unordered).
- ❌ One more table. Trivial cost.

**Alternatives considered:**
- Keep on `parties` and auto-create a `parties` row in B's books on first incoming invoice — couples trust state to address book state and forces synthetic name/address from A's `businesses` row.

---

## ADR-12 | 2026-05-02 | DPDP — silent GSTIN lookup is not personal data processing

**Context:** When user A creates an invoice for B's GSTIN, the server checks whether B is a registered Shulka business and, if yes, populates `linked_to_business_id` on A's invoice. This means A learns that B is on Shulka without B's explicit consent. DPDP Act 2023 governs personal data processing; question is whether this lookup qualifies.

**Decision:** This lookup is lawful and requires no consent screen. Reasoning:
1. A GSTIN is a public business identifier published on the GST portal. Disclosing that an entity registered for GST exists is not personal data disclosure.
2. The matching is on the business identifier, not on the user behind the business. No personal information about B's owner-user is exposed to A.
3. The disclosure is purpose-limited (network-effect linking only) and reciprocal — both parties are on Shulka by their own choice.
4. A learns only "B is on Shulka," which is the same information they would learn the moment B sends an invoice back to A.

**Consequences:**
- ✅ Network-effect mechanic ships without a consent friction point.
- ✅ DPDP defense documented if ever questioned.
- ❌ Edge case: if a Shulka business owner does not want to be discoverable by GSTIN, we have no opt-out. Acceptable for MVP; revisit if a real user requests it.

**Alternatives considered:**
- Explicit consent at sign-up ("Allow other Shulka businesses to discover you by GSTIN?") — adds friction; no real privacy gain since the GSTIN is already public and the inference is trivial.

---

## ADR-13 | 2026-05-02 | Capacitor MVP is read-only offline; writes require connectivity

**Context:** Capacitor wraps the Next.js build for Android (Phase 6) and later iOS. The rule engine ships bundled JSON and works offline. But invoice creation requires server round-trip (server-computed taxes per Sacred Rule 1, audit log writes, gap-free invoice numbering allocated server-side). What's the offline-write story?

**Decision:** **Read-only offline at MVP.** Service Worker + IndexedDB cache the most recent dashboard fetch and recently-viewed invoices/purchases for offline viewing. Any write action (create invoice, record purchase, elevate trust, claim ITC) shows a top banner "You're offline. Reconnect to save." and disables submit buttons. No queued offline mutations.

**Consequences:**
- ✅ Avoids the gap-free numbering nightmare of offline-allocated invoice numbers.
- ✅ Avoids reconciliation logic for offline-vs-server divergence.
- ✅ Audit log stays canonical (no client-side append-and-reconcile).
- ❌ Users in poor connectivity can read but not work. Acceptable for an MSME tool whose target users are mostly indoors with WiFi or 4G.
- ❌ Revisit if user feedback demands it; Phase 7+ can add queued reads with explicit warnings.

**Alternatives considered:**
- Optimistic offline writes with reconciliation — complex, breaks numbering invariants.
- Reserve number ranges per device — loses gap-free guarantee on cancellation.

---

## ADR-14 | 2026-05-02 | Auth.js v5 fallback — JWT-only sessions if edge-compat fails

**Context:** Auth.js v5 + Drizzle adapter + Neon HTTP driver + Cloudflare Pages edge runtime is a known-ugly combination. The Drizzle adapter for Auth.js is community-maintained and has lagged Auth.js releases historically. There is real risk that the database-session strategy (Auth.js stores session in `sessions` table, looked up on every request) doesn't work cleanly on edge runtime.

**Decision:** Before P0-08 (Auth.js ticket) begins, do a 30-minute throwaway POC confirming the full chain works end-to-end with Google OAuth. **If it does:** use database session strategy as planned. **If it does not:** fall back to `strategy: 'jwt'` (JWT-only sessions; no DB session lookup). Cost: cannot force-revoke a session; tokens stay valid until expiry. Acceptable at MVP — Auth.js JWTs are short-lived and revocation will be revisited if needed.

The `users` and `accounts` tables are still created (for OAuth account linking and user identity); only the `sessions` table is conditionally unused.

**Consequences:**
- ✅ De-risks the single highest-risk Phase 0 ticket.
- ✅ Either path satisfies the user-visible auth requirement.
- ❌ If JWT-only is chosen, document a future remediation path: a token denylist in KV when forced revocation becomes necessary.

**Alternatives considered:**
- Skip Auth.js entirely and roll custom — too much surface for solo dev.
- Use Lucia or another lib — Auth.js is the most maintained for this stack; switching libraries is a bigger risk than the JWT fallback.

---
