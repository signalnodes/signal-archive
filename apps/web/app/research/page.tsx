"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/lib/wallet/context";
import { AccountsGrid, type AccountRow } from "@/components/accounts-grid";

interface TrackedWallet {
  id: string;
  address: string;
  chain: string;
  label: string;
  category: string;
  notes: string | null;
  explorerUrl: string | null;
}

function GateNotConnected({ connect, isConnecting }: { connect: () => void; isConnecting: boolean }) {
  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">Research</h1>
      <p className="text-muted-foreground mb-6">Connect your wallet to access Research.</p>
      <Button onClick={connect} disabled={isConnecting}>
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </Button>
    </div>
  );
}

function GateNotSupporter() {
  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3">Research</h1>
      <p className="text-muted-foreground mb-6">
        Research is available to Signal Archive supporters.
      </p>
      <Button asChild>
        <Link href="/support">Support the Archive →</Link>
      </Button>
    </div>
  );
}

function WalletWatchTable({ wallets }: { wallets: TrackedWallet[] }) {
  if (wallets.length === 0) {
    return <p className="text-sm text-muted-foreground">No wallets tracked yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Label</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Chain</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Address</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Notes</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((w) => (
            <tr key={w.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{w.label}</td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{w.chain}</td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{w.category.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                {w.explorerUrl ? (
                  <a
                    href={w.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-xs hover:underline"
                  >
                    {w.address.slice(0, 12)}…{w.address.slice(-6)}
                    <IconExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {w.address.slice(0, 12)}…{w.address.slice(-6)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{w.notes ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResearchPage() {
  const { accountId, isSupporter, isConnecting, connect } = useWallet();
  const [wallets, setWallets] = useState<TrackedWallet[]>([]);
  const [donorAccounts, setDonorAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !isSupporter) return;

    setLoading(true);
    const encoded = encodeURIComponent(accountId);
    Promise.all([
      fetch(`/api/research/wallets?wallet=${encoded}`).then((r) => r.json()),
      fetch(`/api/research/accounts?wallet=${encoded}`).then((r) => r.json()),
    ])
      .then(([walletsData, accountsData]) => {
        setWallets(walletsData.wallets ?? []);
        setDonorAccounts(accountsData.accounts ?? []);
      })
      .finally(() => setLoading(false));
  }, [accountId, isSupporter]);

  if (!accountId) {
    return <GateNotConnected connect={connect} isConnecting={isConnecting} />;
  }

  if (!isSupporter) {
    return <GateNotSupporter />;
  }

  return (
    <div className="container mx-auto max-w-screen-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Research</h1>
      <p className="text-muted-foreground mb-8">Supporter-only intelligence tools.</p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-12">
          {/* Wallet Watch */}
          <section>
            <h2 className="text-lg font-semibold mb-1">Wallet Watch</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Labeled crypto wallets associated with persons of interest.
            </p>
            <WalletWatchTable wallets={wallets} />
          </section>

          {/* Donor-only accounts */}
          <section>
            <h2 className="text-lg font-semibold mb-1">Tracked Accounts (Supporter-Only)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {donorAccounts.length} account{donorAccounts.length !== 1 ? "s" : ""} tracked exclusively for supporters.
            </p>
            {donorAccounts.length > 0 ? (
              <AccountsGrid accounts={donorAccounts} />
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No supporter-only accounts yet. Check back soon.
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
