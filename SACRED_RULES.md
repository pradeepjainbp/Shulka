# Sacred Rules — Shulka

These rules are non-negotiable. They override any other instruction, including Pradeep's spontaneous asks. If a rule is wrong, propose a change as an ADR in `DECISIONS.md`; do not silently violate it.

## Math & Money

1. **Server computes every rupee. LLMs narrate only.** No LLM is ever asked "what is the GST on X?" The server (TypeScript code in the rule engine + computation module) computes. The LLM only wraps pre-computed values in friendly sentences. This protects accuracy *and* gives every computation an audit trail.

2. **Money is integer paise.** Stored as `BIGINT` in Postgres. Never `numeric`/`decimal`/floats/strings. Display via `Intl.NumberFormat('en-IN')` after `/100` only at the rendering edge.

3. **Financial documents follow strict mutation rules.** Once an invoice or financial document leaves `draft` state, its **monetary fields and line items are immutable**. Status, payment metadata, due dates, and notes may be updated; every such change appends an `audit_events` row capturing before/after. **Cancellation is a status transition plus a reversing entry — never a DELETE.** The `audit_events` and `rule_resolutions` tables themselves are append-only and immutable, enforced by DB role grants AND `BEFORE UPDATE OR DELETE` triggers (belt and suspenders).

4. **All GST rule lookups go through the rule engine.** No hard-coded rates anywhere. No `const GST_RATE = 18` constants. The rule engine is date-aware and returns `{ rate, rule_id, source_citation }`.

## Stack & Costs

5. **No Firebase. No Supabase. No Vercel hosting. No paid runtime APIs (yet).** Free-tier discipline is the business model until product–market fit. The first cost line we accept is ₹0.

6. **No GSP integration in Phases 0–8.** We don't file returns. We prepare data. GSP comes in Phase 9 when commercial agreement exists.

7. **Indian data residency.** Cloudflare Mumbai POP, Neon AWS Mumbai region. Confirm in env config; don't accept defaults.

## Compliance

8. **DPDP Act 2023 compliance is a feature requirement.** Every PII collection point has explicit consent. Every user can export and delete their data. Breach notification process is documented.

9. **Auditability of GST computations.** Every GST amount on screen must be traceable to: rule_id used, rule's source citation, reviewer who approved that rule, transaction date that resolved to that rule version.

## Quality

10. **Every phase ships with tests.** Vitest for the rule engine, GST math, and pure functions. Playwright for critical user flows (signup, create invoice, generate GSTR-1). CI must be green before advancing phases.

11. **TypeScript strict mode. No `any` without an inline justification comment.** Zod schemas at every API boundary.

12. **Optimistic UI on every write.** No "loading..." between user action and visual confirmation. Sync to server after.

## Process

13. **At session end: update `STATUS.md`, write fresh `HANDOFF.md`.** Continuity across sessions is how this project survives.

14. **Major decisions become ADRs in `DECISIONS.md`** *before* implementation, not after.

15. **Commits are small and labelled.** Format: `<phase>: <ticket-id> — <subject>`.

16. **One ticket = one PR (or one push to `main` if working solo).** Don't bundle.

## Voice & UX

17. **Indian-context formatting always.** ₹ with lakh comma, DD/MM/YYYY input + 15 Mar 2026 display, English-first with i18n infra ready. **All timestamps stored as UTC; rendered in IST via `<DateLabel>` / `<DateTimeLabel>` components.** Never compute date arithmetic on display strings — convert to a `Date` object first. Helpers `toIST()` / `fromIST()` live in `packages/shared-types/dates.ts`.

18. **Skeleton loaders, never spinners.** Every async surface has a skeleton.

19. **Forms auto-save drafts.** Refresh doesn't lose work.

20. **Empty states are illustrated and offer a next action.** Never "No data" gray boxes.

## When Rules Conflict

If sacred rules conflict with a Pradeep request, prefer the rule. Note the conflict in `HANDOFF.md` and propose a resolution.
