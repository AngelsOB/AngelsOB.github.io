import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/beta-builder/:path*",
        destination: "/recipes/:path*",
        permanent: true,
      },
      {
        source: "/r/seed/seed-american-ipa",
        destination: "/r/west-coast-ipa",
        permanent: true,
      },
      {
        source: "/r/seed/seed-saison",
        destination: "/r/farmhouse-saison",
        permanent: true,
      },
      {
        source: "/r/seed/seed-irish-stout",
        destination: "/r/irish-stout",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
