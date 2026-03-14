import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, supporters } from "@taa/db";
import { eq } from "drizzle-orm";
import { getMirrorBase } from "@/lib/hedera-server";
import { getHbarUsdRate, hbarToUsd } from "@/lib/hbar-rate";
import { createBatchEntry, type DonationTemplate } from "@/lib/batch-store";

const prepareSchema = z.object({
  walletAddress: z.string().min(1),
  asset: z.enum(["hbar", "usdc"]),
  amount: z.number().positive(),
});

const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
const THRESHOLD_USD = 10;

async function isTokenAssociated(
  accountId: string,
  tokenId: string,
): Promise<boolean> {
  if (!tokenId) return false;
  try {
    const res = await fetch(
      `${getMirrorBase()}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`,
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.tokens) && data.tokens.length > 0;
  } catch {
    return false;
  }
}

async function alreadyHasBadge(walletAddress: string): Promise<boolean> {
  try {
    const db = getDb();
    const rows = await db
      .select({ badgeSerial: supporters.badgeSerial })
      .from(supporters)
      .where(eq(supporters.walletAddress, walletAddress))
      .limit(1);
    return rows.length > 0 && rows[0].badgeSerial !== null;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const parsed = prepareSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    const { walletAddress, asset, amount } = parsed.data;

    if (!DONATION_ACCOUNT_ID) {
      return NextResponse.json(
        { error: "Donation account not configured" },
        { status: 503 },
      );
    }

    // --- Determine USD amount and lock rate ---
    let amountUsd: number;
    let hbarRate: number | null = null;

    if (asset === "hbar") {
      hbarRate = await getHbarUsdRate();
      amountUsd = hbarToUsd(amount, hbarRate);
    } else {
      amountUsd = amount; // 1 USDC = $1
    }

    // --- Determine template ---
    let template: DonationTemplate = "A";
    let needsAssociation = false;

    if (amountUsd >= THRESHOLD_USD && BADGE_TOKEN_ID) {
      const hasBadge = await alreadyHasBadge(walletAddress);
      if (!hasBadge) {
        const associated = await isTokenAssociated(walletAddress, BADGE_TOKEN_ID);
        if (!associated) {
          needsAssociation = true;
        } else {
          template = "B";
        }
      }
    }

    if (needsAssociation) {
      return NextResponse.json({
        needsAssociation: true,
        badgeTokenId: BADGE_TOKEN_ID,
        batchId: null,
      });
    }

    // --- Store batch entry ---
    const batchId = createBatchEntry({
      accountId: walletAddress,
      asset,
      amount,
      amountUsd,
      template,
      hbarRate,
    });

    return NextResponse.json({
      batchId,
      template,
      amountUsd,
      needsAssociation: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Donation prepare error:", message, err);
    return NextResponse.json(
      { error: message || "Internal server error" },
      { status: 500 },
    );
  }
}
