import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { WalletConnectModal } from "@walletconnect/modal";
import { LedgerId } from "@hashgraph/sdk";
import { WALLETCONNECT_PROJECT_ID, HEDERA_NETWORK } from "./constants";

// WalletConnect Explorer IDs for Hedera-native wallets
const HASHPACK_WC_ID =
  "a29498d225fa4b13468ff4d6cf4ae0ea4adcbd95f07ce8a843a1dee10b632f3f";
const KABILA_WC_ID =
  "c40c24b39500901a330a025938552d70def4890fffe9bd315046bd33a2ece24d";

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

  // Override the internal modal to feature Hedera-native wallets at the top
  connector.walletConnectModal = new WalletConnectModal({
    projectId: WALLETCONNECT_PROJECT_ID,
    explorerRecommendedWalletIds: [HASHPACK_WC_ID, KABILA_WC_ID],
  });

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
