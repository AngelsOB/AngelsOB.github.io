# BeerApp Documentation

## Project Overview

BeerApp is a comprehensive brewing application built with React, TypeScript, and Tailwind CSS. It provides recipe building, brewing calculations, and brew session management for homebrewers. The application uses local storage for data persistence and provides a rich set of calculators and utilities for creating and managing beer recipes.

### Tech Stack
- **Frontend Framework**: React 19.1.1
- **Language**: TypeScript 5.8.3
- **Routing**: React Router DOM 7.8.0
- **State Management**: Zustand 5.0.7
- **Styling**: Tailwind CSS 4.1.11
- **Charts**: Recharts 3.1.2
- **Drag & Drop**: DND Kit 6.3.1
- **Build Tool**: Vite 7.1.2

---

## Application Architecture

### Directory Structure

```
src/
├── assets/          # Static assets
├── calculators/     # Calculation modules (ABV, IBU)
├── components/      # Reusable UI components
├── hooks/          # Custom React hooks
├── modules/        # Feature modules
│   └── recipe/     # Recipe-specific components and types
├── pages/          # Route pages (Home, RecipeBuilder, Calculators, BrewMode)
├── types/          # TypeScript type definitions
└── utils/          # Utility functions and helpers
```

---

## Data Models

### Core Recipe Type

The `Recipe` type is the central data structure representing a complete beer recipe:

```typescript
type Recipe = {
  // Metadata
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;

  // Style targeting
  bjcpStyleCode?: string;
  targetProfile: {
    batchVolumeL: number;
    originalGravity: number;
    finalGravity: number;
    abv?: number;
    ibu?: number;
    srm?: number;
  };

  // Equipment snapshot
  equipment: {
    profileId: string;
    snapshotAt: string;
    snapshot: EquipmentProfile;
  };

  // Process settings
  processSettings: {
    mashEfficiencyPct: number;
    ibuCalculationMethod: "tinseth" | "rager" | "garetz";
    colorCalculationMethod: "morey" | "mosher" | "daniels";
    hopUtilizationFactor: number;
    brewMethod: "three-vessel" | "biab-full" | "biab-sparge" | "extract";
  };

  // Ingredients
  ingredients: {
    fermentables: FermentableAddition[];
    hops: HopAddition[];
    yeast: YeastAddition | null;
    water?: WaterTreatment;
    other: OtherAddition[];
  };

  // Process steps
  process: {
    mash?: MashProfile;
    fermentation: FermentationSchedule;
    packaging?: PackagingSettings;
  };

  // User preferences
  preferences: {
    displayUnits: "metric" | "us" | "imperial";
    preferredIbuMethod: "tinseth" | "rager" | "garetz";
    preferredColorMethod: "morey" | "daniels" | "mosher";
    sugarScale: "sg" | "plato" | "brix";
  };

  // Brew session tracking
  brewSessions: BrewSession[];

  // Calculated results
  calculated: CalculatedResults;
};
```

### Ingredient Addition Types

#### FermentableAddition
Represents grains, extracts, sugars, and adjuncts:
- **ingredientRef**: Reference to preset or custom ingredient
- **amountKg**: Amount in kilograms
- **usage**: Timing (mash, first-wort, boil, whirlpool, fermentation)
- **overrides**: Optional property overrides (color, potential, fermentability)

#### HopAddition
Represents hop additions at various stages:
- **ingredientRef**: Reference to hop preset or custom
- **amountG**: Amount in grams
- **usage**: Comprehensive timing information
  - **timing**: "first-wort" | "boil" | "whirlpool" | "dry-hop" | "mash"
  - **timeMin**: Time in minutes
  - **temperature**: Optional temp for whirlpool
  - **stage**: Optional stage for dry-hop
  - **dayOffsetFromFermentationStart**: Dry-hop scheduling
  - **durationDays**: Dry-hop duration
- **overrides**: Alpha acid, beta acid overrides

#### YeastAddition
Represents yeast and starter information:
- **ingredientRef**: Reference to yeast strain
- **form**: "liquid" | "dry" | "slurry"
- **quantity**: Packages or grams/ml
- **starter**: Optional multi-step starter plan
- **overrides**: Attenuation and temperature range

### Water Chemistry

#### WaterProfile
Represents water mineral content in ppm:
```typescript
type WaterProfile = {
  Ca: number;    // Calcium
  Mg: number;    // Magnesium
  Na: number;    // Sodium
  Cl: number;    // Chloride
  SO4: number;   // Sulfate
  HCO3: number;  // Bicarbonate
};
```

#### WaterTreatment
Comprehensive water treatment tracking:
- **sourceProfileId / targetProfileId**: References to water profiles
- **sourceProfile / targetProfile**: Actual profiles (for fidelity)
- **salts**: Gypsum, calcium chloride, epsom salt, table salt, baking soda (in grams)
- **acids**: Lactic, phosphoric acid (in ml), target mash pH
- **resultingProfile**: Calculated resulting water profile

### Equipment Profile

Detailed equipment specifications:
- **Volumes**: Batch, boil, fermenter, mash tun, deadspace volumes
- **Efficiency**: Mash efficiency %, brewhouse efficiency %
- **Losses**: Evaporation rate, grain/hop absorption, shrinkage, misc losses
- **Thermal**: Mash tun temp loss, grain temp, mash thickness
- **Timing**: Boil time, mash time
- **Calibration**: Hydrometer offset, wort correction, hop utilization factors

### UI Types (modules/recipe/types.ts)

Simplified UI types for components:

#### GrainItem
```typescript
type GrainItem = {
  id: string;
  name: string;
  weightKg: number;
  colorLovibond: number;
  potentialGu: number;
  type: "grain" | "adjunct_mashable" | "extract" | "sugar";
  fermentability?: number;
  customNameLocked?: boolean;
  customNameSelected?: boolean;
};
```

#### HopItem
```typescript
type HopItem = {
  id: string;
  name: string;
  grams: number;
  alphaAcidPercent: number;
  timeMin: number;
  category?: string;
  type: "boil" | "dry hop" | "whirlpool" | "first wort" | "mash";
  flavor?: HopFlavorProfile;
  dryHopStage?: "primary" | "post-fermentation" | "keg";
  dryHopStartDay?: number;
  dryHopDays?: number;
  whirlpoolTempC?: number;
  whirlpoolTimeMin?: number;
};
```

---

## State Management

### Zustand Store (useRecipeStore)

The application uses a single Zustand store for recipe management:

```typescript
type State = {
  recipes: Recipe[];
  upsert: (recipe: Recipe) => void;  // Create or update recipe
  remove: (id: string) => void;       // Delete recipe
};
```

**Key Features**:
- Initializes with a demo recipe (Belgian Tripel/Patersbier) if empty
- Auto-syncs to localStorage on every change
- Manages timestamps automatically (updatedAt)

**Storage Keys**:
- `beerapp.recipes` - Main recipe storage
- `beerapp.equipment` - Equipment profiles
- `beerapp.ingredients.*` - Custom ingredients
- `beerapp.waterProfiles` - Saved water profiles

### Local Storage Structure

All data is persisted using a versioned storage format:

```typescript
type StoredValue<T> = {
  version: number;
  value: T;
};
```

The `storage.ts` utility provides `loadJson<T>` and `saveJson<T>` functions for type-safe persistence.

---

## Calculation Methods

### Gravity Calculations

#### Original Gravity (OG)
```typescript
ogFromGrainBill(grains, volumeL, efficiencyDecimal)
```

**Formula**:
1. Convert grain weights to pounds
2. Calculate total gravity units: `weightLb × PPG × efficiency`
3. Divide by batch volume in gallons
4. Convert to OG: `1 + points/1000`

**Efficiency Handling**:
- Mash efficiency applies to grains and mashable adjuncts
- 100% efficiency for extracts and sugars

#### Points from Grain Bill
```typescript
pointsFromGrainBill(grains, batchVolumeL, efficiencyDecimal)
```

Calculates gravity points (GU) per gallon using PPG (points per pound per gallon).

### ABV Calculation

#### Simple Formula (Default)
```typescript
abvSimple(og, fg) = (og - fg) × 131.25
```

This is the standard simple formula used throughout the app.

#### Morey Formula (Alternative)
```typescript
abvMorey(og, fg)
```
More accurate but complex, accounting for alcohol by weight conversion.

### IBU Calculation (Tinseth Method)

The app primarily uses the Tinseth method with enhancements:

#### Core Tinseth Formulas

**Gravity Factor**:
```typescript
gravityFactor(wortGravity) = 1.65 × 0.000125^(wortGravity - 1.0)
```

**Time Factor**:
```typescript
timeFactor(minutes) = (1 - e^(-0.04 × minutes)) / 4.15
```

**Utilization**:
```typescript
utilization = gravityFactor × timeFactor
```

#### Timing-Specific Adjustments

**First Wort Hops**: +10% utilization boost
```typescript
utilization = tinsethUtilization(time, gravity) × 1.1
```

**Whirlpool Hops**: Temperature-adjusted utilization
```typescript
tempFactor = ((clampedTemp - 60) / 40)^1.8
utilization = gravityFactor × timeFactor × tempFactor
```

**Dry Hops**: ~5% contribution from non-isomerized compounds
```typescript
utilization = tinsethUtilization(60, gravity) × 0.05
```

**Mash Hops**: 15% of base utilization
```typescript
utilization = tinsethUtilization(60, gravity) × 0.15
```

#### IBU per Addition
```typescript
IBU = (weightGrams × alphaAcid% × 1000 × utilization) / volumeLiters
```

### Color Calculation (SRM)

#### Morey Method (Default)
```typescript
// Calculate MCU (Malt Color Units)
MCU = Σ(weightLbs × colorLovibond) / volumeGallons

// Convert to SRM using Morey formula
SRM = 1.4922 × MCU^0.6859
```

#### Color to Hex Conversion
The app uses a lookup table with 21 SRM reference points and linear RGB interpolation for accurate color display.

### Water Calculations

#### Pre-Boil Volume
```typescript
preBoilVolume = batchVolume + boilOff + losses
```

Where:
- `boilOff = boilOffRateLPerHour × (boilTimeMin / 60)`
- `losses` include trub, kettle deadspace, and optional shrinkage

#### Advanced Mode (with cooling shrinkage)
```typescript
postBoilHotL = (batchVolume + kettleLoss + chillerLoss) / shrinkFactor
preBoilL = postBoilHotL + boilOff
```

#### Mash Water
```typescript
mashWater = totalGrainKg × mashThicknessLPerKg + deadspace
```

Typical mash thickness: 3 L/kg

#### Sparge Water
```typescript
mashRunoff = mashWater - (grainAbsorption × totalGrainKg) - deadspace
spargeWater = preBoilVolume - mashRunoff
```

Dynamic hop absorption is added to kettle losses:
```typescript
hopLoss = totalKettleHopKg × hopsAbsorptionLPerKg
```

### FG Estimation

Complex model incorporating multiple factors:

```typescript
effectiveAttenuation = baseAttenuation
  + mashTempAdjustment      // (66 - mashTempC) × 0.006 per minute
  + decoctionAdjustment      // +0.005 per minute of decoction
  + mashTimeAdjustment       // ±0.005 per 15 min from 60 min baseline
  + fermentTempAdjustment    // (fermentTempC - 20) × 0.004
  + fermentTimeAdjustment    // (fermentDays - 10) × 0.002

// Clamp to reasonable range
effectiveAttenuation = clamp(effectiveAttenuation, 0.6, 0.95)

// Calculate FG
FG = 1 + (OG - 1) × (1 - effectiveAttenuation)
```

### Hop Flavor Estimation

Sophisticated model for predicting hop flavor profile:

#### Timing Aroma Factors

**Dry Hop**: Base 0.6, increases with duration (saturates at 7 days)
```typescript
factor = 0.6 + 0.4 × (1 - e^(-0.6 × min(7, days)))
```

Start day adjustment for CO₂ scrubbing and staling.

**Whirlpool**: Base 0.75, adjusted for temperature and time
```typescript
tempFactor = 0.6 + 0.4 × ((95 - tempC) / 20)  // Cooler = better
timeFactor = 1 - e^(-0.06 × time)             // Saturates ~30 min
factor = 0.5 + 0.5 × tempFactor × timeFactor
```

**Boil**: Exponential decay
```typescript
factor = e^(-0.05 × timeMin)
```

**First Wort**: 0.08 fixed factor

**Mash**: 0.05 fixed factor

#### Overall Recipe Flavor

```typescript
// Weight each hop by dose (g/L) and timing factor
weight_i = (grams_i / batchL) × aromaFactor(timing_i)

// Sum contributions for each flavor axis
axisSum = Σ(weight_i × (flavorScore / 5))

// Calculate overall intensity (0-5 scale)
magnitude = 5 × (1 - e^(-0.7 × Σweight_i))

// Final flavor profile
flavorAxis = magnitude × (axisSum / Σweight_i)
```

Flavor axes: citrus, tropical fruit, stone fruit, berry, floral, grassy, herbal, spice, resin/pine

---

## Data Flow

### Recipe Creation/Editing Flow

```
1. User Input (RecipeBuilder Page)
   ↓
2. Local State Updates (useState)
   ↓
3. useRecipeCalculations Hook
   - Receives: grains, hops, yeast, volumes, etc.
   - Calculates: OG, FG, ABV, IBU, SRM, water volumes
   ↓
4. Real-time Display Updates
   - SummaryStickyHeader shows calculated values
   - Individual sections show relevant calculations
   ↓
5. Save Action
   - Maps UI types to Recipe types
   - Adds equipment snapshot
   - Stores calculated values
   ↓
6. useRecipeStore.upsert()
   ↓
7. localStorage Sync (automatic)
```

### Calculation Dependencies

```
Grains + Volume + Efficiency
  → OG Calculation
    → IBU Calculation (requires OG)
      → Display Updates

Grains + Volume
  → SRM Calculation
    → Color Hex Conversion
      → Visual Display

Grains + Water Params
  → Pre-boil Volume
    → Mash Water
      → Sparge Water
        → Display & Validation

Hops + Volume + Flavor Profiles
  → Flavor Estimation
    → Radar Chart Display
```

### Component Hierarchy

```
App
├── NavBar
└── Outlet (React Router)
    ├── Home
    ├── Calculators
    │   ├── AbvCalculator
    │   ├── IbuCalculator
    │   ├── CarbonationCalculator
    │   ├── WaterSaltsCalc
    │   └── YeastPitchCalc
    ├── RecipeBuilder
    │   ├── SummaryStickyHeader
    │   ├── StyleSelector
    │   ├── GrainBill
    │   │   └── SearchSelect (for grain selection)
    │   ├── HopSchedule
    │   │   ├── SearchSelect (for hop selection)
    │   │   └── HopFlavorMini (flavor display)
    │   ├── YeastSection
    │   ├── MashSchedule
    │   ├── FermentationSection
    │   ├── WaterSettings
    │   │   └── WaterSaltsSection
    │   ├── OtherIngredients
    │   └── FlavorGraphs
    │       └── HopFlavorRadar
    └── BrewMode
        └── FermentationPlan
```

---

## Key Methods & Functions

### Core Calculations (utils/calculations.ts)

#### `ogFromPoints(points: number): number`
Converts gravity points to OG value (1.xxx format).

#### `pointsFromGrainBill(grains, batchVolumeL, efficiencyDecimal): number`
Calculates total gravity contribution from grain bill.
- Handles different grain types (mashable vs extract/sugar)
- Applies efficiency only to mashable ingredients

#### `abvSimple(og: number, fg: number): number`
Simple ABV calculation: `(OG - FG) × 131.25`

#### `mcuFromGrainBill(grains, volumeL): number`
Calculates Malt Color Units for SRM calculation.

#### `srmMoreyFromMcu(mcu: number): number`
Converts MCU to SRM using Morey formula: `1.4922 × MCU^0.6859`

#### `srmToHex(srm: number): string`
Converts SRM value to hex color code using interpolated lookup table.

#### `computePreBoilVolumeL(batchVolumeL, params): number`
Calculates required pre-boil volume accounting for:
- Boil-off (rate × time)
- Trub/kettle losses
- Optional cooling shrinkage (advanced mode)

#### `computeMashWaterL(totalGrainKg, params): number`
Calculates mash water: `grainKg × thickness + deadspace`

#### `computeSpargeWaterL(totalGrainKg, batchVolumeL, params): number`
Calculates sparge water to hit pre-boil volume after accounting for:
- Grain absorption
- Mash tun deadspace
- Mash runoff volume

### IBU Calculations (calculators/ibu.ts)

#### `tinsethGravityFactor(wortGravity: number): number`
Tinseth gravity correction factor.

#### `tinsethTimeFactor(minutes: number): number`
Tinseth time-based utilization curve.

#### `tinsethUtilization(minutes, wortGravity): number`
Combined utilization factor.

#### `whirlpoolUtilization(minutes, tempC, wortGravity): number`
Special handling for whirlpool additions with temperature scaling.

#### `ibuSingleAddition(addition, postBoilVolumeLiters, wortGravity): number`
Calculates IBU for a single hop addition, handling all timing types.

#### `ibuTotal(additions, postBoilVolumeLiters, wortGravity): number`
Sums IBU contributions from all hop additions.

### Water Chemistry (utils/water.ts)

#### `addProfiles(a: WaterProfile, b: WaterProfile): WaterProfile`
Adds two water profiles ion-by-ion.

#### `scaleProfile(p: WaterProfile, factor: number): WaterProfile`
Scales all ions by a factor.

#### `ionDeltaFromSalts(salts: SaltAdditions, volumeL: number): WaterProfile`
Calculates ion contributions from salt additions using molecular weights:
- Gypsum (CaSO₄·2H₂O): 232.8 ppm Ca, 558.3 ppm SO₄ per g/L
- CaCl₂·2H₂O: 272.6 ppm Ca, 482.0 ppm Cl per g/L
- Epsom (MgSO₄·7H₂O): 98.6 ppm Mg, 389.6 ppm SO₄ per g/L
- NaCl: 393.4 ppm Na, 606.6 ppm Cl per g/L
- NaHCO₃: 273.7 ppm Na, 726.3 ppm HCO₃ per g/L

#### `mixProfiles(volumesAndProfiles): WaterProfile`
Volume-weighted average of multiple water profiles.

#### `chlorideToSulfateRatio(profile): number | null`
Calculates Cl:SO₄ ratio (key for flavor balance).

### Hop Flavor (utils/hopsFlavor.ts)

#### `timingAromaFactor(type, timeMin, ...): number`
Returns 0-1 factor for aroma retention based on timing.

#### `normalizeHopFlavor(flavor): HopFlavorProfile`
Ensures all 9 flavor axes are present with defaults.

#### `estimateRecipeHopFlavor(hops, batchVolumeL): HopFlavorProfile`
Main algorithm for recipe flavor estimation:
1. Weight each hop by dose (g/L) and timing factor
2. Sum weighted contributions per flavor axis
3. Calculate overall magnitude from total weight
4. Scale axes proportionally to magnitude

#### `estimatePerHopContributions(hops, batchVolumeL)`
Returns individual hop contributions for detailed display.

### Presets (utils/presets.ts)

#### `getGrainPresets(): GrainPreset[]`
Merges generated grain database with custom additions.

#### `getGrainPresetsGrouped(): Array<{label, items}>`
Groups grains by category:
- Base malts
- Crystal/Caramel
- Roasted
- Toasted & specialty
- Adjuncts (mashable/flaked)
- Extracts
- Sugars
- Lauter aids & other

#### `getGrainPresetsGroupedByVendor()`
Groups by both grain type and vendor for organized selection.

#### `getHopPresets(): HopPreset[]`
Returns all hop presets with flavor profiles.
Categories: US Hops, Noble Hops, New Zealand Hops, Australian Hops, English Hops, German Hops

#### `getYeastPresets(): YeastPreset[]`
Returns yeast strains from multiple laboratories:
- Escarpment Labs
- Wyeast
- Fermentis
- Lallemand
- Imperial Yeast
- Omega Yeast
- White Labs

#### `getOtherIngredientPresets()`
Returns categorized additives:
- water-agent: pH adjustment, minerals
- fining: clarity agents
- spice: spices and herbs
- flavor: flavor additions
- herb: herbal additions
- other: yeast nutrients, enzymes

### Custom Hooks

#### `useRecipeStore()`
Zustand store hook providing:
- `recipes: Recipe[]` - All saved recipes
- `upsert(recipe)` - Create/update recipe
- `remove(id)` - Delete recipe

#### `useRecipeCalculations(params)`
Main calculation hook that returns:
- **Gravity**: `ogAutoCalc`, `ogUsed`, `fgEstimated`, `fgUsed`
- **Alcohol**: `abv`
- **Color**: `srm`, `color` (hex)
- **Bitterness**: `ibu`
- **Water**: `totalGrainKg`, `preBoilVolumeL`, `mashWaterL`, `spargeWaterL`, `finalMashL`, `finalSpargeL`
- **Fermentation**: `fermentDays`, `fermentTempC`
- **Flavor**: `estimatedTotalFlavor`
- **Flags**: `hasSecondTiming`, `hasDryHopAdditions`, `hasDecoctionStep`, `capacityExceeded`

Real-time recalculation on any input change.

### BJCP Integration (utils/bjcp.ts)

#### `BJCP_CATEGORIES: BjcpCategory[]`
Complete 2021 BJCP style guidelines (34 categories, 100+ styles).

#### `flatBjcpStyles()`
Flattened array of all styles with category info.

#### `findBjcpStyleByCode(code: string)`
Looks up style details by code (e.g., "21A" → American IPA).

### Unit Conversions (utils/units.ts)

#### Temperature
- `cToF(c: number): number` - Celsius to Fahrenheit
- `fToC(f: number): number` - Fahrenheit to Celsius

#### Volume
- `lToGal(l: number): number` - Liters to gallons
- `galToL(gal: number): number` - Gallons to liters

---

## Component Details

### RecipeBuilder (pages/RecipeBuilder.tsx)

Main recipe editing page with complex state management.

**State Variables**:
- Recipe metadata (name, batch volume, efficiency)
- Ingredient arrays (grains, hops, yeast, other)
- Process steps (mash, fermentation)
- Water parameters
- OG/FG override controls
- Unsaved changes tracking

**Key Features**:
- Auto-save detection with dirty state tracking
- Real-time calculations via `useRecipeCalculations`
- Load recipe from ID or create new
- Save/delete operations with confirmation
- Navigate to brew mode

**Sub-components**:
- `SummaryStickyHeader` - OG, FG, ABV, IBU, SRM display
- `StyleSelector` - BJCP style selection
- `GrainBill` - Grain bill editor with drag-drop
- `HopSchedule` - Hop schedule with timing controls
- `YeastSection` - Yeast and starter management
- `MashSchedule` - Mash step editor
- `FermentationSection` - Fermentation schedule
- `WaterSettings` - Water chemistry calculator
- `OtherIngredients` - Additional ingredients
- `FlavorGraphs` - Hop flavor visualization

### GrainBill (modules/recipe/components/GrainBill.tsx)

Grain bill editor with DND Kit for reordering.

**Features**:
- Add grains from extensive preset database
- Drag-and-drop reordering
- Inline weight editing
- Type indicators (grain/extract/sugar/adjunct)
- Per-grain contribution display
- Total weight calculation
- Fermentable timing (mash/boil/fermentation)

### HopSchedule (modules/recipe/components/HopSchedule.tsx)

Comprehensive hop schedule editor.

**Timing Types**:
- Boil (with time in minutes)
- First Wort
- Whirlpool (time + temperature)
- Dry Hop (start day + duration)
- Mash

**Features**:
- Per-hop IBU calculation
- Alpha acid editing
- Flavor profile display
- Dry-hop scheduling with fermentation offset
- Whirlpool temperature control
- Inline editing

### YeastSection (modules/recipe/components/YeastSection.tsx)

Yeast selection and starter calculator.

**Features**:
- Yeast strain selection from presets
- Attenuation percentage override
- Starter volume calculation
- Multi-step starter planning
- Liquid/dry/slurry form selection

### MashSchedule (modules/recipe/components/MashSchedule.tsx)

Mash step editor for single infusion, step mash, or decoction.

**Step Types**:
- Infusion (with strike temp calculation)
- Ramp (temperature change)
- Decoction (with decoction percentage)

**Features**:
- Strike water temperature calculator
- Mash thickness adjustment
- Grain absorption settings
- Dead space configuration

### FermentationSection (modules/recipe/components/FermentationSection.tsx)

Fermentation schedule builder.

**Stage Types**:
- Primary
- Secondary
- Diacetyl rest
- Cold crash
- Lagering
- Conditioning
- Spunding

**Features**:
- Temperature per stage
- Duration in days
- Pressure (psi) for spunding
- Notes per stage
- Dry-hop reminders
- Total fermentation time calculation

### WaterSettings (modules/recipe/components/WaterSettings.tsx)

Comprehensive water chemistry management.

**Features**:
- Source/target profile selection
  - Common profiles (RO, Pilsen, Burton, etc.)
  - Style-based targets (APA, NEIPA, Pilsner, etc.)
  - Custom profiles
- Salt calculator with real-time ion updates
- Chloride:Sulfate ratio tracking
- Ion target ranges per style
- Mash water calculations
- Sparge water calculations
- BIAB mode support

### Calculators

#### AbvCalculator
Standalone ABV calculator with OG/FG inputs.

#### IbuCalculator
IBU calculator with:
- Multiple hop additions
- Timing type support
- Batch volume input
- OG input for utilization

#### CarbonationCalculator
Calculates priming sugar for target CO₂ volumes:
- Beer temperature input
- Target volumes of CO₂
- Sugar type selection
- Residual CO₂ estimation

#### WaterSaltsCalc
Standalone water chemistry calculator (similar to WaterSettings but independent).

#### YeastPitchCalc
Yeast pitch rate calculator:
- Batch volume
- OG
- Yeast form (liquid/dry)
- Pitch rate recommendations
- Starter size calculation

### BrewMode (pages/BrewMode.tsx)

Brew day execution mode with timer and checklist.

**Features**:
- Step-by-step brew day guide
- Mash step timer
- Hop addition alerts
- Fermentation schedule display
- Actual gravity tracking
- Session notes

### Visualization Components

#### HopFlavorRadar (components/HopFlavorRadar.tsx)

Recharts-based radar chart displaying 9 flavor axes:
- Citrus
- Tropical Fruit
- Stone Fruit
- Berry
- Floral
- Grassy
- Herbal
- Spice
- Resin/Pine

Color-coded axes with 0-5 scale.

#### StyleRangeBars (components/StyleRangeBars.tsx)

Visual display of BJCP style ranges vs actual recipe values:
- OG, FG, ABV, IBU, SRM
- Green bars for in-range
- Red indicators for out-of-range
- Target ranges from BJCP data

---

## Storage & Persistence

### localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `beerapp.recipes` | `Recipe[]` | All saved recipes |
| `beerapp.equipment` | `EquipmentProfile[]` | Equipment profiles |
| `beerapp.ingredients.fermentables` | `FermentableIngredient[]` | Custom grains |
| `beerapp.ingredients.hops` | `HopIngredient[]` | Custom hops |
| `beerapp.ingredients.yeasts` | `YeastIngredient[]` | Custom yeasts |
| `beerapp.waterProfiles` | `SavedWaterProfile[]` | Custom water profiles |
| `beerapp.customGrains` | `GrainPreset[]` | User-added grains |
| `beerapp.customHops` | `HopPreset[]` | User-added hops |
| `beerapp.customYeasts` | `YeastPreset[]` | User-added yeasts |

### Storage Utilities

#### `loadJson<T>(key: string, defaultValue: T): T`
Safely loads and parses JSON from localStorage with fallback.

#### `saveJson<T>(key: string, value: T, version?: number): void`
Saves data with version wrapper for future migration support.

Format:
```json
{
  "version": 1,
  "value": { ... }
}
```

---

## Preset Data

### Grain Database

The app includes an extensive grain database (`presets.generated.grains.json`) with:
- **Base malts**: Pilsner, Pale, Munich, Vienna, Wheat, Rye
- **Crystal/Caramel malts**: Various Lovibond ratings
- **Roasted malts**: Chocolate, Black, Roasted Barley
- **Specialty malts**: Aromatic, Victory, Biscuit, Melanoidin
- **Adjuncts**: Flaked oats, corn, barley, rice
- **Extracts**: DME and LME variants
- **Sugars**: Candi syrup, table sugar, honey, maple syrup

Each grain includes:
- **Name** (full "Vendor - Product"), plus split **producer** + **productName** fields
- **Color** (°Lovibond)
- **Potential** (GU/PPG)
- **Type** (grain/adjunct/extract/sugar)
- **Origin code** (ISO country codes)

### Hop Presets

224 hop varieties (`presets.generated.hops.json`) with:
- **Alpha & beta acid %**, **total oil**, **cohumulone**, **origin** — facts from kasperg3's HopDatabase (MIT), which aggregates grower specs
- **Flavor profile** (9-axis 0–5 radar): Citrus, Tropical Fruit, Stone Fruit, Berry, Floral, Grassy, Herbal, Spice, Resin/Pine — 65 hand-curated, the rest derived from grower aroma data and reconciled against BeerMaverick (provenance per hop via `flavorSource` / `flavorConfidence`)
- **Category** (US, Noble, NZ, Australian, English, German)

Popular varieties: Cascade, Citra, Mosaic, Simcoe, Galaxy, Nelson Sauvin, Saaz, Hallertau Mittelfrüh, etc.

### Yeast Presets

143 yeast strains from major laboratories (thin fields today — structured enrichment planned, see docs/ingredient-data-plan.md):
- **Escarpment Labs**: 40+ strains
- **Wyeast**: 30+ strains
- **Fermentis**: SafAle, SafLager, SafBrew series
- **Lallemand**: LalBrew series
- **Imperial Yeast**
- **Omega Yeast**: OYL series
- **White Labs**: WLP series

Each includes:
- Attenuation percentage (where known)
- Category/laboratory
- Typical temperature ranges

### Water Profiles

Pre-configured profiles:
- **Common sources**: RO, Montreal, various city waters
- **Style targets**: Pilsner, APA, NEIPA, Stout, Helles, ESB, Belgian Ale, Wheat Beer, Strong Ale
- Each includes ion ranges and brewing tips

### BJCP Styles

Complete 2021 BJCP guidelines:
- 34 categories
- 100+ styles
- Includes specialty styles and historical beers
- Provisional styles (e.g., NZ Pilsner)

---

## Routing

### Routes (main.tsx)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Home | Landing page with quick links |
| `/calculators` | Calculators | Standalone calculator tools |
| `/recipes` | RecipeBuilder | Recipe creation/editing |
| `/brew/:id` | BrewMode | Brew day execution mode |
| `/test` | DualUnitInputTest | UI component testing |

All routes are lazily loaded for code splitting.

---

## Development Notes

### Code Organization Principles

1. **Separation of Concerns**:
   - Pure calculation functions in `utils/` and `calculators/`
   - UI components in `components/` and `modules/`
   - Type definitions centralized in `types/`

2. **Type Safety**:
   - Strict TypeScript throughout
   - Separate types for storage (Recipe) vs UI (GrainItem, HopItem)
   - Explicit conversion functions between type domains

3. **Calculation Philosophy**:
   - Calculations are pure functions
   - All calculations use metric internally
   - Unit conversion only at display layer

4. **State Management**:
   - Single Zustand store for recipes
   - Local component state for UI-only data
   - No global state for calculations (derived in hooks)

### Performance Considerations

- **Lazy Loading**: Routes are code-split
- **Memoization**: Heavy calculations use `useMemo`
- **Selective Re-renders**: Calculations only run when dependencies change
- **Debouncing**: Consider adding for rapid input changes

### Future Enhancement Opportunities

1. **Export/Import**:
   - BeerXML 2.0 support (interfaces defined but not implemented)
   - JSON export/import
   - PDF recipe cards

2. **Advanced Features**:
   - Multi-step starter calculator enhancements
   - Brew session tracking with charts
   - Recipe scaling
   - Equipment profile builder UI
   - Ingredient inventory tracking

3. **Calculations**:
   - Rager and Garetz IBU methods (interfaces exist)
   - Daniels and Mosher color methods
   - Mash pH prediction
   - Strike water temperature calculator enhancements

4. **Data Sync**:
   - Cloud storage option
   - Multi-device sync
   - Recipe sharing

5. **Mobile**:
   - PWA support
   - Offline mode
   - Timer notifications

---

## Testing Strategy

Currently no automated tests, but recommended areas:

1. **Unit Tests**:
   - All calculation functions in `utils/` and `calculators/`
   - Water chemistry calculations
   - Hop flavor estimation

2. **Integration Tests**:
   - Recipe save/load cycle
   - Calculation hook accuracy
   - Storage persistence

3. **E2E Tests**:
   - Recipe creation workflow
   - Calculator usage
   - Brew mode execution

---

## Troubleshooting

### Common Issues

**Calculations Not Updating**:
- Check that `useRecipeCalculations` dependencies are correct
- Verify useMemo dependency arrays
- Ensure state updates are immutable

**Storage Issues**:
- Check browser localStorage limits (typically 5-10MB)
- Verify JSON structure with dev tools
- Clear storage and reload if corrupted

**Performance Problems**:
- Reduce preset database size if needed
- Add debouncing to rapid inputs
- Check for unnecessary re-renders with React DevTools

---

## API Reference Summary

### Calculation Functions

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `ogFromPoints(pts)` | number | number | Points → OG |
| `pointsFromGrainBill(grains, vol, eff)` | Grains[], L, decimal | number | Total gravity points |
| `abvSimple(og, fg)` | number, number | number | ABV calculation |
| `mcuFromGrainBill(grains, vol)` | Grains[], L | number | Malt color units |
| `srmMoreyFromMcu(mcu)` | number | number | MCU → SRM |
| `srmToHex(srm)` | number | string | SRM → hex color |
| `ibuSingleAddition(hop, vol, og)` | HopAddition, L, number | number | IBU for one hop |
| `ibuTotal(hops, vol, og)` | HopAddition[], L, number | number | Total recipe IBU |
| `computePreBoilVolumeL(batch, params)` | L, WaterParams | number | Pre-boil volume |
| `computeMashWaterL(grain, params)` | kg, WaterParams | number | Mash water volume |
| `computeSpargeWaterL(grain, batch, params)` | kg, L, WaterParams | number | Sparge water volume |
| `estimateRecipeHopFlavor(hops, vol)` | HopItem[], L | HopFlavorProfile | Flavor estimation |

### Preset Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getGrainPresets()` | GrainPreset[] | All grain presets |
| `getGrainPresetsGrouped()` | GroupedGrains[] | Grains by type |
| `getGrainPresetsGroupedByVendor()` | GroupedGrains[] | Grains by vendor |
| `getHopPresets()` | HopPreset[] | All hop presets |
| `getYeastPresets()` | YeastPreset[] | All yeast presets |
| `getOtherIngredientPresets()` | Categorized strings | Additives by category |
| `flatBjcpStyles()` | BjcpStyle[] | All BJCP styles |
| `findBjcpStyleByCode(code)` | BjcpStyle? | Style lookup |

### Water Chemistry Functions

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `addProfiles(a, b)` | WaterProfile × 2 | WaterProfile | Add ions |
| `scaleProfile(p, factor)` | WaterProfile, number | WaterProfile | Scale ions |
| `ionDeltaFromSalts(salts, vol)` | SaltAdditions, L | WaterProfile | Salt → ion contribution |
| `mixProfiles(profiles)` | {vol, profile}[] | WaterProfile | Volume-weighted average |
| `chlorideToSulfateRatio(profile)` | WaterProfile | number? | Cl:SO₄ ratio |

---

## Glossary

**ABV**: Alcohol by Volume
**BJCP**: Beer Judge Certification Program
**BIAB**: Brew in a Bag
**DME**: Dry Malt Extract
**FG**: Final Gravity
**FWH**: First Wort Hops
**GU**: Gravity Units
**IBU**: International Bitterness Units
**LME**: Liquid Malt Extract
**MCU**: Malt Color Units
**OG**: Original Gravity
**PPG**: Points per Pound per Gallon
**SRM**: Standard Reference Method (color scale)
**Tinseth**: Popular IBU calculation method by Glenn Tinseth

---

## Version History

**Current Version**: 0.0.0 (initial development)

This is an active development project. Features and APIs may change.

---

## Credits & Resources

**Calculation Methods**:
- Tinseth IBU formula: Glenn Tinseth
- Morey SRM formula: Dan Morey
- BJCP Style Guidelines: bjcp.org

**Data Sources**:
- Grain database: Various malt specifications
- Hop varieties: Multiple hop grower catalogs
- Yeast strains: Laboratory strain charts
- Water profiles: Brewing literature and water reports

**Libraries**:
- React ecosystem (Facebook/Meta)
- Zustand (Poimandres)
- Recharts (Recharts team)
- DND Kit (Clauderic Demonet)
- Tailwind CSS (Tailwind Labs)
