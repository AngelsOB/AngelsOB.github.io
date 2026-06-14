# Design roadmap

Where the design work goes next, in priority order. Came out of the June 2026
design critique session — the quick wins from that session are done (radar
label fixes, mobile Menu nav, common picks in the pickers, popular styles,
humanized dates, water source guidance, water intro flow).

## 1. Reactive delight layer ← start here

The aesthetic is playful but mostly static. Make the UI respond. Already
started: the water intro morphs (Auto-Calc CTA glides into the header
compound button, additional-items row glides to the panel foot) — that's the
vocabulary to extend.

Candidates, roughly in feel-per-effort order:

- **In-range stamp** — when a vital slides into the BJCP range, the stat
  card gets a quick letterpress press (translate + hard-shadow squash, same
  physics as the buttons) or a tilted script "in style —" note that stamps in
  once.
- **Rolling numbers** — odometer-style digit ticks on stat cards. Tabular
  nums already guarantee alignment.
- **Radar morph** — animate the flavor polygon between states when hop
  timing changes instead of redrawing.
- **Grain bar settle** — segments slide in and settle with a small spring
  when a grain is added.
- **SRM pin glide** — the color pin moves with a slight overshoot as the
  beer color shifts.

Constraints that make it work: stay inside the brand vocabulary (paper, ink,
stamps, hard offsets). Use the motion tokens (`springSupersoft` for big
surfaces, `springSoft` for small live elements). Play once, never loop. No
confetti. Reduced-motion collapses everything to instant.

## 2. Guided first-brew onboarding

Agreed biggest win overall. The water intro is the working prototype of the
pattern: gate → teach → morph into the real UI. Onboarding is that idea
applied across the builder (template → contextual "why" notes → learn links
→ brew sheet). Also resolves the parked question of when to hide the
source-modal guidance note.

## 3. "Mean brews" / blend mode

Compare mode evolves: select beers and combine them into an average, or
cherry-pick the traits you like from each into a new recipe. This plus
community recipes is the answer to starter templates — the community
provides starting points, the blender makes them yours. Current compare/data
visibility is the groundwork.

## 4. Finish the HS migration, delete legacy

Classic glassmorphic remnants and the 4 palette variants (Default, Vintage,
Midnight, Forest) are confirmed legacy. One design language everywhere;
light/dark only.

## 5. Mobile brew-day mode

Big-type, glanceable, wet-hands brew sheet for phones. Same scope as PRD-006
Phase 3C (Enhanced Brew Mode).

## 6. Recipe identity & share surface

Label-style share/OG cards so shared recipes feel like artifacts instead of
"the builder, read-only". Lean into the existing label-image support.

## 7. Accessibility / reduced-motion pass

Muted-text contrast, 10px eyebrows, script font at small sizes, touch
targets, and a deliberate reduced-motion story for the homepage tour.

## Watch list / small stuff

- Water phase 2: account-page "default source water" selector. The plumbing
  exists — `users/{uid}.lastUsedSourceWater` is written on every pick and
  hydrated on login (sourceWaterPrefs.ts); the selector just edits the same
  field.
- Intro friction: experienced users confirm a target on every new recipe.
  If it grates, skip the intro when a source is remembered AND the style
  resolves a target.
- Generic preset origin flags are wrong in the data (Pale 2-Row 🇨🇦, Wheat
  Malt 🇳🇿) — quirks in presets.generated.grains.json.
- Homepage mobile tour: section eyebrow tucks behind the pinned mock
  mid-scroll.
- Beer-glass recipe "face": tried before, never fit. Only revisit as a flat
  ink-outlined stamp glyph with solid SRM fill; kill it if it still reads
  off-brand.
