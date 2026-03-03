"use client";

import Image from "next/image";
import { useState } from "react";
import { LetterAvatar } from "@/components/letter-avatar";

interface AccountAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const SIZE_PX = { sm: 28, md: 36, lg: 56 };

export function AccountAvatar({ username, avatarUrl, size = "md" }: AccountAvatarProps) {
  const src = avatarUrl ?? `https://unavatar.io/twitter/${username}`;
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return <LetterAvatar username={username} size={size} />;
  }

  const px = SIZE_PX[size];
  const sizeClass =
    size === "sm" ? "w-7 h-7" : size === "lg" ? "w-14 h-14" : "w-9 h-9";

  return (
    <Image
      src={src}
      alt={`@${username}`}
      width={px}
      height={px}
      className={`${sizeClass} rounded-full object-cover shrink-0`}
      onError={() => setImgError(true)}
      unoptimized
    />
  );
}
