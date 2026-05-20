CREATE TYPE "public"."sales_invoice_status" AS ENUM('draft', 'final', 'cancelled');--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"fy" text NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"place_of_supply_state" text NOT NULL,
	"status" "sales_invoice_status" DEFAULT 'draft' NOT NULL,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"total_cgst_paise" bigint DEFAULT 0 NOT NULL,
	"total_sgst_paise" bigint DEFAULT 0 NOT NULL,
	"total_igst_paise" bigint DEFAULT 0 NOT NULL,
	"total_cess_paise" bigint DEFAULT 0 NOT NULL,
	"round_off_paise" bigint DEFAULT 0 NOT NULL,
	"total_amount_paise" bigint DEFAULT 0 NOT NULL,
	-- No FK constraint intentionally: purchase_invoices table is created in Phase 3 (P3-01).
	-- ALTER TABLE ... ADD CONSTRAINT will be added in migration 0009_purchase_invoice_fks.sql.
	"linked_purchase_invoice_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"reversed_by_invoice_id" uuid,
	"pdf_r2_key" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"description" text NOT NULL,
	"hsn_code" text,
	"sac_code" text,
	"quantity" numeric NOT NULL,
	"unit" text NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"discount_pct" numeric DEFAULT '0' NOT NULL,
	"taxable_value_paise" bigint NOT NULL,
	"cgst_rate_pct" numeric DEFAULT '0' NOT NULL,
	"cgst_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_rate_pct" numeric DEFAULT '0' NOT NULL,
	"sgst_paise" bigint DEFAULT 0 NOT NULL,
	"igst_rate_pct" numeric DEFAULT '0' NOT NULL,
	"igst_paise" bigint DEFAULT 0 NOT NULL,
	"cess_rate_pct" numeric DEFAULT '0' NOT NULL,
	"cess_paise" bigint DEFAULT 0 NOT NULL,
	"rule_resolutions" jsonb,
	"total_paise" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_reversed_by_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("reversed_by_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_invoices_number_uidx" ON "sales_invoices" USING btree ("business_id","fy","invoice_number");--> statement-breakpoint
CREATE INDEX "sales_invoices_business_status_idx" ON "sales_invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "sales_invoices_party_idx" ON "sales_invoices" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_business_id_idx" ON "sales_invoices" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_invoice_idx" ON "sales_invoice_items" USING btree ("sales_invoice_id");
