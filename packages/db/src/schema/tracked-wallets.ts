import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const trackedWallets = pgTable("tracked_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: text("address").notNull(),
  chain: text("chain").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  notes: text("notes"),
  explorerUrl: text("explorer_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
