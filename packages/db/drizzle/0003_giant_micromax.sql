CREATE TABLE "tracked_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"chain" text NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"notes" text,
	"explorer_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracked_accounts" ADD COLUMN "donor_only" boolean DEFAULT false NOT NULL;