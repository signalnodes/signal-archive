"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { IconExternalLink, IconCircleCheck, IconAlertCircle, IconLoader2 } from "@tabler/icons-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet/context";
import { SupporterBadge } from "@/components/supporter-badge";
import { DONATION_ACCOUNT_ID, HEDERA_NETWORK } from "@/lib/wallet/constants";
import type { AtomicDonationResult } from "@/lib/wallet/donate";

type Asset = "hbar" | "usdc";
type FlowState =
  | "idle"
  | "connecting"
  | "preparing"
  | "associating"
  | "signing"
  | "confirming"
  | "success"
  | "error";

const HBAR_PRESETS = [50, 100, 250, 500];
const USDC_PRESETS = [5, 10, 25, 50];

function hashscanAccountUrl(accountId: string) {
  return `https://hashscan.io/mainnet/account/${accountId}`;
}

export function DonationCard() {
  const { accountId, connect, refreshSupporterStatus, isSupporter } = useWallet();

  const [asset, setAsset] = useState<Asset>("hbar");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [donationResult, setDonationResult] = useState<AtomicDonationResult | null>(null);

  // If the mirror node was slow and all verifyWithRetries attempts were exhausted,
  // the supporter row might not exist yet when we show the success screen.
  // Poll a few more times in the background so the Research nav link eventually appears.
  useEffect(() => {
    if (flowState !== "success" || isSupporter) return;
    let attempts = 0;
    const id = setInterval(async () => {
      if (++attempts >= 5) { clearInterval(id); return; }
      await refreshSupporterStatus();
    }, 8000);
    return () => clearInterval(id);
  }, [flowState, isSupporter, refreshSupporterStatus]);

  const presets = asset === "hbar" ? HBAR_PRESETS : USDC_PRESETS;
  const effectiveAmount =
    customAmount !== ""
      ? parseFloat(customAmount)
      : (selectedPreset ?? null);

  function handlePreset(v: number) {
    setSelectedPreset(v);
    setCustomAmount("");
  }

  function handleCustomChange(v: string) {
    setCustomAmount(v);
    setSelectedPreset(null);
  }

  function handleAssetSwitch(a: Asset) {
    setAsset(a);
    setSelectedPreset(a === "hbar" ? 50 : 5);
    setCustomAmount("");
  }

  async function handleDonate() {
    if (!effectiveAmount || effectiveAmount <= 0) return;

    if (!accountId) {
      setFlowState("connecting");
      await connect();
      setFlowState("idle");
      return;
    }

    setErrorMsg("");
    setDonationResult(null);

    try {
      const { submitAtomicDonation } = await import("@/lib/wallet/donate");
      const result = await submitAtomicDonation(
        accountId,
        asset,
        effectiveAmount,
        (state) => setFlowState(state),
      );

      if (!result.success) {
        const msg = result.error ?? "Transaction failed";
        setErrorMsg(msg);
        toast.error(msg);
        setFlowState("error");
        return;
      }

      setDonationResult(result);
      await refreshSupporterStatus();
      setFlowState("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(msg);
      toast.error(msg);
      setFlowState("error");
    }
  }

  if (flowState === "success") {
    const awardedBadge = donationResult?.template === "B";
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <IconCircleCheck size={40} className="text-emerald-400" />
          <div>
            <p className="font-semibold text-lg">Thank you for supporting the Archive.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your donation was recorded atomically on Hedera.
            </p>
          </div>
          <SupporterBadge />
          {awardedBadge ? (
            <div className="flex flex-col items-center gap-1">
              <p className="text-xs text-muted-foreground">
                You&apos;re now a Signal Archive supporter.
              </p>
              <p className="text-xs text-emerald-400">
                Supporter badge NFT minted
                {donationResult?.badgeSerial != null
                  ? ` (serial #${donationResult.badgeSerial})`
                  : ""}
                {" "}and transferred to your wallet.
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              You&apos;re now a Signal Archive supporter.
            </p>
          )}
          {donationResult?.transactionId && (
            <a
              href={`https://hashscan.io/${HEDERA_NETWORK}/transaction/${donationResult.transactionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View on HashScan <IconExternalLink size={12} />
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFlowState("idle"); setDonationResult(null); }}
          >
            Donate again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isBusy =
    flowState === "connecting" ||
    flowState === "preparing" ||
    flowState === "associating" ||
    flowState === "signing" ||
    flowState === "confirming";

  const ctaLabel = (() => {
    if (flowState === "connecting") return "Connecting…";
    if (flowState === "preparing") return "Preparing transaction…";
    if (flowState === "associating") return "Associating badge token…";
    if (flowState === "signing") return "Waiting for signature…";
    if (flowState === "confirming") return "Submitting to Hedera…";
    if (!accountId) return "Connect Wallet & Donate";
    return `Donate ${effectiveAmount ? `${effectiveAmount} ${asset.toUpperCase()}` : ""}`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Support the Archive</CardTitle>
        <CardDescription>
          Signal Archive is independently built and funded. Donations support
          archival infrastructure, Hedera network costs, and ongoing
          development.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Asset toggle */}
        <div className="flex gap-2">
          {(["hbar", "usdc"] as Asset[]).map((a) => (
            <Button
              key={a}
              variant={asset === a ? "default" : "outline"}
              size="sm"
              onClick={() => handleAssetSwitch(a)}
              disabled={isBusy}
            >
              {a.toUpperCase()}
            </Button>
          ))}
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-4 gap-2">
          {presets.map((v) => (
            <Button
              key={v}
              variant={selectedPreset === v ? "default" : "outline"}
              size="sm"
              onClick={() => handlePreset(v)}
              disabled={isBusy}
            >
              {asset === "usdc" ? `$${v}` : v}
            </Button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">Custom:</span>
          <input
            type="number"
            min="0"
            step="any"
            aria-label={`Custom ${asset.toUpperCase()} amount`}
            placeholder={asset === "usdc" ? "0.00 USD" : "0 HBAR"}
            value={customAmount}
            onChange={(e) => handleCustomChange(e.target.value)}
            disabled={isBusy}
            className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {/* Error */}
        {flowState === "error" && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <IconAlertCircle size={16} className="shrink-0" />
            <span>{errorMsg || "Something went wrong. Please try again."}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-3">
        <Button
          className="w-full"
          onClick={handleDonate}
          disabled={isBusy || (!effectiveAmount && !!accountId)}
        >
          {isBusy && <IconLoader2 size={16} className="animate-spin" />}
          {ctaLabel}
        </Button>

        {DONATION_ACCOUNT_ID && (
          <a
            href={hashscanAccountUrl(DONATION_ACCOUNT_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Donations go to {DONATION_ACCOUNT_ID}
            <IconExternalLink size={12} />
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
