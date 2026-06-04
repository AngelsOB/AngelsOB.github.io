// Locked stage copy for the v3 homepage. Source of truth:
// docs/homepage-v3-copy.md and docs/PRD-008-homepage-v3.md.
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

// Shared CTA shape. Used by hero (stage 1) and final CTA (stage 12).
export const CTA = {
  primary: { label: "Start a recipe", href: "/recipes/new" },
  secondary: [
    { label: "Sign in to your library", href: "/recipes" },
    { label: "Browse recipes", href: "/browse" },
  ],
  trust: "Free. Save locally without an account. Sign in to sync across devices.",
} as const;

export const STAGES = {
  // ── Stage 1: Hero ──────────────────────────────────────────────────────
  hero: {
    kicker: "built by a brewer tired of forgetting things on brew day —",
    // Words pulled out so each animates in independently (PRD 7, stage 1).
    // "thinks ahead" gets the subtle roast color shift (no highlighter).
    headlineWords: [
      { text: "A", color: null, accent: false, breakAfter: false },
      { text: "recipe", color: null, accent: false, breakAfter: false },
      { text: "builder", color: null, accent: false, breakAfter: true },
      { text: "that", color: null, accent: false, breakAfter: false },
      { text: "thinks", color: "roast", accent: true, breakAfter: false },
      { text: "ahead.", color: "roast", accent: true, breakAfter: false },
    ],
    subhead:
      "Recipes, water chemistry, mash pH, priming sugar, starter calcs, keg PSI. Everything where you need it.",
  },

  // ── Stage 2: Opening ───────────────────────────────────────────────────
  // Sentences split for sentence-by-sentence reveal (PRD 7, stage 2).
  // Final sentence gets a longer reveal as the closing beat.
  opening: {
    sentences: [
      "Wort's boiling. The starter isn't going. I can't remember the keg PSI for the bitter I'm planning to keg next week. I'm one tab over googling priming sugar, one tab back on a spreadsheet, the notebook's somewhere on the floor.",
      "I made this so I'd never forget things and find myself there again.",
    ],
  },

  // ── Stage 3: Grains — live math ────────────────────────────────────────
  grains: {
    h2: "Homebrew recipe builder",
    lead: "So I made the math run as you build.",
    body: "Add Munich, OG ticks up. Drop a late hop, IBU shifts. Change the equipment, boil-off recalculates. Nothing is a static field. Every number is connected to every other number.",
  },

  // ── Stage 4: Hops — dial in flavors ────────────────────────────────────
  hops: {
    h2: "Hop flavor visualizer",
    lead: "I added the hop flavor visualizer because I didn't want to keep googling hop profiles mid-recipe.",
    paragraphs: [
      "Pick three hops, see the flavor land. Citrus, tropical, stone fruit, dank. Swap one out, watch it shift.",
      "Timings shape the flavor too. Early additions land as bitter, late ones hold aroma. The math weighs both.",
      "It's a recipe builder and a way to dial in your flavors without opening a different tab.",
    ],
  },

  // ── Stage 5: Water — salts solve themselves ────────────────────────────
  water: {
    h2: "Water chemistry and mash pH",
    lead: "Water chemistry was the worst spreadsheet I had. So I made the salts solve themselves.",
    paragraphs: [
      "You pick a style. The target loads from BJCP. A bounded least-squares solver fits gypsum, calcium chloride, epsom, and salt. Chloride and sulfate are weighted heaviest. They drive flavor balance.",
      "You get the rest for free. Mash pH calculated from the grain bill. A lactic acid suggestion when pH is off. Salts split between strike and sparge so you dose at the right step.",
      "Close as you need to be. Tinker if you want.",
    ],
    // Callout that slides in SPRINGY pointing at the mash pH row.
    callout: "+ 2.3 mL lactic acid to hit pH 5.4.",
  },

  // ── Stage 6: Brew sheet — adjust on the fly (breakout) ─────────────────
  brewSheet: {
    h2: "Brew-day adjustments",
    lead: "And when brew day doesn't go to plan, the brew sheet is ready.",
    paragraphs: [
      "Pre-boil gravity at 1.040 instead of 1.044? It suggests 60g of DME at flameout. Or 8 minutes more boil to concentrate. It calculates both and shows them side by side. If your whirlpool hops are still in the kettle, it warns you they'll over-extract on the extra boil and suggests pulling them with a filter first.",
      "Pre-boil gravity too high? Dilution math at flameout, with a check for whether you'd overfill the kettle.",
      "Hot hydrometer reading? Correction calc, right there.",
      "Recorded OG and FG? It tracks expected vs actual and shows your apparent attenuation.",
      "The recipe is a living thing during brew day. The math stays current with what's actually happening.",
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

  // ── Stage 7: Brewed again ──────────────────────────────────────────────
  brewedAgain: {
    body: "Every brew gets saved as a version. So six months from now when you brew that same beer again, you can see what you did differently this time. Different water profile? Different yeast viability on the starter? A pre-boil gravity that drifted? It's all there. The recipe is a record, not just a plan.",
    // Brewed Versions panel content (mock).
    versions: [
      {
        date: "2026-04-12",
        og: "1.062",
        fg: "1.012",
        abv: "6.5%",
        note: "different water profile",
      },
      {
        date: "2026-01-08",
        og: "1.059",
        fg: "1.014",
        abv: "5.9%",
        note: "yeast pack was older",
      },
      {
        date: "2025-09-21",
        og: "1.061",
        fg: "1.013",
        abv: "6.3%",
        note: "first run",
      },
    ],
  },

  // ── Stage 8: Community + Compare ───────────────────────────────────────
  community: {
    h2: "Community recipes",
    intro: "Other brewers publish their recipes too. Browse what they've poured.",
    compareIntro:
      "Pick a few. Put them side by side. The comparison view shows the actual differences: water profiles, hop schedules, mash temps, vitals. There's even an average across the set, in case you're trying to figure out what most American IPAs land at.",
    closer: "When you find one that fits, fork it and make it yours.",
  },

  // ── Stage 9: What else it does ─────────────────────────────────────────
  whatElse: {
    h2: "Also in the recipe builder",
    tiles: [
      {
        title: "BeerXML",
        body: "Import any recipe. Export to share or print.",
      },
      {
        title: "Equipment profiles",
        body: "Boil-off, deadspace, absorption. Set once. Applied to every recipe.",
      },
      {
        title: "Mash schedule",
        body: "Single infusion, step mash, decoction. Strike temps calculate.",
      },
      {
        title: "Fermentation steps",
        body: "Primary, secondary, diacetyl rest, cold crash. With temps and days.",
      },
    ],
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
  // Final wording per backlog/PRD: 8 items. JSON-LD generated from this list.
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

  // ── Stage 12: Final CTA ────────────────────────────────────────────────
  finalCta: {
    headline: "Start a recipe.",
  },
} as const;
