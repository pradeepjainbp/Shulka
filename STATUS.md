# Shulka — Status

> Updated by every Claude Code session at session-end. Read by every session at session-start.

## Current state

**Phase:** Phase 2 — Invoicing
**Status:** IN PROGRESS — 3/8 tickets done
**Last updated:** 2026-05-20
**Last actor:** Sonnet (P2-03 network-effect trust system)

## Active ticket

**P2-04** — next ticket TBD

## Recent shipped

- P2-03 — business_trusts + purchase_invoices tables (migration 0008), linked_to_business_id on sales_invoices, /api/incoming + /api/trusts + /api/incoming/:id/accept, /en/incoming quarantine inbox + TrustButton, auto-mirror on sales create when trust exists (232 tests unchanged)
- P2-02 — posKind enum + pos_override_reason columns (migration 0007), POST /api/sales stores posKind, PATCH finalise writes PoS rule_resolution row, SalesInvoiceForm override detection + reason field + tax split display, 13 new tests (232 total)
- P2-01 — sales_invoices + sales_invoice_items schema + migration 0006, POST/GET /api/sales, GET/PATCH /api/sales/:id (finalise dual-write), SalesInvoiceForm (draft save + restore), /en/sales list page, 28 new tests (219 total)
- P1-08 — AuditPayloadSchemas (15 kinds), recordEvent<K> helper, wired into businesses + parties POST routes, immutability trigger integration test
- P1-07 — placeOfSupply() engine, all 36 states+UTs, export/import/SEZ/B2B/B2C, 60 tests
- P1-06 — RuleEngine (fromRules, resolveRule, 4 invariants, scheme-election grandfathering), 10 seeded rule JSON files, scheme_elections table + migration 0005 (applied).
- P1-05 — HSN/SAC master JSON (633 codes), fuse.js autocomplete component, /en/hsn demo page
- P1-04 — parties table + migration (applied manually to Neon), nested API GET/POST/PATCH, party list + search, add-party form with GSTIN validation + network-effect Shulka-match banner.
- P1-03 — `@shulka/gst-engine` package, GSTIN validator (pure TS, Mod-36), 108 tests, wired into API + UI
- P1-02 — businesses table, GET/POST/PATCH API, creation form, list page, dashboard CTA
- P1-01 — Role selection onboarding, auth guard in middleware, PATCH /api/me, /en/dashboard

## Blockers

- [x] ~~Migration 0006 applied to Neon~~ ✓
- [x] ~~Migration 0007 applied to Neon~~ ✓
- [ ] **Migration 0008 (0008_network_effect.sql) — must be applied to Neon** (business_trusts + purchase_invoices + linked_to_business_id on sales_invoices)
- [ ] **CF Pages env vars missing** — Add to CF Pages dashboard before next deploy:
  - SENTRY_AUTH_TOKEN, SENTRY_ORG=shulka, SENTRY_PROJECT=shulka (for source map upload during build)
  - NEXT_PUBLIC_SENTRY_DSN (same value as SENTRY_DSN — needed for client-side error capture)
  - AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, RESEND_API_KEY, RESEND_FROM (auth env vars)
- [ ] GitHub Personal Access Token for bot account — defer to Phase 8.
- [ ] Replace placeholder PWA icons (public/icons/icon-192.png, icon-512.png) — defer to Phase 8.

**Confirmed decisions:**
- Auth.js JWT-only strategy is permanent (not a fallback). See ADR-14.
- OpenNext is the permanent CF Pages adapter. See LEARNINGS.md #7.
- Sales invoice two-step flow: Save as Draft → explicit Finalise (per session decision 2026-05-20).
- Place of supply override: editable dropdown in P2-01 form (not auto-derived only).

## Phase progress

- [x] Phase 0 — Setup (9/9 — all done ✓)
- [x] Phase 1 — Identity & Foundation (8/8 — all done ✓)
- [ ] Phase 2 — Invoicing (3/8)
- [ ] Phase 3 — Purchases & ITC (0/5)
- [ ] Phase 4 — Summaries & Insights (0/6)
- [ ] Phase 5 — CA Multi-client (0/6)
- [ ] Phase 6 — Android shell (0/4)
- [ ] Phase 7 — Bank statements
- [ ] Phase 8 — Public beta + Contributor UI
- [ ] Phase 9 — GSP integration
- [ ] Phase 10 — iOS + e-Inv + e-Way

## Notes

Phase 0 is complete. The stack is:
- Next.js 16.2.6 + OpenNext on CF Pages
- Drizzle + Neon (JWT sessions, no DB sessions)
- next-intl [locale] routing
- shadcn/ui + Tremor + Sonner + Lucide
- Sentry v10 error reporting (client + server)
- CF Web Analytics beacon
- PWA (next-pwa v5)
- Auth.js v5 (Google OAuth + magic-link)

See LEARNINGS.md for 21 hard-won discoveries from Phase 0 that future sessions must know.
