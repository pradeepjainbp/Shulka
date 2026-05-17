# Shulka

> The GST app that tells you what to do, not just what happened.

Shulka is a GST + business-finance app for Indian MSMEs and the Chartered Accountants who serve them. It's designed for three personas — Vinay (kirana / sub-₹40 L), Priya (manufacturer / ~₹1 Cr), and Rakesh (CA managing 50+ clients) — with a network-effect twist: when two Shulka users transact, the invoice automatically populates both ledgers.

Built mobile-first (web + PWA + Android via Capacitor + iOS later), free for users, free to run.

## Status

In active development. See [`STATUS.md`](./STATUS.md) for current phase.

## Local setup

```bash
pnpm install
cp .env.example .env.local
# Fill in .env.local — see .env.example for all required keys
pnpm dev        # http://localhost:3000
```

**Prerequisites:** Node.js ≥ 20, pnpm ≥ 9, Cloudflare account (free), Neon account (free).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright e2e tests |
| `pnpm lint` | Biome lint check |
| `pnpm format` | Biome format (auto-fix) |
| `pnpm typecheck` | TypeScript type check |
| `pnpm db:migrate` | Run pending Drizzle migrations |

## Database

Neon Postgres · Singapore (ap-southeast-1) · PITR enabled · 6-hour recovery window (free tier limit).

## Deployment

Production: `https://shulka.pradeepjainbp.in` (Cloudflare Pages, auto-deploys from `main`)  
Build adapter: OpenNext (`@opennextjs/cloudflare`)

## For developers (and Claude Code)

Start by reading these files in this order:

1. [`MASTER_PROMPT.md`](./MASTER_PROMPT.md) — the entrypoint
2. [`SACRED_RULES.md`](./SACRED_RULES.md) — invariants
3. [`STATUS.md`](./STATUS.md) — current state
4. [`HANDOFF.md`](./HANDOFF.md) — last session's notes
5. [`PHASES.md`](./PHASES.md) — ticket queue
6. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — technical architecture
7. [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — visual language
8. [`DECISIONS.md`](./DECISIONS.md) — ADR log
9. [`/planning/`](./planning/) — original research and decision rationale

Every Claude Code session must:
- Read SACRED_RULES + STATUS + HANDOFF at start
- Update STATUS + write fresh HANDOFF at end
- Append to DECISIONS for any architectural choice

## Tech stack (one-liner)

Next.js 16 + Tailwind + shadcn/ui + Tremor + Framer Motion · Cloudflare Pages (OpenNext) + Workers + R2 + KV · Neon Postgres (Singapore) · Drizzle ORM · Auth.js v5 (Google + magic-link via Resend) · Gemini 2.5 Flash for OCR/narration · Capacitor for Android/iOS · pnpm monorepo · Biome · Vitest + Playwright

Total monthly fixed cost at MVP: **₹0**.

## Repository

`https://github.com/pradeepjainbp/Shulka`

## License

Application code: proprietary — see [LICENSE](LICENSE).  
GST rule definitions (`/rules/`): CC0 public domain — see [rules/LICENSE](rules/LICENSE).

## Owner

Pradeep Jain — pradeepjainbp@gmail.com

---

This README is for humans. Machines start at MASTER_PROMPT.md.
