# Shulka — Context Management Strategy

> How we keep Claude Code's context window healthy across a multi-month project.

The Shulka project — full architecture + all phase tickets + design system + planning docs — is roughly 27,000 tokens of orientation alone. Loading it all on every session is wasteful and counterproductive. This doc explains our four-layer strategy.

## Layer 1 — `CLAUDE.md` (auto-loaded)

Claude Code automatically reads `CLAUDE.md` at the project root on every session. Ours is deliberately small (~200 lines). It only states what to read first and lists available sub-agents and slash commands.

## Layer 2 — Per-session bootstrap

When a new session begins, run the `/start` slash command. It triggers:

1. Read `SACRED_RULES.md` (full)
2. Read `STATUS.md` (full)
3. Read `HANDOFF.md` (full)
4. Invoke the `phase-planner` sub-agent to identify the next ticket and return a focused brief.

Total token cost: ~3K. Compared to loading everything: ~27K. **9x improvement at session start.**

## Layer 3 — Per-task focused load

Use `/work-on <ticket-id>` to load only what's needed for one ticket:

- The ticket section from `PHASES.md` (via Grep, not full read)
- The relevant slice of `ARCHITECTURE.md` (via Grep)
- `DESIGN_SYSTEM.md` slice if UI work
- The actual code files involved

Per-ticket cost: ~5–8K tokens of focused context, leaving 180K+ for actual implementation work.

## Layer 4 — Sub-agents (the biggest lever)

Sub-agents have **isolated context windows**. The main Sonnet doesn't see what the sub-agent reads — it only sees the sub-agent's return value. This means:

- The `gst-engineer` sub-agent can read the full rule book + existing engine code (~30K tokens) without polluting main context.
- The `ui-builder` sub-agent can read the entire design system + every component (~20K tokens) the same way.
- Main Sonnet stays lean and orchestrates.

Available sub-agents (in `.claude/agents/`):

| Agent | Purpose | Tools |
|---|---|---|
| `phase-planner` | Pick next ticket; return brief | Read, Grep, Glob |
| `schema-architect` | Drizzle schemas + migrations | Read, Write, Edit, Grep, Glob, Bash |
| `gst-engineer` | Rule engine + GST math | Read, Write, Edit, Grep, Glob, Bash |
| `ui-builder` | Components + screens | Read, Write, Edit, Grep, Glob, Bash |
| `api-builder` | API routes + Auth + Workers | Read, Write, Edit, Grep, Glob, Bash |
| `test-writer` | Vitest + Playwright + golden tests | Read, Write, Edit, Grep, Glob, Bash |
| `code-reviewer` | Sacred-rule + design-system audit | Read, Grep, Glob, Bash |

The main agent invokes them via the Task tool when delegation makes sense.

## Layer 5 — Symbol graph (recommended for Phase 2+)

When the codebase exceeds ~50 files, install **Serena** (https://github.com/oraios/serena) as an MCP server. Serena gives Claude:

- "Find symbol `computeInvoiceLine`" → returns just that function
- "What calls `placeOfSupply`?" → returns call sites
- "Edit this symbol" → surgical edit, no whole-file context

This is dramatically more token-efficient than file-level reads once the codebase is large.

Setup (when ready):
1. `pip install serena-agent`
2. Run `serena-agent` and follow setup
3. Add to Claude Code's MCP config: `~/.claude/settings.json` or via CLI

## Slash commands

In `.claude/commands/`:

| Command | Purpose |
|---|---|
| `/start` | Session bootstrap (~3K tokens) |
| `/work-on <ticket-id>` | Load focused context for one ticket |
| `/decide` | Append a new ADR to DECISIONS.md |
| `/rule-add` | Guided creation of a new rule JSON file |
| `/wrap` | End-of-session: tests, commit, update STATUS, write HANDOFF |

## Token budget targets

| Activity | Budget | Notes |
|---|---|---|
| Session start | ≤ 5K tokens | `/start` flow |
| Per-ticket setup | ≤ 8K tokens | `/work-on` flow |
| Sub-agent invocation | n/a in main context | Sub-agent gets its own window |
| Code work | up to 180K tokens free | The whole point of being lean elsewhere |
| Session end | ≤ 5K tokens | `/wrap` flow |

If a session is consistently exceeding these, it's a signal to refactor: split a big doc, move details to a subdir-level CLAUDE.md, or write a more specific sub-agent.

## When to violate the strategy

- Onboarding a new contributor — they may need to read everything once.
- Architectural changes that affect multiple domains — the main agent legitimately needs broad context.
- Debugging a cross-cutting issue — wide-net reads may be necessary.

In these cases, plan ahead: spend the tokens deliberately and finish in fewer sessions.

## What this strategy is NOT

- Not a hard cap on context. Claude will still pull in what it needs.
- Not a substitute for thinking. Sub-agents help the main agent think clearly, not replace its judgment.
- Not premature optimization for small projects. Shulka is large enough (years of compounding rules + features) that token discipline pays.
