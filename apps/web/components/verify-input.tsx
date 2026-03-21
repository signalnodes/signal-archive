"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function VerifyInput({ defaultHash }: { defaultHash?: string }) {
  const [hash, setHash] = useState(defaultHash ?? "");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = hash.trim().toLowerCase();
    if (trimmed.length === 64) {
      router.push(`/verify/${trimmed}`);
    }
  }

  const isValid = /^[0-9a-fA-F]{64}$/.test(hash.trim());
  const isUnchanged = defaultHash !== undefined && hash.trim().toLowerCase() === defaultHash.toLowerCase();

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={hash}
        onChange={(e) => setHash(e.target.value)}
        placeholder="Enter SHA-256 content hash (64 hex characters)"
        className="font-mono text-xs"
        maxLength={64}
        spellCheck={false}
      />
      <Button type="submit" disabled={!isValid || isUnchanged}>
        Verify
      </Button>
    </form>
  );
}
