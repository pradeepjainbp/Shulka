# Shulka — Status

> Updated by every Claude Code session at session-end. Read by every session at session-start.

## Current state

**Phase:** Phase 1 — Identity & Foundation
**Status:** IN PROGRESS — 4/8 tickets done
**Last updated:** 2026-05-20
**Last actor:** Sonnet (P1-04 party directory)

## Active ticket

**P1-05 — HSN/SAC code search** (in_progress)

## Recent shipped

- P1-04 — parties table + migration, nested API GET/POST/PATCH, party list + search, add-party form with GSTIN validation + network-effect Shulka-match banner. **Migration 0004 NOT YET APPLIED to Neon (DNS unreachable at commit time) — apply before testing live.**
- P1-03 — `@shulka/gst-engine` package, GSTIN validator (pure TS, Mod-36), 108 tests, wired into API + UI
- P1-02 — businesses table, GET/POST/PATCH API, creation form, list page, dashboard CTA
- P1-01 — Role selection onboarding, auth guard in middleware, PATCH /api/me, /en/dashboard
- P0-01 — monorepo + tooling
- P0-02 — repo config files + first git commit
- P0-03 — packages/db (Drizzle + Neon), audit tables + triggers live, shulka_app role, cron stub, health route
- P0-04 — DNS CNAME set, CF Pages build passing (OpenNext adapter), `shulka.pradeepjainbp.in` live
- P0-05 — packages/design-tokens, Tailwind config, AppShell (header+sidebar+bottom-nav), /styleguide route
- P0-06 — next-intl [locale] routing, packages/i18n, next-pwa service worker, PWA manifest, CF cache fix
- P0-07 — shadcn/ui (10 components), Sonner, Tremor charts, Lucide; /en/styleguide updated
- P0-08 — Auth.js v5 JWT, Google OAuth + magic-link, /api/me, KV rate limiting, e2e test
- P0-09 — CF Web Analytics beacon, Sentry v10 (client/server/edge), ErrorBoundary, withErrorReporting(), e2e trip-the-boundary

## Blockers

- [ ] **CF Pages env vars missing** — Add to CF Pages dashboard before next deploy:
  - SENTRY_AUTH_TOKEN, SENTRY_ORG=shulka, SENTRY_PROJECT=shulka (for source map upload during build)
  - NEXT_PUBLIC_SENTRY_DSN (same value as SENTRY_DSN — needed for client-side error capture)
  - AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, RESEND_API_KEY, RESEND_FROM (auth env vars)
- [ ] GitHub Personal Access Token for bot account — defer to Phase 8. Not a Phase 1 blocker.
- [ ] Replace placeholder PWA icons (public/icons/icon-192.png, icon-512.png) — defer to Phase 8.

**Confirmed decisions:**
- Auth.js JWT-only strategy is permanent (not a fallback). See ADR-14.
- OpenNext is the permanent CF Pages adapter. See LEARNINGS.md #7.

## Phase progress

- [x] Phase 0 — Setup (9/9 — all done ✓)
- [ ] Phase 1 — Identity & Foundation (4/8)
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
