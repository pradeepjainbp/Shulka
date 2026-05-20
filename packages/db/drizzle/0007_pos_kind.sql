CREATE TYPE "public"."pos_kind" AS ENUM('intra_state', 'inter_state', 'export', 'sez');--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "pos_kind" "pos_kind" DEFAULT 'inter_state' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "pos_override_reason" text;
