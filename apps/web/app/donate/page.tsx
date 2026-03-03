import type { Metadata } from "next";
import { DonationCard } from "@/components/donation-card";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support Signal Archive with HBAR or USDC. Donations fund archival infrastructure, Hedera network costs, and ongoing development.",
  openGraph: {
    title: "Donate — Signal Archive",
    description:
      "Support Signal Archive with HBAR or USDC. Keep public accountability infrastructure running.",
  },
};

export default function DonatePage() {
  return (
    <div className="container mx-auto max-w-screen-sm px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-3">Support the Archive</h1>
      <p className="text-muted-foreground leading-relaxed mb-8">
        Signal Archive is an independent, non-commercial project. No ads, no paywalls, no
        corporate backing. Donations go directly toward Hedera network fees, infrastructure
        costs, and keeping the lights on.
      </p>
      <DonationCard />
    </div>
  );
}
