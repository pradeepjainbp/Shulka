CREATE TYPE "public"."party_kind" AS ENUM('customer', 'supplier', 'both');--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"external_gstin" text,
	"linked_business_id" uuid,
	"phone" text,
	"email" text,
	"address" jsonb,
	"party_kind" "party_kind" DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_linked_business_id_businesses_id_fk" FOREIGN KEY ("linked_business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "parties_business_gstin_uidx" ON "parties" USING btree ("business_id","external_gstin");--> statement-breakpoint
CREATE INDEX "parties_business_id_idx" ON "parties" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "parties_linked_business_id_idx" ON "parties" USING btree ("linked_business_id");