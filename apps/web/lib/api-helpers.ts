import { eq } from "drizzle-orm";
import { getDb, trackedAccounts } from "@taa/db";

export async function getAccountByUsername(db: ReturnType<typeof getDb>, username: string) {
  const [account] = await db
    .select({ id: trackedAccounts.id })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);
  return account ?? null;
}

export function parsePage(param?: string | null): number {
  return Math.max(1, parseInt(param ?? "1", 10) || 1);
}
