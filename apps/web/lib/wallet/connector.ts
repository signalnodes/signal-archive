import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";
import { WALLETCONNECT_PROJECT_ID, HEDERA_NETWORK } from "./constants";

let connector: DAppConnector | null = null;

const APP_METADATA = {
  name: "Signal Archive",
  description: "Public statements. Permanent record.",
  url: "https://signalarchive.org",
  icons: ["https://signalarchive.org/favicon.ico"],
};

export async function getConnector(): Promise<DAppConnector> {
  if (connector) return connector;

  const network =
    HEDERA_NETWORK === "mainnet" ? LedgerId.MAINNET : LedgerId.TESTNET;

  connector = new DAppConnector(
    APP_METADATA,
    network,
    WALLETCONNECT_PROJECT_ID,
  );

  await connector.init();
  return connector;
}

export function getExistingConnector(): DAppConnector | null {
  return connector;
}

export async function resetConnector(): Promise<void> {
  if (connector) {
    try {
      await connector.disconnectAll();
    } catch {
      // ignore disconnect errors during cleanup
    }
    connector = null;
  }
}
