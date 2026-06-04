# Voice & Tone

How the app sounds. A working document. When in doubt, write toward this.

## The voice in one paragraph

A homebrewer who built an app and is showing it to other homebrewers. Not performing friendliness. Not selling. Just describing what the thing is, in plain English, with the confidence of someone who actually uses it. Closer to a craft brewery label or a Linear release note than a SaaS landing page. Confident, plain, slightly opinionated. Says what it is and gets out of the way.

## Brand positioning

The app is a recipe builder and brew-day calculator suite, well-researched and grounded in published brewing science. In product copy, it presents itself confidently as a product, not as a side project.

The voice comes from a homebrewer's perspective, not a startup founder's. That's the **source** of the voice, not the **pitch**. The product carries itself like a real product — the homebrewer-built origin is the charm underneath, not the headline.

### What it is, in one sentence

A recipe builder that does the math, with the calculators you reach for on brew day.

### What users get

- Recipes, calculators, water chemistry, and BJCP style targets in one place
- Live math, so the recipe updates as you edit
- A simpler brewing workflow with no tab-switching
- Calculations grounded in published brewing science (Tinseth for IBU, the proton-deficit model for mash pH, and so on)
- A place to save, share, and fork recipes with other brewers

### Mental model

A place to keep recipes, run the math, and share what you've made. "Recipes" is the canonical word. "Your library" is the canonical container.

Don't push log / logbook / brew log / entry vocabulary in product copy. The brew-log framing helped shape the voice direction (personal, owned, not corporate) but it doesn't need to surface in the words on screen. "Recipes" and "library" are plainer and more universally understood.

### What the app is NOT (yet)

- A "brewing science library". The Learn section exists and may grow into one as more articles get written. Until then, frame it as articles or as the research behind the calculators. Don't oversell.

### The founder hook (acquisition contexts + the homepage)

For ads, social posts, launch announcements, and **the homepage**, the founder hook is the strongest angle:

> "Built by a brewer tired of forgetting things on brew day."

The homepage is the one exception to the "no founder hook inside the app" rule, for now. The rest of the app (builder, calculators, learn pages, sharing, account screens, etc.) stays clean. The founder hook does not appear there. When the product outgrows the indie-by-a-brewer framing, the homepage will shed it too. See [homepage-v3-copy.md](homepage-v3-copy.md) for the rationale.

On the homepage, the founder voice extends slightly past the hook itself: the opening paragraph and the stage-lead sentences are first-person ("I made this so I'd never forget things and find myself there again.", "I added the hop visualizer because..."). Feature descriptions in the stage bodies stay product-voice. This is a specific exception for the homepage scroll narrative, not a license to write the rest of the app in first-person.

## The five rules

### 1. Plain sentences. Periods, not em-dashes.

Em-dashes are a stylistic crutch and a tell. Default to periods. Two short sentences usually beat one long sentence with a dash in the middle.

> "Recipe published." not "Recipe published — share it now."
> "Couldn't save. Try again." not "Couldn't save — let's try again."

One em-dash per page max, and only when a comma genuinely won't carry the rhythm.

### 2. Use whichever pronoun is natural

No default. Some lines need "you", some need "we", some need neither.

- **"You" / "your"** for the brewer's stuff and direct address. "Your recipes." "Sign in to save this recipe." "Pick up where you left off."
- **"We"** rarely. Only when we're describing what the app actively does on the brewer's behalf, and only when leaving it out reads worse. "We use Tinseth to calculate IBU." Don't force it.
- **"Let's"** in invitations only. Empty states, first-time moments, onboarding. "Let's make one." Not on every button.

The earlier draft of this guide pushed "we-first". That was wrong. Forced "we" sounds corporate or hovering. Natural beats systematic.

### 3. Name the thing. Don't abbreviate to pronouns.

"Sign in to save this recipe" beats "Sign in to save it." Naming the thing makes the copy feel grounded and specific.

> "Fork failed. Try again." not "Couldn't fork. Try again." (over-clipped, no subject)
> "Couldn't load this recipe." not "Couldn't load it."

### 4. No metaphors outside brewer vocabulary

Words that are already part of brewing are fair game: mash, dial, pitch, batch, pour, brew day, on tap, racking, brew log, logbook.

Words that aren't already brewing vocab feel forced when applied to the app: notebook, ceiling, dive, journey, toolkit, suite, hub, ecosystem. Don't reach.

> "No recipes yet. Let's make one." not "An empty notebook. Let's fill it."
> "Free tier's full." not "We've hit the ceiling."

### 5. No exclamation marks, no marketing words

Earn an exclamation mark or skip it. Default: skip.

Marketing words to avoid: powerful, robust, seamless, ultimate, all-in-one (the concept is fine, the phrase is not), discover, unlock, leverage, utilize, optimize, streamline, take it to the next level, get started, take action.

Words that are fine: built, made, designed, handles, calculates, saves, helps, brews, dials, runs.

## Do / don't pairs

Calibrated from real audit findings. The right-hand column is what we're going for.

| Don't | Do |
| --- | --- |
| "Brew with numbers that agree." | "A simpler place to brew." |
| "An empty notebook. Let's fill it." | "No recipes yet." |
| "Let's keep that recipe safe." | "Sign in to save this recipe." |
| "We've hit the free-tier ceiling." | "Free tier's full." |
| "It's out in the world." | "Recipe published." |
| "Couldn't fork. Try again." | "Fork failed. Try again." |
| "Recipe is now public!" | "Recipe published." |
| "Failed to save recipe" | "Couldn't save. Try again." |
| "Discover homebrewing recipes shared by the community." | "Recipes shared by other brewers." |
| "Get started with your first recipe" | "Make your first recipe." |
| "Every input nudges every output." | "The math runs as you edit." |
| "The numbers you'll need, ready when you are." | "The math you'll reach for." |

## Words we use

These sound like us. Most are already in the brewing vocabulary.

- **Verbs:** brew, build, make, save, share, fork, dial in, mash, pitch, pour, run, check, save, sip
- **Concrete numbers:** "5 calculators", "0 spreadsheets", "5 recipes saved", "247 recipes shared"
- **Brewing nouns:** brew day, batch, grain bill, hop schedule, mash, wort, library, recipe
- **Plain connectors:** periods. Commas. Occasional colons.

## Words we avoid

- **SaaS marketing:** powerful, robust, seamless, optimize, streamline, leverage, utilize, ultimate, all-in-one (concept fine, phrase no)
- **Performative friendliness:** "Oops!", "Awesome!", "Get started", "Welcome aboard"
- **Metaphors outside brewing:** notebook, ceiling, dive, journey, toolkit, hub, ecosystem
- **Forced "we":** "We noticed", "We'd love", "We're here to help"
- **Hyphen-as-em-dash:** ` - ` in headings or marketing copy. Use ` — ` only when actually needed, otherwise period.

## Edge cases

### Errors

Plain past tense or "couldn't". Name what failed, point to the next step. No apologies, no faux-cheer.

- "Couldn't save. Try again."
- "Fork failed. Try again."
- "Couldn't load this recipe."
- "That recipe is private. Open it and make it public first."

### Success / confirmations

Two words is usually enough. No exclamation marks.

- "Recipe saved."
- "Recipe published."
- "Link copied."
- "Imported."

### Empty states

State what's there (nothing), then a soft invitation. "Let's" is allowed here because empty states are inherently invitations.

- "No recipes yet. Let's make one."
- "Nothing matches that search. Try a different term."

### Premium / paid copy

Friendly but not desperate. Acknowledge the brewer's choice. The existing "Keep a solo dev in pints" line is the right energy.

- "Free tier's full. Upgrade or delete one to make room."
- "Premium unlocks export and unlimited recipes. $1.99/mo."

### Calls to action

Buttons can stay imperative. Hero CTAs can be slightly longer if they read naturally.

- Buttons: "Save", "Share", "Cancel", "Done", "Sign in"
- Larger CTAs: "Start a recipe", "Open the calculators", "Browse recipes"
- Avoid: "Get started", "Take action", "Try it now"

### SEO copy

Same voice as marketing copy, just denser. SEO is allowed slightly more keyword density, but never at the cost of sounding like an SEO page. Say what the app is, what it does, who it's for.

## Locked-in canonical copy

These are the lines the rest of the audit should pattern off. If a proposed line doesn't sound like it belongs in the same app as these, redraft.

- **Homepage hero (v3):** "A recipe builder that thinks ahead."
- **Homepage hero subhead (v3):** "Recipes, water chemistry, mash pH, priming sugar, starter calcs, keg PSI. Everything where you need it."
- **Homepage hero kicker (v3):** "built by a brewer tired of forgetting things on brew day —"
- **Homepage trust line (v3):** "Free. Save locally without an account. Sign in to sync across devices."
- **Calculators section title:** "The math you'll reach for."
- **Calculators section body:** "Did I hit my OG? What do I do now that I didn't? How long do I boil? How much priming sugar? When you have a question, it's here."
- **Empty library:** "No recipes yet. Let's make one."
- **Sign-in prompt:** "Sign in to save this recipe."
- **Free tier full:** "Free tier's full."
- **Share success:** "Recipe published."
- **Fork error:** "Fork failed. Try again."
- **Link copy:** "Link copied."

The previous homepage hero ("A simpler place to brew." / "A recipe builder with live math, brew-day calculators, and the science behind them.") is retired with the v3 homepage. Don't reuse those exact lines.

## Learn section is exempt

The Learn section is user-written, and lives in a more authoritative voice — appropriate for reference content. Don't apply this guide to Learn articles, formula explanations, or BJCP deep-dives.

## The read-aloud test

Say it out loud. Does it sound like a brewer talking to another brewer? Or does it sound like a product trying to sell itself?

Tells we're off:
- Two em-dashes on the same page
- Any exclamation mark
- Any word from the "avoid" list
- "We" appears in three sentences in a row
- A metaphor that isn't a brewing word
- Could appear on any SaaS landing page without changing
- Reads like an AI trying to sound friendly

When in doubt, cut a word. Then cut another. The shortest version that still says the thing is usually the right one.
