# PRD-007: Standalone Calculator Pages

> **Status:** Not started
> **Created:** 2026-03-27
> **Depends on:** PRD-005 (SEO & Docs — Learn section infrastructure)
> **Goal:** Widen SEO surface area by giving each brewing calculation its own indexable, linkable page

---

## Context

The recipe builder already performs 15+ distinct calculations internally. Right now none of those are reachable as standalone pages. Homebrewers routinely search for specific calculators mid-brew ("strike water temperature calculator", "priming sugar calculator") and land on competitors like Brewer's Friend or Brewtoad.

We already have 5 standalone calculator pages in the Learn section (ABV, dilution, boil-off, carbonation, hydrometer). This PRD adds 5 more — the highest-traffic brewing searches we aren't covering — using the exact same pattern.

## Goals

- 5 new calculator pages, each with its own URL, JSON-LD schema, metadata, and article content
- Each calculator is interactive (client component) backed by a pure calculation function in `src/calculators/`
- Pages live under `/learn/` and appear in the Learn sidebar under "Calculators"
- All pages are server-rendered (page = RSC, calculator widget = `'use client'`)
- All routes added to `allLearnRoutes` for sitemap inclusion

## Non-Goals

- No auth, no saving results
- No multi-step recipe building (that's the builder)
- No integration with Firestore
- No unit preference persistence (session-only toggle is fine)

---

## The 5 Calculators

### 1. Strike Water Temperature — `/learn/strike-temp-calculator`

**What it does:** Given a target mash temperature, grain temperature, and mash thickness, calculate the required strike water temperature.

**Formula (Palmer heat balance):**
```
strikeTemp = targetTemp + (grainMass × 0.41 × (targetTemp − grainTemp)) / waterMass
```
Where `waterMass = grainMass × thickness` and `0.41` is the grain/water heat capacity ratio.

**Inputs:**
- Target mash temp (°C / °F toggle)
- Grain temperature (°C / °F)
- Mash thickness (L/kg or qt/lb)

**Output:** Strike water temperature in °C and °F

**SEO targets:** "strike water temperature calculator", "strike temp homebrewing", "mash infusion temperature"

**Existing service:** `MashScheduleService.calculateStrikeTemp()` — can be used directly or the formula can be inlined in `src/calculators/strikeTemp.ts`

**Article hook:** "Heat transfer between hot water and cold grain. Why you always need to add a few degrees."

---

### 2. Priming Sugar — `/learn/priming-sugar-calculator`

**What it does:** Calculate how much priming sugar to add for bottle conditioning, based on target CO₂ volumes, batch size, and beer temperature (residual CO₂).

**Formula:**
```
residualCO2 = 3.0378 − (0.050062 × tempF) + (0.00026555 × tempF²)
sugarNeeded_g = batchL × (targetVols − residualCO2) × sugarFactor
```
Sugar factors: corn sugar (dextrose) = 4.0 g/L/vol, table sugar = 3.8 g/L/vol, DME = 5.3 g/L/vol.

**Inputs:**
- Batch size (L / gal toggle)
- Beer temperature at time of priming (°C / °F)
- Target CO₂ volumes
- Sugar type (corn sugar / table sugar / DME)

**Output:** Grams and ounces of priming sugar

**SEO targets:** "priming sugar calculator", "bottle carbonation calculator", "how much priming sugar homebrew"

**Article hook:** "Residual CO₂ is already dissolved in your beer. Ignore it and you'll over-carbonate."

---

### 3. SRM Beer Color — `/learn/srm-calculator`

**What it does:** Estimate beer color in SRM from a simplified grain bill (weights + Lovibond values) and batch volume.

**Formula (Morey equation):**
```
MCU = Σ(weight_lb × color_lovibond) / volume_gal
SRM = 1.4922 × MCU^0.6859
```

**Inputs:**
- Batch volume (L / gal)
- Up to 6 grain rows: name (optional), weight (kg / lb), color (°L)

**Output:** SRM value + visual color swatch (CSS background color mapped from SRM)

**SEO targets:** "SRM calculator homebrew", "beer color calculator", "Lovibond to SRM", "what color will my beer be"

**Article hook:** "SRM is just a number. The swatch is what brewers actually care about."

**Note:** SRM → hex color mapping uses the standard lookup table (SRM 1–40+).

---

### 4. IBU — `/learn/ibu-calculator`

**What it does:** Calculate IBUs from one or more hop additions using the Tinseth utilization model.

**Formula (Tinseth):**
```
bignessFactor = 1.65 × 0.000125^(OG − 1)
timeFactor = (1 − e^(−0.04 × boilTime)) / 4.15
utilization = bignessFactor × timeFactor
IBU_addition = (grams × AA% × utilization × 1000) / volumeL
totalIBU = Σ IBU_addition
```

**Inputs:**
- Batch volume (L / gal)
- Boil OG (gravity at start of boil, default 1.050)
- Up to 8 hop rows: name (optional), weight (g / oz), AA%, boil time (min)

**Output:** IBU per addition + total IBU

**SEO targets:** "IBU calculator", "homebrew bitterness calculator", "Tinseth IBU", "how to calculate IBUs"

**Article hook:** "Tinseth is the industry default for a reason — but whirlpool and dry hops aren't in this model."

---

### 5. Pitch Rate — `/learn/pitch-rate-calculator`

**What it does:** Calculate required yeast cell count and whether a starter is needed, based on OG, batch volume, and beer type.

**Formula:**
```
°Plato = (OG − 1) × 1000 / 4  (approximation)
cellsNeeded = pitchRate × volumeMl × °Plato  (billions)
```
Pitch rates: ale = 0.75M cells/mL/°P, lager = 1.5M cells/mL/°P, high-gravity ale = 1.0M.

Viability decay (White model):
```
viability = max(0.75, 1 − 0.003 × daysSinceManufacture)
cellsAvailable = packetsUsed × 100B × viability
```

**Inputs:**
- Batch volume (L / gal)
- Original gravity
- Beer type (ale / lager / high-gravity ale)
- Manufacture date of yeast (for viability)
- Number of packets / vials

**Output:** Cells needed (B), cells available (B), viability %, whether a starter is recommended

**SEO targets:** "yeast pitch rate calculator", "homebrew yeast calculator", "how many yeast cells homebrew", "do I need a yeast starter"

**Article hook:** "Underpitching is the #1 cause of off-flavors. The math isn't complicated."

---

## Implementation Pattern (Same for All 5)

Each calculator follows the same 4-file structure already established by the existing 5:

```
src/calculators/{name}.ts          ← pure function, no React, exported + tested
src/components/{Name}Calculator.tsx ← 'use client', uses the pure function
app/learn/{slug}/page.tsx           ← RSC page: metadata, JSON-LD, LearnArticle wrapper
src/modules/learn/docsConfig.ts     ← add link entry under "Calculators" section
```

### File checklist per calculator

Each calculator needs:
- [ ] Pure calc function in `src/calculators/`
- [ ] Client component in `src/components/`
- [ ] Page file at `app/learn/{slug}/page.tsx` with:
  - [ ] `export const metadata` (title, description, keywords, canonical)
  - [ ] JSON-LD `SoftwareApplication` schema
  - [ ] `<LearnArticle>` wrapper with title, subtitle, relatedLearn, ctaText
  - [ ] Article content (~400–600 words): what it is, the calculator widget, how we calculate it, formula callout, worked example
- [ ] Entry in `docsConfig.ts` `learnNav` under "Calculators"
- [ ] Route included in `allLearnRoutes` (automatic via `learnNav`)

---

## Implementation Checklist

### Setup
- [ ] No new dependencies needed — all formulas inline or use existing services

---

### Calculator 1: Strike Water Temperature

- [ ] `src/calculators/strikeTemp.ts` — export `calculateStrikeTemp(targetC, grainTempC, thicknessLPerKg): number`
- [ ] `src/components/StrikeTempCalculator.tsx` — inputs: target mash temp, grain temp, thickness; °C/°F toggle; output gauge
- [ ] `app/learn/strike-temp-calculator/page.tsx` — metadata, JSON-LD, LearnArticle, formula callout, worked example
- [ ] `docsConfig.ts` — add `{ href: "/learn/strike-temp-calculator", label: "Strike Water Temp", description: "..." }`

---

### Calculator 2: Priming Sugar

- [ ] `src/calculators/primingSugar.ts` — export `calculatePrimingSugar(batchL, tempC, targetVols, sugarType): { grams, oz }`
- [ ] `src/components/PrimingSugarCalculator.tsx` — inputs: batch size, temp, target vols, sugar type dropdown; output: g + oz
- [ ] `app/learn/priming-sugar-calculator/page.tsx` — metadata, JSON-LD, LearnArticle, residual CO₂ explanation, CO₂ volumes by style reference table
- [ ] `docsConfig.ts` — add entry

---

### Calculator 3: SRM Beer Color

- [ ] `src/calculators/srm.ts` — export `calculateSRM(grains: {weightKg, colorL}[], batchL: number): number` + `srmToHex(srm: number): string`
- [ ] `src/components/SrmCalculator.tsx` — dynamic grain rows (add/remove), batch volume, color swatch output
- [ ] `app/learn/srm-calculator/page.tsx` — metadata, JSON-LD, LearnArticle, Morey formula callout, SRM style reference (straw → black)
- [ ] `docsConfig.ts` — add entry

---

### Calculator 4: IBU

- [ ] `src/calculators/ibu.ts` — export `tinsethUtilization(og, boilMinutes): number` + `calculateIBUs(hops: {grams, aa, boilMinutes}[], batchL, boilOG): {perAddition, total}`
- [ ] `src/components/IbuCalculator.tsx` — OG + volume inputs, dynamic hop rows, per-addition IBU column + total
- [ ] `app/learn/ibu-calculator/page.tsx` — metadata, JSON-LD, LearnArticle, Tinseth formula callout, note about whirlpool/dry-hop not included
- [ ] `docsConfig.ts` — add entry

---

### Calculator 5: Pitch Rate

- [ ] `src/calculators/pitchRate.ts` — export `calculatePitchRate(og, batchL, beerType, manufactureDateISO, packets): { cellsNeeded, cellsAvailable, viabilityPct, starterRecommended }`
- [ ] `src/components/PitchRateCalculator.tsx` — OG, volume, beer type, manufacture date, packet count; output: cells needed vs available, viability badge, starter recommendation
- [ ] `app/learn/pitch-rate-calculator/page.tsx` — metadata, JSON-LD, LearnArticle, pitch rate table by style, viability decay explanation
- [ ] `docsConfig.ts` — add entry

---

## Acceptance Criteria

- All 5 routes return 200 and render correctly
- Each page has unique `<title>`, `<meta name="description">`, canonical URL, and JSON-LD
- All 5 routes appear in `allLearnRoutes` (verified via sitemap)
- Calculator widgets produce correct output (spot-check against known values)
- All pages link to at least 2 related Learn articles or calculators via `relatedLearn`
- No TypeScript errors, no `any` types in new code
