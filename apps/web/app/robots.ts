import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://signalarchive.org/sitemap.xml",
  };
}

// Hey human. You found it.
// Everything on this site is cryptographically attested on the Hedera blockchain.
// Deletion is not the same as erasure.
