/**
 * Registers Signal Archive as an AI agent on the HOL Registry Broker.
 * This is a one-time operation — the resulting UAID is stored in .env as HOL_AGENT_UAID.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/register-hol-agent.ts
 *
 * Requires in .env:
 *   HEDERA_OPERATOR_ID   — Hedera account ID (e.g. 0.0.12345)
 *   HEDERA_OPERATOR_KEY  — ED25519 private key
 *   HEDERA_NETWORK       — "mainnet" or "testnet" (default: testnet)
 *
 * Optional (use a dedicated account to isolate HBAR spend from attestation budget):
 *   HOL_HEDERA_ACCOUNT_ID  — falls back to HEDERA_OPERATOR_ID
 *   HOL_HEDERA_PRIVATE_KEY — falls back to HEDERA_OPERATOR_KEY
 */

import { RegistryBrokerClient } from "@hashgraphonline/standards-sdk";
import {
  HOL_AGENT_PROFILE,
  HOL_AGENT_ENDPOINT,
  HOL_COMMUNICATION_PROTOCOL,
} from "@taa/shared/hol-agent";

const accountId =
  process.env.HOL_HEDERA_ACCOUNT_ID ?? process.env.HEDERA_OPERATOR_ID;
const privateKey =
  process.env.HOL_HEDERA_PRIVATE_KEY ?? process.env.HEDERA_OPERATOR_KEY;
const network = process.env.HEDERA_NETWORK ?? "testnet";

if (!accountId || !privateKey) {
  console.error(
    "HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required (or HOL_HEDERA_ACCOUNT_ID / HOL_HEDERA_PRIVATE_KEY)"
  );
  process.exit(1);
}

const holNetwork =
  network === "mainnet" ? "hedera:mainnet" : "hedera:testnet";

async function main() {
  console.log(`Registering Signal Archive agent on HOL Registry Broker`);
  console.log(`Network : ${holNetwork}`);
  console.log(`Account : ${accountId}`);
  console.log(`Endpoint: ${HOL_AGENT_ENDPOINT}\n`);

  const client = new RegistryBrokerClient();

  console.log("Authenticating with Hedera credentials...");
  await client.authenticateWithLedgerCredentials({
    accountId: accountId!,
    network: holNetwork,
    hederaPrivateKey: privateKey!,
  });
  console.log("Authenticated.\n");

  const payload = {
    profile: HOL_AGENT_PROFILE,
    endpoint: HOL_AGENT_ENDPOINT,
    communicationProtocol: HOL_COMMUNICATION_PROTOCOL,
    registry: "hashgraph-online",
  };

  console.log("Getting registration quote...");
  const quote = await client.getRegistrationQuote(payload);
  console.log("Quote:", JSON.stringify(quote, null, 2));

  const shortfall = (quote as any).shortfallCredits ?? 0;
  if (shortfall > 0) {
    console.log(
      `\nInsufficient credits — shortfall: ${shortfall}. The SDK will auto top-up from HBAR balance.`
    );
    console.log(
      "Ensure the account has enough HBAR. Continuing with auto top-up...\n"
    );
  }

  console.log("Registering agent...");
  const result = await client.registerAgent(payload, {
    autoTopUp: {
      accountId: accountId!,
      network: holNetwork,
      hederaPrivateKey: privateKey!,
    },
  });

  console.log("Registration initiated:", JSON.stringify(result, null, 2));

  const attemptId = (result as any).attemptId ?? (result as any).id;
  if (!attemptId) {
    console.log(
      "\nNo attemptId in response — registration may have completed synchronously."
    );
    const uaid = (result as any).uaid ?? (result as any).agentId;
    if (uaid) printSuccess(uaid);
    return;
  }

  console.log("\nWaiting for registration to complete...");
  const final = await client.waitForRegistrationCompletion(attemptId, {
    intervalMs: 3000,
    timeoutMs: 120_000,
    onProgress: (status: unknown) =>
      console.log("  status:", JSON.stringify(status)),
  });

  const uaid = (final as any).uaid ?? (final as any).agentId;
  if (uaid) {
    printSuccess(uaid);
  } else {
    console.log("\nFinal result:", JSON.stringify(final, null, 2));
    console.log(
      "\nCheck the HOL dashboard for the UAID and add it to .env as HOL_AGENT_UAID"
    );
  }
}

function printSuccess(uaid: string) {
  console.log(`\nAgent registered successfully!`);
  console.log(`UAID: ${uaid}`);
  console.log(`\nAdd to .env:`);
  console.log(`  HOL_AGENT_UAID=${uaid}`);
  console.log(
    `\nView on HOL registry: https://hol.org/registry/agent/${uaid}`
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
