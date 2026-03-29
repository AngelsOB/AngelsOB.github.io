# PRD-004: BJCP Hop Flavor Style Targeting

> **Status:** Complete
> **Created:** 2026-03-05
> **Depends on:** None (existing hop radar and BJCP infrastructure are in place)

---

## Context

BeerApp already has two powerful features that exist in isolation:

1. **Hop Flavor Radar** — a 9-axis radar chart (citrus, tropical fruit, stone fruit, berry, floral, grassy, herbal, spice, resin/pine) that estimates the hop flavor profile of a recipe based on hop varieties, doses, and addition timing.

2. **BJCP Style Range Comparison** — arc gauges showing where the recipe's ABV, OG, FG, IBU, and SRM fall within the selected BJCP style's published ranges.

The gap: there's no way for a brewer to see whether their hop bill *flavors* match the style they're brewing. A brewer making an American IPA can see that their IBU is in range, but not whether their hop character is sufficiently citrusy/piney vs. the tropical/fruity profile more typical of a New England IPA.

Connecting these two features — overlaying a "style target" flavor profile on the existing hop radar — would give brewers a visual tool no other calculator offers.

## Goals

- Brewers can see a BJCP-derived "style target" hop flavor profile overlaid on their recipe's hop radar
- The overlay is automatic when a BJCP style is selected — zero extra clicks
- Brewers can quickly see where their hop bill aligns with or diverges from the style expectation
- The feature works entirely client-side with no API calls or external data fetches

## Non-Goals

- Hop oil composition modeling (future PRD — requires gathering oil data for every hop variety)
- Flavor profiles for non-hop ingredients (malt character, yeast esters, etc.)
- AI-powered hop suggestions ("add Citra to get closer to style")
- Custom user-defined style targets
- Scoring/grading the recipe against the style

---

## Design

### Data: Style Flavor Map

A new data file `src/data/bjcpFlavorProfiles.ts` containing a mapping from BJCP style code to a `HopFlavorProfile` (the same 9-axis type used by the hop radar).

Not every BJCP style needs a hop flavor profile — many styles have negligible hop aroma (e.g., American Light Lager, English Mild, Schwarzbier). Only styles where hop character is a meaningful part of the style description get an entry. Styles without an entry simply don't show the overlay.

**Estimated coverage:** ~30-40 styles out of ~130 total. Focus on hop-forward styles:
- Category 12: Pale Commonwealth Beer (Blonde Ale, Australian Sparkling)
- Category 14: Scottish/Irish Ales (minimal — mostly skip)
- Category 18: Pale American Ale (Blonde, Pale, American Amber)
- Category 21: IPA (American, Belgian, Specialty — all get profiles)
- Category 22: Strong American Ale (Double IPA, American Barleywine)
- Category 25: Strong Belgian (Saison — herbal/spice focus)
- Selected German styles with noble hop character (Pilsner, Kölsch)
- Selected English styles with earthy/floral character (ESB, English IPA)

Each profile uses the same 0–5 scale as hop presets. Values represent the **typical/ideal** hop flavor for the style, not hard boundaries.

**Example entries:**

```typescript
// American IPA — citrus/pine forward, moderate tropical
"21A": {
  citrus: 4.0,
  tropicalFruit: 2.5,
  stoneFruit: 1.5,
  berry: 0.5,
  floral: 1.0,
  grassy: 0.5,
  herbal: 0.5,
  spice: 0.5,
  resinPine: 3.5,
},

// New England IPA — tropical/stone fruit dominant, low bitterness character
"21B": {
  citrus: 2.5,
  tropicalFruit: 4.5,
  stoneFruit: 3.5,
  berry: 1.5,
  floral: 0.5,
  grassy: 0.0,
  herbal: 0.0,
  spice: 0.5,
  resinPine: 0.5,
},

// German Pils — floral/herbal/spice (noble hop character)
"5D": {
  citrus: 0.5,
  tropicalFruit: 0.0,
  stoneFruit: 0.0,
  berry: 0.0,
  floral: 3.5,
  grassy: 1.5,
  herbal: 3.0,
  spice: 2.5,
  resinPine: 0.5,
},
```

**Source methodology:** Profiles are derived from BJCP 2021 style descriptions (aroma/flavor sections), cross-referenced with common hop varieties used in each style and their known flavor profiles from our existing hop preset data.

### UI: Overlay on Existing Radar

The `HopFlavorRadar` component already supports multi-series rendering with legend and highlight-on-hover. The implementation:

1. When a BJCP style is selected and a flavor profile exists for it, add a second series to the radar chart:
   - Series 1: "Your Recipe" (existing behavior, current recipe's calculated profile)
   - Series 2: "American IPA Target" (or whatever the style name is) — rendered as a dashed or semi-transparent polygon

2. The style target series uses a distinct visual treatment:
   - Dashed stroke (2px, dash pattern 6,3)
   - Low fill opacity (0.08) vs. the recipe's solid fill (0.15)
   - Neutral/muted color (gray or theme accent) so it doesn't compete with the recipe polygon

3. Legend shows both series. Hovering one dims the other (existing behavior).

4. When no style is selected, or the selected style has no hop flavor profile, the radar renders as it does today (single series, no overlay).

### Integration Point

The overlay is wired in `BetaBuilderPage.tsx` (or wherever the hop radar is rendered), not inside the radar component itself. The radar component remains a generic multi-series renderer.

```
// Pseudocode for the integration
const styleFlavor = recipe.styleCode ? getBjcpFlavorProfile(recipe.styleCode) : null;

const radarSeries = [
  { name: "Your Recipe", flavor: calculatedFlavor },
  ...(styleFlavor ? [{ name: `${styleName} Target`, flavor: styleFlavor }] : []),
];

<HopFlavorRadar series={radarSeries} ... />
```

---

## Implementation Plan

### Phase 1 — Data & Core Integration

1. **Create `src/data/bjcpFlavorProfiles.ts`**
   - Type: `Record<string, HopFlavorProfile>`
   - Getter function: `getBjcpFlavorProfile(code: string): HopFlavorProfile | null`
   - Start with ~15 high-priority styles (all IPAs, Pale Ales, Pilsners)
   - Expand to ~35 styles in a follow-up pass

2. **Wire into hop radar rendering**
   - Look up the selected style's flavor profile
   - Pass it as a second series to `HopFlavorRadar`
   - Use `colorStrategy="index"` so recipe and target get distinct colors

3. **Visual polish**
   - Style target polygon uses dashed stroke
   - Muted color for the target series (don't compete with the recipe)
   - Legend labels: "Your Recipe" vs. "{Style Name} Target"

### Phase 2 — Refinement (Optional)

4. **Contextual hint text**
   - Below the radar, show a one-line hint like "Your recipe leans more tropical than a typical American IPA" when the recipe's dominant axis differs from the style target's dominant axis

5. **Expand style coverage**
   - Add profiles for remaining hop-relevant styles (~20 more)
   - Review and fine-tune initial profiles based on user feedback

---

## Data Quality & Maintenance

The style flavor profiles are subjective approximations, not measured values. They represent "what a typical, well-made example of this style tastes like in terms of hop character" as described by the BJCP guidelines.

To maintain quality:
- Each profile should be reviewed against the BJCP 2021 guideline text for that style
- Profiles should align with the hop varieties commonly used in each style
- The data file should include brief comments explaining the reasoning for each profile
- Values should be conservative (prefer 3.0 over 5.0) — the target represents a typical example, not an extreme one

When the BJCP guidelines are updated (rare — last update was 2021, prior was 2015), the profiles should be reviewed for any style description changes.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Profiles feel wrong to experienced brewers | Medium | Low | Profiles are approximate guides, not scores. UI copy sets expectations ("typical target, not a requirement"). Easy to adjust individual values. |
| Too many styles without profiles feels incomplete | Low | Low | Only show the overlay when a profile exists. No broken state. |
| Visual clutter on radar with two overlapping polygons | Low | Medium | Style target uses dashed/muted rendering. Hover-to-isolate already works. |

---

## Success Criteria

- Style target overlay renders on the hop radar when a hop-relevant BJCP style is selected
- The overlay is visually distinct from the recipe polygon (dashed, muted)
- At least 25 hop-relevant styles have flavor profiles
- No performance impact (data is a small static object, no API calls)
- Zero additional clicks required — the overlay appears automatically

---

## Future Considerations

- **Hop oil composition model** (separate PRD): Once we have per-hop oil data (myrcene, humulene, caryophyllene, linalool, geraniol), the style flavor profiles could be derived from oil composition rather than hand-coded, and the radar could show oil-based flavor predictions
- **Hop suggestion engine**: "Add 30g Citra at whirlpool to move toward the style target" — requires the oil composition model
- **User-editable style targets**: Let users save custom flavor targets for house styles or competition entries
- **Co-humulone bitterness quality**: Model bitterness *quality* (smooth vs. harsh) based on hop co-humulone content — separate from IBU quantity

---

*Last updated: March 2026*
