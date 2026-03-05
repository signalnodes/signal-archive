import {
  TransferTransaction,
  TokenAssociateTransaction,
  Hbar,
  HbarUnit,
  AccountId,
  TokenId,
  Transaction,
} from "@hiero-ledger/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";
import { DONATION_ACCOUNT_ID, USDC_TOKEN_ID, HEDERA_NETWORK } from "./constants";

export type AtomicDonationState =
  | "preparing"
  | "associating"
  | "signing"
  | "confirming";

export type AtomicDonationResult = {
  success: boolean;
  transactionId?: string;
  template?: "A" | "B";
  badgeSerial?: number | null;
  error?: string;
};

/**
 * New atomic batch donation flow (HIP-551).
 *
 * prepare → (associate if needed) → sign → execute
 *
 * onStateChange is called at each phase so the UI can update.
 */
export async function submitAtomicDonation(
  accountId: string,
  asset: "hbar" | "usdc",
  amount: number,
  onStateChange: (state: AtomicDonationState) => void,
): Promise<AtomicDonationResult> {
  const { getConnector } = await import("./connector");
  const connector = await getConnector();
  const signer = connector.getSigner(AccountId.fromString(accountId));

  // --- Prepare ---
  onStateChange("preparing");
  const prepareRes = await fetch("/api/donations/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: accountId, asset, amount }),
  });

  if (!prepareRes.ok) {
    const data = await prepareRes.json().catch(() => ({}));
    return { success: false, error: data.error ?? "Prepare failed" };
  }

  const prepareData = await prepareRes.json();

  // --- Token association (Template B only, if badge not yet associated) ---
  if (prepareData.needsAssociation && prepareData.badgeTokenId) {
    onStateChange("associating");
    try {
      const associateTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([TokenId.fromString(prepareData.badgeTokenId)]);

      const signerAccountId = `hedera:${HEDERA_NETWORK}:${accountId}`;
      await connector.signAndExecuteTransaction({
        signerAccountId,
        transactionList: transactionToBase64String(associateTx),
      });
    } catch {
      // signAndExecuteTransaction often throws even when the tx succeeds on-chain
      // (WalletConnect response parsing). Fall through and retry prepare — if the
      // association went through, prepare will return Template B. If not, it will
      // return needsAssociation: true again and we surface the error then.
    }

    // Always retry prepare after attempting association
    onStateChange("preparing");
    const retryRes = await fetch("/api/donations/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: accountId, asset, amount }),
    });

    if (!retryRes.ok) {
      const data = await retryRes.json().catch(() => ({}));
      return { success: false, error: data.error ?? "Prepare failed" };
    }

    const retryData = await retryRes.json();
    if (retryData.needsAssociation) {
      return { success: false, error: "Token association did not complete. Please try again." };
    }
    Object.assign(prepareData, retryData);
  }

  const { batchId, transactionBytes } = prepareData as {
    batchId: string;
    transactionBytes: string;
    template: "A" | "B";
  };

  // --- Sign user's transfer transaction ---
  onStateChange("signing");
  let signedBytes: string;
  try {
    const txBytes = Uint8Array.from(Buffer.from(transactionBytes, "base64"));
    const tx = Transaction.fromBytes(txBytes);
    const signedTx = await signer.signTransaction(tx);
    signedBytes = Buffer.from(signedTx.toBytes()).toString("base64");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signing failed";
    return { success: false, error: message };
  }

  // --- Execute batch ---
  onStateChange("confirming");
  const executeRes = await fetch("/api/donations/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batchId, signedTransactionBytes: signedBytes }),
  });

  if (!executeRes.ok) {
    const data = await executeRes.json().catch(() => ({}));
    return { success: false, error: data.error ?? "Execute failed" };
  }

  const executeData = await executeRes.json();
  return {
    success: true,
    transactionId: executeData.transactionId,
    template: executeData.template,
    badgeSerial: executeData.badgeSerial ?? null,
  };
}

/**
 * Legacy single-step donation flow (fallback if atomic batch is unavailable).
 * Kept for the /api/donations/verify route compatibility.
 */
export async function submitDonation(
  accountId: string,
  asset: "hbar" | "usdc",
  amount: number,
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  const { getConnector } = await import("./connector");
  const connector = await getConnector();

  let tx: TransferTransaction;
  if (asset === "hbar") {
    tx = new TransferTransaction()
      .addHbarTransfer(
        AccountId.fromString(accountId),
        Hbar.from(-amount, HbarUnit.Hbar),
      )
      .addHbarTransfer(
        AccountId.fromString(DONATION_ACCOUNT_ID),
        Hbar.from(amount, HbarUnit.Hbar),
      );
  } else {
    const microAmount = Math.round(amount * 1_000_000);
    tx = new TransferTransaction()
      .addTokenTransfer(
        TokenId.fromString(USDC_TOKEN_ID),
        AccountId.fromString(accountId),
        -microAmount,
      )
      .addTokenTransfer(
        TokenId.fromString(USDC_TOKEN_ID),
        AccountId.fromString(DONATION_ACCOUNT_ID),
        microAmount,
      );
  }

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

    const verifyResult = await verifyWithRetries(transactionId, accountId, asset);
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
        if (data.status === "pending" && attempt < maxRetries) continue;
        return {
          success: false,
          transactionId,
          error: data.error || "Verification failed",
        };
      }

      const data = await res.json();
      if (data.status === "confirmed") return { success: true, transactionId };
      if (data.status === "pending" && attempt < maxRetries) continue;
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
