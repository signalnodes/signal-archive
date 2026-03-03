"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface WalletState {
  accountId: string | null;
  isConnecting: boolean;
  isSupporter: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshSupporterStatus: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSupporter, setIsSupporter] = useState(false);

  const refreshSupporterStatus = useCallback(async (walletAddr?: string) => {
    const addr = walletAddr;
    if (!addr) {
      setIsSupporter(false);
      return;
    }
    try {
      const res = await fetch(`/api/supporters/${encodeURIComponent(addr)}`);
      if (res.ok) {
        const data = await res.json();
        setIsSupporter(data.isSupporter === true);
      }
    } catch {
      // silently fail
    }
  }, []);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const { getConnector } = await import("./connector");
      const connector = await getConnector();
      const session = await connector.openModal();

      // Extract account ID from session namespaces
      const hederaNamespace = session.namespaces?.hedera;
      if (hederaNamespace?.accounts?.[0]) {
        // Format: hedera:mainnet:0.0.XXXX
        const parts = hederaNamespace.accounts[0].split(":");
        const acctId = parts[parts.length - 1];
        setAccountId(acctId);
        await refreshSupporterStatus(acctId);
      }
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting, refreshSupporterStatus]);

  const disconnect = useCallback(async () => {
    try {
      const { resetConnector } = await import("./connector");
      await resetConnector();
    } catch {
      // ignore
    }
    setAccountId(null);
    setIsSupporter(false);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (accountId) {
      await refreshSupporterStatus(accountId);
    }
  }, [accountId, refreshSupporterStatus]);

  // Restore an existing WalletConnect session on page load.
  // connector.init() hydrates signers from localStorage — we just need to
  // read them back into React state so the nav updates without a manual reconnect.
  useEffect(() => {
    async function restoreSession() {
      try {
        const { getConnector } = await import("./connector");
        const connector = await getConnector();
        const signers = connector.signers;
        if (signers && signers.length > 0) {
          const acctId = signers[0].getAccountId().toString();
          if (acctId) {
            setAccountId(acctId);
            await refreshSupporterStatus(acctId);
          }
        }
      } catch {
        // No existing session — normal for first-time visitors
      }
    }
    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider
      value={{
        accountId,
        isConnecting,
        isSupporter,
        connect,
        disconnect,
        refreshSupporterStatus: refreshStatus,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
