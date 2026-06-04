export const EASE = {
  smooth: [0.22, 1, 0.36, 1] as const,
  hover: [0.34, 1.56, 0.64, 1] as const,
};

export const COPY = {
  hero: {
    kicker: "hello, brewer —",
    headline: "A simpler place to brew.",
    subhead:
      "A recipe builder with live math, brew-day calculators, and the science behind them.",
    primaryCta: "Start a recipe",
    primaryHref: "/recipes/new",
    socialProof: (recipeCount: number | string) =>
      `${recipeCount} recipes in our collection · 20+ live calculations · 0 spreadsheets needed`,
    annotation: "live as you edit",
  },
  community: {
    eyebrow: "Community",
    title: "Recipes other brewers are pouring.",
    endLink: "Browse all →",
    endHref: "/browse",
  },
  brewDay: {
    eyebrow: "Recipe builder",
    title: "Pick a style. Drop in grains and hops. Watch the math work.",
    body: "Build the recipe the way you'd build it in a notebook, but the math runs as you go. Adjust grain weights and OG updates. Add a late hop and IBU shifts. Change your equipment profile and boil-off recalculates. Everything is connected.",
    pills: [
      {
        label: "Live math",
        desc: "OG, FG, ABV, IBU, SRM update on every edit.",
      },
      {
        label: "Water chem",
        desc: "Mineral additions, salt targets, mash pH.",
      },
      {
        label: "Style targets",
        desc: "BJCP in-range gauges per metric.",
      },
      {
        label: "Equipment-aware",
        desc: "Boil-off, deadspace, absorption built in.",
      },
    ],
    cta: "Open the recipe builder",
    ctaHref: "/recipes/new",
  },
  math: {
    kicker: "brew-day math without the spreadsheet —",
    eyebrow: "Calculators",
    title: "The math you'll reach for.",
    questions: [
      "Did I hit my OG?",
      "What do I do now that I didn't?",
      "How long do I boil?",
      "How much priming sugar?",
    ],
    closer: "When you have a question, it's here.",
    endLink: "See all 7 calculators →",
    endHref: "/calculators",
  },
  library: {
    eyebrow: "Your library",
    title: "Pick up where you left off.",
    previewNote:
      "preview only — wires to your real recipes when this ships to /",
  },
  learn: {
    eyebrow: "Brewing science",
    title: "The research behind the numbers.",
    endLink: "All articles →",
    endHref: "/learn",
  },
};
