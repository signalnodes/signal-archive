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

    if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
      console.error("[donate/execute] Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
      return NextResponse.json({ error: "Server misconfigured: missing operator credentials" }, { status: 503 });
    }
    if (!DONATION_TOPIC_ID) {
      console.error("[donate/execute] Missing HEDERA_DONATION_TOPIC_ID");
      return NextResponse.json({ error: "Server misconfigured: missing donation topic" }, { status: 503 });
    }

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

    markBatchEntryUsed(batchId);

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
      badge_serial: null,
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

    // --- Template B: mint badge in the batch; transfer separately after ---
    //
    // The NFT transfer is intentionally NOT included in the batch. Hedera
    // validates all inner transactions before execution, so a transfer
    // referencing serial N would fail validation because the NFT doesn't
    // exist yet at validation time (it will be minted by mintTx in the
    // same batch). Running the transfer as a follow-up transaction avoids
    // this ordering issue.
    let mintTx: TokenMintTransaction | null = null;
    let predictedSerial: number | null = null;

    if (entry.template === "B" && BADGE_TOKEN_ID) {
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
    }

    // --- Assemble batch: [mintTx, hcsTx] for Template B, [hcsTx] for A ---
    const innerTxs =
      entry.template === "B" && mintTx
        ? [mintTx, hcsTx]
        : [hcsTx];

    const batchTx = await new BatchTransaction()
      .setInnerTransactions(innerTxs)
      .freezeWith(client)
      .sign(operatorKey);

    // --- Execute operator batch ---
    const response = await batchTx.execute(client);
    const batchTransactionId = normalizeTxId(response.transactionId.toString());

    // Get receipt — this confirms consensus. Distinguish real failures from
    // timeouts: a ReceiptStatusError means the batch was rejected at consensus.
    let receiptConfirmed = false;
    try {
      await response.getReceipt(client);
      receiptConfirmed = true;
    } catch (receiptErr) {
      const errMsg = receiptErr instanceof Error ? receiptErr.message : String(receiptErr);
      // If the error contains a status code it's a consensus failure, not a timeout
      if (errMsg.includes("status") || errMsg.toLowerCase().includes("failed")) {
        console.error(`[donate/execute] Batch receipt FAILED for ${batchTransactionId}:`, receiptErr);
      } else {
        console.warn(`[donate/execute] Batch receipt timeout for ${batchTransactionId}:`, errMsg);
      }
    }

    // Get actual mint serial from the mint receipt
    let actualSerial: number | null = null;
    if (entry.template === "B") {
      if (receiptConfirmed && mintTx?.transactionId) {
        try {
          const mintReceipt = await new TransactionReceiptQuery()
            .setTransactionId(mintTx.transactionId)
            .execute(client);
          actualSerial = mintReceipt.serials?.[0]?.toNumber() ?? predictedSerial;
        } catch {
          actualSerial = predictedSerial;
        }
      } else {
        actualSerial = predictedSerial;
      }
    }

    // --- Transfer minted NFT to user (separate from batch to avoid serial validation issue) ---
    if (receiptConfirmed && entry.template === "B" && actualSerial !== null && BADGE_TOKEN_ID) {
      try {
        const nftTransferTx = await new TransferTransaction()
          .addNftTransfer(
            new NftId(TokenId.fromString(BADGE_TOKEN_ID), actualSerial),
            operatorId,
            AccountId.fromString(entry.accountId),
          )
          .freezeWith(client)
          .sign(operatorKey);
        const nftResponse = await nftTransferTx.execute(client);
        await nftResponse.getReceipt(client);
        console.log(`[donate/execute] NFT serial #${actualSerial} transferred to ${entry.accountId}`);
      } catch (nftErr) {
        // Transfer failed but badge was minted — log and continue.
        // The NFT sits in the operator treasury and can be transferred manually.
        console.error(`[donate/execute] NFT transfer failed for serial #${actualSerial}:`, nftErr);
      }
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
