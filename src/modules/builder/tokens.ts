// Hop & Skip design tokens — JS mirror for inline styles and JSX-driven SVG.
//
// Surface colors (cream, cream-2, paper, ink, muted) resolve to CSS variables
// so inline styles automatically switch when dark mode toggles. The CSS
// variables themselves are defined in src/modules/builder/styles/tokens.css.
//
// Ingredient accents (malt, hops, water, yeast, roast, honey) stay literal
// hex — they don't change between light and dark mode by design.

export const hsTokens = {
  // surfaces — resolve via CSS var so dark mode flips them
  cream: "var(--hs-cream)",
  cream2: "var(--hs-cream-2)",
  paper: "var(--hs-paper)",
  ink: "var(--hs-ink)",
  muted: "var(--hs-muted)",

  // ingredient accents — literal, brand-constant
  malt: "#f2c14e",
  roast: "#d4452c",
  water: "#2b6fb8",
  hops: "#4a8a3d",
  yeast: "#ee7755",
  honey: "#ffd97a",

  // font families — CSS variables from next/font (defined in app/layout.tsx).
  // Never reference the family names directly; next/font rewrites them.
  display:
    "var(--font-archivo-black), var(--font-space-grotesk), system-ui, sans-serif",
  body: "var(--font-space-grotesk), system-ui, sans-serif",
  script: "var(--font-caveat), cursive",
  mono: "var(--font-ibm-plex-mono), ui-monospace, monospace",

  // shadows — use the ink CSS var so they shift to cream in dark mode
  sh1: "2px 2px 0 var(--hs-ink)",
  sh2: "3px 3px 0 var(--hs-ink)",
  sh3: "4px 4px 0 var(--hs-ink)",
  sh4: "6px 6px 0 var(--hs-ink)",
} as const;

export type HSIngredient =
  | "malt"
  | "roast"
  | "water"
  | "hops"
  | "yeast"
  | "honey"
  | "muted"
  | "ink";

export const hsAccent: Record<HSIngredient, string> = {
  malt: hsTokens.malt,
  roast: hsTokens.roast,
  water: hsTokens.water,
  hops: hsTokens.hops,
  yeast: hsTokens.yeast,
  honey: hsTokens.honey,
  muted: hsTokens.muted,
  ink: hsTokens.ink,
};

// Map the existing classic builder section data-accent values to HS
// ingredient colors. Mirrors the rules in overrides.css.
export const hsBrewAccentMap = {
  grain: hsTokens.malt,
  hops: hsTokens.hops,
  mash: hsTokens.roast,
  water: hsTokens.water,
  yeast: hsTokens.yeast,
  fermentation: hsTokens.honey,
  equipment: hsTokens.muted,
  targets: hsTokens.ink,
} as const;
