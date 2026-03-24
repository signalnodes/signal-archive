import { ImageResponse } from "next/og";
import { count, eq } from "drizzle-orm";
import { getDb, trackedAccounts, tweets, deletionEvents } from "@taa/db";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORY_LABELS: Record<string, string> = {
  trump_family: "Trump Family",
  wlfi: "World Liberty Financial",
  political_appointee: "Political Appointee",
  white_house: "White House",
  federal_agency: "Federal Agency",
  congress: "Congress",
  crypto_industry: "Crypto Industry",
  crypto_caller: "Crypto Caller",
};

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const db = getDb();

  const [accountRow] = await db
    .select({
      displayName: trackedAccounts.displayName,
      category: trackedAccounts.category,
    })
    .from(trackedAccounts)
    .where(eq(trackedAccounts.username, username))
    .limit(1);

  const [tweetCount, deletionCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(tweets)
      .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
      .where(eq(trackedAccounts.username, username)),
    db
      .select({ count: count() })
      .from(deletionEvents)
      .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
      .where(eq(trackedAccounts.username, username)),
  ]);

  const displayName = accountRow?.displayName ?? `@${username}`;
  const category = accountRow?.category ?? "";
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  const archived = tweetCount[0]?.count ?? 0;
  const deletions = deletionCount[0]?.count ?? 0;
  const hasDeletions = deletions > 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#09090b",
          padding: "56px 64px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "48px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
              }}
            />
            <span
              style={{ color: "#71717a", fontSize: "18px", fontWeight: 600 }}
            >
              Signal Archive
            </span>
          </div>
          {categoryLabel && (
            <div
              style={{
                display: "flex",
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "6px",
                padding: "6px 16px",
                color: "#a1a1aa",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              {categoryLabel}
            </div>
          )}
        </div>

        {/* Account */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              color: "#71717a",
              fontSize: "24px",
              fontWeight: 500,
              marginBottom: "8px",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              display: "flex",
              color: "#ffffff",
              fontSize: "64px",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            {`@${username}`}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                color: "#ffffff",
                fontSize: "36px",
                fontWeight: 700,
              }}
            >
              {archived.toLocaleString()}
            </span>
            <span style={{ color: "#52525b", fontSize: "15px" }}>
              statements archived
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                color: hasDeletions ? "#ef4444" : "#ffffff",
                fontSize: "36px",
                fontWeight: 700,
              }}
            >
              {deletions.toLocaleString()}
            </span>
            <span style={{ color: "#52525b", fontSize: "15px" }}>
              deletions detected
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            borderTop: "1px solid #27272a",
            paddingTop: "20px",
            color: "#52525b",
            fontSize: "15px",
          }}
        >
          signalarchive.org
        </div>
      </div>
    ),
    { ...size }
  );
}
