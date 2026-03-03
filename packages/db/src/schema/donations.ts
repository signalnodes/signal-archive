import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

export const donations = pgTable("donations", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  transactionId: text("transaction_id").unique().notNull(),
  asset: text("asset").notNull(),
  amount: numeric("amount", { precision: 18, scale: 8 }).notNull(),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
  status: text("status").default("pending").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
