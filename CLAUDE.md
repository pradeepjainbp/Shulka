# Shulka — Claude Code Auto-Context

> Claude Code loads this file automatically on every session. Keep it short.

## Project

**Shulka** — GST + business-finance app for Indian MSMEs and CAs. Web + Android (Phase 6) + iOS (Phase 10). Free-tier-only stack.

## Owner

Pradeep Jain — solo founder, technical, delegates execution.

## What to read at session start

In this exact order:

1. `SACRED_RULES.md` — non-negotiable invariants
2. `STATUS.md` — current phase, current ticket, blockers
3. `HANDOFF.md` — what the previous session shipped, what's next

If those three are insufficient, read on demand:
- `PHASES.md` — only the section for the current/next phase
- `ARCHITECTURE.md` — only the section relevant to current ticket
- `DESIGN_SYSTEM.md` — only when doing UI work
- `MASTER_PROMPT.md` — when in doubt about overall direction
- `DECISIONS.md` — when wondering "why is this the way it is"
- `/planning/` — historical research, only when explicitly relevant

**Do not auto-load planning docs or full architecture/phases files.** Token discipline matters; this project is too large to carry all context all the time.

## Sacred rule sample (full list in SACRED_RULES.md)

- Server computes every rupee. LLMs narrate only.
- Money is integer paise.
- All financial mutations append to audit log (no UPDATE/DELETE).
- All GST rule lookups go through the rule engine.
- No Firebase, Supabase, Vercel, or paid runtime APIs.

## Sub-agents available

Use them via the Task tool to keep main context small:

- `phase-planner` — picks next ticket from STATUS + PHASES
- `schema-architect` — Drizzle/Postgres schemas
- `gst-engineer` — rule engine + GST math
- `ui-builder` — shadcn + Tailwind + design tokens
- `api-builder` — Next.js API routes + Zod + Auth.js
- `test-writer` — Vitest + Playwright
- `code-reviewer` — checks diffs against SACRED_RULES

## Slash commands available

- `/start` — orient at session start
- `/work-on <ticket-id>` — load focused context for one ticket
- `/decide` — append an ADR
- `/wrap` — end-of-session: update STATUS, write HANDOFF, commit

## Recommended MCP

Install Serena (https://github.com/oraios/serena) for symbol-level code navigation once the codebase grows past ~50 files. Until then, file-level reads are fine.

## Default working directory

`P:\PradeepDev\AppsIcreated\Shulka`

## Repo

`https://github.com/pradeepjainbp/Shulka`

## Deploy URL

`https://shulka.pradeepjainbp.in`
