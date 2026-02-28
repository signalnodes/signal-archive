// Cost note: join between hcs_attestations and tweets on account_id.
// Limited to PAGE_SIZE — does not re-fetch verification data.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, hcsAttestations, tweets, trackedAccounts } from "@taa/db";

const PAGE_SIZE = 25;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(_req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();

  const [account] = await db
    .select({ id: trackedAccounts.id })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db
    .select({
      id: hcsAttestations.id,
      tweetId: hcsAttestations.tweetId,
      topicId: hcsAttestations.topicId,
      transactionId: hcsAttestations.transactionId,
      contentHash: hcsAttestations.contentHash,
      sequenceNumber: hcsAttestations.sequenceNumber,
      consensusTimestamp: hcsAttestations.consensusTimestamp,
    })
    .from(hcsAttestations)
    .innerJoin(tweets, eq(hcsAttestations.tweetId, tweets.id))
    .where(eq(tweets.accountId, account.id))
    .orderBy(desc(hcsAttestations.consensusTimestamp))
    .limit(PAGE_SIZE)
    .offset(offset);

  return NextResponse.json({ attestations: rows, page, pageSize: PAGE_SIZE });
}
