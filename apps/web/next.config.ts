import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@taa/db", "@taa/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "unavatar.io" },
    ],
  },
  turbopack: {},
};

export default nextConfig;
