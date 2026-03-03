import { NextResponse } from "next/server";
import { getDb, supporters } from "@taa/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ walletAddress: string }> },
) {
  try {
    const { walletAddress } = await params;
    const db = getDb();

    const result = await db
      .select()
      .from(supporters)
      .where(eq(supporters.walletAddress, walletAddress))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ isSupporter: false });
    }

    const supporter = result[0];
    return NextResponse.json({
      isSupporter: true,
      totalDonatedUsd: supporter.totalDonatedUsd,
      firstDonationAt: supporter.firstDonationAt,
    });
  } catch (err) {
    console.error("Supporter lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
