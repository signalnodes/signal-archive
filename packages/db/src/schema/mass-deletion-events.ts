import { pgTable, uuid, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { trackedAccounts } from "./tracked-accounts";

export const massDeletionEvents = pgTable(
  "mass_deletion_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .references(() => trackedAccounts.id)
      .notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    deletionCount: integer("deletion_count").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_mass_deletions_account").on(table.accountId, table.detectedAt),
    // Prevent duplicate events for the same account + window bucket
    unique("uq_mass_deletion_account_window").on(table.accountId, table.windowStart),
  ]
);
