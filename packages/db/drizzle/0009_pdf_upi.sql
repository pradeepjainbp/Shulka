-- Migration 0009: PDF share tokens + UPI VPA
-- Adds three columns:
--   businesses.upi_vpa          — UPI VPA for QR code generation (nullable)
--   sales_invoices.pdf_r2_key   — already exists; added in P2-01 schema but not yet in DB
--   sales_invoices.pdf_share_token          — public share token (UUID string)
--   sales_invoices.pdf_share_token_expires_at — 7-day expiry for public link

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS upi_vpa text;

ALTER TABLE sales_invoices
  ADD COLUMN IF NOT EXISTS pdf_share_token text,
  ADD COLUMN IF NOT EXISTS pdf_share_token_expires_at timestamptz;

-- Index for fast public-link lookup
CREATE INDEX IF NOT EXISTS sales_invoices_pdf_share_token_idx
  ON sales_invoices (pdf_share_token)
  WHERE pdf_share_token IS NOT NULL;
