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
  // Atomic batch fields (HIP-551)
  hbarRate: numeric("hbar_rate", { precision: 12, scale: 8 }),
  template: text("template"),
  badgeSerial: numeric("badge_serial", { precision: 18, scale: 0 }),
  batchTransactionId: text("batch_transaction_id"),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
});
