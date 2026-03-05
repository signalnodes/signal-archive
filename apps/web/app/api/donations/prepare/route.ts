import { NextResponse } from "next/server";
import {
  TransferTransaction,
  TransactionId,
  Hbar,
  HbarUnit,
  AccountId,
  TokenId,
} from "@hashgraph/sdk";
import { getDb, supporters } from "@taa/db";
import { eq } from "drizzle-orm";
import { getHederaServerClient, getOperatorKey, getMirrorBase } from "@/lib/hedera-server";
import { getHbarUsdRate, hbarToUsd } from "@/lib/hbar-rate";
import { createBatchEntry, type DonationTemplate } from "@/lib/batch-store";

const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const USDC_TOKEN_ID = process.env.NEXT_PUBLIC_USDC_TOKEN_ID ?? "0.0.456858";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
const THRESHOLD_USD = 5;

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
    const body = await request.json();
    const { walletAddress, asset, amount } = body;

    if (!walletAddress || !asset || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (asset !== "hbar" && asset !== "usdc") {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

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

    // --- Build user's transfer transaction ---
    const client = getHederaServerClient();
    const operatorKey = getOperatorKey();

    let transferTx: TransferTransaction;
    if (asset === "hbar") {
      transferTx = new TransferTransaction()
        .addHbarTransfer(
          AccountId.fromString(walletAddress),
          Hbar.from(-amount, HbarUnit.Hbar),
        )
        .addHbarTransfer(
          AccountId.fromString(DONATION_ACCOUNT_ID),
          Hbar.from(amount, HbarUnit.Hbar),
        );
    } else {
      const microAmount = Math.round(amount * 1_000_000);
      transferTx = new TransferTransaction()
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(walletAddress),
          -microAmount,
        )
        .addTokenTransfer(
          TokenId.fromString(USDC_TOKEN_ID),
          AccountId.fromString(DONATION_ACCOUNT_ID),
          microAmount,
        );
    }

    // Pin to a single node before freezing.
    //
    // freezeWith(client) normally creates one signed-transaction copy per Hedera
    // node. DAppSigner.signTransaction re-serializes the body via _makeTransactionBody
    // to get bytes for the wallet to sign. If nodeAccountIds is not populated after
    // fromBytes on the client, it signs a body without a nodeAccountId — but
    // _signedTransactions.get(0) has the body WITH the nodeAccountId.
    // Those two bodies differ → INVALID_SIGNATURE when Hedera validates the inner tx.
    //
    // Pinning to one node means there is only one copy in the TransactionList.
    // The wallet signs exactly the body in _signedTransactions.get(0). No mismatch.
    const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";
    const pinnedNode = AccountId.fromString(network === "mainnet" ? "0.0.3" : "0.0.3");
    transferTx
      .setTransactionId(TransactionId.generate(AccountId.fromString(walletAddress)))
      .setNodeAccountIds([pinnedNode])
      .setBatchKey(operatorKey.publicKey)
      .freezeWith(client);
    const transactionBytes = Buffer.from(transferTx.toBytes()).toString(
      "base64",
    );

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
      transactionBytes,
      template,
      amountUsd,
      needsAssociation: false,
    });
  } catch (err) {
    console.error("Donation prepare error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

