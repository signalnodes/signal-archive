import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@taa/db", "@taa/shared"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
