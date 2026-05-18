# Shulka — Engineering Learnings

> Hard-won discoveries from building this stack. Each entry documents a real problem hit in
> production or CI, the root cause, and the fix. Written for future sessions and as training
> signal for AI models working on similar stacks.
>
> Format: Problem → Root cause → Fix → Why it works.

---

## Stack: Next.js 16 + OpenNext + Cloudflare Pages

### 1. ALL requests go through `_worker.js` in CF Pages Advanced Mode

**Problem:** `/_next/static/css/*.css` returned the full Next.js HTML page instead of CSS.
Styleguide rendered completely unstyled in production despite working locally.

**Root cause:** When a `_worker.js` file is present in the CF Pages output directory, CF Pages
enters "Advanced Mode" and routes **every** request — including static assets — through the
worker. There is no automatic static-before-worker pass. The default OpenNext `_worker.js`
template has zero `env.ASSETS` references.

**Fix:** Patch the OpenNext worker template *before* `opennextjs-cloudflare build` runs to add:
```js
if (env.ASSETS) {
  const staticPrefixes = ['/_next/static/', '/_next/image/', '/favicon']
  if (staticPrefixes.some((p) => url.pathname.startsWith(p))) {
    const assetRes = await env.ASSETS.fetch(request)
    if (assetRes.status !== 404) return assetRes
  }
}
```
See `apps/web/scripts/patch-cf-worker-template.mjs`.

**Why it works:** CF Pages Advanced Mode automatically provides an `env.ASSETS` binding to
`_worker.js` that can fetch files from the output directory. The worker must call it explicitly.

---

### 2. OpenNext outputs `worker.js`; CF Pages requires `_worker.js`

**Problem:** Build succeeds but site is blank — CF Pages doesn't recognise the worker.

**Root cause:** `opennextjs-cloudflare build` outputs `.open-next/worker.js`. CF Pages Advanced
Mode looks for `_worker.js` as the entry point. Different name = no worker = blank site.

**Fix:** Add to `build:cf` script: `mv .open-next/worker.js .open-next/_worker.js`

---

### 3. Static assets must be at `_next/` in the output root, not `assets/_next/`

**Problem:** `/_next/static/...` returns 404 even after the ASSETS binding fix.

**Root cause:** OpenNext places static files at `.open-next/assets/_next/`. CF Pages ASSETS
binding serves files relative to the output directory root. So the file is at
`assets/_next/static/...` but requests come in as `/_next/static/...`.

**Fix:** Add to `build:cf` script: `mv .open-next/assets/_next .open-next/_next`

---

### 4. `require-hook.js` crashes CF Workers — `Module.prototype` is undefined

**Problem:** Site returns 500 on first load. CF Workers log: `TypeError: Cannot read properties
of undefined (reading 'require')`.

**Root cause:** Next.js's compiled `require-hook.js` calls `require('module')` then accesses
`mod.prototype.require`. CF Workers' `nodejs_compat` implementation of the `module` built-in
does NOT expose `Module.prototype` — it's `undefined`.

**Fix:** `apps/web/scripts/patch-require-hook.mjs` — guards all `mod.prototype` accesses with
null checks, runs before `opennextjs-cloudflare build`.

---

### 5. `postcss.config.mjs` silently fails on Linux / CF Pages CI

**Problem:** Tailwind CSS not applied in production (CF Pages Linux build) despite working on
Windows locally.

**Root cause:** Next.js's PostCSS loader on Linux does not pick up `postcss.config.mjs` (ES
module format) reliably. It silently falls back to no-config, so PostCSS runs but Tailwind
generates no utilities.

**Fix:** Use `postcss.config.js` with CommonJS `module.exports = { plugins: { tailwindcss: {},
autoprefixer: {} } }`. Never use `.mjs` for PostCSS config.

---

### 6. Tailwind content paths must be absolute in a monorepo

**Problem:** Tailwind generates ~4 KB of CSS locally vs ~15 KB expected. All utility classes
missing in production.

**Root cause:** OpenNext runs a second internal `next build --webpack` from a different working
directory than the project root. Relative content paths like `'./app/**/*.{ts,tsx}'` resolve
to nothing from that CWD.

**Fix:** Use `path.join(__dirname, './app/**/*.{ts,tsx}')` in `tailwind.config.ts`. The
`__dirname` is absolute and resolves correctly regardless of where `next build` is invoked from.

---

### 7. `@cloudflare/next-on-pages` has a doubled-path bug in pnpm monorepos

**Problem:** Asset URLs become `/_next/_next/static/...` (doubled path segment), breaking all
static assets.

**Root cause:** Cloudflare's official `@cloudflare/next-on-pages` adapter has a known bug with
pnpm monorepo symlink resolution that doubles the path prefix.

**Fix:** Use `@opennextjs/cloudflare` (OpenNext) instead. It's actively maintained and works
correctly in pnpm monorepos. Cloudflare themselves recommend it for Next.js App Router.

---

### 8. `wrangler.toml` must be at the repository root for CF Pages

**Problem:** CF Pages CI logs "No Wrangler configuration file found" and deployment fails
silently.

**Root cause:** CF Pages scans for `wrangler.toml` starting at the repository root only. Placing
it in `apps/web/` is not found.

**Fix:** Keep `wrangler.toml` at repo root. Set `pages_build_output_dir` to the relative path
from root: `"apps/web/.open-next"`.

---

### 9. `wrangler.toml compatibility_date` must be ≥ 2025-05-05 for Next.js 16.2.x

**Problem:** Potential `FinalizationRegistry` API errors crash CF Workers on startup with
Next.js 16.2.x.

**Root cause:** `FinalizationRegistry` was not available in CF Workers runtime before the
2025-05-05 compatibility date. Next.js 16.2.x uses it.

**Fix:** Set `compatibility_date = "2025-05-05"` in `wrangler.toml`.

---

## Stack: Auth.js v5 + Cloudflare Workers

### 10. Auth.js v5 database session strategy is broken on CF Workers edge

**Problem:** Auth.js v5 with `strategy: 'database'` (Drizzle adapter + Neon HTTP) crashes or
hangs on CF Workers edge runtime. Multiple confirmed GitHub issues (#435, #483, #494 in
opennextjs-cloudflare).

**Root cause:** The database session strategy reads the session from DB on every request,
including in middleware. On CF Workers edge, the timing and async handling of the Drizzle HTTP
driver in this context is not reliable.

**Fix:** Use `strategy: 'jwt'` always on CF Workers. The Drizzle adapter is still used for
`users` and `accounts` table management (sign-in, account linking) — just not for sessions.
Sessions live in a signed JWT cookie instead of the DB.

**Why it works:** JWT session reads are a cookie decode + HMAC verify — pure CPU, no DB hit.
The DB is only touched during sign-in/sign-out, which happen via normal Next.js API routes, not
edge middleware.

---

### 11. Auth.js signout via CSRF POST is unreliable in Playwright tests

**Problem:** Playwright `page.request.post('/api/auth/signout', { data: 'csrfToken=...' })` fails
or doesn't clear the session cookie correctly in e2e tests.

**Root cause:** Auth.js v5 CSRF validation can mismatch between the `page.request` cookie store
and the browser cookie store when both are used in the same test.

**Fix:** Create a dedicated `/[locale]/sign-out` page with a server action:
```tsx
<form action={async () => { 'use server'; await signOut({ redirectTo: '/en' }) }}>
  <button type="submit">Sign out</button>
</form>
```
The Playwright test navigates to this page and clicks the button. Server action handles CSRF
natively.

---

### 12. Magic-link test capture via `globalThis`, not module-level variable

**Problem:** Module-level `let lastUrl: string | null = null` in `auth.ts` doesn't work for
capturing the magic link URL in tests — the test endpoint reads `null` even after the email was
"sent".

**Root cause:** Next.js webpack bundles each API route in its own module context. `auth.ts` is
imported by `/api/auth/[...nextauth]/route.ts` (the sender) and `/api/test/magic-link/route.ts`
(the reader) — but they get different module instances. Module-level state is not shared.

**Fix:** Store the captured URL on `globalThis`:
```ts
globalThis.__playwrightLastMagicLinkUrl = url
```
`globalThis` is shared across all bundles in the same Node.js process.

---

## Stack: next-intl + CF Workers

### 13. Default next-intl middleware does not work reliably on CF Workers

**Problem:** next-intl's built-in `createMiddleware()` fails or causes routing loops on CF
Workers/OpenNext.

**Root cause:** next-intl's middleware uses `next/server` APIs that are not fully compatible with
the OpenNext CF Workers routing layer.

**Fix:** Write a custom `middleware.ts` (or `proxy.ts` in Next.js 16) that does locale
detection manually:
```ts
const pathnameHasLocale = locales.some(
  (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
)
if (!pathnameHasLocale) {
  url.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(url)
}
```

---

## Stack: Next.js 16

### 14. `middleware.ts` is deprecated in Next.js 16 — use `proxy.ts`

**Problem:** Next.js 16 dev server logs: "The 'middleware' file convention is deprecated. Please
use 'proxy' instead."

**Root cause:** Next.js 16 renamed the middleware file convention from `middleware.ts` /
`export function middleware` to `proxy.ts` / `export function proxy`.

**Note:** `middleware.ts` still works (backward-compatible deprecation) but will eventually be
removed. New projects should use `proxy.ts`. Existing `middleware.ts` files should be renamed
when convenient.

**Migration:** Rename `middleware.ts` → `proxy.ts`, change `export async function middleware`
→ `export async function proxy`. The `config.matcher` export stays the same.

---

### 15. `next build --webpack` required for OpenNext compatibility

**Problem:** `opennextjs-cloudflare build` fails or produces a broken bundle when Turbopack is
the default bundler (Next.js 16 default).

**Root cause:** OpenNext bundles the Next.js output for CF Workers. It supports the webpack
output format, not Turbopack's. Turbopack produces a different module graph that OpenNext
cannot process.

**Fix:** Always use `next build --webpack` (not just `next build`) in the `build:cf` script.
Also add `--webpack` to the regular `build` script to ensure local builds match the CF build.

---

## Stack: pnpm monorepo

### 16. Playwright `--pass-with-no-tests` doesn't skip `webServer` startup

**Problem:** CI E2E job fails even with `--pass-with-no-tests` because Playwright tries to
start the dev server (configured in `webServer`) and it fails or times out.

**Root cause:** Playwright starts the `webServer` before test collection. `--pass-with-no-tests`
only affects the exit code when no tests are found — it does not skip the webServer start.

**Fix:** Make `webServer` conditional on there being actual test files:
```ts
const hasTests = (() => {
  try { return readdirSync('./e2e').some(f => f.endsWith('.ts')) }
  catch { return false }
})()
// ...
...(hasTests && { webServer: { ... } })
```

---

### 17. pnpm `.pnpm` virtual store path is unpredictable — use `readdirSync` to find it

**Problem:** `require.resolve('@opennextjs/cloudflare/dist/cli/templates/worker.js')` fails or
returns a wrong path in pnpm monorepos.

**Root cause:** pnpm stores packages at
`node_modules/.pnpm/@opennextjs+cloudflare@{version}_{hash}/node_modules/@opennextjs/cloudflare/`.
The hash suffix changes with dependency updates. `require.resolve` adds `.js` extension or
resolves the wrong path.

**Fix:** Walk up directory tree with `readdirSync` to find the `.pnpm` store, then find the
matching entry with `entries.find(e => e.startsWith('@opennextjs+cloudflare@'))`.
See `apps/web/scripts/patch-cf-worker-template.mjs`.

---

## Stack: next-pwa + CF Pages

### 18. CF Pages caches `sw.js` — service workers become stale after deploy

**Problem:** PWA service worker is stale after a new deploy. Users continue running the old
service worker.

**Root cause:** CF Pages' edge cache caches `/sw.js` like any other static file. The browser
fetches a cached copy and never sees the new service worker.

**Fix:** Add a `public/_headers` file (CF Pages reads this for response header overrides):
```
/sw.js
  Cache-Control: no-store, no-cache, must-revalidate

/workbox-*.js
  Cache-Control: no-store, no-cache, must-revalidate
```

---

## Architectural decisions confirmed in production

### 19. Neon free tier is Singapore, not Mumbai

The Neon free tier does not offer `ap-south-1` (Mumbai). The actual region is
`ap-southeast-1` (Singapore). India-to-Singapore round-trip is ~60ms. Acceptable for MVP.
Neon paid tier adds Mumbai.

### 20. `strategy: 'jwt'` is the permanent Auth.js choice, not a fallback

ADR-14 originally said "run a POC; fall back to JWT if DB strategy fails." Research confirmed
DB strategy is broken on CF Workers. JWT is the correct permanent architecture for this stack,
not a temporary workaround. Future sessions should not reconsider this.

### 21. OpenNext is the correct CF Pages adapter for Next.js App Router

`@cloudflare/next-on-pages` (Cloudflare's own adapter) has a pnpm monorepo doubled-path bug.
Cloudflare themselves recommend `@opennextjs/cloudflare` for Next.js App Router. Do not revert
to `next-on-pages`.

---

## AGENTS.md trap in apps/web

`apps/web/AGENTS.md` previously contained misleading text: "This is NOT the Next.js you know.
APIs may differ from training data." This was a gaslighting trap that caused an AI agent to
create `proxy.ts` with non-standard export names.

The file has been rewritten with accurate project-specific notes. Standard Next.js 16
conventions apply everywhere in this project.

---

*Last updated: 2026-05-18 — Phase 0, P0-08 complete.*
