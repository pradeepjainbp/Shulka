# GANAKA – Original Brainstorm

> Source: Initial ChatGPT conversation. Preserved verbatim as the starting point. See `02_critique_and_improvements.md` for the working revision.

You are an expert product architect, GST domain expert (India), and senior full-stack engineer.
I want to build a production-ready mobile + backend application called GANAKA focused on GST compliance, business finance tracking, and decision support for Indian businesses.

## 1. PROJECT OVERVIEW
**Project Name:** GANAKA – GST & Business Finance Assistant
**Goal:** Build a simple but powerful system that helps small and medium business owners:
- Manage GST (sales, purchases, returns)
- Track cash flow and working capital
- Generate actionable insights (not just reports)

**Target Users:**
- Small business owners (traders, manufacturers)
- Accountants managing multiple clients
- Freelancers with GST registration

**Core Value Proposition:** Unlike traditional accounting tools, this app will:
- Be simple enough for non-accountants
- Provide decision insights (not just data entry)
- Act like a "financial assistant", not just software

## 2. CORE FEATURES

### 2.1 GST MODULE
- Record Sales (with GST breakup: CGST, SGST, IGST)
- Record Purchases (input tax credit tracking)
- Auto-calculate GST payable
- Monthly GST summary (GSTR-1, GSTR-3B support)

### 2.2 INVOICE MANAGEMENT
- Create GST-compliant invoices
- Store and retrieve invoices
- Export PDF

### 2.3 EXPENSE & CASH FLOW TRACKING
- Track expenses (categorized)
- Track inflow/outflow
- Daily cash position

### 2.4 DASHBOARD & INSIGHTS
- Monthly profit estimate
- GST payable vs input credit
- Top expenses
- Alerts (e.g., high GST liability)

### 2.5 CLIENT MANAGEMENT (FOR ACCOUNTANTS)
- Manage multiple businesses
- Switch between clients
- Consolidated view

## 3. USER FLOW

**Business Owner Flow:**
1. Login / Register
2. Create Business Profile (GSTIN, type)
3. Add Sales / Purchases
4. View Dashboard
5. Generate GST summary

**Accountant Flow:**
1. Login
2. Add multiple clients
3. Switch between clients
4. Review GST + reports

## 4. TECHNICAL ARCHITECTURE
**Frontend:** Android app using Kotlin + Jetpack Compose
**Backend:** Firebase (Authentication + Firestore). Optional: Node.js backend for scaling.
**Database:** Firestore (initial). Structure optimized for multi-tenant (client-based).
**Why:** Faster MVP, scalable later, offline-friendly potential.

## 5. DATA MODEL DESIGN

**Entities:**
- **User** — user_id, role (business_owner / accountant)
- **Business** — business_id, GSTIN, name
- **Transactions** — transaction_id, type (sale / purchase / expense), amount, GST components, date
- **Invoices** — invoice_id, linked_transaction, PDF link
- **GST Summary** — month, output GST, input credit, payable

**Relationships:**
- One user → multiple businesses
- One business → many transactions

## 6. UI/UX DESIGN
**Screens:** Login · Dashboard (key metrics first) · Add Transaction (very simple form) · Invoice View · GST Summary Screen
**Design Principles:** Minimal typing · Clear numbers · Visual indicators (red = payable, green = credit)

## 7. DEVELOPMENT PLAN
**Phase 1 (MVP):** User login · Add transactions · Basic dashboard
**Phase 2:** GST calculations · Invoice generation · Monthly summaries
**Phase 3:** Multi-client support · Advanced insights · Export & integrations

## 8. EDGE CASES & RISKS
- Incorrect GST classification
- Missing transactions
- Multi-state GST complexity
- Data loss risk (must handle backups)

## 9. BUSINESS MODEL
- Freemium model
- Paid features: Multi-client support, Advanced reports, CA tools

## 10. IMPROVEMENT LOOP
- Track: Daily active users, Transactions added per user
- Feedback loop: In-app prompts, Accountant interviews
