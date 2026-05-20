CREATE TYPE "public"."purchase_invoice_status" AS ENUM('draft', 'recorded', 'paid', 'partially_paid', 'disputed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."business_trust_status" AS ENUM('pending', 'trusted', 'revoked');--> statement-breakpoint
CREATE TABLE "business_trusts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"truster_business_id" uuid NOT NULL,
	"trusted_business_id" uuid NOT NULL,
	"status" "business_trust_status" DEFAULT 'pending' NOT NULL,
	"elevated_at" timestamp with time zone,
	"elevated_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"supplier_invoice_number" text NOT NULL,
	"fy" text NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"place_of_supply_state" text NOT NULL,
	"pos_kind" "pos_kind" DEFAULT 'inter_state' NOT NULL,
	"status" "purchase_invoice_status" DEFAULT 'recorded' NOT NULL,
	"notes" text,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"total_cgst_paise" bigint DEFAULT 0 NOT NULL,
	"total_sgst_paise" bigint DEFAULT 0 NOT NULL,
	"total_igst_paise" bigint DEFAULT 0 NOT NULL,
	"total_cess_paise" bigint DEFAULT 0 NOT NULL,
	"round_off_paise" bigint DEFAULT 0 NOT NULL,
	"total_amount_paise" bigint DEFAULT 0 NOT NULL,
	-- plain uuid, no FK — circular cross-reference with sales_invoices.linked_purchase_invoice_id
	-- FK will be added in a future migration once both tables are stable (ADR-10).
	"linked_sales_invoice_id" uuid,
	"linked_from_business_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	-- Self-referential reversal pointer; plain uuid to keep migration simple (no circular FK)
	"reversed_by_invoice_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_trusts" ADD CONSTRAINT "business_trusts_truster_business_id_businesses_id_fk" FOREIGN KEY ("truster_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trusts" ADD CONSTRAINT "business_trusts_trusted_business_id_businesses_id_fk" FOREIGN KEY ("trusted_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trusts" ADD CONSTRAINT "business_trusts_elevated_by_user_id_users_id_fk" FOREIGN KEY ("elevated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_trusts" ADD CONSTRAINT "business_trusts_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_linked_from_business_id_businesses_id_fk" FOREIGN KEY ("linked_from_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD COLUMN "linked_to_business_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_linked_to_business_id_businesses_id_fk" FOREIGN KEY ("linked_to_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_trusts_pair_uidx" ON "business_trusts" USING btree ("truster_business_id","trusted_business_id");--> statement-breakpoint
CREATE INDEX "business_trusts_truster_idx" ON "business_trusts" USING btree ("truster_business_id");--> statement-breakpoint
CREATE INDEX "business_trusts_trusted_idx" ON "business_trusts" USING btree ("trusted_business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_invoices_number_uidx" ON "purchase_invoices" USING btree ("business_id","party_id","supplier_invoice_number");--> statement-breakpoint
CREATE INDEX "purchase_invoices_business_status_idx" ON "purchase_invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "purchase_invoices_party_idx" ON "purchase_invoices" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "purchase_invoices_linked_from_business_idx" ON "purchase_invoices" USING btree ("linked_from_business_id");--> statement-breakpoint
CREATE INDEX "purchase_invoices_linked_sales_invoice_idx" ON "purchase_invoices" USING btree ("linked_sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_linked_to_idx" ON "sales_invoices" USING btree ("linked_to_business_id");
