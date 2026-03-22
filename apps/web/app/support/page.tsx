import type { Metadata } from "next";
import { DonationCard } from "@/components/donation-card";
import { SupporterResearchLink } from "./supporter-research-link";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Support Signal Archive with HBAR or USDC. Donors get access to Research — wallet tracking, donor-only account monitoring, and more.",
  openGraph: {
    title: "Support Signal Archive",
    description:
      "Support Signal Archive with HBAR or USDC. Keep public accountability infrastructure running.",
  },
};

export default function SupportPage() {
  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-3 font-editorial">Support the Archive</h1>
      <p className="text-muted-foreground leading-relaxed mb-6">
        Signal Archive is an independent, non-commercial project. No ads, no subscriptions, no
        corporate backing. Donations go directly toward Hedera network fees, infrastructure
        costs, and keeping the lights on.
      </p>

      <div className="mb-8 rounded-lg border border-border px-5 py-4">
        <p className="text-sm font-semibold mb-3">What supporters unlock</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Research section</strong> — donor-only view with additional tracked accounts and analysis tools</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Wallet Watch</strong> — labeled crypto wallets tied to persons of interest, with chain explorer links</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Donor-only account tracking</strong> — accounts monitored exclusively for supporters</span>
          </li>
        </ul>
      </div>

      <SupporterResearchLink />
      <DonationCard />
    </div>
  );
}
