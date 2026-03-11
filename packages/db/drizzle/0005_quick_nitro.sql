CREATE TABLE "mass_deletion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"deletion_count" integer NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_mass_deletion_account_window" UNIQUE("account_id","window_start")
);
--> statement-breakpoint
ALTER TABLE "mass_deletion_events" ADD CONSTRAINT "mass_deletion_events_account_id_tracked_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tracked_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mass_deletions_account" ON "mass_deletion_events" USING btree ("account_id","detected_at");