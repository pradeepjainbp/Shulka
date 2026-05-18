# Shulka — Status

> Updated by every Claude Code session at session-end. Read by every session at session-start.

## Current state

**Phase:** Phase 0 — Setup
**Status:** In progress — P0-05 done
**Last updated:** 2026-05-18
**Last actor:** Sonnet (P0-05 design tokens + Geist + AppShell + styleguide)

## Active ticket

**P0-08 — Auth.js v5: Google OAuth + Email magic link via Resend** (next to claim)

## Recent shipped

- P0-01 — monorepo + tooling
- P0-02 — repo config files + first git commit
- P0-03 — packages/db (Drizzle + Neon), audit tables + triggers live, shulka_app role, cron stub, health route
- P0-04 — DNS CNAME set, CF Pages build passing (OpenNext adapter), `shulka.pradeepjainbp.in` live
- P0-05 — packages/design-tokens, Tailwind config, AppShell (header+sidebar+bottom-nav), /styleguide route
- P0-06 — next-intl [locale] routing, packages/i18n, next-pwa service worker, PWA manifest, CF cache fix
- P0-07 — shadcn/ui (10 components), Sonner, Tremor charts, Lucide; /en/styleguide updated

## Blockers

**Confirmed by Pradeep on 2026-05-02:**

- [x] Cloudflare account ready
- [x] Neon account ready (AWS Mumbai region)
- [x] Resend account ready (`pradeepjainbp.in` domain to be verified at P0-08)
- [x] Google Cloud project ready (OAuth client IDs)
- [ ] **Sentry account NOT yet set up** — partial blocker for P0-09. Can be set up in 5 minutes on sentry.io in parallel with P0-01 through P0-08; only blocks the Sentry portion of P0-09. Cloudflare Web Analytics portion of P0-09 is unblocked.
- [x] GitHub repo `pradeepjainbp/Shulka` confirmed
- [ ] GitHub Personal Access Token for bot account — defer to Phase 8 (contributor PR flow). Not a Phase 0 blocker.

**Decisions confirmed by Pradeep on 2026-05-02:**

- **License (P0-02):** proprietary all-rights-reserved at root; CC0 in `/rules/` directory.
- **Phase 8 reviewer governance:** Pradeep acts as primary architectural auditor and rule-approval reviewer. Community-contributed rules (Phase 8 contributor flow) require Pradeep's approval with verified `membership_no` + cryptographic hash validation. Pradeep's own rule additions go through PR review (developer flow), not the contributor flow — this preserves the `proposed_by != approved_by` invariant without requiring a second CA reviewer at launch. *Note: a second human reviewer for resilience / bus-factor remains advisable; flag as a "before scaling rule contributions" item, not a Phase 8 launch blocker.*

## Phase progress

- [ ] Phase 0 — Setup (7/9 tickets — P0-01 ✓ P0-02 ✓ P0-03 ✓ P0-04 ✓ P0-05 ✓ P0-06 ✓ P0-07 ✓)
- [ ] Phase 1 — Identity & Foundation (0/8)
- [ ] Phase 2 — Invoicing (0/8)
- [ ] Phase 3 — Purchases & ITC (0/5)
- [ ] Phase 4 — Summaries & Insights (0/6)
- [ ] Phase 5 — CA Multi-client (0/6)
- [ ] Phase 6 — Android shell (0/4)
- [ ] Phase 7 — Bank statements
- [ ] Phase 8 — Public beta + Contributor UI
- [ ] Phase 9 — GSP integration
- [ ] Phase 10 — iOS + e-Inv + e-Way

## Notes

The framework has been pre-flight reviewed by Opus on 2026-05-02. The review:
- Added ADRs 8–14 (DECISIONS.md): split invoice tables, Sacred Rule 3 amendment, mirrored-row linking, business_trusts, DPDP justification, Capacitor read-only offline, Auth.js fallback strategy.
- Amended Sacred Rule 3 (mutation rules) and Sacred Rule 17 (UTC storage / IST render).
- Rewrote ARCHITECTURE.md §3 schema: split `invoices` → `sales_invoices` + `purchase_invoices` (and items); removed `trust_status` from `parties`; added `business_trusts` and `scheme_elections`; specified the dual-write contract between `audit_events` and `rule_resolutions`; switched to `clock_timestamp()` defaults.
- Reorganized Phase 0 into nine tickets in execution order (PHASES.md).

The first Claude Code session should:
1. Read SACRED_RULES.md → STATUS.md → HANDOFF.md → MASTER_PROMPT.md → PHASES.md.
2. Confirm pre-flight items above with Pradeep.
3. Begin P0-01 in the revised order.
