export interface LearnLink {
  href: string;
  label: string;
  description: string;
}

export interface LearnSection {
  title: string;
  links: LearnLink[];
}

// Note: the standalone calculators used to live here under a "Calculators"
// section. They now have their own tool-first section at /calculators/[slug];
// the old /learn/*-calculator URLs 301 there (see next.config.ts).
export const learnNav: LearnSection[] = [
  {
    title: "Getting Started",
    links: [
      {
        href: "/learn/getting-started",
        label: "How To Use Brewing.It",
        description:
          "A quick start guide — what the builder calculates, what to set up first, and how to use the numbers on brew day.",
      },
    ],
  },
  {
    title: "Brewing Science",
    links: [
      {
        href: "/learn/ibu",
        label: "IBU & Bitterness",
        description:
          "Tinseth utilization, whirlpool hops, dry-hop bitterness, and the science of iso-alpha acids.",
      },
      {
        href: "/learn/gravity",
        label: "Gravity & ABV",
        description:
          "How original gravity is built from your grain bill, and the path from OG to FG to alcohol.",
      },
      {
        href: "/learn/water-chemistry",
        label: "Water Chemistry",
        description:
          "Source profiles, style targets, the auto-calculator, and what ions do to your beer.",
      },
      {
        href: "/learn/mash-ph",
        label: "Mash pH",
        description:
          "The proton deficit model — predicting and adjusting mash pH from grain and water chemistry.",
      },
      {
        href: "/learn/mash-temperature",
        label: "Mash Temperature",
        description:
          "Enzyme kinetics, beta- vs alpha-amylase, and why mash temperature controls fermentability.",
      },
      {
        href: "/learn/yeast-starters",
        label: "Yeast Starters",
        description:
          "Viability decay, pitching rates, and the White vs Braukaiser growth models explained.",
      },
      {
        href: "/learn/hop-flavor",
        label: "Hop Flavor Radar",
        description:
          "A 9-axis flavor model that maps hop character beyond IBU — citrus, tropical, resin, and more.",
      },
    ],
  },
];

/** Flat list of all learn page hrefs for sitemap generation */
export const allLearnRoutes = learnNav.flatMap((section) =>
  section.links.map((link) => link.href)
);
