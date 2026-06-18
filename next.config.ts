import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
      // Calculators moved out of /learn into their own tool-first section.
      {
        source: "/learn/abv-calculator",
        destination: "/calculators/abv",
        permanent: true,
      },
      {
        source: "/learn/dilution-calculator",
        destination: "/calculators/dilution",
        permanent: true,
      },
      {
        source: "/learn/boil-off-calculator",
        destination: "/calculators/boil-off",
        permanent: true,
      },
      {
        source: "/learn/carbonation-calculator",
        destination: "/calculators/carbonation",
        permanent: true,
      },
      {
        source: "/learn/hydrometer-calculator",
        destination: "/calculators/hydrometer",
        permanent: true,
      },
      {
        source: "/learn/strike-temp-calculator",
        destination: "/calculators/strike-temp",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
