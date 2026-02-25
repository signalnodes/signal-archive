import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@taa/db", "@taa/shared"],
};

export default nextConfig;
