# Backlog

Rolling list of things worth doing, captured from conversations. Not a roadmap.
Things move in and out as priorities change. Each item has a rough scope so
sequencing is honest.

Existing structured plans live in the PRDs and in
[PRD-remaining-work.md](PRD-remaining-work.md). This file is for things that
haven't been spec'd yet.

---

## Marketing

### Homepage v3 rework

See [homepage-v3-copy.md](homepage-v3-copy.md) for the locked spec. Pivot
from "simpler" to "thinks ahead." Scroll-driven product tour with one beer
built across 12 stages. Highest-leverage marketing change.

- **Scope:** ~1 week of focused work for the polished version. ~1–2 days
  for an MVP that wires scroll to existing tab states without new panels.
- **Why:** Current homepage doesn't sell the actual pain. The new arc tells
  a story and leads with differentiators visually.
- **Sub-items rolled into this:**
  - Copy moved into `app/_home/data.ts` per the locked stage drafts.
  - Scroll-position-to-tab mapping (`useInView` + `setActiveTab`,
    disable auto-rotate when scroll-driven).
  - Brew Sheet mock panel as a new state on the hero card (DME suggestion
    + hop warning view).
  - Brewed Versions mock panel as a new state (small list of versions of
    the same recipe).
  - Sticky right column positioning.
  - Mobile stacked-cards alternate layout.
  - `schema.org/FAQPage` JSON-LD component for the FAQ stage.
  - Semantic H1/H2 fix (existing subhead and section eyebrows become
    `<h2>`, no new SEO text added).
  - Em-dash sweep across the homepage code.
- **Blocker:** None. Spec is locked.

### "New to homebrewing" Learn article

Stage 10 of the homepage links to this. If it doesn't exist yet, write it.
Plain-language entry point for someone whose first batch is coming up. Links
out to the other Learn articles where relevant.

- **Scope:** ~half a day to draft, ~half a day to edit.
- **Why:** Catches the beginner segment without forcing a beginner/advanced
  split on the homepage.
- **Sequence:** Before launch.

### Comparison pages

`/compare/brewfather` and `/compare/brewers-friend`. Honest, not hawkish.
Concede where they win. Recommend them where they actually fit better.

- **Scope:** ~1–2 days each.
- **Why:** "brewfather alternative" and similar searches are high-intent and
  uncontested. Trust-builder when written honestly.
- **When:** Not urgent. Defer until there's a few months of users and the
  homepage is the strongest version of itself.

### Service worker for real PWA install

Right now the app is PWA-lite. Manifest is in place, but no service worker is
registered. Chrome/Android won't show the install prompt without one. iOS
still works via Add to Home Screen.

- **Scope:** ~half a day with `next-pwa`. ~1 day hand-rolled.
- **Why:** If "install on your phone" becomes a homepage feature, it needs to
  work on every platform, not just iOS. Also unlocks offline behavior down
  the line.
- **Note:** Only worth doing if PWA install becomes part of the marketing.
  Otherwise skip.

### Demo GIF or short video

A 15–30 second loop of the recipe builder doing its thing. Numbers updating.
A grain weight changing. The math reacting. Pinned to the top of the launch
post on Reddit.

- **Scope:** ~half a day to record and edit.
- **Why:** Reddit posts with a visual demo perform 10× better than text-only.
  The single biggest leverage point for launch.

### Reddit launch post (r/Homebrewing)

The post itself. Honest framing: "I'm a homebrewer, I kept forgetting things
on brew day, so I built this. Free, no signup to play with the calculators."
No marketing language. No "I'd love your feedback" boilerplate.

- **Scope:** ~half a day to draft and edit.
- **Why:** r/Homebrewing is the natural home and rewards genuine
  builder-shows-thing posts. Anti-promotion only kicks in when it reads as
  promotion.
- **Sequence:** Last. Don't post until the homepage matches the pitch.

---

## Product

### Inventory MVP

A page where you list what you have. Quantities. Shows in the ingredient
pickers as "have: 8 oz" badges.

- **Scope:** ~5–7 days for the honest MVP cut. See conversation for the
  expanded version which is ~2–3 weeks.
- **MVP cut:**
  - `/inventory` page with list view
  - Firestore collection per user
  - Manual add / edit / delete UI
  - "Have: {qty}" badges next to ingredients in the recipe builder
  - No auto-deduct on brew. No shopping list. No lot tracking. No cost.
- **Why:** Founder wants it for themselves. Replaces their personal
  spreadsheet. On-niche — the whole product was built from "I want this for
  myself" energy.
- **Risks:**
  - Unit reconciliation (oz / g / lb / kg) across recipe and inventory
  - Identity matching (is "Citra" in inventory the same as "Citra" in the
    picker? What about "Citra (2024)"?)
  - Every ingredient picker needs a small UI touch. Picker is touched in
    multiple places.
- **Note:** Punt auto-deduct, shopping list, and lot tracking to v2. They are
  where the real complexity hides.

### Brew-day recovery: mash temp miss

Surface in the brew sheet (next to the existing OG-off recovery flow) when
recorded mash temp deviates meaningfully from target. Show approximate
impact on apparent attenuation / body (cooler mash = lower attenuation =
more body; hotter mash = higher attenuation = drier finish). Frame as
information, not as a recovery action — once mash is done, the brewer
mostly notes the change for the recipe history.

- **Scope:** Half a day to a day. Math is straightforward (well-documented
  in Briggs / Bamforth). UI follows the existing PostBoilOgTip /
  PreBoilOgPredictor pattern in `HSBrewSheetSection.tsx`.
- **Why:** Closes a small gap in the brew-day decision-aid story. Brewer's
  acknowledged framing: mash temp "just shouldn't be missed" but having the
  app note the impact when it does is genuinely useful.
- **Caveat:** Not a fix-it action — by the time mash temp is recorded, the
  mash is done. Frame as expected-vs-actual + likely sensory impact.

### Enhanced Brew Mode (premium)

Already spec'd. See [PRD-remaining-work.md](PRD-remaining-work.md). The
step-by-step brew day flow with measurement capture and variance summary.

- **Scope:** ~2–3 weeks (per the existing PRD).
- **Why:** The "guides you through making a beer" promise. Closes the loop
  the homepage implies. Premium gate.

### "Brew this with a friend" — collab story

Today: shared links + forks. Tomorrow: real-time collab on a single recipe.

- **Scope (story-only, no real-time collab):** A homepage section + a polish
  pass on the share flow + a "designed with X" attribution on forked recipes.
  ~2–3 days.
- **Scope (real-time collab):** Significant. Firestore listeners on a shared
  recipe doc, cursor presence, conflict resolution. ~2–4 weeks.
- **Why:** A specific stated goal — "I want to send this to my friends and
  design a beer together." Has viral acquisition potential too (one person
  brings their friends in).
- **Recommendation:** Ship the story-only version first. Real-time collab is
  v2.

### AI brewing assistant (PRD-003)

Already drafted. TBD if pursuing. The long arc of "guides you through making
a beer" lands here.

- **Scope:** Large. Per the PRD.
- **Why:** The forward-looking story. The thing the homepage hints at without
  promising.
- **Sequence:** After more users exist. Premature without traffic.

### Premium Browse Badge (PRD-006 Phase 3D)

Already spec'd. See PRDs.

---

## Quality / polish

### Onboarding for first-time visitors landing from Reddit / search

When someone arrives cold, the path should be: hero → click "Start a recipe"
→ build something without auth → save prompt at the end → auth → recipe
persisted. Verify the path is smooth and no auth wall pops too early.

- **Scope:** ~half a day to audit. Variable to fix anything found.
- **Why:** Reddit traffic will bounce hard if a signup wall hits in the
  first 30 seconds.

### Seed recipes for community section

If the community section is going to live on the homepage, it should have
recipes that look real and varied. Curate or seed 10–20 quality ones across
styles before launch.

- **Scope:** ~1 day to build, ~half a day to write notes on each.
- **Why:** A homepage that says "see what other brewers are pouring" needs
  variety to land. Six recipes of "American IPA, American IPA, Stout,
  American IPA" reads as small and boring.

### Hero screenshot polish

The hero builder card is good. Question is whether it could be even more
obviously *interactive* on first view. A subtle "drag me" affordance on a
slider, or an animated value that moves as the page loads.

- **Scope:** ~half a day.
- **Why:** First impression. Already strong; small lift makes it stronger.

---

## Not doing

Worth being explicit about what's been considered and declined:

- **Hardware integration** (Tilt, RAPT, iSpindel). Brewfather's moat. Not on
  niche. Skip.
- **Native mobile apps.** Lean into "no app to install, works in any browser,
  syncs everywhere." Make the web-only a virtue. Service worker if PWA
  install matters.
- **A/B testing infrastructure.** Overkill for solo dev with low traffic.
  Ship and watch.
- **Email capture form on the homepage.** Not worth the surface area for a
  0-user solo project. Revisit if traffic grows.
- **Beginner vs advanced split on the homepage.** Forces self-categorization.
  Handle via the "new to homebrewing" Learn article instead.
- **Brand Twitter / Bluesky account.** Use the founder's personal account
  for updates. Revisit if community grows.
- **"Designed for brewing together" section / framing.** Wrong story. The
  product wasn't built as a collab tool.
- **AI / "guides you through" on the homepage.** Save for launch posts.
  Don't promise what isn't built.
- **Mock moving around the page.** Sticky right column is the right
  pattern.

---

## Triage rule of thumb

When in doubt, sequence by:

1. **Does this matter for a first-time visitor today?** If yes, do soon.
2. **Does this matter for the launch story?** If yes, do before launch.
3. **Does this matter for the founder using the app?** If yes, do when in the
   right headspace.
4. **Everything else.** Park.
