import type { Metadata } from "next";
import { DonationCard } from "@/components/donation-card";
import { SupporterResearchLink } from "./supporter-research-link";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Support Signal Archive with HBAR or USDC. Donations help keep public proof free to inspect and verify.",
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
        Signal Archive keeps public proof free to inspect and verify. Donations help cover Hedera
        network fees, ingestion, storage, monitoring, and ongoing development.
      </p>

      <div className="mb-8 rounded-lg border border-border px-5 py-4">
        <p className="text-sm font-semibold mb-3">What your support enables</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Public archive operations:</strong> ingestion, deletion checks, storage, and proof pages that remain free to inspect</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Hedera attestations:</strong> network fees for anchoring each captured record and deletion event</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0">→</span>
            <span><strong className="text-foreground">Research access:</strong> additional monitoring views and tools for supporters who want to dig deeper</span>
          </li>
        </ul>
      </div>

      <SupporterResearchLink />
      <DonationCard />
    </div>
  );
}
