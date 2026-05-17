# Shulka — Setup Checklist for Pradeep

> Non-code work to do before / alongside Claude Code's Phase 0. Total time ~1 hour, total cost ₹0.

## Phase 0 prerequisites

### 1. GitHub — repo confirmation

- [ ] Confirm `https://github.com/pradeepjainbp/Shulka` exists and is empty (initialized with no README, or default-init is fine)

### 2. Cloudflare account

- [ ] Sign up at cloudflare.com (skip if existing)
- [ ] Confirm `pradeepjainbp.in` is on Cloudflare DNS
- [ ] Create API Token (My Profile → API Tokens → Create Token, custom template):
  - Account → Cloudflare Pages — Edit
  - Account → Workers Scripts — Edit
  - Account → Workers KV Storage — Edit
  - Account → Workers R2 Storage — Edit
  - Zone (`pradeepjainbp.in`) → DNS — Edit
- [ ] Note Account ID (sidebar of any Workers/Pages page)
- **Output:** Account ID, API Token → into `.env.local` later as `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`

### 3. Neon Postgres

- [ ] Sign up at neon.tech
- [ ] Create project "Shulka" → region **AWS — Asia Pacific (Mumbai)** ← critical for data residency
- [ ] From dashboard, copy the **pooled connection string** with `sslmode=require`
- **Output:** Connection string → `.env.local` as `DATABASE_URL`

### 4. Resend (email)

- [ ] Sign up at resend.com
- [ ] Add domain `pradeepjainbp.in` → note the DNS records (SPF, DKIM, MX) Resend provides
- [ ] In Cloudflare DNS, add those records on `pradeepjainbp.in`
- [ ] Wait <5 minutes for verification
- [ ] Create API key
- **Output:** API Key → `.env.local` as `RESEND_API_KEY`. From: `Shulka <hello@shulka.pradeepjainbp.in>`

### 5. Google Cloud — OAuth for Google Sign-In

- [ ] console.cloud.google.com → New Project → name "Shulka"
- [ ] APIs & Services → OAuth consent screen:
  - User type: **External**
  - App name: Shulka
  - User support email: pradeepjainbp@gmail.com
  - Developer contact: pradeepjainbp@gmail.com
  - Scopes: `email`, `profile`, `openid`
  - Test users: add `pradeepjainbp@gmail.com`
- [ ] APIs & Services → Credentials → Create Credentials → OAuth client ID:
  - Type: **Web application**
  - Name: "Shulka Web"
  - JS origins:
    - `http://localhost:3000`
    - `https://shulka.pradeepjainbp.in`
  - Redirect URIs:
    - `http://localhost:3000/api/auth/callback/google`
    - `https://shulka.pradeepjainbp.in/api/auth/callback/google`
- **Output:** Client ID + Client Secret → `.env.local` as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### 6. Sentry

- [ ] Sign up at sentry.io
- [ ] Create project → platform: Next.js → name "Shulka"
- [ ] Copy DSN from install screen
- **Output:** DSN → `.env.local` as `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`

### 7. Cloudflare Web Analytics

- [ ] In Cloudflare → Web Analytics → Add a site → use `shulka.pradeepjainbp.in` (can add later, free)
- [ ] Note the analytics token
- **Output:** Token → `.env.local` as `NEXT_PUBLIC_CF_ANALYTICS_TOKEN`

### 8. Local dev environment

- [ ] Install Node.js 20.x or 22.x (via fnm or installer)
- [ ] `npm install -g pnpm@9` (or run `corepack enable`)
- [ ] `npm install -g wrangler` (Cloudflare CLI)
- [ ] Git already installed
- [ ] Editor with Claude Code (VS Code recommended)

### 9. Gemini Flash proxy (existing from Bharat Stock X-Ray)

Confirm with Claude:
- [ ] Worker URL of the existing Gemini proxy
- [ ] Auth token (if any)
- [ ] Whether it can handle Shulka's volume (~few thousand requests/day MVP)

If fresh Worker needed for Shulka, that's part of Phase 0 work — Claude Code can deploy it.

- **Output:** URL + token → `.env.local` as `GEMINI_PROXY_URL`, `GEMINI_PROXY_TOKEN`

---

## Phase 6 prerequisites (Android — ~12 weeks out)

- [ ] Install Android Studio + Java JDK 17+
- [ ] Google Play Console developer account (₹2,000 one-time)
- [ ] Add **Android OAuth client ID** in Google Cloud:
  - Type: Android
  - Package: `in.pradeepjainbp.shulka` (or whatever final bundle ID)
  - SHA-1 fingerprint: from `keytool -list -v` on debug keystore (and release later)
- **Output:** Android Client ID → `.env.local` as `GOOGLE_CLIENT_ID_ANDROID`

---

## v1.1 prerequisites (WhatsApp OTP — ~4 months out)

- [ ] Procure dedicated phone number for Shulka (separate from personal WhatsApp)
  - Options: cheap prepaid SIM (~₹50–₹500), virtual number from Knowlarity/Exotel, or a Jio Business number
- [ ] Create Meta Business account (business.facebook.com)
- [ ] Submit business verification (PAN sufficient initially; GSTIN once you have one)
- [ ] In WhatsApp Manager, add the dedicated number to WhatsApp Business Platform → Cloud API
- [ ] Generate access token + Phone Number ID
- **Output:** → `.env.local` as `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

---

## Phase 8 prerequisites (Rule contributor UI)

- [ ] Create a GitHub bot account (or use Personal Access Token from main account)
- [ ] PAT with `repo` scope (full control of `pradeepjainbp/Shulka`)
- **Output:** → `.env.local` as `GITHUB_BOT_TOKEN`, `GITHUB_REPO=pradeepjainbp/Shulka`

---

## Phase 9 prerequisites (GSP integration — when ready)

- [ ] Outreach to GSPs (start in Phase 5, ~8 weeks in):
  - Masters India — most developer-friendly docs
  - Cygnet — enterprise-y but solid
  - IRIS / GSTZen — smaller, sometimes better commercial terms
  - Avoid Clear (ClearTax) — competitor conflict
- [ ] Commercial agreement signed
- [ ] Sandbox + production credentials issued
- **Output:** → `.env.local` as `GSP_PROVIDER`, `GSP_CLIENT_ID`, `GSP_CLIENT_SECRET`

---

## Phase 10 prerequisites (iOS — when ready)

- [ ] Apple Developer Program ($99/year)
- [ ] Mac with Xcode (for build)
- [ ] iOS OAuth client in Google Cloud (separate from Web + Android)
- **Output:** → `.env.local` as `GOOGLE_CLIENT_ID_IOS`

---

## Privacy / ToS placeholder pages (Phase 0)

Before Google OAuth verification (which kicks in at 100 users), you need real Privacy + ToS URLs. Initially these can be placeholder pages on `pradeepjainbp.in`:

- `pradeepjainbp.in/shulka/privacy`
- `pradeepjainbp.in/shulka/terms`

Final versions are an Opus task in Phase 8. Placeholders are fine until then.

---

## Trademark, MSME registration, GSTIN-for-Shulka — defer

These are revenue-stage items. Don't bother until you have paying users:
- Trademark "Shulka" with Indian IP Office (~₹4.5K + lawyer)
- MSME Udyam registration (free)
- Shulka's own GSTIN (mandatory above ₹20 lakh revenue)

---

## What to hand to Claude Code

Once items 1–9 in the Phase 0 list are done, paste your `.env.local` values when Claude Code asks (or save to a secure note and feed in during ticket P0-02). Sample:

```env
# Auth
AUTH_SECRET=<generate via: openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Email
RESEND_API_KEY=re_...

# Database
DATABASE_URL=postgres://...neon.../neondb?sslmode=require

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
R2_BUCKET=shulka-files
KV_NAMESPACE_ID=<created in P0-02>

# LLM
GEMINI_PROXY_URL=...
GEMINI_PROXY_TOKEN=...

# Observability
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_CF_ANALYTICS_TOKEN=...
```

Claude Code will create R2 bucket and KV namespace itself in P0-02 using your CF API token.
