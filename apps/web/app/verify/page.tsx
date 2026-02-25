import type { Metadata } from "next";
import { VerifyInput } from "@/components/verify-input";

export const metadata: Metadata = { title: "Verify Hash" };

export default function VerifyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Verify Content Hash</h1>
      <p className="text-muted-foreground mb-8">
        Enter a SHA-256 content hash to check if a matching tweet is in the archive with a
        valid Hedera attestation.
      </p>
      <VerifyInput />
    </div>
  );
}
