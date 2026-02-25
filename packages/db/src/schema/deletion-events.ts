import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tweets } from "./tweets";
import { trackedAccounts } from "./tracked-accounts";

export const deletionEvents = pgTable(
  "deletion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tweetId: uuid("tweet_id").references(() => tweets.id),
    accountId: uuid("account_id").references(() => trackedAccounts.id),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    tweetAgeHours: numeric("tweet_age_hours"),
    contentPreview: text("content_preview"),
    categoryTags: text("category_tags").array(),
    severityScore: integer("severity_score"),
    hcsProofTxn: text("hcs_proof_txn"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("idx_deletions_account").on(table.accountId, table.detectedAt),
    index("idx_deletions_severity").on(table.severityScore),
  ]
);
