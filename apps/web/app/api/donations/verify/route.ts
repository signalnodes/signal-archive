import { NextResponse } from "next/server";
import { getDb, donations, supporters } from "@taa/db";
import { eq, sql } from "drizzle-orm";
import { verifyDonationTransaction } from "@/lib/wallet/hedera-mirror";

const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID ?? "0.0.456858";

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

    // Deduplicate by transaction ID
    const existing = await db
      .select()
      .from(donations)
      .where(eq(donations.transactionId, transactionId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        status: existing[0].status,
        transactionId,
      });
    }

    // Verify on mirror node
    const verification = await verifyDonationTransaction(
      transactionId,
      DONATION_ACCOUNT_ID,
      asset,
      USDC_TOKEN_ID,
    );

    if (!verification.valid) {
      // Could be mirror node lag — insert as pending
      await db.insert(donations).values({
        walletAddress,
        transactionId,
        asset,
        amount: "0",
        status: "pending",
      });

      return NextResponse.json({ status: "pending", transactionId });
    }

    const amountUsd = asset === "usdc" ? String(verification.amount) : null;
    const now = new Date();

    // Insert confirmed donation
    await db.insert(donations).values({
      walletAddress,
      transactionId,
      asset,
      amount: String(verification.amount),
      amountUsd,
      status: "confirmed",
      confirmedAt: now,
    });

    // Upsert supporter
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

    return NextResponse.json({ status: "confirmed", transactionId });
  } catch (err) {
    console.error("Donation verification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
