import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/beta-builder/:path*",
        destination: "/recipes/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
