import {
  pgTable,
  uuid,
  integer,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { tweets } from "./tweets";

export const engagementSnapshots = pgTable("engagement_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tweetId: uuid("tweet_id").references(() => tweets.id),
  likes: integer("likes"),
  retweets: integer("retweets"),
  replies: integer("replies"),
  views: bigint("views", { mode: "number" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
});
