const COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-orange-500",
  "bg-pink-600",
  "bg-cyan-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-indigo-600",
  "bg-teal-600",
];

interface LetterAvatarProps {
  username: string;
  size?: "sm" | "md" | "lg";
}

export function LetterAvatar({ username, size = "md" }: LetterAvatarProps) {
  const colorIndex =
    username.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    COLORS.length;
  const letter = username[0]?.toUpperCase() ?? "?";
  const sizeClass =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "lg"
        ? "w-14 h-14 text-xl"
        : "w-9 h-9 text-sm";

  return (
    <div
      className={`${COLORS[colorIndex]} ${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none`}
      aria-hidden
    >
      {letter}
    </div>
  );
}
