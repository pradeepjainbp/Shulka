CREATE TYPE "public"."business_type" AS ENUM('proprietorship', 'partnership', 'llp', 'pvt_ltd', 'public_ltd', 'huf', 'other');--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"gstin" text,
	"pan" text,
	"state_code" text,
	"address" jsonb,
	"registration_date" date,
	"type" "business_type" DEFAULT 'proprietorship' NOT NULL,
	"composition_scheme" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_gstin_uidx" ON "businesses" USING btree ("gstin");--> statement-breakpoint
CREATE INDEX "businesses_owner_user_id_idx" ON "businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "businesses_deleted_at_idx" ON "businesses" USING btree ("deleted_at");