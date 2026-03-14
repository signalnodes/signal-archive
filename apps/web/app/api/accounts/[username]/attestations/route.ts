// Cost note: join between hcs_attestations and tweets on account_id.
// Limited to PAGE_SIZE — does not re-fetch verification data.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, hcsAttestations, tweets } from "@taa/db";
import { getAccountByUsername, parsePage } from "@/lib/api-helpers";

const PAGE_SIZE = 25;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const url = new URL(_req.url);
  const page = parsePage(url.searchParams.get("page"));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();
  const account = await getAccountByUsername(db, username);

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

  return NextResponse.json({ attestations: rows, page, pageSize: PAGE_SIZE }, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
