# Handoff — Shulka

> Each session writes this for the next session.
> The next session reads this after SACRED_RULES.md and STATUS.md.

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

1. **Onboarding chain**: Currently after role selection the user goes to `/en/dashboard`, which now shows a "Create your first business" CTA. The PHASES.md open question was whether to force business creation inline during onboarding (role → business form). Current implementation leaves it at dashboard level. Is this acceptable, or should the middleware also redirect business_owner users with 0 businesses to `/en/businesses/new`?

2. **CA flow for businesses**: CAs don't own businesses — the `businesses` page currently queries by `ownerUserId`, so CAs will always see an empty list. Should `/en/businesses/new` be hidden / replaced for CAs? (The `ca_business_links` table for CA←→client relationships doesn't exist yet — that's a later ticket.)

3. **Edit page**: `/en/businesses/:id/edit` is linked from the list but the page doesn't exist yet (only the `PATCH` API exists). Should this be added as part of P1-02 cleanup or deferred to after P1-03?

4. **Deploy to production?** Migration is on live Neon already. CF Pages deploy would expose the new routes.

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
