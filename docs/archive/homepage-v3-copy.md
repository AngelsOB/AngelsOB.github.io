# Homepage v3 — Copy and Positioning

Working doc. Voice rules in [voice-and-tone.md](voice-and-tone.md) still apply.

This doc supersedes [homepage-refactor.md](homepage-refactor.md) as the
*current direction*. That doc is the spec we shipped to land the current
homepage. This one is the next pivot.

---

## The pivot in one paragraph

The current homepage sells **simplicity**. The new homepage sells **the thing
the simplicity is for**: not forgetting anything on brew day. The recipe
builder is the surface. The real product is "you sit down, design the beer,
and brew day is just execution because everything is already solved."

The founder pain. Said in plain English by the person who built the thing:

> I kept forgetting the starter math, or what PSI to set the keg to, and
> ending up doing it on brew day. I wanted a recipe builder where all of
> that was already solved by the time I finished the recipe.

That pain is the homepage.

---

## The differentiator we almost missed: brew-day adjustment

Worth naming because it shapes the whole back half of the page: **the brew
sheet itself is a brew-day decision aid.** Not just calculators. The sheet
analyzes your measurements as you record them and surfaces recovery options
side by side, with the math computed and with caveats.

What that looks like in the app today (`HSBrewSheetSection.tsx`):

- **Pre-boil OG predictor** runs as soon as you record pre-boil gravity. It
  predicts post-boil OG from your boil-off rate. If it's off target, it
  shows two options side by side. Add DME (with grams). Or boil longer
  (with extra minutes). Kettle-aware. If dilution would overfill the
  kettle, it tells you to accept instead.
- **Post-boil OG tip** runs after you record actual OG. Too high? Dilute
  (notes it's safe now because boil hops are already utilized). Too low?
  Add DME at flameout (cleanest), or boil longer with a hop-character
  warning if late additions are still in the kettle (even suggests removing
  them with a hop filter first).

This is not a thing competitors do. Brewfather and Brewer's Friend both
offer calculators where you punch in numbers and get an answer. The brew
sheet here *watches your measurements* and *recommends* an action, with the
brewing-craft tradeoffs spelled out.

The whole pitch is the loop:

> Plan it. Brew it. Adjust on the fly. Hit your numbers.

---

## What changes from the voice doc — decisions made

The voice doc says the founder hook is **acquisition-only**, not for the app
itself, and the canonical hero is "A simpler place to brew." This pivot
pushes against both. Where we landed:

1. **Founder hook on the homepage: yes, for now.** The homepage *is*
   acquisition. The hook is the strongest sell we have. When the product
   outgrows the indie-by-a-brewer framing, the homepage can shed it. The
   rest of the app stays clean per the voice doc.

2. **Replace the H1.** New H1: **"A recipe builder that thinks ahead."** The
   founder hook becomes the kicker, not the lead. On Reddit and in launch
   posts, that order flips. Founder pain leads.

3. **Locked founder hook line:** **"Built by a brewer tired of forgetting
   things on brew day."** Replaces the voice doc's "tired of switching
   tabs" line for all acquisition contexts. The voice doc should get
   updated to match.

4. **The homepage leans into founder voice throughout, not just the
   kicker.** First-person where it lands naturally. The opening is "I made
   this so I'd never forget things and find myself there again." Tour
   stage leads are "I added the hop visualizer because…" / "Water was the
   worst spreadsheet I had." The product still has its own voice in the
   feature descriptions. The founder voice surrounds it.

---

## What the page needs to do

In rough priority:

1. A first-time visitor knows what the app is and what pain it solves
   within five seconds of landing.
2. They feel the pain themselves. They nod. They commit to the scroll.
3. They see the product working before they sign up.
4. They see other brewers using it. Social proof, even if small.
5. They have one obvious next action. Not three.

Compared to the current homepage:

- The current page leads with *what the product is*. The new page leads
  with *what it solves*.
- Conversion matters. We can have personality and still convert. We just
  don't bury the lead in atmosphere.

---

## The structural approach: scroll-driven product tour

The homepage is a **single-beer narrative**. One recipe (the existing Citra
Mosaic IPA showcase) gets built across the scroll. As the visitor moves
down the page, the mock on the right shows that same recipe at different
stages of the workflow: fermentables, hops, water, brew sheet, brewed
versions. The story is one beer told from design through brew day through
community.

Three reasons for this format:

1. The depth is in the integration. A static feature list undersells it.
   Seeing the mock react to "now we're in water chem mode, now we're in
   brew sheet mode" demonstrates the cohesion in a way text can't.
2. Each stage has a unique visual hook so a visitor who bounces partway
   through has still seen something differentiating.
3. Competitors don't do this. Brewfather and Brewer's Friend both have
   static feature pages. A scroll-driven tour reads as Stripe / Linear /
   Vercel polish in a category where competitors are clinical.

### Mock movement: sticky right column, dynamic contents

The mock stays on the right side throughout. **Don't move it around the
page.** Stable position means the visitor's eye knows where to look. Mock
moving feels novel once, gimmicky on second view.

What can happen within the sticky frame:

- Tab changes synced to scroll (the existing `HeroBuilderCard` already has
  a `TabKey` state machine driving Fermentables / Mash / Hops / Yeast /
  Water / Boil panels).
- Value animations (OG counter ticking up at the grains stage).
- Floating callout annotations ("← this is the BJCP gauge") that fade in
  and out per stage.
- A clean swap to the brew sheet panel at the brew-day stage. Biggest
  visual moment of the tour.
- A clean swap to the brewed-versions list at the "brewed again" stage.

### Mobile: stacked cards, not sticky scroll

Mobile gets its own pattern. Each tour stage becomes a stacked card with
its own mock + copy. No sticky. No scroll-trigger. Sequential cards.

This is what Stripe and Linear do. Mobile is its own story, not a degraded
desktop.

---

## The 12-stage arc

| # | Stage | Mock state |
|---|---|---|
| 1 | **Hero** | Recipe overview + live OG/IBU/SRM numbers. No scroll required. |
| 2 | **Opening — "I made this..."** | Same recipe card. Atmospheric. |
| 3 | **Grains — live math** | Fermentables tab. OG ticks as grains land. |
| 4 | **Hops — dial in flavors** | Hops tab. Flavor radar lights up. Timings shape the visual. |
| 5 | **Water — salts solve themselves** | Water tab. Salts re-solve to target. |
| 6 | **Brew sheet — adjust on the fly** | Brew sheet panel with DME suggestion + hop warning. |
| 7 | **Brewed again** | Brewed versions list, same recipe across time. |
| 8 | **Community + Compare** | Recipe cards then compare view side by side. |
| 9 | **What else it does** | Compact grid of capabilities not in the tour. |
| 10 | **Learn — Path B** | Two CTAs: "New to homebrewing? Start here." and "Browse all articles." Featured article cards. |
| 11 | **FAQ** | Q&A with `schema.org/FAQPage` markup. |
| 12 | **Final CTA** | Start a recipe. |

---

## Stage-by-stage copy drafts

Locked-in working versions. Em-dashes already scrubbed. Final wording will
likely shift another notch during implementation; this is the spine.

### Stage 1 — Hero

> *built by a brewer tired of forgetting things on brew day —*
>
> # A recipe builder that thinks ahead.
>
> Recipes, water chemistry, mash pH, priming sugar, starter calcs, keg PSI.
> Everything where you need it.
>
> **[ Start a recipe ]**   Sign in to your library →   Browse recipes →
>
> *Free. Save locally without an account. Sign in to sync across devices.*

### Stage 2 — Opening

Founder voice, atmospheric, no header announcing a section change. Flows
directly from the hero into stage 3 without "here's what changed."

> Wort's boiling. The starter isn't going. I can't remember the keg PSI for
> the bitter I'm planning to keg next week. I'm one tab over googling
> priming sugar, one tab back on a spreadsheet, the notebook's somewhere
> on the floor.
>
> I made this so I'd never forget things and find myself there again.

### Stage 3 — Grains

> So I made the math run as you build. Add Munich, OG ticks up. Drop a late
> hop, IBU shifts. Change the equipment, boil-off recalculates. Nothing is
> a static field. Every number is connected to every other number.

### Stage 4 — Hops

> I added the hop flavor visualizer because I didn't want to keep googling
> hop profiles mid-recipe. Pick three hops, see the flavor land. Citrus,
> tropical, stone fruit, dank. Swap one out, watch it shift.
>
> Timings shape the flavor too. Early additions land as bitter, late ones
> hold aroma. The math weighs both.
>
> It's a recipe builder *and* a way to dial in your flavors without opening
> a different tab.

### Stage 5 — Water

> Water chemistry was the worst spreadsheet I had. So I made the salts
> solve themselves.
>
> You pick a style. The target loads from BJCP. A bounded least-squares
> solver fits gypsum, calcium chloride, epsom, and salt. Chloride and
> sulfate are weighted heaviest. They drive flavor balance.
>
> You get the rest for free. Mash pH calculated from the grain bill. A
> lactic acid suggestion when pH is off. Salts split between strike and
> sparge so you dose at the right step.
>
> Close as you need to be. Tinker if you want.

### Stage 6 — Brew sheet

The payoff stage. Don't skimp.

> And when brew day doesn't go to plan, the brew sheet is ready.
>
> Pre-boil gravity at 1.040 instead of 1.044? It suggests 60g of DME at
> flameout. Or 8 minutes more boil to concentrate. It calculates both and
> shows them side by side. If your whirlpool hops are still in the kettle,
> it warns you they'll over-extract on the extra boil and suggests pulling
> them with a filter first.
>
> Pre-boil gravity too high? Dilution math at flameout, with a check for
> whether you'd overfill the kettle.
>
> Hot hydrometer reading? Correction calc, right there.
>
> Recorded OG and FG? It tracks expected vs actual and shows your apparent
> attenuation.
>
> The recipe is a living thing during brew day. The math stays current
> with what's actually happening.

### Stage 7 — Brewed again

The brew log / version history story. Segues into community.

> Every brew gets saved as a version. So six months from now when you brew
> that same beer again, you can see what you did differently this time.
> Different water profile? Different yeast viability on the starter? A
> pre-boil gravity that drifted? It's all there. The recipe is a record,
> not just a plan.

### Stage 8 — Community + Compare

One stage, two halves. The compare module is the verb that joins "your
library" to "other brewers' library."

> Other brewers publish their recipes too. Browse what they've poured.
>
> Pick a few. Put them side by side. The comparison view shows the actual
> differences: water profiles, hop schedules, mash temps, vitals. There's
> even an average across the set, in case you're trying to figure out
> what most American IPAs land at.
>
> When you find one that fits, fork it and make it yours.

### Stage 9 — What else it does

Compact grid. Four tiles. Two columns. Each line short and factual. No
marketing.

| Tile | Line |
|---|---|
| **BeerXML** | Import any recipe. Export to share or print. |
| **Equipment profiles** | Boil-off, deadspace, absorption. Set once. Applied to every recipe. |
| **Mash schedule** | Single infusion, step mash, decoction. Strike temps calculate. |
| **Fermentation steps** | Primary, secondary, diacetyl rest, cold crash. With temps and days. |

Labels are dropped from the grid — not active in the current version.
Sharing/forking is dropped from the grid because it's covered in stage 8.

### Stage 10 — Learn (Path B)

Keep the existing `SectionLearn` structurally. Reframe the top to surface
two entry points clearly.

> *the research behind the numbers —*
>
> **Learn brewing. And Brewing.It.**
>
> [ New to homebrewing? Start here. → ]   [ Browse all articles → ]
>
> *(featured article cards below, current rendering)*

One section. Two CTAs. The "new to homebrewing" link goes to a single
beginner article that's the gentle entry point. The "browse all" link goes
to `/learn`. The featured cards stay as the showcase of deeper articles.

If a "new to homebrewing" article doesn't exist yet, it's a small writing
task to do before launch. Tracked in [backlog.md](backlog.md).

### Stage 11 — FAQ

Bottom of page. Below the Learn cards. `schema.org/FAQPage` JSON-LD for
rich results.

Suggested question list (final order TBD):

- How do I calculate ABV from gravity?
- What is IBU and how is it calculated?
- What is mash pH and why does it matter?
- What are BJCP styles?
- How much priming sugar do I need?
- What PSI should I carbonate my keg at?
- How much yeast do I need to pitch?
- My pre-boil gravity is low. What do I do?

Each answer links to the relevant calculator or learn article. Topical
authority + answers to the questions the homepage just named. The last
question is a hook back into the brew-sheet decision aid story.

### Stage 12 — Final CTA

Repeat the hero CTA at the bottom of the page. Same primary action.

> **[ Start a recipe ]**   Sign in to your library →   Browse recipes →

---

## CTAs — locked

Primary: **Start a recipe.** (Unchanged.)

Secondary actions, sitting near the primary as smaller links:

- **Sign in to your library →**
- **Browse recipes →**

Trust-builder line under the CTA cluster:

- **Free. Save locally without an account. Sign in to sync across devices.**

Repeat at the bottom of the page (stage 12). Same primary + secondaries.

---

## SEO — the honest take

The current homepage has SEO terms in the metadata but barely on the page.
The new copy improves that. Specifically:

### H1 / H2 — semantic fix, no new content

The H1 stays in your voice: **"A recipe builder that thinks ahead."** It
won't carry the keywords. That's fine.

The cleanest SEO improvement is **semantic, not new content**. Tag
existing pieces that already carry the keywords as H2:

- **Hero subhead** ("Recipes, water chemistry, mash pH, priming sugar,
  starter calcs, keg PSI…") becomes `<h2>` instead of `<p>`. Same visual.
  Same words. Google reads it as the keyword anchor.
- **Section eyebrows** become `<h2>` tags. They already exist
  ("Recipe builder", "Calculators", "Community", etc.). Optional 1-2 word
  enrichment, never hawkish:

| Current eyebrow | Slightly richer | Hawkish? |
|---|---|---|
| Recipe builder | Homebrew recipe builder | No |
| Calculators | Brew-day calculators | No |
| Brewing science | Brewing science articles | No |
| Community | Community recipes | No |
| (new: Water) | Water chemistry and mash pH | No |
| (new: Brew sheet) | Brew-day adjustments | No |

This adds zero new text that reads as SEO. Visitors see the same eyebrows
they were going to see. Google reads them as proper H2s.

### FAQ schema

`schema.org/FAQPage` JSON-LD on the FAQ section is the highest-leverage
new SEO piece. Competitors don't have it. Captures rich-result placement
for long-tail brewing questions.

### Internal linking

Already good. Hero / sections link to `/recipes/new`, `/calculators`,
`/learn`, `/browse`, `/r/[slug]`. Keep that architecture.

### Honest walk-back

Earlier drafts of this doc promised specific long-tail terms ("homebrew
recipe builder that doesn't require sign up" etc.) would hit. That was
guessing. We don't have GSC data for those queries.

What we actually know:

- The H1/H2 semantic fix is the highest-leverage on-page change. Should
  move impressions, not just rankings.
- FAQ schema is the next highest leverage.
- Internal linking is already strong.
- 0 hits is normal for a small site. Don't read into it.

**SEO is not the biggest growth lever for now.** Direct, Reddit, and
word-of-mouth are. SEO compounds over 6-12 months with consistent Learn
article output. Today: optimize the homepage for the visitor, not for
hypothetical Google queries.

Compared to competitors: Brewfather and Brewer's Friend have years of
domain authority and inbound links. We can be on-page B+ today and still
not outrank them on head terms like "ABV calculator" or "brewing software"
for a long time. The play is the long tail and the brand search ("brewing.it"),
not head-term replacement.

---

## Honest assessment: length, funnel, conversion

### Length

12 stages is on the long side. Linear is ~6 sections, Stripe ~8, Vercel
~6. Most conversion-optimized homepages are 5-8.

But the product is genuinely rich. A short homepage would underplay the
depth. The depth IS the sell.

**The real risk**: the cluster at stages 7-11 (brewed-again, community,
what-else, learn, FAQ) is a long epilogue after the brew sheet payoff.

**Compression options** (don't apply preemptively; revisit with analytics):

- Fold "brewed again" into the END of stage 6 as 2-3 sentences. Saves a
  stage.
- Move "what else it does" into FAQ Q&A entries. Tighter + stronger SEO.

That would get to ~10 stages. Ship 12 first. Compress later based on data,
not guesses.

### Funnel

Strong on every standard checkpoint:
- Hero promises a specific pain.
- Single CTA above the fold.
- Trust line removes signup friction.
- Tour proves the differentiation through narrative + visual.
- Final CTA at the bottom.

### Capture gaps (acknowledged, mostly intentional)

- **No email capture.** Decision: skip. A bigger surface area than it's
  worth for a 0-user solo project.
- **No testimonials.** Hard to address with 0 users. Self-resolves.
- **No "is it for me?" segmentation on the homepage.** Decision: skip the
  homepage split. Handle via the "new to homebrewing" Learn article
  linked from stage 10.
- **No live activity signal.** Brewer's Friend has the fermenting feed.
  Moot at 0 users. Future consideration.

### Conversion

I don't know what it'll convert at. Anyone who tells you they do is
selling something. Variables include traffic source, audience temp,
mobile vs desktop, day of week, season.

What I can say with reasonable confidence:

- **Better than the current homepage.** The current homepage doesn't tell
  a story. This one does.
- **Better than competitors' homepages** for the audience that cares
  about design and depth.
- **Below conversion-optimized SaaS pages** with infinite A/B testing
  budget.

Educated guesses for ballpark planning, not promises:

- Reddit launch traffic from r/Homebrewing with a well-crafted post:
  probably 3–5% signup. Reddit is high intent.
- Cold search traffic: lower, 1–2%. Search is broader intent.
- Direct word-of-mouth: 8–15%. Already qualified.

The real question is cost-per-signup. For a free product with no ad spend,
acquisition cost is time. As long as time-to-signup is reasonable, you're
net positive.

---

## Voice reminders specific to this homepage

- **No em-dashes.** Periods, commas, occasional colons. This is strict.
- **Founder voice for the opener and stage leads.** First person ("I made
  this…", "I added the hop visualizer because…"). Product voice for the
  feature descriptions in the stage body.
- **"Dial in" is the brewer-vocab verb for the hops stage.** Not "find new
  combinations" (treats the user as a tourist). "Dial in" treats them as
  a craftsperson.
- **"You" not "we"** in the feature descriptions. "You pick a style. The
  target loads." Not "We load the target."
- **No exclamation marks anywhere.**
- **No marketing words.** Per the voice doc: powerful, robust, seamless,
  optimize, streamline, leverage, utilize, ultimate, discover, unlock,
  transform.
- **Plain script kickers stay all-lowercase** with a trailing em-dash if
  used (this is the one em-dash exception in the voice doc — script
  kicker punctuation only).

---

## Mock movement summary

| Property | Decision |
|---|---|
| Desktop position | Sticky right column. Stays put across the scroll. |
| Desktop contents | Dynamic. Tab swap per stage, value animations, callouts, brew-sheet swap, brewed-versions list. |
| Mobile layout | Stacked cards. Each stage has its own mock card inline. No sticky scroll. |
| State source | The existing `TabKey` state in `HeroBuilderCard.tsx`. Add a Brew Sheet panel and a Brewed Versions panel as new tabs (or new states). |

---

## Implementation scope

What already exists:

- `HeroBuilderCard.tsx` (1,926 lines): tab state machine, panels for
  Fermentables / Mash / Hops / Yeast / Water / Boil, auto-rotation, click
  handlers.
- `RecipeBuilderMock.tsx` (745 lines): related mock used in
  `SectionBrewDay`.
- Framer-motion is already a dependency. Used heavily in current
  sections.
- `hsTokens` design system consistent across all sections.

What needs to be built:

- A Brew Sheet panel as a new mock state (the DME suggestion + hop warning
  view).
- A Brewed Versions panel (a small list view of versions of the same
  recipe).
- Scroll-position-to-tab mapping. When a section comes into view, set
  `activeTab` to the corresponding tab. `useInView` from framer-motion
  + `setActiveTab` in an effect. Disable auto-rotate when scroll-driven.
- Sticky positioning on the right column.
- The mobile stacked-cards alternate layout.
- A `schema.org/FAQPage` JSON-LD component for the FAQ section.

Scope estimates:

- **MVP** (hook scroll position to existing tab state, no new panels, no
  mobile alternate): **1-2 days.**
- **Full version with new panels + mobile alternate**: **~1 week of
  focused work.**

---

## Things considered and rejected

- **"Designed for brewing together" section.** Tells the wrong story. The
  product wasn't built as a collab tool.
- **"What gets forgotten" as its own section.** Folded into the hero
  subhead and the math section across the tour.
- **AI / "guides you through making a beer" on the homepage.** Save for
  launch posts and PRD-003 territory. Don't promise what isn't built.
- **Email capture form on the homepage.** Skip for now. Not worth the
  surface area for a 0-user solo project.
- **Beginner vs advanced split on the homepage.** Forces self-categorization.
  Handle via the "new to homebrewing" Learn article instead.
- **Brand Twitter account.** Use the founder's personal account.
- **Comparison pages (`/compare/brewfather`).** Worth doing eventually but
  not before launch. Backlog.
- **Mock moving around the page.** Sticky right column is the right
  pattern. Mock movement reads as gimmick after first view.
- **A separate BJCP section.** BJCP is industry standard; competitors
  have it. Folded into ambient visual (gauges visible on relevant tour
  stages) rather than its own stage.

---

## Backlog spawned from this work

Tracked in [backlog.md](backlog.md). Items spawned by this iteration:

- "New to homebrewing? Start here." Learn article. Required for stage 10
  CTA to land somewhere useful.
- Brew Sheet mock panel for the homepage. Required for stage 6.
- Brewed Versions mock panel for the homepage. Required for stage 7.
- Scroll-position-to-tab mapping logic. Required for the tour to actually
  work.
- Mobile stacked-cards alternate layout. Required for mobile.
- FAQ schema component. Required for stage 11.
- Mash temp recovery in the brew sheet (already in backlog).
- Comparison pages (already in backlog, post-launch).

---

## Headline / subhead candidates (historical reference)

Locked picks are noted. Other candidates kept for context.

### Headlines

| # | Headline | Notes |
|---|---|---|
| 1 | The recipe builder that doesn't forget. | Cleanest. Names the pain. |
| 2 | Plan the recipe. Don't scramble on brew day. | Direct. |
| 3 | Built by a brewer tired of forgetting things on brew day. | **Locked as kicker / founder hook.** |
| 4 | Everything you need to brew. Sorted before you start. | Calmer. |
| 5 | A recipe builder that thinks ahead. | **Locked as H1.** |
| 6 | The math, the water, the starter, the carbonation. One recipe. | Tactile but long. |
| 7 | A simpler place to brew. | The current line. Doesn't sell the pivot. |

### Subheads

| # | Subhead | Notes |
|---|---|---|
| 1 | The starter math, priming sugar, keg PSI, mash pH, solved when you finish the recipe. Not on brew day. | Names the pain. |
| 2 | A recipe builder, brew-day calculators, and the science behind them. All one app. | Safe fallback. |
| 3 | Design the recipe once. Brew it without scrambling. | Short. |
| 4 | Recipes, water chemistry, mash pH, priming sugar, starter calcs, keg PSI. Everything where you need it. | **Locked.** |
| 5 | Plan every detail when you build the recipe. Brew day becomes execution. | Promise-and-payoff. |

---

## Decisions summary

| Decision | Answer |
|---|---|
| Founder hook on the homepage | Yes, for now. Reassess when the product outgrows it. |
| H1 | "A recipe builder that thinks ahead." |
| Subtitle / kicker | "Built by a brewer tired of forgetting things on brew day." |
| Subhead | Listy variant of #4, locked text above. |
| Founder voice | Yes. Opener + stage leads first-person. Feature descriptions stay product-voice. |
| Structural format | Scroll-driven product tour. 12 stages. One beer built across the page. |
| Mock movement | Sticky right column. Dynamic contents. Mobile = stacked cards. |
| Heart of the page | Stages 5 and 6 (water + brew sheet). The strongest differentiators. |
| BJCP | Not its own section. Ambient visual via gauges on relevant tour stages. |
| FAQ | Yes, bottom of page, with schema markup. |
| Community + Compare | One paired stage. Compare is the verb that joins "your library" to "other brewers' library." |
| Brewed again / version history | Yes, its own stage. Segue into community. |
| What else it does | 4-tile grid. BeerXML, equipment profiles, mash schedule, fermentation steps. Labels dropped. |
| Learn section | Keep. Path B framing: two CTAs ("New to homebrewing? Start here." + "Browse all articles"). |
| Email capture | No. |
| Beginner vs advanced split on homepage | No. Handle via Learn article. |
| Brand Twitter | No. Use personal. |
| Comparison pages | Backlog. Post-launch. |
| AI / "guides you through" on page | No. Save for launch posts. |
| H1/H2 SEO fix | Semantic only, no new content. Subhead and section eyebrows become `<h2>`. Optional 1-2 word richer eyebrows. |
| Em-dashes | None except in the lowercase script kickers (voice doc carve-out). |

---

## Next step

1. Lock final word-level wording on the stage drafts above (probably one
   more pass during implementation).
2. Move locked copy into `app/_home/data.ts` (or a new file if the section
   structure changes enough to warrant one).
3. Build the new mock panels (Brew Sheet, Brewed Versions) and the
   scroll-to-tab wiring.
4. Mobile alternate layout.
5. FAQ schema component.
6. Sweep all live homepage code for em-dashes.
7. Update the voice doc with the new founder hook line ("tired of
   forgetting things on brew day" replaces "tired of switching tabs").

The voice doc itself should also get a small update on the founder hook
line and the founder-voice-on-homepage exception.
