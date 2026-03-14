// Cost note: MVP Snapshot Model — fetches limited N from each stream independently,
// merges in application layer. No SQL UNION. No offset pagination across streams.
// IDENTITY_ONLY accounts skip tweet/deletion fetches entirely.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, tweets, deletionEvents, hcsAttestations, trackedAccounts } from "@taa/db";
import {
  tweetToEvent,
  deletionToEvent,
  attestationToEvent,
  mergeEvents,
} from "@/lib/adapters/account";

const STREAM_LIMIT = 15; // fetch N from each stream; merge gives up to 3N, slice to 20

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const db = getDb();

  const [account] = await db
    .select({
      id: trackedAccounts.id,
      metadata: trackedAccounts.metadata,
    })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });


  const meta = account.metadata as Record<string, unknown> | null;
  const trackingMode = (meta?.trackingMode as string) ?? "FULL_ARCHIVE";
  const isFullArchive = trackingMode === "FULL_ARCHIVE";

  // Fetch streams in parallel. IDENTITY_ONLY accounts skip tweet/deletion fetches.
  const [tweetRows, deletionRows, attestationRows] = await Promise.all([
    isFullArchive
      ? db
          .select({
            id: tweets.id,
            content: tweets.content,
            capturedAt: tweets.capturedAt,
            contentHash: tweets.contentHash,
          })
          .from(tweets)
          .where(eq(tweets.accountId, account.id))
          .orderBy(desc(tweets.capturedAt))
          .limit(STREAM_LIMIT)
      : Promise.resolve([]),
    isFullArchive
      ? db
          .select({
            id: deletionEvents.id,
            tweetId: deletionEvents.tweetId,
            contentPreview: deletionEvents.contentPreview,
            detectedAt: deletionEvents.detectedAt,
          })
          .from(deletionEvents)
          .where(eq(deletionEvents.accountId, account.id))
          .orderBy(desc(deletionEvents.detectedAt))
          .limit(STREAM_LIMIT)
      : Promise.resolve([]),
    db
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
      .limit(STREAM_LIMIT),
  ]);

  const events = mergeEvents(
    [
      tweetRows.map(tweetToEvent),
      deletionRows.map(deletionToEvent),
      attestationRows.map(attestationToEvent),
    ],
    20
  );

  return NextResponse.json({ events, trackingMode }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
