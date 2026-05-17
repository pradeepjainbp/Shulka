# Handoff — Shulka

> Each session writes this for the next session.
> The next session reads this after SACRED_RULES.md and STATUS.md.

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
