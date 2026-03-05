ALTER TABLE "donations" ADD COLUMN "hbar_rate" numeric(12, 8);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "badge_serial" numeric(18, 0);--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "batch_transaction_id" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "prepared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supporters" ADD COLUMN "badge_token_id" text;--> statement-breakpoint
ALTER TABLE "supporters" ADD COLUMN "badge_serial" numeric(18, 0);--> statement-breakpoint
ALTER TABLE "supporters" ADD COLUMN "badge_awarded_at" timestamp with time zone;