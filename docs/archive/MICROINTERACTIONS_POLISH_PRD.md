# Microinteractions Polish PRD — Curated playful microanimation opportunities

## Context

The site already has a solid base of motion — custom `AnimatedValue` count-ups, springy modal open-from-click-origin, gooey segmented toggles, and the HopSkip framer-motion morphs ([MainSectionMorph](src/modules/hopskip/components/builder/MainSectionMorph.tsx), [HelperCardMorph](src/modules/hopskip/components/builder/HelperCardMorph.tsx)). But interaction polish is unevenly distributed: some surfaces feel crafted, others feel snappy-but-flat. This PRD is a curated catalog of places where small, deliberate microinteractions would make the product feel more playful and high-end — without leaning hard on beer imagery. The motion language of HopSkip is the visual north star: confident, springy easing curves; tight 125–250ms timings; layout FLIP over snap.

This is a **flag-only menu**, not an implementation plan. No specs, no code, no timings — just curated locations + a description of what each moment should feel like. Pick items off the menu over time; each is independent and can ship alone.

## Goals

1. Raise the polish floor across the highest-frequency interactions (ingredient adds, stat recalcs, number-field edits) so the product feels crafted at every touch.
2. Identify 2–3 deliberate signature moments — places where a more memorable microinteraction would earn its visibility (save, copy share link, publish).
3. Standardize cross-cutting patterns (card hover, form validation, confirmations, page transitions) so the polish is consistent rather than spot-applied.
4. Use HopSkip's existing motion vocabulary as the baseline — do not introduce a third dialect or a new animation library.

## Non-goals

- Visual redesign. Color, type, spacing, and layout are not in scope here.
- Adding new animation libraries beyond the already-installed `framer-motion`. No GSAP, no react-spring.
- Touching anything in the deprecated `OLD_*` files or otherwise spending time on the quarantined `/betabuilder/*` UI surfaces that have HopSkip-native replacements.
- Changing brewing math, calculators, recipe domain models, sharing logic, or any data layer.
- A single coordinated motion overhaul. This is a menu of independent improvements; nothing here has to ship as a bundle.

## Guiding principles

- **HopSkip motion language is the baseline.** Reuse `hs-slide-from-*`, `hs-lift-card`, framer-motion layout FLIP, and the `[0.22, 1, 0.36, 1]` / `[0.85, 0, 0.15, 1]` easings.
- **Restraint > novelty.** Most moments should be invisible — felt, not noticed. Reserve "you'll remember this" energy for the 2–3 signature moments below.
- **Brewing flourishes earn their place.** Default to neutral elegant motion. Use brewing-specific imagery (foam, hop cones, SRM glow) only on moments where it would genuinely delight, not decorate.
- **Frequency dictates investment.** A microinteraction the user hits 50 times in a recipe gets *less* visible animation, not more — it has to age gracefully. The save button can afford to be a moment; the "+ add hop" button must be quick and quiet by the 100th use.
- **No fake progress.** Every loading state must be honest about whether it's deterministic.

## Scope note: HopSkip is the live UI

The live builder is the **HopSkip module** (`src/modules/hopskip/`). All ingredient flows, preset pickers, range bars, and section navigation reference the components there. A few surfaces (Share modal, Brew Session) still live in the classic `beta-builder` module but are scheduled to migrate — opportunities flagged in those surfaces should be designed so the motion language transfers cleanly when they move. Anything prefixed `OLD_*` in the repo is historical and is ignored here.

---

## Tier 1 — The "every session" moments

These are the highest-leverage opportunities because users hit them constantly. Polish here raises the floor of the whole product.

### 1. Ingredient added → row enters the bill
- **Where:** [FermentableSection.tsx](src/modules/hopskip/components/builder/FermentableSection.tsx) (`LedgerRow`, `MobileAddRow`), [HopSection.tsx](src/modules/hopskip/components/builder/HopSection.tsx), [YeastSection.tsx](src/modules/hopskip/components/builder/YeastSection.tsx). The picker that triggers this lives in [src/modules/hopskip/components/modals/](src/modules/hopskip/components/modals/).
- **Today:** New rows snap into existence after the preset picker closes. No transition, no sense of where the row came from.
- **What it should feel like:** The new row arrives. It slides down from above the bill by a few pixels and fades in over ~180ms; rows already in the bill shift to make room with a layout FLIP (framer-motion already loaded by HopSkip — extend the pattern from `HelperCardMorph`) so nothing teleports. If the picker is still closing, the row's entrance is staggered behind the modal exit so it doesn't compete. Numbers in the stat readouts pick up the change in the same beat as the row settling — recalc and reveal feel like one event, not two.
- **Why it matters:** This is the *most repeated action* in the entire builder. Currently the most jarring.

### 2. Stats recalc → arrival inside BJCP style range
- **Where:** The BJCP visual stack — [BJCPStyleRail.tsx](src/modules/hopskip/components/BJCPStyleRail.tsx), [BJCPRangeRow.tsx](src/modules/hopskip/components/BJCPRangeRow.tsx), [HSRangeBar.tsx](src/modules/hopskip/components/HSRangeBar.tsx) — plus the inline stat readouts in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx). The shared `AnimatedValue` count-up lives in [AnimatedValue.tsx](src/modules/beta-builder/presentation/components/AnimatedValue.tsx).
- **Today:** The numeric value count-up is already great. The position indicator on the range bar likely snaps to a new x-coordinate; the same accent highlight fires whether the user just landed inside the style target or merely drifted within it.
- **What it should feel like:** When a stat *crosses into* the active style's target range, the indicator dot on the range bar eases to its new position over ~220ms (not jumps) and the range band itself does a quiet "yes, that's the move" pulse — slightly warmer, lingers a half-beat longer than a routine recalc. When a stat *leaves* the range, the indicator cools (a faint outline that tones rather than alarms — never red, never urgent). Numeric value highlight and range-bar position move on the same curve, so user perceives them as one event. The signal is *contextual* — the same numeric change can feel different depending on whether it brought you closer to your goal.
- **Why it matters:** Turns dumb stat updates into a *coaching moment*. Tight feedback loop between an ingredient change and "you're getting warmer."

### 3. Number field interactions — the most-touched control
- **Where:** [HSNumberField.tsx](src/modules/hopskip/components/HSNumberField.tsx). Used everywhere the user enters or scrubs a numeric value — grain weight, hop amount/time, yeast pitch count, water mineral targets, every calculator (`AbvCalculator`, `IbuCalculator`, `CarbonationCalculator`).
- **Today:** Standard numeric input behaviour.
- **What it should feel like:** On focus, the field's accent border eases in (not toggles), and a small stepper affordance appears on hover — discoverable but not always visible so the field stays calm at rest. Each step (arrow key or click) does a brief flash on the new value; holding the arrow accelerates with a soft visual pulse that matches the cadence. When a *programmatic* change arrives (a preset sets the field, a calculator pipes a result back in), the value uses an `AnimatedValue`-style interpolation so it *settles* rather than snaps. If the entered value is out of a reasonable range (e.g. 9000 IBU, 200% grain), the field shakes once — friendly, not punitive.
- **Why it matters:** The single most-repeated interaction in the entire builder. Polish here compounds across every other section, calculator, and modal.

### 4. Preset picker → list reveal & sift
- **Where:** [FermentablePresetModal.tsx](src/modules/hopskip/components/modals/FermentablePresetModal.tsx), [HopPresetModal.tsx](src/modules/hopskip/components/modals/HopPresetModal.tsx), [YeastPresetModal.tsx](src/modules/hopskip/components/modals/YeastPresetModal.tsx)
- **Today:** The shared modal shell scales in beautifully (`ModalOverlay` is excellent); the inner list of presets snaps in fully populated.
- **What it should feel like:** As the modal lands, the preset cards do a tight ~25ms-stagger cascade — only the 6–8 rows visible in the viewport need to animate, not the whole list. Search/filter changes feel like a sift: matching cards stay anchored, non-matching gently shrink/fade out, new matches glide in (framer-motion `AnimatePresence` with `popLayout`, same primitive used in `MainSectionMorph`). The hop card flavor radar tooltip in the hop picker gains a faint springy pop when it appears so it feels like it *belongs* to the card it's attached to.
- **Why it matters:** The picker is the moment of choice — the user is browsing, comparing. Stagger + sift turns a "list of things" into "a browsable surface."

### 5. SRM color swatch → ingredient-driven shifts
- **Where:** Color swatch rendering inside [FermentableSection.tsx](src/modules/hopskip/components/builder/FermentableSection.tsx) (per-grain swatch in `LedgerRow`) and the recipe-level SRM display rendered by [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx).
- **Today:** Color updates instantly when grains change.
- **What it should feel like:** The swatch interpolates smoothly between colors over ~250ms when SRM shifts, the way an actual liquid would deepen/lighten with added grain. On hover, the swatch gains a faint inner highlight (a single subtle gloss line, *not* a full beer-glass treatment) — enough to suggest depth without committing to skeuomorphism.
- **Why it matters:** One of the few places brewing-specific motion earns its place — color *is* the thing here. This is a quiet brewing flourish, not a loud one.

---

## Tier 2 — High-impact, less frequent

These are moments users hit once or twice per session, where polish creates a memorable impression without aging poorly.

### 6. Save recipe → signature moment
- **Where:** Save button in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) (recipe creation/save flow)
- **Today:** Button shows the standard spinner; toast slides in from bottom right confirming success.
- **What it should feel like:** A **signature moment candidate**. The button itself becomes the feedback — when save resolves, the spinner morphs into a checkmark that briefly fills the button width with a confident bounce, then the button returns to its idle state. The toast still fires for confirmation, but the *button-as-feedback* makes the action feel sealed at the point of the click. No confetti, no particles — restraint is the brand.
- **Why it matters:** Save is the moment of commitment. It should feel decisive and high-end.

### 7. Copy share link → "Copied!" replacement
- **Where:** [ShareModal.tsx](src/modules/sharing/ShareModal.tsx) (currently invoked from the classic builder only; share UI is scheduled to migrate into HopSkip — design the motion so it transfers cleanly)
- **Today:** Button text swaps to "Copied!" and back after 2s.
- **What it should feel like:** A **signature moment candidate**. The button's icon morphs from link → check in one continuous motion (~200ms), the label crossfades to "Copied!" with the icon, and the button briefly takes on a softer "completed" state — almost like the button is acknowledging the user. The whole thing reverts after ~1.5s with a subtle exhale (icon slides back, label crossfades). The motion communicates *something was given to you*, not just *we changed the text*.
- **Why it matters:** Copy-link is the most common share action and a moment of social pride — the user is about to send their recipe to someone.

### 8. Make Public toggle → recipe "goes live"
- **Where:** [ShareModal.tsx](src/modules/sharing/ShareModal.tsx) (same caveat as #7 — currently classic-only, design to transfer)
- **Today:** Button shows loading state, then toast.
- **What it should feel like:** A **signature moment candidate** — the most earned brewing flourish in the app. When a recipe is published, the share modal's preview block briefly takes on a faint warm halo that fades — the way a sign coming on at dusk reveals itself. The toggle button itself shifts decisively into a "public" state; the share URL field that appears below it slides in (not fades), giving the user something tangible to grab. This is the one place where the brewing connotation (*your recipe is now out in the world*) justifies a small, restrained brewing-adjacent flourish (warm glow ≈ amber light).
- **Why it matters:** This is the moment a private artifact becomes a public one. It should feel like opening a door, not flipping a checkbox.

### 9. Fork recipe → "this is yours now"
- **Where:** [HSForkButton.tsx](src/modules/hopskip/components/public/HSForkButton.tsx), with the fork side-effect logic in [useForkRecipe.ts](src/modules/hopskip/components/public/useForkRecipe.ts). Mounted in [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx) when `isShared === true`.
- **Today:** Button → loading → navigation to the new recipe.
- **What it should feel like:** The fork button shows loading honestly, but the navigation that follows isn't a hard cut — the new recipe page enters with the recipe name doing a brief handwritten-underline scribble (reusing the existing `scribble-in` keyframe), signaling "this is yours, write on it." Doesn't need to be loud — the framing of the entrance does the work.
- **Why it matters:** Fork is a moment of inheritance. The motion should communicate ownership transfer, not just "we made a copy."

### 10. Brew session task tick
- **Where:** Brew session checklist in [src/modules/beta-builder/presentation/components/brew-session/](src/modules/beta-builder/presentation/components/brew-session/) — `BrewInstructionsSection.tsx` for step ticks, `BrewSessionPage.tsx` for the session shell. (Brew session is still on the classic stack — when it migrates to HopSkip the motion should port.)
- **Today:** Standard checkbox toggle.
- **What it should feel like:** Ticking a step does a satisfying inline check — the checkbox fills with the accent color from the inside out (radial, ~180ms), the task label dims slightly and gains a faint strikethrough that *draws on* rather than appears, and the next unchecked step subtly emphasizes itself (a faint indent shift or accent border on the left) so the eye is guided forward without nagging. Completing the *last* step earns a tiny "we did it" gesture — a brief soft pulse on the session card, no confetti.
- **Why it matters:** Brew sessions are long sessions of repeated check-the-box moments. Each tick should feel earned.

---

## Tier 3 — System polish (broad effect)

These aren't individual moments — they're patterns that, when applied consistently, raise the polish floor across many surfaces.

### 11. Recipe card hover — extend `.hs-lift-card` everywhere
- **Where:** `.hs-lift-card` is the established HopSkip pattern (see [tokens.css](src/modules/hopskip/styles/tokens.css)). Apply across every clickable card surface: [HSBrowsePage.tsx](src/modules/hopskip/components/public/HSBrowsePage.tsx) browse cards, recipe list cards, version-history cards, the [HSCard.tsx](src/modules/hopskip/components/HSCard.tsx) base component, and any card surfaces in the brew session view that still live on the classic side.
- **Today:** Some cards have ad-hoc hover treatments (shadow, border tint); many have none.
- **What it should feel like:** A consistent lift across every clickable card surface — `translate(-2px, -3px) scale(1.02)` with the springy curve. Hover-target cards become a visual category the user learns to trust. The few cards that *aren't* clickable should be deliberately flat so the affordance is clear by absence.
- **Why it matters:** Consistency is high-end. Right now hover is a coin flip.

### 12. Inline form validation feedback
- **Where:** [Input.tsx](src/components/Input.tsx) — currently only accepts a boolean `error` prop with no message slot. Used throughout builder, share, auth.
- **Today:** Red border on error, but the error *text* is the parent's problem and is mostly absent. Users see a red border with no hint why.
- **What it should feel like:** The Input grows a small inline message slot that fades down ~6px when an error appears (not slides — slides feel violent on form fields). Success states get a quiet check (when meaningful — not every valid field needs a checkmark; only ones the user actively had to fix). The red border itself transitions in over ~120ms instead of toggling instantly — feels less like being scolded.
- **Why it matters:** Currently the lowest-polish surface in the app and the one most directly tied to user trust.

### 13. Replace `confirm()` dialogs → consistent confirmation moments
- **Where:** Browser `confirm()` calls in HopSkip sections ([MashSection.tsx](src/modules/hopskip/components/builder/MashSection.tsx), [YeastSection.tsx](src/modules/hopskip/components/builder/YeastSection.tsx), [FermentationSection.tsx](src/modules/hopskip/components/builder/FermentationSection.tsx) — "replace schedule" prompts). Delete recipe uses a styled modal in [RecipeListPage.tsx](src/modules/beta-builder/presentation/components/RecipeListPage.tsx). Unpublish currently has no confirmation in `ShareModal.tsx`.
- **Today:** Inconsistent. Browser `confirm()` dialogs break the immersion completely.
- **What it should feel like:** All destructive/irreversible actions land in the same kind of small confirmation modal — built on top of the existing `ModalOverlay` (or `HSModal`) so the modal *scales from the trigger that caused it*. The destructive button inside the modal is the only red surface, and gets a tiny "are you sure" hesitation — its hover state takes a touch longer to engage than other buttons, communicating gravity without a literal countdown.
- **Why it matters:** This is the most jarring polish gap. One `confirm()` dialog undoes minutes of polish.

### 14. Page / route transitions
- **Where:** App-level navigation between `/recipes`, `/browse`, `/betabuilder`, `/learn` — see [ClientShell.tsx](app/ClientShell.tsx), no `loading.tsx` files exist.
- **Today:** Hard navigation cuts. No skeleton, no progress, no transition.
- **What it should feel like:** A thin top-of-page progress sliver appears immediately on click (honest indeterminate motion, ~3px tall, accent color); content fades in over ~180ms once mounted with the page heading doing a quick `hs-slide-from-left` micro-entrance so the user feels *arrival* rather than appearance. Don't over-design — the page is still the destination, not the journey.
- **Why it matters:** Currently the app feels like a series of pages; with transitions it feels like one product.

### 15. Empty states — gentle entrance motion
- **Where:** [HSBrowsePage.tsx](src/modules/hopskip/components/public/HSBrowsePage.tsx) ("empty shelf —"), empty ingredient bills in [FermentableSection.tsx](src/modules/hopskip/components/builder/FermentableSection.tsx)/[HopSection.tsx](src/modules/hopskip/components/builder/HopSection.tsx)/[YeastSection.tsx](src/modules/hopskip/components/builder/YeastSection.tsx), and the classic [RecipeListPage.tsx](src/modules/beta-builder/presentation/components/RecipeListPage.tsx) empty-state ("Your brew log is empty") until that view is brought into HopSkip.
- **Today:** Static illustrations + copy.
- **What it should feel like:** When an empty state mounts, the illustration does a one-time gentle settle — a subtle `hs-fade-in-up` already in the system, but with the *CTA button* arriving a beat after the illustration and copy. The sequence (illustration → copy → CTA) gives the moment a small narrative arc instead of appearing all at once. No looping animation — empty states should not be aquariums.
- **Why it matters:** Empty states are first impressions for new users. They should feel intentional, not abandoned.

---

## Honorable mentions (lower priority, worth noting)

- **Anonymous sign-in / auth banner dismiss**: wherever HopSkip shows the "sign in to save" prompt (typically the top of [HopSkipBuilder.tsx](src/modules/hopskip/components/HopSkipBuilder.tsx)). Currently the banner disappears on dismiss. Could slide-out + collapse the space it occupied. Low effort.
- **Theme toggle**: currently `transition-colors`. Could do a quick radial wipe from the toggle button so the theme change feels emanating, not blanket. Risk of feeling gimmicky — only worth doing if it lands gracefully on first try.
- **BJCP range bar stat entrance**: when a style is first selected and the range bars populate, the active indicator dots could stagger in (~30ms apart) so the user feels the ranges *settling onto* the recipe. Subtle but adds polish.
- **Style selector → matched-style chip**: when the user picks a style via [BJCPStyleRail.tsx](src/modules/hopskip/components/BJCPStyleRail.tsx), a small chip could appear next to the recipe name with a `hs-slide-from-left` — gives the user a tangible "you're targeting this" anchor.
- **Builder title bar entry**: [BuilderTitleBar.tsx](src/modules/hopskip/components/builder/BuilderTitleBar.tsx) (kicker + colored rule). When a section first mounts, the colored rule could draw on from left over ~180ms — quick brand moment that costs nothing.
- **Scribble underline on recipe name**: the classic builder already has a delayed handwritten underline (a great existing detail). Worth porting into the HopSkip recipe-name field and re-using on the fork destination, so the moment carries across the migration.

---

## What's *already* great — don't regress

These are working at or near 10/10. Listed here so they don't get accidentally regressed while polishing the rest:

- `AnimatedValue` smooth count-ups with accent highlight ([AnimatedValue.tsx](src/modules/beta-builder/presentation/components/AnimatedValue.tsx)) — shared by both stacks
- `ModalOverlay` scale-from-click-origin with app-shell scale-down ([ModalOverlay.tsx](src/modules/beta-builder/presentation/components/ModalOverlay.tsx))
- HopSkip `MainSectionMorph` ([MainSectionMorph.tsx](src/modules/hopskip/components/builder/MainSectionMorph.tsx)) and `HelperCardMorph` ([HelperCardMorph.tsx](src/modules/hopskip/components/builder/HelperCardMorph.tsx)) — framer-motion layout FLIPs
- `Button` 3D depth (translateY + shadow on hover/active) ([Button.tsx](src/components/Button.tsx))
- Segmented toggle gooey spring deformation
- Toast slide-in (custom store, no library bloat) ([Toaster.tsx](src/components/Toaster.tsx))
- The handwritten-underline scribble on the recipe name (currently classic — worth carrying into HopSkip per the honorable mention)

---

## Suggested first three to ship

If picking off the list one at a time, this is a defensible starting order — highest impact, lowest risk first:

1. **#1 — Ingredient row entrance** (the most repeated action in the app; biggest jarring → smooth delta)
2. **#7 — Copy share link signature moment** (small surface, big delight, social context)
3. **#13 — Replace `confirm()` dialogs** (single biggest polish-floor lift in the product)

After those land, the rest of the menu can be sequenced however the moment dictates — they're independent.

## How to use this PRD

This is a menu, not a roadmap. Read it, pick the items that resonate, and we'll design implementation specs (timings, easings, library choice, file:line of where to wire it) when you decide to build one. Most items are independent — each can ship on its own without a coordinated motion overhaul. As items get built, mark them done inline (or move them under "What's already great — don't regress") so this document stays the live source of truth on remaining polish work.

## Verification (when items get built)

Each microinteraction gets verified live in the dev server via `preview_*` tools — clicking the affordance, watching the timing, comparing on mobile and desktop, checking the hover/active/focus states. Visual proof (screenshot of the final state, or short note from the network/logs) gets attached to the PR. No item is "done" until it has been seen running in a real browser.
