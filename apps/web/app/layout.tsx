import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletProvider } from "@/lib/wallet/context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/rss+xml": "https://signalarchive.org/rss.xml",
    },
  },
  title: {
    template: "%s | Signal Archive",
    default: "Signal Archive: Public Statements. Permanent Record.",
  },
  description:
    "Signal Archive monitors public figures, captures their statements, and creates cryptographic proof anchored to the Hedera Consensus Service. Deletion is never the last word.",
  openGraph: {
    siteName: "Signal Archive",
    type: "website",
    title: "Signal Archive: Public Statements. Permanent Record.",
    description:
      "Signal Archive monitors public figures, captures their statements, and creates cryptographic proof anchored to the Hedera Consensus Service. Deletion is never the last word.",
    url: "https://signalarchive.org",
  },
  twitter: {
    card: "summary",
    title: "Signal Archive: Public Statements. Permanent Record.",
    description:
      "Monitoring public figures. Cryptographic proof of every tweet. Deletion is never the last word.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <WalletProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
