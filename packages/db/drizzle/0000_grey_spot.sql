CREATE TYPE "public"."user_role" AS ENUM('business_owner', 'chartered_accountant', 'rule_contributor', 'reviewer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."invoice_kind" AS ENUM('sales', 'purchase');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"role" "user_role" DEFAULT 'business_owner' NOT NULL,
	"notification_prefs" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"business_id" uuid,
	"kind" text NOT NULL,
	"ref_table" text,
	"ref_id" uuid,
	"payload" jsonb NOT NULL,
	"rule_ids" text[]
);
--> statement-breakpoint
CREATE TABLE "rule_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"invoice_kind" "invoice_kind" NOT NULL,
	"invoice_item_id" uuid,
	"domain" text NOT NULL,
	"rule_id" text NOT NULL,
	"source_citation_json" jsonb NOT NULL,
	"resolved_value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_events_business_id_ts_idx" ON "audit_events" USING btree ("business_id","ts");--> statement-breakpoint
CREATE INDEX "audit_events_kind_ts_idx" ON "audit_events" USING btree ("kind","ts");--> statement-breakpoint
CREATE INDEX "rule_resolutions_item_idx" ON "rule_resolutions" USING btree ("invoice_kind","invoice_item_id");--> statement-breakpoint
CREATE INDEX "rule_resolutions_rule_id_ts_idx" ON "rule_resolutions" USING btree ("rule_id","ts");
--> statement-breakpoint

-- ─── Immutability triggers (Sacred Rule 3) ───────────────────────────────────
CREATE OR REPLACE FUNCTION raise_on_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events and rule_resolutions are append-only. UPDATE and DELETE are forbidden.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION raise_on_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER rule_resolutions_immutable
  BEFORE UPDATE OR DELETE ON rule_resolutions
  FOR EACH ROW EXECUTE FUNCTION raise_on_audit_mutation();
--> statement-breakpoint

-- ─── DB roles ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'shulka_app') THEN
    CREATE ROLE shulka_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO shulka_app;
--> statement-breakpoint
GRANT INSERT, SELECT ON audit_events TO shulka_app;
--> statement-breakpoint
GRANT INSERT, SELECT ON rule_resolutions TO shulka_app;
--> statement-breakpoint
GRANT INSERT, SELECT, UPDATE, DELETE ON users TO shulka_app;