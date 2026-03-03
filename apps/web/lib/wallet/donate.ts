import {
  TransferTransaction,
  Hbar,
  HbarUnit,
  AccountId,
  TokenId,
} from "@hiero-ledger/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";
import { DONATION_ACCOUNT_ID, USDC_TOKEN_ID, HEDERA_NETWORK } from "./constants";

export function buildHbarTransfer(from: string, amountHbar: number) {
  return new TransferTransaction()
    .addHbarTransfer(
      AccountId.fromString(from),
      Hbar.from(-amountHbar, HbarUnit.Hbar),
    )
    .addHbarTransfer(
      AccountId.fromString(DONATION_ACCOUNT_ID),
      Hbar.from(amountHbar, HbarUnit.Hbar),
    );
}

export function buildUsdcTransfer(from: string, amountUsdc: number) {
  // USDC on Hedera has 6 decimals
  const microAmount = Math.round(amountUsdc * 1_000_000);
  return new TransferTransaction()
    .addTokenTransfer(
      TokenId.fromString(USDC_TOKEN_ID),
      AccountId.fromString(from),
      -microAmount,
    )
    .addTokenTransfer(
      TokenId.fromString(USDC_TOKEN_ID),
      AccountId.fromString(DONATION_ACCOUNT_ID),
      microAmount,
    );
}

export async function submitDonation(
  accountId: string,
  asset: "hbar" | "usdc",
  amount: number,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const { getConnector } = await import("./connector");
  const connector = await getConnector();

  const tx =
    asset === "hbar"
      ? buildHbarTransfer(accountId, amount)
      : buildUsdcTransfer(accountId, amount);

  const signerAccountId = `hedera:${HEDERA_NETWORK}:${accountId}`;

  try {
    const result = await connector.signAndExecuteTransaction({
      signerAccountId,
      transactionList: transactionToBase64String(tx),
    });

    const transactionId = result.result?.transactionId;
    if (!transactionId) {
      return { success: false, error: "No transaction ID returned" };
    }

    // Verify via our API with retries for mirror node lag
    const verifyResult = await verifyWithRetries(
      transactionId,
      accountId,
      asset,
    );
    return verifyResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    return { success: false, error: message };
  }
}

async function verifyWithRetries(
  transactionId: string,
  walletAddress: string,
  asset: "hbar" | "usdc",
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const maxRetries = 3;
  const delayMs = 4000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    try {
      const res = await fetch("/api/donations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, walletAddress, asset }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.status === "pending" && attempt < maxRetries) {
          continue;
        }
        return {
          success: false,
          transactionId,
          error: data.error || "Verification failed",
        };
      }

      const data = await res.json();
      if (data.status === "confirmed") {
        return { success: true, transactionId };
      }
      if (data.status === "pending" && attempt < maxRetries) {
        continue;
      }
      return { success: true, transactionId };
    } catch {
      if (attempt === maxRetries) {
        return {
          success: true,
          transactionId,
          error: "Transaction sent but verification pending",
        };
      }
    }
  }

  return {
    success: true,
    transactionId,
    error: "Transaction sent but verification still pending",
  };
}
