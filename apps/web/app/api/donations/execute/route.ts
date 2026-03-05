import { NextResponse } from "next/server";
import {
  BatchTransaction,
  TokenMintTransaction,
  TransferTransaction,
  TopicMessageSubmitTransaction,
  AccountId,
  TokenId,
  NftId,
  TransactionReceiptQuery,
} from "@hashgraph/sdk";
import { getDb, donations, supporters } from "@taa/db";
import { eq, sql } from "drizzle-orm";
import {
  getHederaServerClient,
  getOperatorKey,
  getMirrorBase,
} from "@/lib/hedera-server";
import { getBatchEntry, markBatchEntryUsed } from "@/lib/batch-store";
import { setSupporter } from "@/lib/supporter-cache";

const DONATION_ACCOUNT_ID = process.env.NEXT_PUBLIC_DONATION_ACCOUNT_ID ?? "";
const BADGE_TOKEN_ID = process.env.NEXT_PUBLIC_BADGE_TOKEN_ID ?? "";
const DONATION_TOPIC_ID = process.env.HEDERA_DONATION_TOPIC_ID ?? "";

/**
 * Normalize a Hedera transaction ID to HashScan-compatible format.
 * SDK toString(): "0.0.XXXX@seconds.nanos"
 * HashScan format:  "0.0.XXXX-seconds-nanos"
 */
function normalizeTxId(txId: string): string {
  const [payer, timestamp] = txId.split("@");
  if (!timestamp) return txId;
  return `${payer}-${timestamp.replace(".", "-")}`;
}

/**
 * Verify the user's transfer transaction landed on-chain via mirror node.
 * Returns the normalized transaction ID on success, throws on failure.
 */
async function verifyTransferOnChain(
  transferTransactionId: string,
): Promise<string> {
  // Mirror node expects "0.0.XXXX-seconds-nanos" format
  const normalized = transferTransactionId.includes("@")
    ? normalizeTxId(transferTransactionId)
    : transferTransactionId;

  const url = `${getMirrorBase()}/api/v1/transactions/${normalized}`;
  const maxAttempts = 6;
  const delayMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const tx = data.transactions?.[0];
        if (tx && tx.result === "SUCCESS") {
          return normalized;
        }
        if (tx && tx.result && tx.result !== "SUCCESS") {
          throw new Error(`Transfer failed on-chain: ${tx.result}`);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Transfer failed")) {
        throw e;
      }
      // network error — retry
    }
  }
  throw new Error("Transfer not confirmed on mirror node after retries");
}

/** Query mirror node for current badge token total supply. */
async function getBadgeTokenSupply(): Promise<number> {
  const res = await fetch(
    `${getMirrorBase()}/api/v1/tokens/${BADGE_TOKEN_ID}`,
  );
  if (!res.ok) throw new Error(`Mirror node token query failed: ${res.status}`);
  const data = await res.json();
  return Number(data.total_supply ?? 0);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { batchId, transferTransactionId } = body;

    if (!batchId || !transferTransactionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Pre-flight: catch missing env vars early with a clear message
    if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
      console.error("[donate/execute] Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
      return NextResponse.json({ error: "Server misconfigured: missing operator credentials" }, { status: 503 });
    }
    if (!DONATION_TOPIC_ID) {
      console.error("[donate/execute] Missing HEDERA_DONATION_TOPIC_ID");
      return NextResponse.json({ error: "Server misconfigured: missing donation topic" }, { status: 503 });
    }

    // --- Look up batch entry ---
    const entry = getBatchEntry(batchId);
    if (!entry) {
      return NextResponse.json(
        { error: "Batch expired or already used" },
        { status: 400 },
      );
    }

    // --- Verify user's transfer landed on-chain ---
    let confirmedTransferId: string;
    try {
      confirmedTransferId = await verifyTransferOnChain(transferTransactionId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: `Transfer verification failed: ${msg}` }, { status: 400 });
    }

    // Mark as used before executing operator batch to prevent replay.
    markBatchEntryUsed(batchId);

    // --- Set up server-side Hedera client ---
    const client = getHederaServerClient();
    const operatorKey = getOperatorKey();
    const operatorPublicKey = operatorKey.publicKey;
    const operatorId = AccountId.fromString(
      process.env.HEDERA_OPERATOR_ID ?? "",
    );

    // --- Build HCS receipt message ---
    const hcsMessage = JSON.stringify({
      version: 1,
      type: "donation_receipt",
      wallet: entry.accountId,
      asset: entry.asset,
      amount: entry.amount,
      amount_usd: entry.amountUsd,
      transfer_tx: confirmedTransferId,
      supporter_awarded: entry.template === "B",
      badge_serial: null, // filled in DB after batch; on-chain record omits it
      threshold_usd: 5,
      rate_hbar_usd: entry.hbarRate,
      prepared_at: new Date(entry.expiresAt - 5 * 60 * 1000).toISOString(),
    });

    const hcsTx = await new TopicMessageSubmitTransaction()
      .setTopicId(DONATION_TOPIC_ID)
      .setMessage(hcsMessage)
      .setBatchKey(operatorPublicKey)
      .freezeWith(client)
      .sign(operatorKey);

    // --- Build Template B inner transactions (badge mint + NFT transfer) ---
    let mintTx: TokenMintTransaction | null = null;
    let nftTransferTx: TransferTransaction | null = null;
    let predictedSerial: number | null = null;

    if (entry.template === "B" && BADGE_TOKEN_ID) {
      // Pre-determine serial to include in batch NFT transfer
      predictedSerial = (await getBadgeTokenSupply()) + 1;

      mintTx = await new TokenMintTransaction()
        .setTokenId(BADGE_TOKEN_ID)
        .setMetadata([
          Buffer.from(
            JSON.stringify({
              wallet: entry.accountId,
              type: "supporter",
              transfer_tx: confirmedTransferId,
              minted_at: new Date().toISOString(),
            }),
          ),
        ])
        .setBatchKey(operatorPublicKey)
        .freezeWith(client)
        .sign(operatorKey);

      nftTransferTx = await new TransferTransaction()
        .addNftTransfer(
          new NftId(TokenId.fromString(BADGE_TOKEN_ID), predictedSerial),
          operatorId,
          AccountId.fromString(entry.accountId),
        )
        .setBatchKey(operatorPublicKey)
        .freezeWith(client)
        .sign(operatorKey);
    }

    // --- Assemble operator-only BatchTransaction ---
    const innerTxs =
      entry.template === "B" && mintTx && nftTransferTx
        ? [mintTx, nftTransferTx, hcsTx]
        : [hcsTx];

    const batchTx = await new BatchTransaction()
      .setInnerTransactions(innerTxs)
      .freezeWith(client)
      .sign(operatorKey);

    // --- Execute operator batch ---
    const response = await batchTx.execute(client);
    const batchTransactionId = normalizeTxId(response.transactionId.toString());

    // Attempt to get receipt to confirm consensus, but don't fail if it times out.
    let receiptConfirmed = false;
    try {
      await response.getReceipt(client);
      receiptConfirmed = true;
    } catch (receiptErr) {
      console.warn(
        `[donate/execute] Receipt fetch timed out for ${batchTransactionId}:`,
        receiptErr,
      );
    }

    // Get actual mint serial if template B
    let actualSerial: number | null = null;
    if (receiptConfirmed && entry.template === "B" && mintTx?.transactionId) {
      try {
        const mintReceipt = await new TransactionReceiptQuery()
          .setTransactionId(mintTx.transactionId)
          .execute(client);
        actualSerial = mintReceipt.serials?.[0]?.toNumber() ?? predictedSerial;
      } catch {
        actualSerial = predictedSerial;
      }
    } else if (entry.template === "B") {
      actualSerial = predictedSerial;
    }

    // --- Record in DB ---
    const db = getDb();
    const now = new Date();
    const status = receiptConfirmed ? "confirmed" : "pending";

    await db.insert(donations).values({
      walletAddress: entry.accountId,
      transactionId: confirmedTransferId,
      asset: entry.asset,
      amount: String(entry.amount),
      amountUsd: String(entry.amountUsd),
      status,
      confirmedAt: receiptConfirmed ? now : null,
      hbarRate: entry.hbarRate !== null ? String(entry.hbarRate) : null,
      template: entry.template,
      badgeSerial: actualSerial !== null ? String(actualSerial) : null,
      batchTransactionId,
      preparedAt: new Date(entry.expiresAt - 5 * 60 * 1000),
    });

    // Grant supporter status if threshold met (template B always meets it).
    // Grant optimistically even if batch receipt timed out — transfer is confirmed.
    if (entry.template === "B" || entry.amountUsd >= 5) {
      await db
        .insert(supporters)
        .values({
          walletAddress: entry.accountId,
          totalDonatedUsd: String(entry.amountUsd),
          firstDonationAt: now,
          lastDonationAt: now,
          badgeTokenId:
            entry.template === "B" && BADGE_TOKEN_ID ? BADGE_TOKEN_ID : null,
          badgeSerial: actualSerial !== null ? String(actualSerial) : null,
          badgeAwardedAt:
            entry.template === "B" && actualSerial !== null ? now : null,
        })
        .onConflictDoUpdate({
          target: supporters.walletAddress,
          set: {
            totalDonatedUsd: sql`${supporters.totalDonatedUsd} + ${String(entry.amountUsd)}`,
            lastDonationAt: now,
            ...(entry.template === "B" && actualSerial !== null
              ? {
                  badgeTokenId: BADGE_TOKEN_ID,
                  badgeSerial: String(actualSerial),
                  badgeAwardedAt: now,
                }
              : {}),
          },
        });

      setSupporter(entry.accountId, true);
    }

    return NextResponse.json({
      success: true,
      transactionId: confirmedTransferId,
      batchTransactionId,
      template: entry.template,
      badgeSerial: actualSerial,
      amountUsd: entry.amountUsd,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Donation execute error:", message, err);
    return NextResponse.json(
      { error: message || "Internal server error" },
      { status: 500 },
    );
  }
}
