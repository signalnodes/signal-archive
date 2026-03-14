import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { trackedAccounts } from "./tracked-accounts";

export const tweets = pgTable(
  "tweets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: text("tweet_id").unique().notNull(),
    accountId: uuid("account_id").references(() => trackedAccounts.id),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    tweetType: text("tweet_type").default("tweet").notNull(),
    mediaUrls: text("media_urls").array(),
    // engagement column removed — was never written to
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
    contentHash: text("content_hash").notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionDetectedAt: timestamp("deletion_detected_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_tweets_account").on(table.accountId),
    index("idx_tweets_posted").on(table.postedAt),
    index("idx_tweets_content_hash").on(table.contentHash),
    index("idx_tweets_fts").using(
      "gin",
      sql`to_tsvector('english', ${table.content})`
    ),
    // Partial index — dramatically speeds up deletion check queries as table grows
    index("idx_tweets_not_deleted").on(table.postedAt).where(
      sql`${table.isDeleted} = false`
    ),
  ]
);
