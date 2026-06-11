// Locked stage copy for the homepage tour (originally ported from the v3 homepage).
// Source of truth: docs/homepage-v3-copy.md and docs/PRD-008-homepage-v3.md.
//
// Voice rule reminder: no em-dashes anywhere except in lowercase script
// kickers (the one allowed exception per docs/voice-and-tone.md). Body
// uses periods, commas, occasional colons.

// PRD section 8 motion language. These are the only two curves on the page.
// SMOOTH for ~80% of motion (text reveals, count-ups, opacity fades, color
// transitions). SPRINGY for spatial entries with personality (cards arriving,
// the breakout pieces, the lactic acid callout, the hop warning callout).
export const EASE = {
  smooth: [0.22, 1, 0.36, 1] as const,
  springy: [0.34, 1.56, 0.64, 1] as const,
} as const;

// Shared CTA shapes. The hero CTA invites a no-friction start; the close CTA
// reflects that the visitor has read the whole pitch.
export const CTA = {
  hero: {
    label: "Start a recipe",
    href: "/recipes/new",
    note: "no signup. saves to your browser.",
  },
  close: { label: "Build your first recipe", href: "/recipes/new" },
} as const;

export const STAGES = {
  // ── Stage 1: Hero ──────────────────────────────────────────────────────
  // Leads with the outcome (idea → glass). The subhead carries the three
  // pillars (flavor · real numbers · holds on brew day) + the connected spine.
  hero: {
    kicker: "one beer, six tabs, a spreadsheet, and a notebook on the floor —",
    headline: {
      pre: "The beer's already in your head. This gets it ",
      accent: "in the glass.",
    },
    subhead:
      "Design it down to the flavor, with numbers that are actually real. Then hold onto it when brew day doesn't cooperate. One connected recipe, from the idea in your head to the beer in your hand.",
  },

  // ── Stage 2: Opening (the chaos) ───────────────────────────────────────
  // Sentence-by-sentence reveal. Condensed; the final line hands off to the
  // connected-recipe spine.
  opening: {
    sentences: [
      "Wort's boiling. The starter isn't going. I can't remember the keg PSI for the bitter I'm kegging next week. One tab's on priming sugar, one's on a spreadsheet, the notebook's somewhere on the floor.",
      "That's the brew day I built this to never have again. One place. Every number wired to the next. Nothing guessed.",
    ],
  },

  // ── Beat 1: The live builder (auto-play "watch" demo) ──────────────────
  grains: {
    h2: "The live builder",
    lead: "Watch one change ripple out.",
    body: "A grain drops into the bill and the OG climbs, the color deepens, the gauges slide toward the style you picked, right inside the BJCP range for it. This is the builder itself, live on the page. Not a screenshot, and the same one you'll design in. Every number is already watching every other number.",
  },

  // ── Beat 2: Flavor — the timing-aware estimate ─────────────────────────
  hops: {
    h2: "Hop flavor, estimated",
    lead: "Now shape how it tastes.",
    paragraphs: [
      "Numbers are half of it. Here's the other half. Pick your hops and watch the flavor land: citrus, tropical, pine, dank.",
      "And it's drawn from when they go in, not just what you add. The same hops bittering at 60 minutes versus dropped in a whirlpool land in completely different places, and the picture moves as you shuffle the timing.",
      "I haven't found another builder that estimates flavor like this. I built it because I got tired of opening a tab to remember what Mosaic tastes like.",
    ],
  },

  // ── Beat 3: Water — the lead exhibit (the spine proven) ────────────────
  water: {
    h2: "Water chemistry and mash pH",
    lead: "Change the grain bill, and the water keeps up.",
    paragraphs: [
      "This is the part nobody else really does. Most software hands you three salt sliders to nudge by hand, or a serious water engine buried in a screen from 2009.",
      "Mine's a real optimizer. One click dials your salts to the chloride-to-sulfate balance you're after, and it's fed by your grain bill and your mash pH, feeding everything downstream.",
      "Not a separate calculator you copy numbers out of. Part of the same recipe.",
    ],
    // Callout that slides in SPRINGY pointing at the mash pH row.
    callout: "+ 2.3 mL lactic acid to hit pH 5.4.",
  },

  // ── Beat 4: Honest numbers (credibility) ───────────────────────────────
  honestNumbers: {
    h2: "Honest numbers",
    lead: "And the hard numbers aren't guessed.",
    paragraphs: [
      "Most calculators score dry hops at zero IBU. That's just wrong, so this one counts the bitterness they actually add.",
      "Your final gravity comes from what your mash temp does to the enzymes, the real gap between 148 and 156, not a fixed number you type in and hope.",
      "I'm not promising my numbers are perfect. I'm promising none of them are made up, and the Learn page shows exactly how I got each one.",
    ],
  },

  // ── Beat 5: Brew sheet — the climax (pays off the hero) ────────────────
  brewSheet: {
    h2: "Brew-day adjustments",
    lead: "Then brew day happens. It keeps you on the beer you set out to make.",
    paragraphs: [
      "Pre-boil gravity in at 1.040 instead of 1.044? It lays both fixes side by side. About 60g of DME at flameout, or eight more minutes of boil. And it warns you if your whirlpool hops will over-extract on the longer one, so you pull them first.",
      "Log your real OG and FG and it works out your actual efficiency for next time.",
      "The plan doesn't break the second reality shows up. It bends, and stays pointed at the beer you imagined.",
    ],
    // Small-scale faithful mock of HSBrewSheetSection. Title block, 3-col
    // stat strip, numbered sections, with the Pre-Boil OG correction as the
    // highlighted differentiator (the "wow it caught that" moment).
    panel: {
      title: "Brew sheet.",
      status: "Brewing",
      brewData: [
        { label: "Batch", value: "5 gal" },
        { label: "Boil", value: "60 min" },
        { label: "Setup", value: "BIAB" },
        { label: "Eff", value: "75%" },
      ],
      targets: [
        { label: "OG", value: "1.062" },
        { label: "FG", value: "1.012" },
        { label: "ABV", value: "6.6%" },
        { label: "IBU", value: "52" },
        { label: "SRM", value: "6.2", srm: 6.2 },
      ],
      yeast: [
        { label: "Strain", value: "US-05" },
        { label: "Packs", value: "1.0" },
        { label: "Pitch", value: "68°F" },
      ],
      grains: [
        { name: "2-row Pale", amount: "9.0 lb", srm: 2.5 },
        { name: "Munich", amount: "1.0 lb", srm: 9 },
        { name: "Crystal 40", amount: "0.3 lb", srm: 40 },
      ],
      hops: [
        { name: "Citra", amount: "0.5oz", use: "boil 60" },
        { name: "Mosaic", amount: "1.5oz", use: "boil 60" },
        { name: "Citra", amount: "1.0oz", use: "whirlpool" },
      ],
      water: {
        salts: "Gyp 5.2 · CaCl 1.8 · Eps 0.4 · NaCl 0.3",
        profile: "Ca 130 · Mg 8 · Na 24 · SO₄ 614 · Cl 209",
        volumes: "Mash 4.0 gal · Sparge 3.5 gal",
      },
      mash: "152°F for 60 min",
      // The highlighted differentiator: actual pre-boil reading came in
      // low, brew sheet auto-suggests two recovery paths and flags the
      // hop-character risk on the boil-longer option.
      preBoilLabel: "Pre-boil OG",
      preBoilPredicted: "1.040",
      preBoilTarget: "1.044",
      options: [
        {
          tag: "Cleanest",
          title: "Add ~60g DME at flameout",
          desc: "Brings predicted OG up to target without changing volume or kettle time.",
        },
        {
          tag: "Or",
          title: "Boil ~8 min longer",
          desc: "Concentrates the wort the same amount. Affects hop timing.",
        },
      ],
      warning:
        "your whirlpool hops will over-extract. pull them with a filter first.",
    },
  },

  // ── Beat 6: Compare (differentiator + the friends angle) ───────────────
  compare: {
    h2: "Compare",
    lead: "Put two beers side by side.",
    paragraphs: [
      "Last batch next to this one. Vitals, water, hops, even the flavor maps, so you can see what changed and why the last one drank better.",
      "And because none of it's intimidating, you can hand it to a friend who doesn't brew, let them find a beer they'd actually want, and make it together.",
    ],
  },

  // ── Beat 7: Your library + community ───────────────────────────────────
  library: {
    h2: "Your library",
    intro: "Everything you brew lives here.",
    body: "Save your recipes, log your brew days, keep your notes and your real numbers batch to batch. Browse what other brewers are pouring and fork any of it. Every recipe opens in the same builder, so you can take it apart and see how it's made.",
    browseLabel: "Browse all recipes",
  },

  // ── What else (table stakes, framed) ───────────────────────────────────
  // The spine beats carry the pitch; this is just "yes, the basics are here
  // too" so they're never the reason someone reaches for another tool.
  whatElse: {
    h2: "Also in the builder",
    lead: "The basics are all here too.",
    body: "BeerXML in and out, recipe versions, mash schedules, equipment profiles, and a full set of standalone calculators. Table stakes, handled, so they're never the reason you reach for something else.",
  },

  // ── Stage 10: Learn (Path B) ───────────────────────────────────────────
  learn: {
    h2: "Brewing science articles",
    kicker: "the research behind the numbers —",
    title: "Learn brewing. And Brewing.It.",
    ctas: [
      { label: "New to homebrewing? Start here.", href: "/learn/getting-started" },
      { label: "Browse all articles", href: "/learn" },
    ],
  },

  // ── Stage 11: FAQ ──────────────────────────────────────────────────────
  // 8 genuine Q&As (SEO surface). JSON-LD generated from this list. Data
  // attribution lives on the Credits page (linked in the footer), not here.
  faq: {
    h2: "Frequently asked questions",
    items: [
      {
        q: "How do I calculate ABV from gravity?",
        a: "ABV is roughly (OG - FG) × 131.25, where OG is original gravity and FG is final gravity. The recipe builder runs this for you on every edit. See the ABV calculator for the full breakdown.",
      },
      {
        q: "What is IBU and how is it calculated?",
        a: "IBU is International Bittering Units. The recipe builder uses the Tinseth model: alpha acid × utilization × hop weight, divided by batch volume. Utilization depends on boil gravity and boil time.",
      },
      {
        q: "What is mash pH and why does it matter?",
        a: "Mash pH is the pH of your wort during the mash. The sweet spot is 5.2 to 5.6. Outside that, enzyme efficiency drops and tannin extraction can spike. The builder calculates expected mash pH from your grain bill and water profile, and suggests acid additions when needed.",
      },
      {
        q: "What are BJCP styles?",
        a: "The Beer Judge Certification Program publishes a style guide with target ranges for every beer category. The builder loads BJCP ranges per style and shows in-range gauges for OG, FG, ABV, IBU, and SRM.",
      },
      {
        q: "How much priming sugar do I need?",
        a: "It depends on batch volume, beer temperature when bottling, and target carbonation level. The priming sugar calculator handles all three. Most beers land around 4g per liter of corn sugar.",
      },
      {
        q: "What PSI should I carbonate my keg at?",
        a: "It depends on temperature and target CO2 volumes. The keg PSI calculator covers it. For most pale ales served at fridge temp, around 12 PSI hits 2.4 volumes.",
      },
      {
        q: "How much yeast do I need to pitch?",
        a: "Pitch rate scales with original gravity and batch volume. The starter calculator runs the math for liquid yeast packs and suggests a starter size when one pack isn't enough.",
      },
      {
        q: "My pre-boil gravity is low. What do I do?",
        a: "The brew sheet handles it. Record your pre-boil reading and it suggests recovery options side by side: add DME at flameout, or boil longer. If late hops are in the kettle, it warns you before you boil them further.",
      },
    ],
  },

  // ── Close (price + data ownership) ─────────────────────────────────────
  close: {
    h2: "Free to start. Cheap to keep.",
    body: "The whole builder works right now. No account, no card. Free covers it, plus five saved recipes. Unlimited is $1.99 a month, or $19.99 for the year, less than a sack of base malt. Everything exports to BeerXML and markdown whenever you want. Your recipes are yours, not hostages.",
    footer: "made with malt & love.",
  },
} as const;
