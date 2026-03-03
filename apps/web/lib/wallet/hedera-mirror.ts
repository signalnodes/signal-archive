const MIRROR_BASE = "https://mainnet-public.mirrornode.hedera.com";

interface MirrorTransaction {
  consensus_timestamp: string;
  transaction_id: string;
  result: string;
  transfers: Array<{
    account: string;
    amount: number;
  }>;
  token_transfers: Array<{
    token_id: string;
    account: string;
    amount: number;
  }>;
}

interface VerifyResult {
  valid: boolean;
  amount: number;
  consensusTimestamp: string | null;
}

export async function verifyDonationTransaction(
  txId: string,
  recipient: string,
  asset: "hbar" | "usdc",
  tokenId: string,
): Promise<VerifyResult> {
  // Mirror node expects txId in format: 0.0.XXXX-XXXXXXXXX-XXXXXXXXX
  // WalletConnect may return it with @ signs — normalize
  const normalizedTxId = txId.replace(/@/g, "-");

  const res = await fetch(
    `${MIRROR_BASE}/api/v1/transactions/${normalizedTxId}`,
  );

  if (!res.ok) {
    return { valid: false, amount: 0, consensusTimestamp: null };
  }

  const data = await res.json();
  const transactions: MirrorTransaction[] = data.transactions;

  if (!transactions?.length) {
    return { valid: false, amount: 0, consensusTimestamp: null };
  }

  const tx = transactions[0];

  if (tx.result !== "SUCCESS") {
    return { valid: false, amount: 0, consensusTimestamp: null };
  }

  if (asset === "hbar") {
    const recipientTransfer = tx.transfers?.find(
      (t) => t.account === recipient && t.amount > 0,
    );
    if (!recipientTransfer) {
      return { valid: false, amount: 0, consensusTimestamp: null };
    }
    // Amount is in tinybars, convert to HBAR
    const amountHbar = recipientTransfer.amount / 100_000_000;
    return {
      valid: true,
      amount: amountHbar,
      consensusTimestamp: tx.consensus_timestamp,
    };
  }

  // USDC
  const recipientTransfer = tx.token_transfers?.find(
    (t) =>
      t.token_id === tokenId && t.account === recipient && t.amount > 0,
  );
  if (!recipientTransfer) {
    return { valid: false, amount: 0, consensusTimestamp: null };
  }
  // USDC has 6 decimals
  const amountUsdc = recipientTransfer.amount / 1_000_000;
  return {
    valid: true,
    amount: amountUsdc,
    consensusTimestamp: tx.consensus_timestamp,
  };
}
