"use client";

import { useState } from "react";
import Link from "next/link";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { WalletButton } from "@/components/wallet-button";
import { useWallet } from "@/lib/wallet/context";

const NAV_LINKS = [
  { href: "/deletions", label: "Deletions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/verify", label: "Verify" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
];

export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const { isSupporter } = useWallet();

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden sm:flex items-center gap-5 text-sm ml-auto">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
        {isSupporter && (
          <Link
            href="/research"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Research
          </Link>
        )}
        <WalletButton />
      </nav>

      {/* Mobile hamburger */}
      <button
        className="sm:hidden ml-auto p-1 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <IconX size={20} /> : <IconMenu2 size={20} />}
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex flex-col gap-1 z-50">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {isSupporter && (
            <Link
              href="/research"
              className="text-sm py-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Research
            </Link>
          )}
          <div className="pt-2 mt-1 border-t border-border">
            <WalletButton />
          </div>
          <div className="pt-2 mt-1 border-t border-border">
            <form method="GET" action="/search">
              <input
                name="q"
                type="text"
                placeholder="Search..."
                className="w-full h-9 rounded-md border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </form>
          </div>
        </div>
      )}
    </>
  );
}
