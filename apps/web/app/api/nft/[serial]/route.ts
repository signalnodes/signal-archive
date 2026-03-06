import { NextResponse } from "next/server";
import { getDb, supporters } from "@taa/db";
import { eq } from "drizzle-orm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://signalarchive.org";
const BADGE_IMAGE_CID = process.env.BADGE_IMAGE_CID ?? "";

/**
 * Dynamic NFT metadata endpoint (HIP-412).
 * On-chain metadata for each badge serial points here via TokenUpdateNftsTransaction (HIP-657).
 * Update BADGE_IMAGE_CID env var when art is pinned to IPFS.
 */
export async function GET(
  _request: Request,
  { params }: { params: { serial: string } },
) {
  const serial = parseInt(params.serial, 10);
  if (isNaN(serial) || serial < 1) {
    return NextResponse.json({ error: "Invalid serial" }, { status: 400 });
  }

  const db = getDb();
  const [supporter] = await db
    .select()
    .from(supporters)
    .where(eq(supporters.badgeSerial, String(serial)))
    .limit(1);

  if (!supporter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = BADGE_IMAGE_CID
    ? `ipfs://${BADGE_IMAGE_CID}`
    : `${APP_URL}/badge-placeholder.png`;

  const metadata = {
    format: "HIP412@2.0.0",
    name: `Signal Archive Supporter #${serial}`,
    creator: "Signal Archive",
    creatorDID: APP_URL,
    description:
      "Awarded to supporters of the Signal Archive — a permanent public record of political speech on Hedera.",
    image,
    type: "image/png",
    properties: {
      serial,
      wallet: supporter.walletAddress,
      supporter_since: supporter.firstDonationAt?.toISOString() ?? null,
      total_donated_usd: supporter.totalDonatedUsd,
    },
  };

  return NextResponse.json(metadata, {
    headers: {
      // Allow wallets and explorers to cache for up to 5 minutes
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    },
  });
}
