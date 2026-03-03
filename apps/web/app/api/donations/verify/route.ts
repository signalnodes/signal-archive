import { NextResponse } from "next/server";
import { getDb, donations, supporters } from "@taa/db";
import { eq, sql } from "drizzle-orm";
import { verifyDonationTransaction } from "@/lib/wallet/hedera-mirror";
import { setSupporter, MIN_HBAR, MIN_USDC } from "@/lib/supporter-cache";

const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID ?? "0.0.456858";

function meetsThreshold(asset: "hbar" | "usdc", amount: number): boolean {
  return asset === "usdc" ? amount >= MIN_USDC : amount >= MIN_HBAR;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionId, walletAddress, asset } = body;

    if (!transactionId || !walletAddress || !asset) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (asset !== "hbar" && asset !== "usdc") {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    const db = getDb();

    // Already confirmed — return immediately
    const existing = await db
      .select()
      .from(donations)
      .where(eq(donations.transactionId, transactionId))
      .limit(1);

    if (existing.length > 0 && existing[0].status === "confirmed") {
      return NextResponse.json({ status: "confirmed", transactionId });
    }

    // For new or pending donations, always re-check the mirror node
    // so retries can upgrade pending → confirmed
    const verification = await verifyDonationTransaction(
      transactionId,
      DONATION_ACCOUNT_ID,
      asset,
      USDC_TOKEN_ID,
    );

    const now = new Date();

    if (!verification.valid) {
      // Mirror node hasn't indexed the tx yet — record as pending if new
      if (existing.length === 0) {
        await db.insert(donations).values({
          walletAddress,
          transactionId,
          asset,
          amount: "0",
          status: "pending",
        });
      }
      return NextResponse.json({ status: "pending", transactionId });
    }

    const amountUsd = asset === "usdc" ? String(verification.amount) : null;

    // Insert or upgrade donation to confirmed
    if (existing.length === 0) {
      await db.insert(donations).values({
        walletAddress,
        transactionId,
        asset,
        amount: String(verification.amount),
        amountUsd,
        status: "confirmed",
        confirmedAt: now,
      });
    } else {
      await db
        .update(donations)
        .set({
          amount: String(verification.amount),
          amountUsd,
          status: "confirmed",
          confirmedAt: now,
        })
        .where(eq(donations.transactionId, transactionId));
    }

    // Only grant supporter status if the donation meets the minimum threshold
    if (meetsThreshold(asset, verification.amount)) {
      await db
        .insert(supporters)
        .values({
          walletAddress,
          totalDonatedUsd: amountUsd ?? "0",
          firstDonationAt: now,
          lastDonationAt: now,
        })
        .onConflictDoUpdate({
          target: supporters.walletAddress,
          set: {
            totalDonatedUsd: amountUsd
              ? sql`${supporters.totalDonatedUsd} + ${amountUsd}`
              : supporters.totalDonatedUsd,
            lastDonationAt: now,
          },
        });

      // Populate cache immediately so refreshSupporterStatus() is instant
      setSupporter(walletAddress, true);
    }

    return NextResponse.json({ status: "confirmed", transactionId });
  } catch (err) {
    console.error("Donation verification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
