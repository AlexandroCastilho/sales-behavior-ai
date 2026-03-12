import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: 20 * 1024 * 1024,
  },
};

export default nextConfig;
