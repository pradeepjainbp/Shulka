# apps/web — Next.js 16.2.6 (App Router, webpack)

Standard Next.js conventions apply. Middleware lives in `middleware.ts` at the project root with `export function middleware(...)`. Do not use `proxy.ts` or any non-standard file names.

Key facts for this project:
- App Router with `[locale]` segment (`app/[locale]/...`). API routes stay at `app/api/...` (no locale prefix).
- Deployed via `@opennextjs/cloudflare` (OpenNext) on Cloudflare Pages Advanced Mode.
- `postcss.config.js` must be CommonJS (`.js`, not `.mjs`).
- Tailwind content paths must use `path.join(__dirname, ...)` — not relative strings.
- See `HANDOFF.md` for known CF Pages gotchas before touching the build pipeline.
