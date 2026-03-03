import { NextRequest, NextResponse } from "next/server";
import { getDb, trackedWallets } from "@taa/db";
import { isSupporter } from "@/lib/supporter-cache";

export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("wallet");
  if (!walletAddress) {
    return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
  }

  const supported = await isSupporter(walletAddress);
  if (!supported) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const wallets = await db
    .select()
    .from(trackedWallets)
    .orderBy(trackedWallets.category, trackedWallets.label);

  return NextResponse.json({ wallets });
}
