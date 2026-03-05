/**
 * Server-side Hedera client singleton.
 * Only imported by API routes (never in client components).
 */

import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";

let _client: Client | null = null;

export function getHederaServerClient(): Client {
  if (_client) return _client;

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";

  if (!operatorId || !operatorKey) {
    throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required");
  }

  _client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  _client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromStringED25519(operatorKey),
  );

  return _client;
}

export function getOperatorKey(): PrivateKey {
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorKey) throw new Error("HEDERA_OPERATOR_KEY is required");
  return PrivateKey.fromStringED25519(operatorKey);
}

export function getMirrorBase(): string {
  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet";
  return network === "mainnet"
    ? "https://mainnet-public.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";
}
