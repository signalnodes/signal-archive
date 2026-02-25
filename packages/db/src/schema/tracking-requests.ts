import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const trackingRequests = pgTable("tracking_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestedUsername: text("requested_username").notNull(),
  requestedBy: text("requested_by"),
  reason: text("reason"),
  status: text("status").default("pending").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
