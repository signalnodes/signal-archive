import { desc, eq } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts, tweets } from "@taa/db";

const BASE_URL = "https://signalarchive.org";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(date: Date): string {
  return date.toUTCString();
}

export async function GET() {
  const db = getDb();

  const rows = await db
    .select({
      deletion: {
        id: deletionEvents.id,
        detectedAt: deletionEvents.detectedAt,
        tweetAgeHours: deletionEvents.tweetAgeHours,
        contentPreview: deletionEvents.contentPreview,
      },
      account: {
        username: trackedAccounts.username,
        displayName: trackedAccounts.displayName,
      },
      tweet: {
        id: tweets.id,
        content: tweets.content,
      },
    })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
    .leftJoin(tweets, eq(deletionEvents.tweetId, tweets.id))
    .orderBy(desc(deletionEvents.detectedAt))
    .limit(50);

  const items = rows
    .map((row) => {
      const username = row.account?.username ?? "unknown";
      const content = row.tweet?.content ?? row.deletion.contentPreview ?? "";
      const tweetDbId = row.tweet?.id;
      const link = tweetDbId
        ? `${BASE_URL}/tweet/${tweetDbId}`
        : `${BASE_URL}/deletions`;

      const hours = row.deletion.tweetAgeHours
        ? parseFloat(String(row.deletion.tweetAgeHours))
        : null;
      const ageStr =
        hours != null
          ? hours < 24
            ? `${Math.round(hours)}h old`
            : `${Math.round(hours / 24)}d old`
          : null;

      const title = ageStr
        ? `@${username} deleted a tweet (${ageStr})`
        : `@${username} deleted a tweet`;

      const preview = content.length > 400 ? content.slice(0, 400) + "…" : content;
      const description = preview
        ? `${escapeXml(preview)}\n\nDeleted by @${username} - cryptographically attested on Hedera Mainnet.`
        : `Tweet deleted by @${username} - cryptographically attested on Hedera Mainnet.`;

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${rfc822(row.deletion.detectedAt)}</pubDate>
      <description>${description}</description>
      <author>noreply@signalarchive.org (@${escapeXml(username)})</author>
    </item>`;
    })
    .join("\n");

  const lastBuildDate =
    rows.length > 0 ? rfc822(rows[0].deletion.detectedAt) : rfc822(new Date());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Signal Archive - Deletion Feed</title>
    <link>${BASE_URL}/deletions</link>
    <description>Cryptographically attested tweet deletions from public figures, politicians, and government officials.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/opengraph-image</url>
      <title>Signal Archive</title>
      <link>${BASE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900", // 15 min cache
    },
  });
}
