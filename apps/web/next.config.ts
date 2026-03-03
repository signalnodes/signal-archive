import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@taa/db", "@taa/shared"],
  async redirects() {
    return [
      {
        source: "/donate",
        destination: "/support",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "unavatar.io" },
    ],
  },
  turbopack: {},
};

export default nextConfig;
