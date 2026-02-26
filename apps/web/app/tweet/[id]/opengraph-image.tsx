import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { getDb, tweets, trackedAccounts } from "@taa/db";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const [row] = await db
    .select({
      content: tweets.content,
      isDeleted: tweets.isDeleted,
      username: trackedAccounts.username,
    })
    .from(tweets)
    .leftJoin(trackedAccounts, eq(tweets.accountId, trackedAccounts.id))
    .where(eq(tweets.id, id))
    .limit(1);

  const content = row?.content ?? "";
  const username = row?.username ?? "unknown";
  const isDeleted = row?.isDeleted ?? false;
  const preview = content.length > 240 ? content.slice(0, 240) + "…" : content;

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
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "36px",
          }}
        >
          {/* Brand */}
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

          {/* Status badge */}
          {isDeleted ? (
            <div
              style={{
                display: "flex",
                backgroundColor: "#450a0a",
                border: "1px solid #ef444460",
                borderRadius: "6px",
                padding: "6px 16px",
                color: "#ef4444",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              DELETED
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                backgroundColor: "#052e16",
                border: "1px solid #16a34a60",
                borderRadius: "6px",
                padding: "6px 16px",
                color: "#16a34a",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              ARCHIVED
            </div>
          )}
        </div>

        {/* Username */}
        <div
          style={{
            color: "#ffffff",
            fontSize: "26px",
            fontWeight: 700,
            marginBottom: "20px",
          }}
        >
          @{username}
        </div>

        {/* Tweet content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-start",
            color: "#d4d4d8",
            fontSize: "30px",
            lineHeight: 1.55,
          }}
        >
          {preview}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #27272a",
            paddingTop: "20px",
            marginTop: "20px",
            color: "#52525b",
            fontSize: "15px",
          }}
        >
          <span>signalarchive.org</span>
          <span>Cryptographically attested · Hedera Mainnet</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
