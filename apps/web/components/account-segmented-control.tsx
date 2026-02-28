"use client";

import { useState } from "react";
import { ActivityFeed } from "@/components/activity-feed";
import { StatementsTab } from "@/components/statements-tab";
import { DeletionsTab } from "@/components/deletions-tab";
import { IdentityTimeline } from "@/components/identity-timeline";
import { AttestationsList } from "@/components/attestations-list";
import type { AccountUI } from "@/lib/adapters/account";

type TabKey = "activity" | "statements" | "deletions" | "identity" | "attestations";

const TABS: { key: TabKey; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "statements", label: "Statements" },
  { key: "deletions", label: "Deletions" },
  { key: "identity", label: "Identity" },
  { key: "attestations", label: "Attestations" },
];

interface AccountSegmentedControlProps {
  account: AccountUI;
}

export function AccountSegmentedControl({ account }: AccountSegmentedControlProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("activity");
  const isFullArchive = account.trackingMode === "FULL_ARCHIVE";

  const isDisabled = (key: TabKey) =>
    !isFullArchive && (key === "statements" || key === "deletions");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const disabled = isDisabled(key);
          const active = activeTab === key;
          return (
            <button
              key={key}
              disabled={disabled}
              onClick={() => !disabled && setActiveTab(key)}
              title={disabled ? "Not tracked for this account's mode." : undefined}
              className={[
                "px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
                active
                  ? "border-foreground text-foreground font-medium"
                  : "border-transparent",
                disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground cursor-pointer",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content — lazy: only active tab is rendered */}
      <div>
        {activeTab === "activity" && <ActivityFeed username={account.currentHandle} />}
        {activeTab === "statements" && isFullArchive && (
          <StatementsTab username={account.currentHandle} />
        )}
        {activeTab === "deletions" && isFullArchive && (
          <DeletionsTab username={account.currentHandle} />
        )}
        {activeTab === "identity" && <IdentityTimeline account={account} />}
        {activeTab === "attestations" && <AttestationsList username={account.currentHandle} />}
      </div>
    </div>
  );
}
