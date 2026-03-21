"use client";

import { useState } from "react";

export function MediaAttachment({ url, index }: { url: string; index: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate block"
      >
        [media {index + 1}] {url}
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`Media attachment ${index + 1}`}
        className="rounded-md max-h-96 object-cover border border-border"
        onError={() => setFailed(true)}
      />
    </a>
  );
}
