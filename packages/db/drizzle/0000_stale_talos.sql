CREATE TABLE "deletion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tweet_id" uuid,
	"account_id" uuid,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tweet_age_hours" numeric,
	"content_preview" text,
	"category_tags" text[],
	"severity_score" integer,
	"hcs_proof_txn" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "engagement_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tweet_id" uuid,
	"likes" integer,
	"retweets" integer,
	"replies" integer,
	"views" bigint,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hcs_attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tweet_id" uuid,
	"topic_id" text NOT NULL,
	"sequence_number" bigint NOT NULL,
	"transaction_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"consensus_timestamp" timestamp with time zone NOT NULL,
	"message_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"twitter_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"category" text NOT NULL,
	"subcategory" text,
	"tracking_tier" text DEFAULT 'standard' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_accounts_twitter_id_unique" UNIQUE("twitter_id")
);
--> statement-breakpoint
CREATE TABLE "tracking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_username" text NOT NULL,
	"requested_by" text,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tweets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tweet_id" text NOT NULL,
	"account_id" uuid,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"raw_json" jsonb NOT NULL,
	"tweet_type" text DEFAULT 'tweet' NOT NULL,
	"media_urls" text[],
	"engagement" jsonb,
	"posted_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deletion_detected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tweets_tweet_id_unique" UNIQUE("tweet_id")
);
--> statement-breakpoint
ALTER TABLE "deletion_events" ADD CONSTRAINT "deletion_events_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_events" ADD CONSTRAINT "deletion_events_account_id_tracked_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tracked_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_snapshots" ADD CONSTRAINT "engagement_snapshots_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hcs_attestations" ADD CONSTRAINT "hcs_attestations_tweet_id_tweets_id_fk" FOREIGN KEY ("tweet_id") REFERENCES "public"."tweets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_account_id_tracked_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tracked_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deletions_account" ON "deletion_events" USING btree ("account_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_deletions_severity" ON "deletion_events" USING btree ("severity_score");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_hcs_tweet" ON "hcs_attestations" USING btree ("tweet_id");--> statement-breakpoint
CREATE INDEX "idx_tweets_account" ON "tweets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_tweets_posted" ON "tweets" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "idx_tweets_content_hash" ON "tweets" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_tweets_fts" ON "tweets" USING gin (to_tsvector('english', "content"));--> statement-breakpoint
CREATE INDEX "idx_tweets_deleted" ON "tweets" USING btree ("is_deleted", "deleted_at" DESC) WHERE is_deleted = true;