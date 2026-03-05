import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const supporters = pgTable("supporters", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").unique().notNull(),
  totalDonatedUsd: numeric("total_donated_usd", { precision: 12, scale: 2 }).default("0").notNull(),
  firstDonationAt: timestamp("first_donation_at", { withTimezone: true }).notNull(),
  lastDonationAt: timestamp("last_donation_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // NFT badge fields (HIP-551 atomic batch)
  badgeTokenId: text("badge_token_id"),
  badgeSerial: numeric("badge_serial", { precision: 18, scale: 0 }),
  badgeAwardedAt: timestamp("badge_awarded_at", { withTimezone: true }),
});
