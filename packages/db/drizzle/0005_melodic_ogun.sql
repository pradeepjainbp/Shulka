CREATE TYPE "public"."scheme_type" AS ENUM('regular', 'composition', 'qrmp');--> statement-breakpoint
CREATE TABLE "scheme_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"scheme" "scheme_type" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"rule_set_at_election" jsonb,
	"declaration_filed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheme_elections" ADD CONSTRAINT "scheme_elections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheme_elections_business_id_idx" ON "scheme_elections" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "scheme_elections_effective_from_idx" ON "scheme_elections" USING btree ("business_id","effective_from");