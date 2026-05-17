# Shulka — Phases, Approvals, and the Rule Book

Companion to `02_synthesis_and_decisions.md`. Captures the development phasing, the external dependencies / approvals, and the rule-engine architecture for GST calculations.

## 1. Development phases

Solo-developer calendar weeks with Claude Code assistance. Engineering complexity weighted, not man-weeks.

| Phase | What ships | Duration |
|---|---|---|
| 0. Setup | Repo, design tokens, auth (Google + email magic-link), empty Next.js + Capacitor scaffolds, deployed to `shulka.pradeepjainbp.in` | 1 wk |
| 1. Identity & Foundation | Business profile, GSTIN validator (15-char + checksum), party directory, HSN search, rule-engine skeleton | 2 wks |
| 2. Invoicing | Invoice create (B2B + B2C), place-of-supply auto, CGST/SGST/IGST split, PDF generation, WhatsApp/email share, UPI link, network-effect auto-link | 3–4 wks |
| 3. Purchases & ITC | Purchase entry, supplier directory, ITC ledger, "ITC at risk" detector | 2–3 wks |
| 4. Summaries, Insights, Exports | GSTR-1 + GSTR-3B computation, dashboard, 10–15 decision insights, JSON + Excel export | 2 wks |
| 5. CA Multi-client | CA dashboard, client switching, batch GST summaries, bulk reminders, in-app messaging | 2 wks |
| 6. Android shell | Capacitor wrap, native camera/share/push, Play Store internal track | 1 wk |
| 7. Bank statement parsing | PDF/CSV upload, transaction parse, GST-relevance categorization, payment-to-invoice matching | 2 wks |
| 8. Public beta launch + CA-rule-contributor UI | DPDP-compliant privacy/ToS, support flow, error monitoring, in-app form-based rule proposal flow that generates GitHub PRs silently | 2 wks |
| 9. GSP integration | Return filing, IRN, GSTR-2B fetch via GSP partner | TBD — gated on commercial agreement |
| 10. iOS + e-Invoicing + e-Way Bill | Capacitor iOS, IRP, EWB | TBD — when users above thresholds exist |

**To public beta: ~15–18 weeks.** Master prompt covers Phase 0–6 in execution detail; Phase 7–10 captured as named scopes with acceptance criteria.

## 2. External agency approvals

### Pre-launch (must have before any users)
- Google Cloud project + OAuth consent screen + brand verification (15 days, free)
- Privacy Policy + Terms of Service published at stable URLs
- DPDP Act 2023 compliance baseline (consent screens, export/delete endpoints, named contact)

### At launch
- Google Play Console developer account (₹2,000 one-time)
- Resend account + DNS records on `pradeepjainbp.in`
- Cloudflare, Neon, GitHub accounts (free)

### v1.1 (when adding WhatsApp OTP)
- Dedicated phone number for Shulka (separate from personal WhatsApp)
- Meta Business account + WhatsApp Business Cloud API verification

### At scale / new features
- GSP partnership (Masters India / Cygnet / IRIS / GSTZen) — for filing, IRN, GSTR-2B. **Outreach starts during Phase 5** (4–8 wk lead time on commercial agreement) to be ready by Phase 9.
- Account Aggregator (Setu / FinBox / OneMoney) — for bank statement auto-fetch (Phase 7+)
- Apple Developer Program ($99/yr) — for iOS (Phase 10)
- MSME Udyam registration for Shulka entity (free)
- Trademark "Shulka" (~₹4.5K govt + lawyer)
- Shulka's own GSTIN (when crossing ₹20L revenue)

### NOT needed
- Any "GST app license" — no such thing in India
- Company registration (sole prop on Pradeep's PAN is fine until revenue)
- Office address beyond home

## 3. The rule book — versioned JSON files in repo, time-aware engine

GST changes constantly (~7–12 CBIC notifications/quarter). A rule book that lives in code or one DB table cannot answer the audit question "what GST did Shulka compute for invoice dated 2 years ago, and why?" The architecture below can.

### Storage

`rules/` directory in repo, organized by domain:

```
rules/
├── gst-rates/
│   ├── 2017-07-01_initial-rates.json
│   ├── 2024-01-01_rate-rationalization.json
│   └── ...
├── hsn-codes/
│   ├── master.json
│   └── digit-requirements.json
├── place-of-supply/
│   ├── intra-state.json
│   ├── inter-state.json
│   ├── sez.json
│   └── export-import.json
├── thresholds/
│   ├── e-invoicing.json
│   ├── composition-scheme.json
│   └── qrmp.json
├── reverse-charge/
│   ├── notified-services.json
│   └── notified-goods.json
├── itc-rules/
│   ├── blocked-credits-17-5.json
│   ├── time-limit.json
│   └── reversal-rules.json
├── forms/
│   ├── gstr-1.schema.json
│   ├── gstr-3b.schema.json
│   └── gstr-9.schema.json
└── sources/
    └── (archived CBIC notification PDFs)
```

### Rule-file shape

```json
{
  "rule_id": "GST_RATE_HSN_8409_v3",
  "effective_from": "2024-01-01",
  "effective_to": null,
  "supersedes": "GST_RATE_HSN_8409_v2",
  "source": {
    "type": "notification",
    "id": "01/2024-CT (Rate)",
    "council_meeting": "52nd",
    "url": "...",
    "archived_pdf": "sources/2024-01-01_notif-01-2024-CT-rate.pdf",
    "summary": "Rate on machinery parts under HSN 8409 reduced from 18% to 12%"
  },
  "rule": {
    "kind": "rate_for_hsn",
    "hsn_prefix": "8409",
    "scope": "all",
    "rate_pct": 12
  },
  "tests": [
    { "transaction_date": "2024-02-15", "hsn": "84099190", "expected_rate": 12 },
    { "transaction_date": "2023-12-31", "hsn": "84099190", "expected_rate": 18 }
  ],
  "hash": "sha256:..."
}
```

### Engine behavior

1. Load all rule files at cold start, validate with Zod, index by `(domain, key, effective_from)`.
2. For any computation (e.g., GST rate for HSN X on date D), resolve the rule whose `effective_from <= D < effective_to`. Return the rate **plus the rule_id**.
3. Every computation logs the resolved rule_id alongside the result in the audit log. Reproducibility is automatic.
4. CI runs all golden tests across all rules on every PR. Rate changes that break historical computations are blocked.

### Grandfathering

Three flavors:
1. **Time-based** — rate changed effective date X, prior transactions use old rule. **Auto-handled by date-based resolution.**
2. **Contract-based** — old contracts continue under old terms. Stored as `grandfather_rule_id` on the contract.
3. **Threshold-based** — composition-scheme election survives threshold change. Stored as `scheme_election.effective_from + rule_set_at_election`.

### Maintenance process

- **Monthly:** Review CBIC notifications at gstcouncil.gov.in.
- **Quarterly:** Rate-card audit against ClearTax/Tally cross-check.
- **Annually:** Form schema review (GSTR-1/3B/9 may change structurally).

This process is the moat. Tally updates rules in opaque DLLs; Shulka's rule book is open, versioned, testable.

### Governance: contributor → reviewer → rule

A contributor proposal is *not* a rule until a designated reviewer approves it. Reviewers are real people with names attached to every rule they approve. CAs are non-technical, so neither contributors nor reviewers ever see git.

**Roles** (in user model from Phase 1): `business_owner | chartered_accountant | rule_contributor | reviewer | admin`.

**Reviewers (Day 1):** at least two — Pradeep + his trusted CA. Either can approve solo. Scale to 3–5 reviewers in Phase 8; consider quorum (2-of-3) for high-impact rule changes later.

**Hard rules baked into schema:**
- `proposed_by != approved_by` (no self-approval)
- `approved_by` and `approved_at` mandatory on every published rule
- `interpretation_note` optional field for genuinely ambiguous rules (the system surfaces both Shulka's chosen interpretation and the alternative)

### Contributor flow (Phase 8 feature; architecture supports from Day 0)

1. Verified-contributor CA fills a guided form (rule type → citation → change → test cases) in Shulka itself.
2. Worker validates against rule schema (Zod), uses a GitHub bot token to create a branch + JSON file + PR.
3. CI runs golden tests on the proposed change.
4. A *different* reviewer (cannot self-approve) reviews via a side-by-side dashboard inside Shulka.
5. On approve, Worker merges the PR via GitHub API → CI deploys → rule live.

### Trust layer (visible to end users from Phase 2)

Every GST computation in the user UI has a "Why this rate?" affordance. Modal shows:
- Rule applied (rule_id)
- Source citation (notification number, council meeting, PDF link)
- Reviewer name + CA membership number + approval date
- Times used count
- "Disagree? Report" link → routes back to reviewer queue

Reputation layer (Phase 8):
- Each rule's `source.submitted_by` field credits the contributor.
- Per-rule `times_used` counter shown on contributor's dashboard ("your rules computed 8,400 invoices").
- Public contributor leaderboard.

GitHub bot account + PAT in env from Phase 0.

### Why not store rules in DB

- Migrations to update rules are heavyweight
- No git history → no audit trail of who changed what
- Mobile (Capacitor) app needs offline GST math; bundled JSON files give that for free
- DB-stored rules require network round-trip per computation
