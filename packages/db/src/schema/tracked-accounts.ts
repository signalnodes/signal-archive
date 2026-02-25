import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const trackedAccounts = pgTable("tracked_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  twitterId: text("twitter_id").unique().notNull(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  trackingTier: text("tracking_tier").default("standard").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
