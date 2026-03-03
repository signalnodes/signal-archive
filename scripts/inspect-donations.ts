import { getDb, donations, supporters } from "@taa/db";

const db = getDb();
const d = await db.select().from(donations);
const s = await db.select().from(supporters);
console.log("Donations:", JSON.stringify(d, null, 2));
console.log("Supporters:", JSON.stringify(s, null, 2));
process.exit(0);
