export interface LearnLink {
  href: string;
  label: string;
  description: string;
}

export interface LearnSection {
  title: string;
  links: LearnLink[];
}

export const learnNav: LearnSection[] = [
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
  {
    title: "Calculators",
    links: [
      {
        href: "/learn/abv-calculator",
        label: "ABV Calculator",
        description:
          "Calculate alcohol by volume from original and final gravity readings.",
      },
      {
        href: "/learn/dilution-calculator",
        label: "Dilution",
        description:
          "Figure out how much water to add to hit your target gravity.",
      },
      {
        href: "/learn/boil-off-calculator",
        label: "Boil-Off",
        description:
          "Calculate post-boil volume from pre-boil measurements and target OG.",
      },
      {
        href: "/learn/carbonation-calculator",
        label: "Carbonation",
        description:
          "Find the right PSI for your desired CO₂ volumes at serving temperature.",
      },
      {
        href: "/learn/hydrometer-calculator",
        label: "Hydrometer Correction",
        description:
          "Correct gravity readings for sample temperature differences.",
      },
    ],
  },
];

/** Flat list of all learn page hrefs for sitemap generation */
export const allLearnRoutes = learnNav.flatMap((section) =>
  section.links.map((link) => link.href)
);
