/**
 * Signal Archive HOL Agent Chat Endpoint
 *
 * HCS-11 registered agent endpoint for the Hashgraph Online Registry.
 * Accepts natural language queries and returns Signal Archive data.
 *
 * UAID: uaid:aid:98gtn21G8xhjbQg4WYkVHHtyYsf6ko2V9YC2WLuh6rjTnD5J8qKxvux6CLGwMakhLH
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, ilike, isNotNull, count } from "drizzle-orm";
import { getDb, deletionEvents, trackedAccounts, tweets, hcsAttestations } from "@taa/db";

interface ChatRequest {
  message?: string;
  content?: string; // HCS-10 alternate field name
  operator_id?: string;
  session_id?: string;
}

function extractMessage(body: ChatRequest): string {
  return (body.message ?? body.content ?? "").trim();
}

// ── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(msg: string): "recent_deletions" | "account_status" | "verify" | "stats" | "help" {
  const lower = msg.toLowerCase();

  if (lower.match(/verif|hash|attest|proof|hcs/)) return "verify";

  const hasAccount = lower.match(/@\w+/) || lower.match(/\b(account|status|monitor|track)\b.*@?\w+/);
  if (hasAccount && !lower.match(/\b(recent|latest|all|list|deleted|deletion)\b/)) return "account_status";

  if (lower.match(/\b(stat|count|total|how many|overview|summary)\b/)) return "stats";

  if (lower.match(/\b(delete|deletion|deleted|removed|removed from|missing)\b/)) return "recent_deletions";

  return "help";
}

function extractUsername(msg: string): string | null {
  const match = msg.match(/@(\w+)/);
  return match?.[1] ?? null;
}

function extractHash(msg: string): string | null {
  const match = msg.match(/\b([a-f0-9]{64})\b/i);
  return match?.[1] ?? null;
}

// ── Query handlers ────────────────────────────────────────────────────────────

async function handleRecentDeletions(limit = 5) {
  const db = getDb();
  const rows = await db
    .select({
      contentPreview: deletionEvents.contentPreview,
      detectedAt: deletionEvents.detectedAt,
      severityScore: deletionEvents.severityScore,
      tweetId: deletionEvents.tweetId,
      username: trackedAccounts.username,
    })
    .from(deletionEvents)
    .leftJoin(trackedAccounts, eq(deletionEvents.accountId, trackedAccounts.id))
    .where(isNotNull(deletionEvents.contentPreview))
    .orderBy(desc(deletionEvents.detectedAt))
    .limit(limit);

  if (rows.length === 0) {
    return "No deletions recorded yet. Signal Archive monitors 40 high-value accounts and records deletions to Hedera HCS.";
  }

  const lines = rows.map((r, i) => {
    const account = r.username ? `@${r.username}` : "unknown";
    const preview = r.contentPreview ? `"${r.contentPreview.slice(0, 80)}${r.contentPreview.length > 80 ? "…" : ""}"` : "(no preview)";
    const severity = r.severityScore != null ? ` [severity: ${r.severityScore}/10]` : "";
    const detected = new Date(r.detectedAt).toISOString().split("T")[0];
    const proofUrl = r.tweetId ? ` — proof: https://signalarchive.org/tweet/${r.tweetId}` : "";
    return `${i + 1}. ${account} (${detected})${severity}: ${preview}${proofUrl}`;
  });

  return `Recent deletions detected by Signal Archive:\n\n${lines.join("\n")}\n\nAll deletions are cryptographically attested on Hedera HCS topic 0.0.10301350. View full feed: https://signalarchive.org/deletions`;
}

async function handleAccountStatus(username: string) {
  const db = getDb();

  const [account] = await db
    .select()
    .from(trackedAccounts)
    .where(ilike(trackedAccounts.username, username))
    .limit(1);

  if (!account) {
    return `@${username} is not currently monitored by Signal Archive. Signal Archive tracks 40 high-value public figures. View all tracked accounts: https://signalarchive.org/accounts`;
  }

  const [tweetCountResult, deletionCountResult] = await Promise.all([
    db.select({ count: count() }).from(tweets).where(eq(tweets.accountId, account.id)),
    db.select({ count: count() }).from(deletionEvents).where(eq(deletionEvents.accountId, account.id)),
  ]);

  const tweetCount = tweetCountResult[0]?.count ?? 0;
  const deletionCount = deletionCountResult[0]?.count ?? 0;

  return `Signal Archive monitoring status for @${account.username}:

• Status: ${account.isActive ? "✓ Active — being monitored" : "⚠ Inactive"}
• Display name: ${account.displayName ?? account.username}
• Category: ${account.category}
• Archived tweets: ${tweetCount}
• Detected deletions: ${deletionCount}
• HCS topic: 0.0.10301350 (Hedera mainnet)

View account page: https://signalarchive.org/accounts/${account.username}`;
}

async function handleVerify(contentHash: string) {
  const db = getDb();

  const [attestation] = await db
    .select({
      topicId: hcsAttestations.topicId,
      sequenceNumber: hcsAttestations.sequenceNumber,
      consensusTimestamp: hcsAttestations.consensusTimestamp,
      contentHash: hcsAttestations.contentHash,
    })
    .from(hcsAttestations)
    .where(eq(hcsAttestations.contentHash, contentHash.toLowerCase()))
    .limit(1);

  if (!attestation) {
    return `No HCS attestation found for hash: ${contentHash}\n\nTo verify a tweet, provide its SHA-256 content hash. You can find hashes at https://signalarchive.org`;
  }

  const hashscanUrl = `https://hashscan.io/mainnet/topic/${attestation.topicId}?sequenceNumber=${attestation.sequenceNumber}`;
  const submittedAt = new Date(attestation.consensusTimestamp).toISOString();

  return `HCS attestation found for hash ${contentHash.slice(0, 16)}…:

• Topic: ${attestation.topicId} (Hedera mainnet)
• Sequence number: ${attestation.sequenceNumber}
• Attested at: ${submittedAt}
• HashScan proof: ${hashscanUrl}

This attestation is permanent and independently verifiable — no trust required.`;
}

async function handleStats() {
  const db = getDb();

  const [tweetCountResult, deletionCountResult, accountCountResult] = await Promise.all([
    db.select({ count: count() }).from(tweets),
    db.select({ count: count() }).from(deletionEvents),
    db.select({ count: count() }).from(trackedAccounts).where(eq(trackedAccounts.isActive, true)),
  ]);

  const tweetCount = tweetCountResult[0]?.count ?? 0;
  const deletionCount = deletionCountResult[0]?.count ?? 0;
  const accountCount = accountCountResult[0]?.count ?? 0;

  return `Signal Archive live statistics:

• Archived tweets: ${Number(tweetCount).toLocaleString()}
• Detected deletions: ${Number(deletionCount).toLocaleString()}
• Monitored accounts: ${Number(accountCount).toLocaleString()}
• HCS topic: 0.0.10301350 (Hedera mainnet)
• All attestations are SHA-256 hashed and submitted to Hedera Consensus Service in near real-time

Live site: https://signalarchive.org`;
}

function handleHelp() {
  return `Signal Archive Agent — HOL Registry (HCS-11)

I monitor 40 high-value public figures on X/Twitter, archive every tweet with a SHA-256 hash, and submit cryptographic attestations to Hedera HCS. When tweets are deleted, I detect and attest the deletion on-chain with an AI severity score.

I can answer:
• "Show recent deletions" — latest deletions with severity scores and proof links
• "Status @username" — monitoring status and deletion count for a tracked account
• "Verify [sha256-hash]" — look up an HCS attestation by content hash
• "Stats" — live counts of archived tweets, deletions, and monitored accounts

UAID: uaid:aid:98gtn21G8xhjbQg4WYkVHHtyYsf6ko2V9YC2WLuh6rjTnD5J8qKxvux6CLGwMakhLH
HCS topic: 0.0.10301350
Live site: https://signalarchive.org`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const message = extractMessage(body);

    if (!message) {
      return NextResponse.json(
        { message: handleHelp(), agent: "signal-archive", status: "ok" },
        { status: 200 }
      );
    }

    const intent = detectIntent(message);
    let response: string;

    switch (intent) {
      case "recent_deletions":
        response = await handleRecentDeletions(5);
        break;

      case "account_status": {
        const username = extractUsername(message);
        if (username) {
          response = await handleAccountStatus(username);
        } else {
          // No username found — fall back to recent deletions
          response = await handleRecentDeletions(5);
        }
        break;
      }

      case "verify": {
        const hash = extractHash(message);
        if (hash) {
          response = await handleVerify(hash);
        } else {
          response = "Please provide a SHA-256 content hash (64 hex characters) to verify. Example: verify a1b2c3...";
        }
        break;
      }

      case "stats":
        response = await handleStats();
        break;

      default:
        response = handleHelp();
    }

    return NextResponse.json(
      {
        message: response,
        agent: "signal-archive",
        uaid: "uaid:aid:98gtn21G8xhjbQg4WYkVHHtyYsf6ko2V9YC2WLuh6rjTnD5J8qKxvux6CLGwMakhLH",
        status: "ok",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[agent/chat] error:", err);
    return NextResponse.json(
      { message: "Signal Archive agent encountered an error. Please try again.", status: "error" },
      { status: 500 }
    );
  }
}

// GET — agent discovery / health
export async function GET() {
  return NextResponse.json({
    agent: "Signal Archive",
    uaid: "uaid:aid:98gtn21G8xhjbQg4WYkVHHtyYsf6ko2V9YC2WLuh6rjTnD5J8qKxvux6CLGwMakhLH",
    hcsTopicId: "0.0.10301350",
    capabilities: ["tweet-monitoring", "deletion-detection", "hcs-attestation", "severity-scoring"],
    description: "Monitors high-value public figures on X/Twitter. Archives tweets with SHA-256 hashes on Hedera HCS. Detects and attests deletions on-chain with AI severity scoring.",
    site: "https://signalarchive.org",
    status: "active",
  });
}
