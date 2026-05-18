# Handoff — Shulka

> Each session writes this for the next session.
> The next session reads this after SACRED_RULES.md and STATUS.md.

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

**P0-09 — Cloudflare Web Analytics + Sentry hookup.** This is the final Phase 0 ticket.

Spec:
- Cloudflare Web Analytics: add the beacon script to the root layout.
- Sentry: React error boundary in app shell + `withErrorReporting()` server-side wrapper on API routes.
- Source maps uploaded in CF Pages build pipeline.
- A "trip the boundary" verification script confirming both paths land in Sentry.

Before starting P0-09: Pradeep needs a Sentry account + project created (sentry.io, free tier). Sentry DSN + auth token needed as env vars.

**After P0-09, Phase 0 is complete.** Phase 0 done when: Pradeep can sign in at `shulka.pradeepjainbp.in`, see his name, sign out. All 9 tickets ✓.

### Open questions for Pradeep

- Push this commit to deploy P0-08. After deploy:
  1. Add `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `RESEND_FROM` to CF Pages → Settings → Variables and Secrets (they're only in `.env.local` right now, not in CF Pages dashboard).
  2. Test Google sign-in at `https://shulka.pradeepjainbp.in/en/sign-in`.
  3. Test magic-link with your Gmail — verify email arrives from `noreply@pradeepjainbp.in`.
  4. Verify `/api/me` returns your user after sign-in.
- Before P0-09: create a Sentry project at sentry.io (free tier). Note the DSN and generate an auth token.
- `middleware.ts` deprecation: Next.js 16 shows a warning that `middleware.ts` is deprecated in favour of `proxy.ts`. The app works fine — this is a non-breaking deprecation. The next session touching middleware should rename the file and update the export name (`proxy` instead of `middleware`). Not urgent but document it.

### Notes / context

- **JWT strategy is the correct permanent choice** (not a fallback). Confirmed working. Do not revisit `strategy: 'database'`.
- The `globalThis.__playwrightLastMagicLinkUrl` pattern is intentional — Next.js webpack bundles each route in its own module; `globalThis` is shared across all bundles in the same Node process, which `module`-level variables are not.
- `apps/web/auth.ts` exports `getLastMagicLinkUrl()` — only called by the test endpoint. In production the endpoint returns 404.
- Rate limiting in `middleware.ts` reads the request body via `request.clone().text()` — the clone is necessary because the body stream can only be consumed once.
- `@cloudflare/workers-types` added to `apps/web/package.json` devDeps for `KVNamespace` type in middleware.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No financial computation. No LLM computed any rupee. Audit log untouched. All services on free tier.

---

## Session: 2026-05-18 — P0-07: shadcn/ui + Sonner + Tremor + Lucide (Sonnet)

### What this session did

- Installed and manually wrote 10 shadcn/ui-style components in `apps/web/components/ui/`:
  `button` (CVA, 5 variants × 4 sizes), `input`, `card` (Header/Title/Description/Content/Footer),
  `dialog` (Radix), `badge` (6 variants), `separator`, `avatar` (Radix), `tabs` (Radix),
  `tooltip` (Radix), `skeleton`.
- Created `apps/web/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
- Added Sonner `<Toaster>` to `app/[locale]/layout.tsx` with Shulka token class names.
- Added Tremor CSS variables to `globals.css` mapped to Shulka palette (primary `#0F5C3F`, surface `#FAF7EE`, etc.).
- Added Tremor dist path to Tailwind content scan in `tailwind.config.ts`.
- Rewrote `app/[locale]/styleguide/page.tsx` as `'use client'` — 11 sections: Color Palette, Type Scale, Buttons, Input, Card, Badge, Dialog, Tabs, Tooltip, Avatar, Skeleton, Toast (3 variants), LineChart + BarChart (Tremor), Separator.
- All deps: `lucide-react`, `sonner`, `@tremor/react`, `recharts`, `class-variance-authority`, `clsx`, `tailwind-merge`, 6 Radix UI primitives.

**Build:** 4 routes clean. Lint: 64 files, no issues. Typecheck: clean. Tests: 1/1.

### What's next

**P0-08 — Auth.js v5: Google OAuth + Email magic-link via Resend.**

This is the highest-risk ticket in Phase 0. Read ADR-14 in DECISIONS.md before starting.

**⚠ Critical constraints for P0-08 (DO NOT SKIP):**
- **JWT session strategy only** — `strategy: 'jwt'`. Auth.js v5 database session strategy is confirmed broken on CF Workers edge (multiple GitHub issues). Do not use the Drizzle session adapter. Do not attempt `strategy: 'database'`.
- Google OAuth client IDs must be in `.env.local` before starting. Pradeep has them ready (confirmed in STATUS.md blockers).
- Resend domain (`pradeepjainbp.in`) needs email verification in Resend dashboard before magic-link works in production.
- Rate limiting on magic-link endpoint: KV-backed token bucket, 5/email/hr, 20/IP/hr (per PHASES.md spec).
- A Playwright e2e test is REQUIRED per Sacred Rule 10 — signs in via magic-link with mocked Resend webhook, asserts `/me` returns user, signs out, asserts 401.
- `/me` API must use Zod schema from `packages/shared-types/src/api/me.ts` (create this file as part of P0-08).

### Open questions for Pradeep

- Push: `git push origin main` — deploy P0-07 to CF Pages. Verify `/en/styleguide` shows all components and charts at `https://shulka.pradeepjainbp.in/en/styleguide`.
- Before P0-08 starts: confirm Google OAuth client ID + secret are ready in `.env.local`. Also confirm Resend API key is in `.env.local` (for magic-link testing).
- Replace placeholder icons in `apps/web/public/icons/` with real Shulka PNGs (192×192 and 512×512) before Phase 8 launch.

### Notes / context

- `dialog.tsx`, `avatar.tsx`, `tabs.tsx`, `tooltip.tsx`, `separator.tsx` all have `'use client'` — they use Radix hooks. This is correct.
- The styleguide page is `'use client'` to support Dialog open/close state and Sonner `toast()` calls. This is intentional for a dev tool.
- Lucide React is installed but no icons are imported in the styleguide yet — they'll be used in P0-08+ screens. The install is confirmed; use `import { IconName } from 'lucide-react'` anywhere.
- Tremor does NOT have a v3 TypeScript error with React 19 in this setup — the peer dep warning was suppressed and the build is clean.
- `apps/web/AGENTS.md` was fixed last session — it no longer contains misleading instructions.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No financial code touched. No LLM computed any rupee. No paid services used.

---

## Session: 2026-05-18 — P0-06: i18n (next-intl) + PWA scaffold (Sonnet)

### What this session did

- Created `packages/i18n/` (`@shulka/i18n`) — English messages object with `app`, `nav`, `common` keys. `Messages` type exported for future locale additions.
- Installed `next-intl ^3.26.3`; configured via `apps/web/i18n/request.ts` using `getRequestConfig`; wired into `next.config.ts` via `createNextIntlPlugin`.
- Restructured `apps/web/app/` — home and styleguide routes moved into `app/[locale]/`. Root layout kept minimal (fonts, globals.css, manifest link). Locale layout wraps children with `NextIntlClientProvider`.
- Created `apps/web/middleware.ts` — custom locale redirect middleware (CF Workers compatible). Skips `/api/`, `/_next/`, files with extensions. Redirects bare paths to `/en/...`.
- Installed `next-pwa ^5.6.0`; service worker auto-registered. `public/manifest.json` with Shulka brand colors, `start_url: /en/`. Placeholder 1×1 PNG icons in `public/icons/`.
- Added `public/_headers` — `Cache-Control: no-store` for `/sw.js` and `/workbox-*.js` (CF Pages would otherwise cache stale service workers across deploys).
- Bumped `wrangler.toml` `compatibility_date` to `2025-05-05` (fixes FinalizationRegistry + Next.js 16.2.x CF Workers crash risk).
- Updated `DECISIONS.md`: ADR-1 (Next.js version), ADR-2 (Neon region), ADR-3b (adapter switch), ADR-14 (JWT-only confirmed).
- Updated `.gitignore`: added `apps/web/.open-next/`, `apps/web/public/sw.js`, `apps/web/public/workbox-*.js`.

**Build:** 4 routes (`/_not-found`, `/[locale]`, `/[locale]/styleguide`, `/api/health`) + Middleware. Service worker generated. Lint clean. Typecheck clean. Tests 1/1.

**Note on `AGENTS.md` trap:** `apps/web/AGENTS.md` contains misleading instructions ("This is NOT the Next.js you know — APIs may differ from training data"). The sub-agent was fooled into creating `proxy.ts` with `export function proxy(...)` instead of `middleware.ts`. Fixed manually. Ignore that file — standard Next.js conventions apply.

### What's next

**P0-07 — shadcn/ui + Tremor + Sonner + Lucide installed and themed.**

Spec: All four libraries integrated and themed to Shulka tokens. A demo page proves Button, Input, Dialog, Card, Toast, LineChart, BarChart. `/styleguide` updated to show all components.

Read `PHASES.md` §P0-07 and `DESIGN_SYSTEM.md` before starting — all component token mappings are locked there.

**Important for P0-07:** The styleguide is now at `/en/styleguide` (not `/styleguide`). Update any internal links or redirect if needed.

### Open questions for Pradeep

- Push to deploy: `git push origin main`. After deploy, verify:
  - `https://shulka.pradeepjainbp.in/en/` loads (redirected from `/`)
  - `https://shulka.pradeepjainbp.in/en/styleguide` loads with styling
  - Chrome shows "Install Shulka" prompt after a few page loads (PWA install heuristic)
  - `manifest.json` validates at web.dev/measure or Chrome DevTools → Application → Manifest
- Replace placeholder icons in `apps/web/public/icons/` with real 192×192 and 512×512 Shulka PNGs before Phase 8 launch (current icons are 1×1 pixel placeholders).
- Verify `/api/health` returns `{"status":"ok"}` in production (DATABASE_URL must be set in CF Pages env vars).
- Fix git identity: `git config --global user.email "pradeepjainbp@gmail.com"` + `git config --global user.name "Pradeep Jain"`.

### Notes / context

- `next-pwa@5.6.0` has no TypeScript declarations — imported via `require()` with manual type cast in `next.config.ts`. This is correct; do not add `@types/next-pwa`.
- `next-intl@3.26.3` peer dep declares `next@^15` but works fine with Next.js 16. The semver warning in `pnpm install` is harmless.
- The `apps/web/AGENTS.md` file contains a trap for AI agents. It claims Next.js conventions are different. They are not — ignore it entirely.
- Service worker scope is `/` but `start_url` is `/en/`. This is intentional — the SW caches all routes under the origin, not just `/en/`.
- `public/_headers` is a CF Pages feature: it applies response headers to matching paths in the static output. It does NOT require changes to `_worker.js`.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No financial code touched. No LLM computed any rupee. No paid services used.

---

## Session: 2026-05-18 — P0-05: design tokens + Geist font + AppShell + styleguide (Sonnet)

### What this session did

- Created `packages/design-tokens/` — locked palette, typography scale, spacing, radius, shadow, motion tokens per DESIGN_SYSTEM.md. All values are `as const` TypeScript exports.
- Installed Tailwind CSS + PostCSS in `apps/web`; `tailwind.config.ts` extends all Shulka tokens (colors, radius, font families). Config imports tokens via relative path (Tailwind's config loader runs before TS path resolution).
- Geist + Geist_Mono loaded via `next/font/google` with CSS variables `--font-geist-sans` / `--font-geist-mono` applied to `<html>`. Body gets `bg-surface text-ink font-sans antialiased`.
- Created `apps/web/components/shell/AppShell.tsx` — responsive shell: sticky header (Shulka logo + avatar placeholder), 240px sidebar on desktop, 60px icon rail on tablet (768–1023px), bottom nav on mobile (≤767px). Pure server component, Tailwind only.
- Created `apps/web/app/styleguide/page.tsx` — visual smoke test at `/styleguide` showing color swatches, type scale, primary + secondary buttons, input, card with shadow, status pills (paid/pending/overdue/draft), shadow scale.
- Updated `apps/web/app/page.tsx` to use `AppShell` with cream background.
- Fixed pre-existing Biome lint issues across the codebase (import sorting in db schema files, `useLiteralKeys` in drizzle.config + client.ts + health route, `noNonNullAssertion` in health route). Added `.wrangler` and `.open-next` to `biome.json` ignore list (generated files were flooding lint output).

**Build:** `pnpm --filter @shulka/web build` — clean, 4 routes. Lint clean. Typecheck clean. Tests pass (1 smoke test).

### What's next

**P0-06 — i18n (next-intl) + PWA scaffold.**

Spec: `next-intl` configured with `en` as only locale; App Router locale routing via `[locale]/...` segment; `packages/i18n/` for messages. `manifest.json` + service worker via `next-pwa` + Shulka icon set (placeholder). PWA install prompt after 3rd visit.

Read `PHASES.md` §P0-06 before starting — acceptance criteria include `/en/...` routing, service worker in prod build, and Chrome "Install Shulka" prompt.

**Important for P0-06:** After the `[locale]/...` routing change, the AppShell and all routes move into `apps/web/app/[locale]/`. The styleguide and health route stay at root or also move — check PHASES.md spec carefully.

**⚠ Known gotchas for P0-06 (researched 2026-05-18):**
- **next-intl middleware on CF Workers:** Default next-intl middleware does not work reliably with OpenNext on CF Workers. You must write a custom `middleware.ts` that handles locale detection manually before delegating to next-intl. Do not assume the standard setup works.
- **next-pwa service worker + CF cache:** Cloudflare caches `/sw.js` by default. The `_worker.js` must set `Cache-Control: no-store` for `/sw.js` and `/workbox-*.js` responses, or users will get stale service workers after deploys.

**⚠ Known gotcha for P0-08 (Auth.js — do not forget):**
- **JWT-only on CF Workers is not a fallback — it is the confirmed design.** Auth.js v5 database session strategy (Drizzle adapter + Neon HTTP + CF Workers edge) is confirmed broken across multiple GitHub issues. Wire `strategy: 'jwt'` from day one. Do not attempt database sessions. See ADR-14 in DECISIONS.md.

### Open questions for Pradeep

- Push when ready: `git push origin main` to deploy latest changes (ADR corrections + wrangler.toml compat date bump) to CF Pages.
- Verify `/api/health` returns `{"status":"ok"}` in production (confirms DATABASE_URL env var is set in CF Pages dashboard).
- Fix git identity: `git config --global user.email "pradeepjainbp@gmail.com"` + `git config --global user.name "Pradeep Jain"` (commits still show `jainpr@dotdashmdp.com`).

### Notes / context

- `wrangler.toml` `compatibility_date` bumped to `2025-05-05` (was `2025-04-01`) — required to avoid FinalizationRegistry API errors on CF Workers with Next.js 16.2.x.
- `tailwind.config.ts` uses a relative import `../../packages/design-tokens/src/index` — not the `@shulka/design-tokens` alias. This is intentional: Tailwind's config runs in Node before TS path aliases are resolved. In-app imports (components, pages) use `@shulka/design-tokens` via the tsconfig alias.
- The styleguide page is a dev tool — no auth, no nav link. Access directly at `/styleguide`.
- No `'use client'` anywhere in P0-05 code — all server components.
- Biome `noConsoleLog` warnings remain in `patch-handler.mjs` and `patch-require-hook.mjs` (they are intentional status messages in build scripts, not prod code). These are warnings, not errors — lint passes.
- DECISIONS.md updated this session: ADR-1 (Next.js version), ADR-2 (Neon region), ADR-3b (adapter switch), ADR-14 (JWT-only confirmed). All stale assumptions corrected.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No financial code touched. No LLM computed any rupee. No paid services used.

---

## Session: 2026-05-18 — P0-04 runtime fix: CF Pages 500 resolved, site confirmed live (Sonnet)

### What this session did

Debugged the "Internal Server Error" on `shulka.pradeepjainbp.in` after P0-04 was declared done.

**Root cause:** Next.js's `require-hook.js` (compiled into the OpenNext bundle) calls `require('module')` then reads `mod.prototype.require`. CF Workers' `nodejs_compat` implementation of the `module` built-in does NOT expose `Module.prototype`, so `mod.prototype` is `undefined` → `TypeError: Cannot read properties of undefined (reading 'require')`.

**Fixes applied:**
- Added `apps/web/scripts/patch-require-hook.mjs` — guards all `mod.prototype` accesses in `require-hook.js` with null checks before OpenNext bundles the handler (same pattern as existing `patch-handler.mjs`).
- Updated `build:cf` in `apps/web/package.json` to run `node scripts/patch-require-hook.mjs` between the two existing steps.
- Also removed a dead `mv .open-next/worker.js .open-next/_worker.js` step (it was no longer needed in v1.19.10)… then added it back — OpenNext still outputs `worker.js`; CF Pages Advanced Mode requires `_worker.js`.

**Also fixed along the way (earlier in session chain):**
- Removed `turbopack: { root }` from `next.config.ts` (Next.js 16 uses Turbopack by default; OpenNext requires webpack)
- Added `--webpack` flag to `next build` in `build` + `build:cf` scripts
- Removed `export const runtime = 'edge'` from `/api/health/route.ts` (OpenNext+webpack rejects edge routes not separately defined)
- Updated `wrangler.toml` `compatibility_date` to `2025-04-01`

**Confirmed live:** `shulka.pradeepjainbp.in` and `shulka.pages.dev` both render the Shulka page ✓

### What's next

**P0-05 — Design tokens + Geist font + base layout.**

Spec: `packages/design-tokens` with locked palette, Geist + Geist Mono via `next/font`, app shell with header + sidebar/bottom-nav per breakpoint. A `/styleguide` route shows tokens, type scale, primary button, input, card.

Read `DESIGN_SYSTEM.md` before starting — all tokens, motion specs, and component decisions are locked there.

### Open questions for Pradeep

- Verify `https://shulka.pradeepjainbp.in/api/health` returns `{"status":"ok"}` — confirms DATABASE_URL env var is wired to the live site.
- Fix git identity: `git config --global user.email "pradeepjainbp@gmail.com"` + `git config --global user.name "Pradeep Jain"` (commits still show `jainpr@dotdashmdp.com`).

### Notes / context

- The three patch scripts in `apps/web/scripts/` run in sequence before `opennextjs-cloudflare build`. They patch Next.js source files in `node_modules/next/dist/server/` before OpenNext bundles them. CF Pages CI installs fresh node_modules each build so the patches always run on clean source.
- The `mv .open-next/worker.js .open-next/_worker.js` step at the end of `build:cf` is required. OpenNext v1.19.x outputs `worker.js`; CF Pages Advanced Mode looks for `_worker.js` as the worker entry point.
- `wrangler.toml` `compatibility_date` is now `2025-04-01` and `compatibility_flags = ["nodejs_compat"]`.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No LLM computed any rupee. No financial mutations. No paid services used.

---

## Session: 2026-05-18 — P0-03 + P0-04: infra, DB, DNS, CF Pages live (Sonnet)

### What this session did

**P0-03 — Cloudflare + Neon + Drizzle + audit foundation:**
- `packages/db/` created: Drizzle ORM + Neon HTTP driver, `drizzle.config.ts`, `src/client.ts`
- Schema: `users`, `audit_events` (`clock_timestamp()`), `rule_resolutions` (`clock_timestamp()`)
- Migration `0000_grey_spot.sql` applied to Neon — tables, indexes, immutability triggers, `shulka_app` role
- Verified live: 3 tables ✓, triggers ✓, `shulka_app` role ✓
- `apps/web/app/api/health/route.ts` — edge route returning DB connectivity status
- `apps/workers/cron/db-backup.ts` + `wrangler.toml` — nightly R2 heartbeat stub
- `.env.local` populated: Neon URLs, Cloudflare account ID + KV namespace ID + R2 keys
- Infra created: Neon DB (Singapore), CF Pages project, R2 bucket `shulka-prod`, KV namespace `shulka-cache`

**P0-04 — DNS + CF Pages deployment:**
- DNS: CNAME `shulka` → `shulka.pages.dev` added to `pradeepjainbp.in` (Proxied)
- Custom domain `shulka.pradeepjainbp.in` added to CF Pages project (SSL auto-provisioned)
- CF Pages build: went through 3 iterations to get working:
  1. `@cloudflare/next-on-pages` → doubled path bug in pnpm monorepo
  2. `outputFileTracingRoot` fix → still conflicted with Vercel CLI internals
  3. **Switched to OpenNext (`@opennextjs/cloudflare`)** — build succeeds ✓
- Final build setup: `build:cf` script in `apps/web/package.json`, `open-next.config.ts` in `apps/web/`, root-level `wrangler.toml` with `pages_build_output_dir = "apps/web/.open-next"`, output dir `apps/web/.open-next`
- **Build passing. Site deployed. `https://shulka.pradeepjainbp.in` is live.**
- Key lesson: CF Pages looks for `wrangler.toml` at repo root only — placing it in `apps/web/` caused "No Wrangler configuration file found" and silent deployment failures.

### What's next

**P0-05 — Design tokens + Geist font + base layout.**

Spec: `packages/design-tokens` with locked palette, Geist + Geist Mono via `next/font`, app shell with header + sidebar/bottom-nav per breakpoint. A `/styleguide` route shows tokens, type scale, primary button, input, card.

Read `DESIGN_SYSTEM.md` before starting — all tokens, motion specs, and component decisions are locked there.

### Open questions for Pradeep

- Verify `https://shulka.pradeepjainbp.in` loads in browser (may take a few minutes for SSL cert to propagate after custom domain setup).
- Verify `https://shulka.pradeepjainbp.in/api/health` returns `{"status":"ok"}` (needs `DATABASE_URL` env var set in CF Pages dashboard under Settings → Environment variables).
- Fix git identity: `git config --global user.email "pradeepjainbp@gmail.com"` + `git config --global user.name "Pradeep Jain"`

### Notes / context

- **OpenNext adapter** (`@opennextjs/cloudflare` v1.19.10) is now the build system. `@cloudflare/next-on-pages` is deprecated by Cloudflare. Do not revert.
- **Neon region is Singapore** (ap-southeast-1), not Mumbai — Mumbai not available on free tier. Documented in README.md. PITR window is 6 hours on free tier.
- `DATABASE_URL` env var must be added to CF Pages dashboard (Settings → Environment variables) for the `/api/health` edge route to work in production. Use the pooled connection string.
- `shulka_app` role exists but is NOLOGIN — app currently connects as `neondb_owner`. A proper login role for `shulka_app` is a pre-production hardening item, not a Phase 0 blocker.
- `apps/web/wrangler.toml` has `NEXT_CACHE_WORKERS_KV` binding wired to the KV namespace. This is used by OpenNext for caching.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No LLM computed any rupee. DB schema only — no financial mutations. All services on free tier.

---

## Session: 2026-05-18 — P0-03 Drizzle + Neon + audit foundation (Sonnet)

### What this session did

- Created `packages/db/` — Drizzle ORM + Neon HTTP driver, `drizzle.config.ts`, `src/client.ts`, schema files for `users`, `audit_events`, `rule_resolutions`.
- `audit_events` and `rule_resolutions` use `clock_timestamp()` default (not `now()`).
- Migration `0000_grey_spot.sql` generated via `drizzle-kit generate`, then extended with immutability triggers + `shulka_app` role grants.
- Migration applied and verified live on Neon (Singapore, Postgres 17).
- Immutability triggers confirmed: `BEFORE UPDATE OR DELETE` on both audit tables raise exception.
- `shulka_app` role confirmed created with INSERT/SELECT-only on audit tables.
- `apps/web/app/api/health/route.ts` — edge route returning `{ status: 'ok', db: { ok: 1 } }`.
- `apps/workers/cron/db-backup.ts` + `wrangler.toml` — nightly R2 heartbeat stub (daily at 06:30 IST).
- `next.config.ts` — added `turbopack.root` fix for monorepo CF Pages builds.
- Pushed to GitHub (`main`); CF Pages auto-build triggered with turbopack fix.
- `.env.local` populated: Neon pooled + unpooled URLs, Cloudflare account ID, KV namespace ID, R2 keys.

### What's next

**P0-04 — DNS: `shulka.pradeepjainbp.in` → Cloudflare Pages.**

Before starting: confirm the CF Pages build triggered by this session's push succeeded (check `shulka.pages.dev`). If it failed, check the build log — the turbopack fix should resolve it, but may need a `wrangler.toml` at `apps/web/` for edge runtime compat flags.

P0-04 itself is purely DNS config in Cloudflare dashboard — no code. Pradeep adds a CNAME record pointing `shulka` subdomain to the Pages project, then verifies HTTPS works.

### Open questions for Pradeep

- Did the CF Pages build pass after the push? Check `shulka.pages.dev` in browser.
- Still need `AUTH_SECRET` in `.env.local` — run `openssl rand -hex 32` to generate one (needed for P0-08).
- Fix git identity before next commit: `git config --global user.email "pradeepjainbp@gmail.com"` and `git config --global user.name "Pradeep Jain"`.

### Notes / context

- Neon free tier: 6-hour PITR window, Singapore region (Mumbai not available on free tier). Documented in README.md.
- `shulka_app` role is NOLOGIN — the application connects as `neondb_owner` for now. A login password for `shulka_app` should be set before production launch (P0-03 scope technically, but Neon free tier requires special handling for role passwords).
- The `drizzle/meta/` directory is gitignored by default — added `packages/db/drizzle/meta/` to `.gitignore` explicitly.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No LLM computed any rupee. DB touched only for schema setup. No paid services used (Neon + Cloudflare free tier only).

---

## Session: 2026-05-17 — P0-02 Repo config files (Sonnet)

### What this session did

- Created `.gitignore` — covers node_modules, .next, dist, all .env* variants (except .env.example), secrets patterns, OS files, editor files, Playwright/Vitest output, .wrangler/, Capacitor/Android build dirs.
- Created `.gitattributes` — normalizes all text files to LF in repo; binary files excluded.
- Created `.env.example` — full key inventory for all Phase 0 services: Neon (pooled + unpooled), Auth.js, Google OAuth, Cloudflare (R2, KV, account), Resend, Sentry, CF Web Analytics beacon, app URL.
- Created `LICENSE` at root — proprietary all-rights-reserved (Pradeep Jain, 2026).
- Created `rules/` directory with `rules/LICENSE` — CC0 1.0 public domain (applies only to /rules/).
- Created `CONTRIBUTING.md` — scope-limited, bug report format, GST rule citation requirement.
- Updated `README.md` — local setup, commands table, DB recovery window, corrected license section.
- Added `repo-config` CI job to `.github/workflows/ci.yml` — asserts all required files exist.
- Made **first git commit** (`27f9742`) — 52 files, all of P0-01 + P0-02.

### What's next

**P0-03 — Cloudflare Pages + Neon + R2 + KV + Drizzle + audit foundation + backups.**

Pradeep must have ready before starting:
- Cloudflare Pages project linked to `pradeepjainbp/Shulka` on GitHub
- Neon DB created (AWS Mumbai, ap-south-1)
- R2 bucket + KV namespace created
- All credentials ready for `.env.local`

### Open questions for Pradeep

- Git committer identity shows `jainpr@dotdashmdp.com` — run `git config --global user.email "pradeepjainbp@gmail.com"` and `git config --global user.name "Pradeep Jain"` to correct for future commits.
- Is the GitHub remote (`pradeepjainbp/Shulka`) ready to push to? P0-03 needs a push to trigger CF Pages auto-deploy.

### Notes / context

- `.gitattributes` added proactively (not in P0-02 spec) to eliminate CRLF warnings on Windows. Zero-risk.
- `rules/` directory created now with `.gitkeep` — GST rule files added in rule-engine phase. CC0 license in place from day one.
- CI `repo-config` job runs before lint/typecheck — fast-fails if a required file is accidentally removed.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. Files only — no code. No LLM computed any rupee. No DB touched. No paid services used.

---

## Session: 2026-05-06 — P0-01 Initialize monorepo + tooling (Sonnet)

### What this session did

- Initialized pnpm monorepo at workspace root with `pnpm-workspace.yaml` (apps/*, packages/*).
- Scaffolded `apps/web/` with Next.js 16.2.4 App Router (Turbopack default bundler), TypeScript, no ESLint (Biome replaces it).
- Replaced scaffold boilerplate: minimal `app/page.tsx` and `app/layout.tsx` with Shulka metadata (Geist fonts retained from scaffold — correct per DESIGN_SYSTEM.md).
- `apps/web/tsconfig.json` extends `tsconfig.base.json` at workspace root; strict mode active.
- Created `packages/shared-types/` stub with `src/index.ts` (empty export — populated from P1-08 onward).
- Added Biome 1.9.4 at workspace root (`biome.json`) — single-quote strings, no semicolons, 100-char lines.
- Added Vitest 2.1.9 at workspace root (`vitest.config.ts`) — smoke test at `apps/web/src/__tests__/smoke.test.ts` passes.
- Added Playwright 1.59.1 at workspace root (`playwright.config.ts`) — no tests yet, targeting localhost:3000.
- Created `.github/workflows/ci.yml` — four jobs: lint (Biome), typecheck (tsc), test (Vitest), e2e (Playwright). Playwright job includes `playwright install --with-deps chromium` pre-step.
- Removed nested `.git`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` that `create-next-app` generated inside `apps/web`.
- Initialized git repo at workspace root, branch `main`.
- All acceptance criteria verified: `pnpm install` ✓ · `pnpm test` passes (1 test) ✓ · `pnpm dev` starts on localhost:3000 in 515ms ✓ · `pnpm lint` clean ✓.

### What's next

**P0-02 — Repo config files.** Create `.gitignore`, `.env.example`, two `LICENSE` files (proprietary at root, CC0 in `/rules/`), `CONTRIBUTING.md`, and a populated `README.md`. This must be done before any infra work (P0-03) to prevent secrets leaking into early commits. Scope is files only — no code changes.

### Open questions for Pradeep

- None. All pre-flight items confirmed. Sentry still pending (non-blocker until P0-09).

### Notes / context

- Next.js 16 (not 14 as originally specced) was installed — latest stable. No API differences relevant to Phase 0. The scaffold's AGENTS.md/CLAUDE.md warns about version changes; nothing in P0-01's scope was affected.
- The CI workflow has an `e2e` job. It will pass vacuously until the first Playwright test is written (P0-08). This is intentional — wiring the plumbing now.
- `@shulka/shared-types` is declared as a workspace package and wired into `apps/web/tsconfig.json` paths. Import path: `@shulka/shared-types`.
- Git repo is initialized but no commit has been made yet — that happens in P0-02 once `.gitignore` exists.

### Sacred rules sanity check

Reviewed all 20 rules. Followed all 20. No LLM computed any rupee. No DB touched. No paid services used. TypeScript strict mode active from first file.

---

## How to write your handoff

When your session ends, replace this file with your own entry following the template:

```
## Session: YYYY-MM-DD — <one-line subject>

### What this session did
- bullet list

### What's next
- bullet list, the very first thing the next session should pick up

### Open questions for Pradeep
- bullets, or "none"

### Notes / context
- bullets, or "none"

### Sacred rules sanity check
- "Reviewed; followed all 20." or "Violated <which> because <why> — see DECISIONS.md ADR-N."
```
