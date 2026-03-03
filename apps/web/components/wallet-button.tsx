"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Wallet, LogOut, ChevronDown, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet/context";
import { SupporterBadge } from "@/components/supporter-badge";

export function WalletButton() {
  const { accountId, isConnecting, isSupporter, connect, disconnect } =
    useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!accountId) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={connect}
        disabled={isConnecting}
      >
        <Wallet className="size-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        {isSupporter && <SupporterBadge />}
        <span className="font-mono text-xs">{accountId}</span>
        <ChevronDown className="size-3" />
      </Button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-background/95 backdrop-blur p-1 shadow-md">
          {isSupporter && (
            <Link
              href="/research"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setDropdownOpen(false)}
            >
              <FlaskConical className="size-4" />
              Research
            </Link>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={async () => {
              setDropdownOpen(false);
              await disconnect();
            }}
          >
            <LogOut className="size-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
