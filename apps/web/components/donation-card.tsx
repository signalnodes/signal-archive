"use client";

import { useState, useEffect } from "react";
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
import { DONATION_ACCOUNT_ID } from "@/lib/wallet/constants";

type Asset = "hbar" | "usdc";
type FlowState =
  | "idle"
  | "connecting"
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

    setFlowState("signing");
    setErrorMsg("");

    try {
      const { submitDonation } = await import("@/lib/wallet/donate");
      const result = await submitDonation(accountId, asset, effectiveAmount);

      if (!result.success) {
        setErrorMsg(result.error ?? "Transaction failed");
        setFlowState("error");
        return;
      }

      setFlowState("confirming");
      // A brief delay to let the confirm animation show
      await new Promise((r) => setTimeout(r, 1000));
      await refreshSupporterStatus();
      setFlowState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setFlowState("error");
    }
  }

  if (flowState === "success") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle className="size-10 text-emerald-400" />
          <div>
            <p className="font-semibold text-lg">Thank you for supporting the Archive.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your donation helps keep Signal Archive running.
            </p>
          </div>
          <SupporterBadge />
          <p className="text-xs text-muted-foreground">
            You&apos;re now a Signal Archive supporter.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFlowState("idle")}
          >
            Donate again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isBusy =
    flowState === "connecting" ||
    flowState === "signing" ||
    flowState === "confirming";

  const ctaLabel = (() => {
    if (flowState === "connecting") return "Connecting…";
    if (flowState === "signing") return "Waiting for signature…";
    if (flowState === "confirming") return "Confirming…";
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
            <AlertCircle className="size-4 shrink-0" />
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
          {isBusy && <Loader2 className="size-4 animate-spin" />}
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
            <ExternalLink className="size-3" />
          </a>
        )}
      </CardFooter>
    </Card>
  );
}
