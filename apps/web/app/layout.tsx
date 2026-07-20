export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Inter, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/lib/wallet/context";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "https://signalarchive.org/rss.xml",
    },
  },
  title: {
    template: "%s | Signal Archive",
    default: "Signal Archive: Public Statements. Permanent Proof.",
  },
  description:
    "Signal Archive preserves public statements from high-impact accounts and anchors cryptographic proof to Hedera. Anyone can verify what was captured, when it was captured, and whether it was later deleted.",
  openGraph: {
    siteName: "Signal Archive",
    type: "website",
    title: "Signal Archive: Public Statements. Permanent Proof.",
    description:
      "Signal Archive preserves public statements from high-impact accounts and anchors cryptographic proof to Hedera. Anyone can verify what was captured, when it was captured, and whether it was later deleted.",
    url: "https://signalarchive.org",
  },
  twitter: {
    card: "summary_large_image",
    site: "@signalarchives",
    title: "Signal Archive: Public Statements. Permanent Proof.",
    description:
      "Public statements preserved with cryptographic proof anchored to Hedera.",
  },
  metadataBase: new URL("https://signalarchive.org"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${newsreader.variable} ${ibmPlexMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <WalletProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster position="bottom-right" theme="dark" />
        </WalletProvider>
      </body>
    </html>
  );
}
