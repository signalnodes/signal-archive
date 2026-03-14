import {
  pgTable,
  uuid,
  text,
  bigint,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tweets } from "./tweets";

export const hcsAttestations = pgTable(
  "hcs_attestations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: uuid("tweet_id").references(() => tweets.id),
    messageType: text("message_type").notNull().default("tweet_attestation"),
    topicId: text("topic_id").notNull(),
    sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
    transactionId: text("transaction_id").notNull(),
    contentHash: text("content_hash").notNull(),
    consensusTimestamp: timestamp("consensus_timestamp", { withTimezone: true }).notNull(),
    messagePayload: jsonb("message_payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_hcs_tweet_type").on(table.tweetId, table.messageType),
  ]
);
