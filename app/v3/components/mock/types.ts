// Shared types across the bone-based mock builder.

export type TabKey =
  | "fermentables"
  | "hops"
  | "water"
  | "mash"
  | "yeast"
  | "boil";

// Highlight is the global state that drives every bone simultaneously.
// One value, many bones — each bone consumes the highlight to decide
// which of its named states to be in.
//
// - "none": default. All bones in normal positions. Mock card at full
//   opacity.
// - "fermentables" / "hops" / "water" / "mash" / "yeast": that section
//   is the focal point. Mock card recedes. The section's content
//   bones lift forward and their key sub-bones (BillStack,
//   HopVisualizer, SaltCells, etc.) explode out further.
// - "brewsheet": Brewsheet bone morphs into its panel state. Mock card
//   recedes.
export type Highlight =
  | "none"
  | "fermentables"
  | "hops"
  | "water"
  | "mash"
  | "yeast"
  | "brewsheet";

export interface TabDef {
  key: TabKey;
  label: string;
  enabled: boolean;
}

export const TABS: TabDef[] = [
  { key: "fermentables", label: "Fermentables", enabled: true },
  { key: "hops", label: "Hops", enabled: true },
  { key: "water", label: "Water", enabled: true },
  { key: "mash", label: "Mash", enabled: true },
  { key: "yeast", label: "Yeast", enabled: true },
  { key: "boil", label: "Boil", enabled: false },
];

// Does this highlight target a tab section (so its content should be
// raised + sub-bones exploded)?
export function highlightToTab(h: Highlight): TabKey | null {
  switch (h) {
    case "fermentables":
    case "hops":
    case "water":
    case "mash":
    case "yeast":
      return h;
    default:
      return null;
  }
}
