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

  const isValid = hash.trim().length === 64;

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
      <Button type="submit" disabled={!isValid}>
        Verify
      </Button>
    </form>
  );
}
