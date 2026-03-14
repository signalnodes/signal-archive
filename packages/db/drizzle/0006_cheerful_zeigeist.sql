ALTER TABLE "engagement_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tracking_requests" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "engagement_snapshots" CASCADE;--> statement-breakpoint
DROP TABLE "tracking_requests" CASCADE;--> statement-breakpoint
DROP INDEX "idx_hcs_tweet";--> statement-breakpoint
ALTER TABLE "deletion_events" ALTER COLUMN "tweet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "deletion_events" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "hcs_attestations" ADD COLUMN "message_type" text DEFAULT 'tweet_attestation' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_deletions_tweet" ON "deletion_events" USING btree ("tweet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hcs_tweet_type" ON "hcs_attestations" USING btree ("tweet_id","message_type");--> statement-breakpoint
CREATE INDEX "idx_tweets_not_deleted" ON "tweets" USING btree ("posted_at") WHERE "tweets"."is_deleted" = false;--> statement-breakpoint
ALTER TABLE "deletion_events" DROP COLUMN "hcs_proof_txn";--> statement-breakpoint
ALTER TABLE "tweets" DROP COLUMN "engagement";--> statement-breakpoint
ALTER TABLE "tracked_accounts" ADD CONSTRAINT "tracked_accounts_username_unique" UNIQUE("username");