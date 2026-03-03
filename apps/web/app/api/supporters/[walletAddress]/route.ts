import { NextResponse } from "next/server";
import { getDb, supporters } from "@taa/db";
import { eq } from "drizzle-orm";
import { isSupporter, setSupporter } from "@/lib/supporter-cache";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ walletAddress: string }> },
) {
  try {
    const { walletAddress } = await params;

    // Fast path: cache hit
    const cached = await isSupporter(walletAddress);
    if (!cached) {
      return NextResponse.json({ isSupporter: false });
    }

    // Full DB read only needed for the extra fields (totalDonatedUsd etc.)
    const db = getDb();
    const result = await db
      .select()
      .from(supporters)
      .where(eq(supporters.walletAddress, walletAddress))
      .limit(1);

    if (result.length === 0) {
      // Cache was stale — correct it
      setSupporter(walletAddress, false);
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
