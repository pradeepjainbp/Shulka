# Shulka — Synthesis & Decisions Log

> Living doc. Captures the working consensus from research + brainstorming. The final master prompt will be derived from this.

## Product

**Name:** Shulka (Sanskrit: शुल्क — "tax / fee / levy")

**One-line positioning:** *The GST app that tells you what to do, not just what happened — for businesses that buy from each other and the CAs who serve them.*

**Three personas, one product, network effect from Day 1 (Reading A):**
- **Vinay** — kirana / sub-₹40L turnover, voluntary GST, mobile-first
- **Priya** — manufacturer / ₹1Cr turnover, e-invoicing-bound, multi-state
- **Rakesh** — CA managing ~50 SMB clients

**Network effect mechanic:** When Vinay invoices Priya and Priya is on Shulka, the invoice automatically lands in Priya's purchase ledger. No re-entry, no upload, no reconciliation. When Rakesh logs in as Priya's CA, Priya's books are already current. Every business added makes Shulka more valuable to its trading partners.

**Linking model:** Auto-link on first invoice (silent). The buyer sees a "from external supplier" badge with one-tap "Trust this supplier" to elevate. No upfront friction, no spam risk, real network effects.

## Initial scope philosophy

- **Free for all** until product–market signal exists
- **Zero monthly fixed cost** at MVP — every dependency on a free tier
- **No GSP yet** — defer return filing; ship invoicing, reconciliation prep, summaries, exports
- **Mobile-first UI but web-first ship** — web app + Android shell now, iOS later
- **Anti-hallucination:** server computes every rupee; LLM narrates only

## Final tech stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 14 (App Router) + TS | SEO for public seller pages, Server Components, PWA-ready |
| Mobile | Capacitor wrapping Next.js build | Single codebase → web + Android (now) + iOS (later) |
| UI | Tailwind + shadcn/ui + Tremor charts + Framer Motion | Premium feel, no MUI/Chakra lock-in |
| State (server) | TanStack Query | Standard, cache-aware |
| State (app) | Zustand | Minimal, no Redux ceremony |
| Forms | React Hook Form + Zod | Strict validation for financial inputs |
| API | Hono on Cloudflare Workers | Edge, free tier 100K req/day, India presence |
| DB | Neon Postgres | Real SQL for ITC matching/aggregations, free 0.5GB, branching for prod/dev |
| File storage | Cloudflare R2 | 10GB free, **zero egress** — critical for PDFs |
| Cache/sessions | Cloudflare KV | Free, fast |
| Cron | Cloudflare Workers Cron Triggers | GST due-date reminders, ITC-risk recompute |
| Auth — primary | Google OAuth (Auth.js v5 on web, Capacitor Google plugin on Android) | Most Indian users have Gmail; fastest onboarding; free |
| Auth — fallback | Email magic link via Resend | 3K/mo free; covers non-Google users |
| Auth (v1.1) | WhatsApp Business Cloud API + own JWT | Phone OTP added after dedicated business number is procured |
| OCR / extraction | Gemini 2.5 Flash multimodal via existing Worker proxy | Free tier, structured JSON output, anti-hallucination preserved |
| LLM (insights) | Gemini 2.5 Flash via Worker proxy | Reuses existing pattern |
| PDF generation | pdf-lib (in Workers) | Free, no service dependency |
| GST math | Pure TypeScript on Workers | Server is single source of truth |
| Hosting (web) | Cloudflare Pages | Free, India edge |
| Hosting (mobile) | Capacitor build → Android Studio APK | Free |
| Source/CI | GitHub + Cloudflare Pages auto-deploy | Free |
| Domain | shulka.pradeepjainbp.in (subdomain on existing) | No new domain purchase needed |

**What's deliberately NOT in the stack:** Firebase (any), Supabase, Vercel hosting, Postgres-on-Render, MUI/Chakra, Redux/Jotai, Tally/ClearTax SDKs (yet), any paid runtime service.

## What carries from the original 66-page Ganaka doc

- Data model shapes (invoice, party, GST notice, reminder, CA-client link) — **kept, with modifications for multi-tenant network effect**
- Screen inventory (login, role select, dashboard, upload invoice, GST summary, notice management, CA dashboard) — **kept**
- Color/typography system as starting point — **upgraded for premium feel**

## What's discarded or replaced from the 66-page Ganaka doc

- Android-Kotlin native architecture → replaced with web-first + Capacitor
- Firebase Auth + Firestore → replaced with custom JWT + Neon Postgres
- Room database (mobile-only) → replaced with server-of-truth + offline cache via PWA
- Generic green palette `#4CAF50` → replaced with custom design tokens (premium)
- Hand-coded Kotlin in spec → not authoritative

## What's missing from all docs combined (must be added in master prompt)

- **Network-effect data model** — invoice that resolves to either an internal Shulka party or external GSTIN
- **Audit log** — append-only `ledger_events` table; immutable record of every financial mutation
- **Place-of-supply engine** — TS function deciding CGST+SGST vs IGST per state pair + transaction type
- **GSTIN validator** — 15-char structural + checksum (Mod-36)
- **HSN/SAC code search** — bundled JSON with ~12k codes, fuzzy search
- **DPDP Act 2023 compliance hooks** — explicit consent screens, purpose-limited processing, deletion endpoint
- **Indian data residency** — explicit pin to Cloudflare Mumbai + Neon AWS Mumbai region
- **Invoice numbering law** — sequential per FY, no gaps, validator
- **Onboarding for CAs that elevates the product** — multi-client switch, batch operations
- **"Insights worth paying for" library** — 10–15 specific decision insights baked into the dashboard

## Final default choices (locked-in for master prompt)

**Visual:** Warm fintech — forest-green `#14854F` primary, cream `#FAF8F3` surface, Inter/Geist type, generous whitespace, large dashboard numerals. Light theme default; dark supported. *Note: the specific color hex values here were superseded by `DESIGN_SYSTEM.md` on 2026-05-02 (primary `#0F5C3F`, surface `#FAF7EE`). DESIGN_SYSTEM.md is authoritative.*

**Indian-context:** ₹ lakh/crore formatting; DD/MM/YYYY; IST hardcoded; integer paise storage. English at MVP; i18n infra (next-intl) wired Day 0 for Hindi/regional later.

**Platform:** PWA from Day 1 (free distribution), Capacitor APK Phase 6, iOS Phase 10. Push via Web Push + Capacitor native.

**Observability:** Cloudflare Web Analytics (privacy-first, free), Sentry free tier for errors, Cloudflare edge rate-limiting, Neon PITR + nightly R2 backup.

**Trust surface:** `/trust` page Day 1 (privacy, security, governance, reviewers, contributors). Branded email templates throughout.

**Scope discipline:** Every phase has explicit "out of scope" list. OCR-extracted fields show confidence badges; user must confirm before save. Invoices to non-Shulka GSTINs send via email/WhatsApp with "join Shulka" CTA on PDF.

**Onboarding:** 3-step dismissable guided tour first run; contextual tooltips after. Illustrated empty states.

## Open items / outstanding questions

- Google OAuth: needs a Google Cloud project + OAuth consent screen + 2 client IDs (web + Android). Pradeep to set up; master prompt will include step-by-step. ~15 min, free.
- WhatsApp Business: needs dedicated phone number — Pradeep to procure post-MVP. For MVP, Google OAuth + email magic-link.
- GSP partner: deferred. Master prompt should architect for plug-in later (interface boundary in code).
- Branding assets (logo, splash, app icon): can be generated by AI later; placeholder design tokens suffice for now.
