import { migrate as drizzleMigrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "./client";

/**
 * Run pending migrations from the drizzle/ directory.
 * Can be called programmatically (e.g., on worker startup) or via CLI script.
 */
export async function runMigrations() {
  const db = getDb();
  const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;
  await drizzleMigrate(db, { migrationsFolder });
}
