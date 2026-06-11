# BeerApp Architecture Diagrams

This document contains visual representations of the BeerApp architecture, data flow, and system design using ASCII diagrams and Mermaid-compatible formats.

---

## Table of Contents

1. [Application Architecture Overview](#application-architecture-overview)
2. [Data Flow Diagrams](#data-flow-diagrams)
3. [Component Hierarchy](#component-hierarchy)
4. [State Management Flow](#state-management-flow)
5. [Calculation Pipeline](#calculation-pipeline)
6. [Storage Architecture](#storage-architecture)
7. [Recipe Data Model](#recipe-data-model)
8. [Water Chemistry Flow](#water-chemistry-flow)
9. [Hop Flavor Calculation](#hop-flavor-calculation)
10. [User Journey Maps](#user-journey-maps)

---

## Application Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BeerApp Frontend                         │
│                    (React 19 + TypeScript)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │              │  │              │  │              │          │
│  │    Pages     │  │  Components  │  │   Modules    │          │
│  │              │  │              │  │              │          │
│  │ - Home       │  │ - NavBar     │  │ - Recipe     │          │
│  │ - Calculators│  │ - Calculators│  │   Builder    │          │
│  │ - RecipeBuilder│ - SearchSelect│  │              │          │
│  │ - BrewMode   │  │ - Graphs     │  │              │          │
│  │              │  │ - Inputs     │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│  ┌────────────────────────┴──────────────────────────┐         │
│  │                                                    │         │
│  │              Custom Hooks Layer                   │         │
│  │                                                    │         │
│  │  ┌───────────────────┐  ┌────────────────────┐   │         │
│  │  │                   │  │                    │   │         │
│  │  │ useRecipeStore    │  │ useRecipeCalcs     │   │         │
│  │  │ (Zustand)         │  │ (Pure Functions)   │   │         │
│  │  │                   │  │                    │   │         │
│  │  └─────────┬─────────┘  └─────────┬──────────┘   │         │
│  │            │                      │              │         │
│  └────────────┼──────────────────────┼──────────────┘         │
│               │                      │                        │
│  ┌────────────┴──────────────────────┴──────────────┐        │
│  │                                                    │        │
│  │              Utilities & Calculators               │        │
│  │                                                    │        │
│  │  - calculations.ts  (Gravity, Water)              │        │
│  │  - ibu.ts          (IBU calculations)             │        │
│  │  - abv.ts          (ABV calculations)             │        │
│  │  - water.ts        (Water chemistry)              │        │
│  │  - hopsFlavor.ts   (Flavor estimation)            │        │
│  │  - presets.ts      (Ingredient database)          │        │
│  │  - bjcp.ts         (Style guidelines)             │        │
│  │  - storage.ts      (Persistence)                  │        │
│  │                                                    │        │
│  └────────────────────────┬───────────────────────────┘        │
│                           │                                    │
│  ┌────────────────────────┴───────────────────────────┐       │
│  │                                                     │       │
│  │               Browser localStorage                  │       │
│  │                                                     │       │
│  │  - beerapp.recipes                                 │       │
│  │  - beerapp.equipment                               │       │
│  │  - beerapp.ingredients.*                           │       │
│  │  - beerapp.waterProfiles                           │       │
│  │  - beerapp.custom*                                 │       │
│  │                                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Recipe Creation Flow

```
User Input
    │
    ├─ Recipe Name ────────────────┐
    ├─ Batch Volume ───────────────┤
    ├─ Efficiency % ───────────────┤
    │                              │
    ├─ Add Grains ─────────────────┤
    │   │                          │
    │   └─> Search Presets         │
    │       Add to Array ──────────┤
    │                              │
    ├─ Add Hops ───────────────────┤
    │   │                          │
    │   ├─> Select Hop             │
    │   ├─> Set Timing             │
    │   ├─> Set Amount ────────────┤
    │   │                          │
    ├─ Select Yeast ───────────────┤
    │                              │
    ├─ Configure Mash ─────────────┤
    │                              │
    ├─ Configure Fermentation ─────┤
    │                              │
    └─ Configure Water ────────────┤
                                   │
                                   ▼
                         ┌──────────────────┐
                         │                  │
                         │  Local State     │
                         │  (useState)      │
                         │                  │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │                          │
                    │  useRecipeCalculations   │
                    │                          │
                    │  Inputs:                 │
                    │  - grains[]              │
                    │  - hops[]                │
                    │  - yeast                 │
                    │  - batchVolumeL          │
                    │  - efficiencyPct         │
                    │  - waterParams           │
                    │  - mashSteps             │
                    │  - fermentationSteps     │
                    │                          │
                    └────────┬─────────────────┘
                             │
                             │ (useMemo - auto recalc)
                             │
                             ▼
                    ┌─────────────────────────┐
                    │  Calculation Results    │
                    │                         │
                    │  - OG: 1.056            │
                    │  - FG: 1.012            │
                    │  - ABV: 5.8%            │
                    │  - IBU: 42              │
                    │  - SRM: 6               │
                    │  - Color: #E0D01B       │
                    │  - PreBoilVol: 27L      │
                    │  - MashWater: 15L       │
                    │  - SpargeWater: 12L     │
                    │  - HopFlavor: {...}     │
                    │                         │
                    └────────┬────────────────┘
                             │
                             ├─────────────────────┐
                             │                     │
                             ▼                     ▼
                    ┌─────────────────┐   ┌──────────────┐
                    │  Display        │   │  Validation  │
                    │  Updates        │   │  Warnings    │
                    │                 │   │              │
                    │  - Header       │   │  - Capacity  │
                    │  - Sections     │   │    Exceeded  │
                    │  - Graphs       │   │  - Style     │
                    │                 │   │    Ranges    │
                    └─────────────────┘   └──────────────┘

User Clicks "Save Recipe"
            │
            ▼
    ┌───────────────────┐
    │  Map UI Types     │
    │  to Recipe Types  │
    │                   │
    │  GrainItem[]      │
    │    → Fermentable  │
    │       Addition[]  │
    │                   │
    │  HopItem[]        │
    │    → HopAddition[]│
    │                   │
    └────────┬──────────┘
             │
             ▼
    ┌────────────────────┐
    │  Build Recipe      │
    │  Object            │
    │                    │
    │  - Add metadata    │
    │  - Add equipment   │
    │    snapshot        │
    │  - Add calculated  │
    │    values          │
    │  - Add timestamps  │
    │                    │
    └────────┬───────────┘
             │
             ▼
    ┌─────────────────────┐
    │  useRecipeStore     │
    │  .upsert(recipe)    │
    │                     │
    └────────┬────────────┘
             │
             ▼
    ┌─────────────────────┐
    │  localStorage       │
    │  .setItem()         │
    │                     │
    │  Key: beerapp.      │
    │       recipes       │
    │                     │
    └─────────────────────┘
```

### Calculation Pipeline

```
                         INPUT DATA
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Grains  │         │  Hops   │         │  Yeast  │
    │         │         │         │         │         │
    │ - name  │         │ - name  │         │ - name  │
    │ - kg    │         │ - grams │         │ - atten │
    │ - color │         │ - AA%   │         │   %     │
    │ - GU    │         │ - time  │         │         │
    │ - type  │         │ - type  │         │         │
    └────┬────┘         └────┬────┘         └────┬────┘
         │                   │                   │
         │                   │                   │
    PARALLEL CALCULATIONS────┴───────────────────┘
         │
    ┌────┴─────────────────────────────────────────┐
    │                                               │
    ▼                                               ▼
┌──────────────────┐                    ┌──────────────────┐
│  Color (SRM)     │                    │  Gravity (OG)    │
│                  │                    │                  │
│  1. Sum MCU      │                    │  1. Calc points  │
│     per grain    │                    │     per grain    │
│                  │                    │                  │
│  2. Apply Morey  │                    │  2. Apply        │
│     formula      │                    │     efficiency   │
│                  │                    │                  │
│  3. Convert to   │                    │  3. Sum total    │
│     hex color    │                    │     points       │
│                  │                    │                  │
│  Output: SRM,    │                    │  4. Divide by    │
│          hex     │                    │     volume       │
└──────────────────┘                    │                  │
                                        │  Output: OG      │
                                        └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  IBU (Tinseth)   │
                                        │                  │
                                        │  For each hop:   │
                                        │                  │
                                        │  1. Get timing   │
                                        │     factor       │
                                        │                  │
                                        │  2. Calc gravity │
                                        │     factor (OG)  │
                                        │                  │
                                        │  3. Calc time    │
                                        │     factor       │
                                        │                  │
                                        │  4. Calculate    │
                                        │     utilization  │
                                        │                  │
                                        │  5. Calculate    │
                                        │     mg/L         │
                                        │                  │
                                        │  6. Sum all hops │
                                        │                  │
                                        │  Output: Total   │
                                        │          IBU     │
                                        └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  FG Estimation   │
                                        │                  │
                                        │  1. Get yeast    │
                                        │     attenuation  │
                                        │                  │
                                        │  2. Adjust for   │
                                        │     mash temp    │
                                        │                  │
                                        │  3. Adjust for   │
                                        │     mash time    │
                                        │                  │
                                        │  4. Adjust for   │
                                        │     decoction    │
                                        │                  │
                                        │  5. Adjust for   │
                                        │     ferment temp │
                                        │                  │
                                        │  6. Adjust for   │
                                        │     ferment time │
                                        │                  │
                                        │  7. Clamp to     │
                                        │     0.6-0.95     │
                                        │                  │
                                        │  8. Calculate FG │
                                        │                  │
                                        │  Output: FG      │
                                        └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  ABV             │
                                        │                  │
                                        │  (OG - FG) ×     │
                                        │  131.25          │
                                        │                  │
                                        │  Output: ABV %   │
                                        └────────┬─────────┘
                                                 │
    ┌────────────────────────────────────────────┤
    │                                            │
    ▼                                            ▼
┌──────────────────┐                    ┌──────────────────┐
│  Water Volumes   │                    │  Hop Flavor      │
│                  │                    │                  │
│  1. Calc total   │                    │  1. Normalize    │
│     grain kg     │                    │     hop flavors  │
│                  │                    │                  │
│  2. Calc pre-    │                    │  2. Weight by    │
│     boil volume  │                    │     dose (g/L)   │
│                  │                    │                  │
│  3. Calc mash    │                    │  3. Adjust by    │
│     water        │                    │     timing       │
│                  │                    │                  │
│  4. Calc sparge  │                    │  4. Sum weighted │
│     water        │                    │     axes         │
│                  │                    │                  │
│  5. Check mash   │                    │  5. Calculate    │
│     tun capacity │                    │     magnitude    │
│                  │                    │                  │
│  Output:         │                    │  6. Scale axes   │
│    - PreBoilL    │                    │                  │
│    - MashWaterL  │                    │  Output: Flavor  │
│    - SpargeL     │                    │    profile (9    │
│    - Warning?    │                    │    axes)         │
└──────────────────┘                    └──────────────────┘
         │                                       │
         └───────────────┬───────────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  FINAL RESULTS  │
                │                 │
                │  All calculated │
                │  values ready   │
                │  for display    │
                │                 │
                └─────────────────┘
```

---

## Component Hierarchy

```
App
│
├── NavBar
│   ├── Link (Home)
│   ├── Link (Recipes)
│   ├── Link (Calculators)
│   └── Link (Test)
│
└── Outlet (React Router)
    │
    ├── Route: / (Home)
    │   └── Home
    │       ├── Hero Section
    │       └── Quick Calculator Cards
    │
    ├── Route: /calculators (Calculators)
    │   └── Calculators
    │       ├── AbvCalculator
    │       │   ├── InputWithSuffix (OG)
    │       │   ├── InputWithSuffix (FG)
    │       │   └── Result Display
    │       │
    │       ├── IbuCalculator
    │       │   ├── Volume Input
    │       │   ├── OG Input
    │       │   ├── Hop Addition Rows
    │       │   │   ├── SearchSelect (hop)
    │       │   │   ├── Amount Input
    │       │   │   ├── Time Input
    │       │   │   └── Type Select
    │       │   └── Total IBU Display
    │       │
    │       ├── CarbonationCalculator
    │       │   ├── Volume Input
    │       │   ├── Temperature Input
    │       │   ├── CO2 Volumes Input
    │       │   ├── Sugar Type Select
    │       │   └── Priming Sugar Result
    │       │
    │       ├── WaterSaltsCalc
    │       │   ├── Volume Input
    │       │   ├── Source Profile Select
    │       │   ├── Target Profile Select
    │       │   ├── Salt Inputs (6 types)
    │       │   └── Resulting Profile Display
    │       │
    │       └── YeastPitchCalc
    │           ├── Volume Input
    │           ├── OG Input
    │           ├── Yeast Form Select
    │           └── Pitch Rate Result
    │
    ├── Route: /recipes (RecipeBuilder)
    │   └── RecipeBuilder
    │       ├── useRecipeStore (hook)
    │       ├── useRecipeCalculations (hook)
    │       │
    │       ├── SummaryStickyHeader
    │       │   ├── Recipe Name (editable)
    │       │   ├── OG Display/Override
    │       │   ├── FG Display/Override
    │       │   ├── ABV Display
    │       │   ├── IBU Display
    │       │   ├── SRM Display with Color
    │       │   ├── Batch Volume Input
    │       │   ├── Efficiency Input
    │       │   └── Action Buttons
    │       │       ├── Save
    │       │       ├── Delete
    │       │       └── Brew Mode
    │       │
    │       ├── Collapsible: Style
    │       │   └── StyleSelector
    │       │       ├── BJCP Category Select
    │       │       ├── BJCP Style Select
    │       │       └── StyleRangeBars
    │       │
    │       ├── Collapsible: Grain Bill
    │       │   └── GrainBill
    │       │       ├── SearchSelect (add grain)
    │       │       ├── DndContext (drag & drop)
    │       │       └── Grain Rows
    │       │           ├── Drag Handle
    │       │           ├── Name Display
    │       │           ├── InlineEditableNumber (weight)
    │       │           ├── Type Badge
    │       │           ├── Color Display
    │       │           ├── % of Bill
    │       │           └── Delete Button
    │       │
    │       ├── Collapsible: Hops
    │       │   └── HopSchedule
    │       │       ├── SearchSelect (add hop)
    │       │       ├── Sort by Timing Toggle
    │       │       └── Hop Rows
    │       │           ├── Name Display
    │       │           ├── Amount Input
    │       │           ├── AA% Input
    │       │           ├── Timing Type Select
    │       │           ├── Time Input (conditional)
    │       │           ├── Whirlpool Temp (conditional)
    │       │           ├── Dry Hop Day (conditional)
    │       │           ├── Dry Hop Duration (conditional)
    │       │           ├── HopFlavorMini (flavor viz)
    │       │           ├── IBU Display
    │       │           └── Delete Button
    │       │
    │       ├── Collapsible: Yeast
    │       │   └── YeastSection
    │       │       ├── SearchSelect (yeast)
    │       │       ├── Attenuation Override
    │       │       ├── Form Select (liquid/dry)
    │       │       ├── Quantity Inputs
    │       │       └── Starter Section (optional)
    │       │           └── Multi-step Starter Inputs
    │       │
    │       ├── Collapsible: Mash
    │       │   └── MashSchedule
    │       │       ├── Method Select (single/step/decoction)
    │       │       ├── Mash Step Rows
    │       │       │   ├── Type Select
    │       │       │   ├── Temperature Input
    │       │       │   ├── Time Input
    │       │       │   ├── Strike Temp Display (infusion)
    │       │       │   └── Delete Button
    │       │       └── Water Parameters
    │       │           ├── Mash Thickness Input
    │       │           ├── Grain Absorption Input
    │       │           └── Deadspace Input
    │       │
    │       ├── Collapsible: Fermentation
    │       │   └── FermentationSection
    │       │       ├── Add Stage Button
    │       │       └── Fermentation Step Rows
    │       │           ├── Stage Select
    │       │           ├── Temperature Input
    │       │           ├── Duration Input (days)
    │       │           ├── Pressure Input (optional)
    │       │           ├── Notes Input
    │       │           ├── Dry Hop Reminder (checkbox)
    │       │           └── Delete Button
    │       │
    │       ├── Collapsible: Water
    │       │   └── WaterSettings
    │       │       ├── Brew Method Select
    │       │       ├── WaterSaltsSection
    │       │       │   ├── Source Profile Select
    │       │       │   │   ├── Common Profiles
    │       │       │   │   ├── Style Targets
    │       │       │   │   └── Custom Profiles
    │       │       │   ├── Target Profile Select
    │       │       │   ├── Salt Inputs (6 types)
    │       │       │   │   └── Real-time ion updates
    │       │       │   ├── Resulting Profile Display
    │       │       │   │   ├── Ion values with colors
    │       │       │   │   └── Cl:SO4 ratio
    │       │       │   └── Save Custom Profile Button
    │       │       ├── Water Volume Calculations
    │       │       │   ├── Pre-boil Volume
    │       │       │   ├── Mash Water
    │       │       │   ├── Sparge Water
    │       │       │   └── Capacity Warning
    │       │       └── Advanced Settings
    │       │           ├── Boil Time
    │       │           ├── Boil-off Rate
    │       │           ├── Cooling Shrinkage %
    │       │           ├── Kettle Loss
    │       │           ├── Hops Absorption
    │       │           └── Mash Tun Capacity
    │       │
    │       ├── Collapsible: Other Ingredients
    │       │   └── OtherIngredients
    │       │       ├── Category Select
    │       │       ├── SearchSelect (ingredient)
    │       │       └── Other Ingredient Rows
    │       │           ├── Name Display
    │       │           ├── Amount Input
    │       │           ├── Unit Input
    │       │           ├── Timing Select
    │       │           ├── Notes Input
    │       │           └── Delete Button
    │       │
    │       └── Collapsible: Flavor Profile
    │           └── FlavorGraphs
    │               ├── HopFlavorRadar
    │               │   └── RadarChart (Recharts)
    │               │       └── 9 flavor axes
    │               └── Per-Hop Contributions
    │                   └── Mini radar charts
    │
    └── Route: /brew/:id (BrewMode)
        └── BrewMode
            ├── Recipe Header
            ├── Brew Session Selector
            ├── FermentationPlan
            │   └── Timeline visualization
            ├── Mash Steps with Timer
            ├── Hop Addition Checklist
            ├── Actual Values Input
            │   ├── Actual OG
            │   ├── Actual FG
            │   ├── Actual Volume
            │   └── Actual ABV
            └── Session Notes
```

---

## State Management Flow

```
┌───────────────────────────────────────────────────────┐
│                  Zustand Store                        │
│              (useRecipeStore)                         │
│                                                       │
│  State:                                               │
│    recipes: Recipe[]                                  │
│                                                       │
│  Actions:                                             │
│    upsert(recipe: Recipe)                             │
│    remove(id: string)                                 │
│                                                       │
└────────────┬─────────────────────────────┬────────────┘
             │                             │
             │                             │
    ┌────────▼────────┐         ┌─────────▼──────────┐
    │                 │         │                    │
    │  localStorage   │◄────────┤  Auto-sync on      │
    │  Persistence    │         │  every change      │
    │                 │         │                    │
    └────────┬────────┘         └────────────────────┘
             │
             │ Load on init
             │
    ┌────────▼───────────────────────────────────────┐
    │                                                │
    │  Recipe Selector (useEffect)                  │
    │                                                │
    │  - URL param :id                              │
    │  - Find recipe in store                       │
    │  - Populate local state                       │
    │                                                │
    └────────┬───────────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────────┐
    │                                             │
    │  Component Local State (RecipeBuilder)     │
    │                                             │
    │  const [name, setName] = useState()         │
    │  const [grains, setGrains] = useState([])   │
    │  const [hops, setHops] = useState([])       │
    │  const [yeast, setYeast] = useState()       │
    │  const [mashSteps, setMashSteps] = useState │
    │  const [fermentSteps, setFermentSteps] =... │
    │  const [waterParams, setWaterParams] =...   │
    │  const [batchVolumeL, setBatchVolumeL] =... │
    │  const [efficiencyPct, setEfficiency] =...  │
    │                                             │
    │  Why local state?                           │
    │  - Immediate UI updates                     │
    │  - No persistence until "Save"              │
    │  - Easy form management                     │
    │                                             │
    └────────┬────────────────────────────────────┘
             │
             │ Pass to hook
             │
             ▼
    ┌──────────────────────────────────────────┐
    │                                          │
    │  useRecipeCalculations Hook              │
    │                                          │
    │  Inputs:                                 │
    │    grains, hops, yeast,                  │
    │    batchVolumeL, efficiencyPct,          │
    │    mashSteps, fermentationSteps,         │
    │    waterParams, brewMethod,              │
    │    ogAuto, actualOg, fgAuto, actualFg    │
    │                                          │
    │  Returns: (all useMemo)                  │
    │    { ogUsed, fgUsed, abv, ibu, srm,      │
    │      color, preBoilVolumeL, mashWaterL,  │
    │      spargeWaterL, estimatedTotalFlavor, │
    │      ... }                               │
    │                                          │
    │  Dependencies tracked automatically      │
    │  → Recalculates only when needed         │
    │                                          │
    └────────┬─────────────────────────────────┘
             │
             │ Return calculated values
             │
             ▼
    ┌──────────────────────────────────────────┐
    │                                          │
    │  Component Render                        │
    │                                          │
    │  - Display calculated values             │
    │  - Update graphs                         │
    │  - Show warnings                         │
    │  - Enable/disable buttons                │
    │                                          │
    └──────────────────────────────────────────┘


User Clicks "Save"
         │
         ▼
┌─────────────────────┐
│  Build Recipe Obj   │
│                     │
│  - Map UI types     │
│  - Add equipment    │
│  - Add calculated   │
│  - Add timestamps   │
│                     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  useRecipeStore.upsert  │
│                         │
└──────────┬──────────────┘
           │
           ├─────────────────┐
           │                 │
           ▼                 ▼
┌────────────────┐   ┌───────────────┐
│  Update Zustand│   │  Sync to      │
│  State         │   │  localStorage │
│                │   │               │
└────────────────┘   └───────────────┘
```

---

## Calculation Pipeline

### Gravity Calculation Detail

```
Input: Grain Bill
┌─────────────────────────────────────┐
│ Grain 1: 4.5 kg Pilsner (GU: 37)   │
│ Grain 2: 0.5 kg Munich (GU: 35)    │
│ Grain 3: 0.3 kg Caramel 60 (GU: 34)│
│ Grain 4: 0.2 kg Sugar (GU: 46)     │
└─────────────────────────────────────┘
                  │
                  ▼
Step 1: Convert kg to lbs
┌─────────────────────────────────────┐
│ Grain 1: 4.5 × 2.20462 = 9.92 lbs  │
│ Grain 2: 0.5 × 2.20462 = 1.10 lbs  │
│ Grain 3: 0.3 × 2.20462 = 0.66 lbs  │
│ Grain 4: 0.2 × 2.20462 = 0.44 lbs  │
└─────────────────────────────────────┘
                  │
                  ▼
Step 2: Calculate points per grain
         (lbs × GU × efficiency)
┌─────────────────────────────────────┐
│ Grain 1: 9.92 × 37 × 0.75 = 275.2  │
│ Grain 2: 1.10 × 35 × 0.75 = 28.9   │
│ Grain 3: 0.66 × 34 × 0.75 = 16.8   │
│ Grain 4: 0.44 × 46 × 1.00 = 20.2   │
│         (sugar: 100% efficiency)    │
│                                     │
│ Total Points = 341.1                │
└─────────────────────────────────────┘
                  │
                  ▼
Step 3: Convert volume to gallons
┌─────────────────────────────────────┐
│ Batch: 20 L × 0.264172 = 5.28 gal  │
└─────────────────────────────────────┘
                  │
                  ▼
Step 4: Calculate gravity points/gal
┌─────────────────────────────────────┐
│ Points = 341.1 / 5.28 = 64.6        │
└─────────────────────────────────────┘
                  │
                  ▼
Step 5: Convert to OG
┌─────────────────────────────────────┐
│ OG = 1 + (64.6 / 1000) = 1.065      │
└─────────────────────────────────────┘
```

### IBU Calculation Detail (Tinseth Method)

```
Input: Single Hop Addition
┌─────────────────────────────────────┐
│ Hop: Cascade                        │
│ Amount: 30 grams                    │
│ Alpha Acid: 5.5%                    │
│ Timing: Boil, 60 minutes            │
│ Batch Volume: 20 L                  │
│ OG: 1.050                           │
└─────────────────────────────────────┘
                  │
                  ▼
Step 1: Calculate Gravity Factor
┌─────────────────────────────────────┐
│ gravityFactor = 1.65 × 0.000125^    │
│                 (OG - 1.0)          │
│               = 1.65 × 0.000125^0.05│
│               = 1.65 × 0.3162       │
│               = 0.522               │
└─────────────────────────────────────┘
                  │
                  ▼
Step 2: Calculate Time Factor
┌─────────────────────────────────────┐
│ timeFactor = (1 - e^(-0.04 × time)) │
│              / 4.15                 │
│            = (1 - e^(-0.04 × 60))   │
│              / 4.15                 │
│            = (1 - e^(-2.4)) / 4.15  │
│            = (1 - 0.0907) / 4.15    │
│            = 0.909 / 4.15           │
│            = 0.219                  │
└─────────────────────────────────────┘
                  │
                  ▼
Step 3: Calculate Utilization
┌─────────────────────────────────────┐
│ utilization = gravityFactor ×       │
│               timeFactor            │
│             = 0.522 × 0.219         │
│             = 0.114 (11.4%)         │
└─────────────────────────────────────┘
                  │
                  ▼
Step 4: Calculate IBU
┌─────────────────────────────────────┐
│ IBU = (grams × AA% × 1000 ×        │
│        utilization) / volumeL       │
│     = (30 × 0.055 × 1000 × 0.114)  │
│       / 20                          │
│     = (1.65 × 1000 × 0.114) / 20   │
│     = 188.1 / 20                    │
│     = 9.4 IBU                       │
└─────────────────────────────────────┘
```

---

## Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Browser localStorage                   │
│                     (5-10 MB typical)                    │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────┐                  ┌──────────────────┐
│  Recipe Data     │                  │  Preset Data     │
│                  │                  │                  │
│  Key:            │                  │  Keys:           │
│  beerapp.recipes │                  │  - beerapp.      │
│                  │                  │    customGrains  │
│  Format:         │                  │  - beerapp.      │
│  {               │                  │    customHops    │
│    version: 1,   │                  │  - beerapp.      │
│    value: [...]  │                  │    customYeasts  │
│  }               │                  │                  │
│                  │                  │  Format:         │
│  Contains:       │                  │  Array of        │
│  - Recipe[]      │                  │  ingredient      │
│    - metadata    │                  │  definitions     │
│    - ingredients │                  │                  │
│    - process     │                  └──────────────────┘
│    - calculated  │                           │
│                  │                           │
└──────────────────┘                           │
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│  Equipment Data  │                  │  Water Profiles  │
│                  │                  │                  │
│  Key:            │                  │  Key:            │
│  beerapp.        │                  │  beerapp.        │
│  equipment       │                  │  waterProfiles   │
│                  │                  │                  │
│  Format:         │                  │  Format:         │
│  {               │                  │  {               │
│    version: 1,   │                  │    version: 1,   │
│    value: [...]  │                  │    value: [...]  │
│  }               │                  │  }               │
│                  │                  │                  │
│  Contains:       │                  │  Contains:       │
│  - Equipment     │                  │  - Saved         │
│    Profile[]     │                  │    WaterProfile[]│
│    - volumes     │                  │    - id          │
│    - efficiency  │                  │    - name        │
│    - losses      │                  │    - profile     │
│    - thermal     │                  │      (Ca, Mg,    │
│    - timing      │                  │       Na, Cl,    │
│    - calibration │                  │       SO4, HCO3) │
│                  │                  │                  │
└──────────────────┘                  └──────────────────┘

Storage Operations:
┌──────────────────────────────────────────────────────┐
│                                                      │
│  storage.ts utilities                                │
│                                                      │
│  loadJson<T>(key, defaultValue)                     │
│    ├─ Try localStorage.getItem(key)                 │
│    ├─ Parse JSON                                    │
│    ├─ Handle versioned format                       │
│    └─ Return value or default on error              │
│                                                      │
│  saveJson<T>(key, value, version)                   │
│    ├─ Wrap in {version, value}                      │
│    ├─ JSON.stringify()                              │
│    └─ localStorage.setItem(key, json)               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Recipe Data Model

```
┌──────────────────────────────────────────────────────────────┐
│                         Recipe                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  METADATA                                                    │
│  ├─ id: string (UUID)                                       │
│  ├─ name: string                                            │
│  ├─ createdAt: ISO8601                                      │
│  ├─ updatedAt: ISO8601                                      │
│  └─ version: number                                         │
│                                                              │
│  STYLE & TARGETING                                           │
│  ├─ bjcpStyleCode?: string (e.g., "21A")                    │
│  └─ targetProfile:                                          │
│      ├─ batchVolumeL: number                                │
│      ├─ originalGravity: number                             │
│      ├─ finalGravity: number                                │
│      ├─ abv?: number                                        │
│      ├─ ibu?: number                                        │
│      └─ srm?: number                                        │
│                                                              │
│  EQUIPMENT SNAPSHOT                                          │
│  └─ equipment:                                              │
│      ├─ profileId: string                                   │
│      ├─ snapshotAt: ISO8601                                 │
│      └─ snapshot: EquipmentProfile                          │
│          ├─ volumes {batch, boil, fermenter, ...}           │
│          ├─ efficiency {mash%, brewhouse%}                  │
│          ├─ losses {evap, grain absorp, ...}                │
│          ├─ thermal {temp loss, grain temp, ...}            │
│          ├─ timing {boil, mash}                             │
│          └─ calibration {offsets, factors}                  │
│                                                              │
│  PROCESS SETTINGS                                            │
│  └─ processSettings:                                        │
│      ├─ mashEfficiencyPct: number                           │
│      ├─ ibuCalculationMethod: enum                          │
│      ├─ colorCalculationMethod: enum                        │
│      ├─ hopUtilizationFactor: number                        │
│      └─ brewMethod: enum                                    │
│                                                              │
│  INGREDIENTS                                                 │
│  └─ ingredients:                                            │
│      ├─ fermentables: FermentableAddition[]                 │
│      │   ├─ id, ingredientRef, amountKg                     │
│      │   ├─ usage {timing, timeMin?}                        │
│      │   └─ overrides? {color, potential, ferm}             │
│      │                                                       │
│      ├─ hops: HopAddition[]                                 │
│      │   ├─ id, ingredientRef, amountG                      │
│      │   ├─ usage {timing, timeMin, temp?,                  │
│      │   │          stage?, dayOffset?, duration?}          │
│      │   └─ overrides? {alphaAcid%, betaAcid%}              │
│      │                                                       │
│      ├─ yeast: YeastAddition?                               │
│      │   ├─ ingredientRef, form, quantity                   │
│      │   ├─ starter? {steps[], volumes, ...}                │
│      │   └─ overrides? {attenuation%, temp}                 │
│      │                                                       │
│      ├─ water?: WaterTreatment                              │
│      │   ├─ sourceProfile/targetProfile                     │
│      │   ├─ salts {gypsum, CaCl2, epsom, ...}               │
│      │   ├─ acids {lactic?, phosphoric?, pH?}               │
│      │   └─ resultingProfile?                               │
│      │                                                       │
│      └─ other: OtherAddition[]                              │
│          ├─ id, ingredientRef, amount, unit                 │
│          ├─ timing, timeMin?, notes?                        │
│          └─                                                 │
│                                                              │
│  PROCESS                                                     │
│  └─ process:                                                │
│      ├─ mash?: MashProfile                                  │
│      │   ├─ method: enum                                    │
│      │   ├─ steps: MashStep[]                               │
│      │   │   └─ {id, name?, type, tempC,                    │
│      │   │       timeMin, infusionVol?, ...}                │
│      │   ├─ grainAbsorptionLPerKg                           │
│      │   └─ mashTunDeadSpaceL                               │
│      │                                                       │
│      ├─ fermentation: FermentationSchedule                  │
│      │   ├─ steps: FermentationStep[]                       │
│      │   │   └─ {id, name, stage, tempC,                    │
│      │   │       durationDays, pressure?, notes?}           │
│      │   └─ estimatedDays                                   │
│      │                                                       │
│      └─ packaging?: PackagingSettings                       │
│          ├─ method: enum                                    │
│          ├─ carbonation {co2Vols, method,                   │
│          │              primingSugar?, type?}               │
│          └─ servingTempC?                                   │
│                                                              │
│  USER PREFERENCES                                            │
│  └─ preferences:                                            │
│      ├─ displayUnits: enum                                  │
│      ├─ preferredIbuMethod: enum                            │
│      ├─ preferredColorMethod: enum                          │
│      └─ sugarScale: enum                                    │
│                                                              │
│  BREW SESSIONS                                               │
│  └─ brewSessions: BrewSession[]                             │
│      └─ {id, brewDate, actualOg?, actualFg?,                │
│          actualAbv?, actualVolume?, notes?,                 │
│          status: enum}                                      │
│                                                              │
│  CALCULATED RESULTS                                          │
│  └─ calculated:                                             │
│      ├─ originalGravity, finalGravity, abv                  │
│      ├─ ibuTinseth, ibuRager, ibuGaretz                     │
│      ├─ srmMorey, srmDaniels, srmMosher                     │
│      ├─ preboilVolumeL, postboilVolumeL                     │
│      ├─ mashWaterL, spargeWaterL, totalWaterL               │
│      ├─ calories, realExtract, apparentAttenuation          │
│      └─ lastCalculated: ISO8601                             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Water Chemistry Flow

```
┌─────────────────────────────────────────────────┐
│  User Inputs                                    │
│                                                 │
│  1. Source Water Profile                        │
│     - RO, City Water, Custom                    │
│     - Ca, Mg, Na, Cl, SO4, HCO3 (ppm)          │
│                                                 │
│  2. Target Profile (optional)                   │
│     - Style-based (APA, Pilsner, etc.)          │
│     - Custom target                             │
│                                                 │
│  3. Water Volume (L)                            │
│                                                 │
│  4. Salt Additions (grams)                      │
│     - Gypsum (CaSO4·2H2O)                       │
│     - Calcium Chloride (CaCl2·2H2O)             │
│     - Epsom Salt (MgSO4·7H2O)                   │
│     - Table Salt (NaCl)                         │
│     - Baking Soda (NaHCO3)                      │
│                                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Step 1: Calculate Ion Contributions            │
│          from Salt Additions                    │
│                                                 │
│  For each salt:                                 │
│    concentration (g/L) = grams / volumeL        │
│    ion_ppm = concentration × ion_factor × 1000  │
│                                                 │
│  Ion Factors (per g/L):                         │
│    Gypsum:                                      │
│      Ca: 232.8 ppm/g/L                          │
│      SO4: 558.3 ppm/g/L                         │
│    CaCl2:                                       │
│      Ca: 272.6 ppm/g/L                          │
│      Cl: 482.0 ppm/g/L                          │
│    Epsom:                                       │
│      Mg: 98.6 ppm/g/L                           │
│      SO4: 389.6 ppm/g/L                         │
│    NaCl:                                        │
│      Na: 393.4 ppm/g/L                          │
│      Cl: 606.6 ppm/g/L                          │
│    NaHCO3:                                      │
│      Na: 273.7 ppm/g/L                          │
│      HCO3: 726.3 ppm/g/L                        │
│                                                 │
│  Result: delta WaterProfile                     │
│                                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Step 2: Add Source + Delta                    │
│                                                 │
│  resultingProfile = addProfiles(                │
│    sourceProfile,                               │
│    deltaFromSalts                               │
│  )                                              │
│                                                 │
│  For each ion:                                  │
│    result[ion] = source[ion] + delta[ion]       │
│                                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Step 3: Calculate Derived Metrics              │
│                                                 │
│  Chloride:Sulfate Ratio = Cl / SO4             │
│    - < 1.0: Dry, hoppy character                │
│    - 1.0: Balanced                              │
│    - > 1.0: Malty, full character               │
│                                                 │
│  Residual Alkalinity (RA) (approximation):     │
│    RA ≈ HCO3 - (Ca/3.5 + Mg/7)                  │
│                                                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Step 4: Display & Validation                   │
│                                                 │
│  Show resulting profile:                        │
│    Ca:   75 ppm   ✓ (50-150 target)             │
│    Mg:   15 ppm   ✓ (10-30 target)              │
│    Na:   25 ppm   ✓ (<100 target)               │
│    Cl:   150 ppm  ✓ (50-200 target)             │
│    SO4:  75 ppm   ✓ (50-150 target)             │
│    HCO3: 50 ppm   ✓ (0-80 target for pale)      │
│                                                 │
│  Cl:SO4 = 2.0:1 (Malty emphasis)                │
│                                                 │
│  Warnings:                                      │
│    - Na > 150: May taste salty                  │
│    - Cl > 300: Poor clarity/stability           │
│    - SO4 > 500: Harsh bitterness                │
│    - Mg > 86: Sour/bitter off-flavors           │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Hop Flavor Calculation

```
┌───────────────────────────────────────────────────┐
│  Input: Recipe Hop Schedule                      │
│                                                   │
│  Hop 1: 30g Citra, Dry Hop, 3 days, Start day 5  │
│  Hop 2: 50g Mosaic, Dry Hop, 4 days, Start day 5 │
│  Hop 3: 20g Cascade, Whirlpool, 20min @ 80°C     │
│  Hop 4: 15g Centennial, Boil, 60 min             │
│                                                   │
│  Batch Volume: 20 L                               │
│                                                   │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  Step 1: Calculate Timing Aroma Factors           │
│                                                   │
│  Hop 1 (Dry Hop, 3 days, start day 5):           │
│    base = 0.6 + 0.4×(1 - e^(-0.6×3)) = 0.89      │
│    startAdj = (day 5 is mid) = 1.0               │
│    factor = 0.89 × 1.0 = 0.89                    │
│                                                   │
│  Hop 2 (Dry Hop, 4 days, start day 5):           │
│    base = 0.6 + 0.4×(1 - e^(-0.6×4)) = 0.93      │
│    startAdj = 1.0                                │
│    factor = 0.93                                 │
│                                                   │
│  Hop 3 (Whirlpool, 20min @ 80°C):                │
│    tempFactor = 0.6+0.4×(95-80)/20 = 0.9         │
│    timeFactor = 1 - e^(-0.06×20) = 0.699         │
│    factor = 0.5 + 0.5×0.9×0.699 = 0.81           │
│                                                   │
│  Hop 4 (Boil, 60 min):                           │
│    factor = e^(-0.05×60) = 0.050                 │
│                                                   │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  Step 2: Calculate Weights                        │
│          (dose in g/L × aroma factor)             │
│                                                   │
│  Hop 1: (30/20) × 0.89 = 1.335                   │
│  Hop 2: (50/20) × 0.93 = 2.325                   │
│  Hop 3: (20/20) × 0.81 = 0.810                   │
│  Hop 4: (15/20) × 0.050 = 0.038                  │
│                                                   │
│  Total Weight = 4.508                             │
│                                                   │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  Step 3: Sum Weighted Contributions Per Axis      │
│                                                   │
│  For each hop, for each flavor axis:              │
│    contribution = weight × (flavorScore / 5)      │
│                                                   │
│  Example: Citrus axis                             │
│    Hop 1 (Citra, citrus:5):                       │
│      1.335 × (5/5) = 1.335                        │
│    Hop 2 (Mosaic, citrus:3):                      │
│      2.325 × (3/5) = 1.395                        │
│    Hop 3 (Cascade, citrus:3):                     │
│      0.810 × (3/5) = 0.486                        │
│    Hop 4 (Centennial, citrus:4):                  │
│      0.038 × (4/5) = 0.030                        │
│                                                   │
│    Sum for citrus = 3.246                         │
│                                                   │
│  Repeat for all 9 axes:                           │
│    citrus, tropicalFruit, stoneFruit, berry,      │
│    floral, grassy, herbal, spice, resinPine       │
│                                                   │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  Step 4: Calculate Overall Magnitude              │
│                                                   │
│  magnitude = 5 × (1 - e^(-λ × totalWeight))       │
│            = 5 × (1 - e^(-0.7 × 4.508))           │
│            = 5 × (1 - e^(-3.156))                 │
│            = 5 × (1 - 0.0425)                     │
│            = 5 × 0.9575                           │
│            = 4.79                                 │
│                                                   │
│  (Magnitude represents overall hop intensity)     │
│                                                   │
└─────────────────────┬─────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────┐
│  Step 5: Scale Axes to Magnitude                  │
│                                                   │
│  For each axis:                                   │
│    proportion = axisSum / totalWeight             │
│    finalValue = magnitude × proportion            │
│    clamp to [0, 5]                                │
│                                                   │
│  Example: Citrus                                  │
│    proportion = 3.246 / 4.508 = 0.72              │
│    finalValue = 4.79 × 0.72 = 3.45                │
│                                                   │
│  Final Flavor Profile:                            │
│    citrus: 3.45                                   │
│    tropicalFruit: 3.89                            │
│    stoneFruit: 2.12                               │
│    berry: 1.35                                    │
│    floral: 0.88                                   │
│    grassy: 0.45                                   │
│    herbal: 0.52                                   │
│    spice: 0.38                                    │
│    resinPine: 1.67                                │
│                                                   │
└───────────────────────────────────────────────────┘
                      │
                      ▼
              Display on Radar Chart
```

---

## User Journey Maps

### Journey 1: Create New Recipe

```
┌──────────────┐
│   User at    │
│   Homepage   │
└──────┬───────┘
       │ Clicks "Start a Recipe"
       ▼
┌──────────────┐
│ RecipeBuilder│
│ (empty form) │
└──────┬───────┘
       │
       │ 1. Enters recipe name: "My IPA"
       │ 2. Sets batch volume: 20L
       │ 3. Sets efficiency: 75%
       │
       ▼
┌──────────────┐
│ Add Grains   │
└──────┬───────┘
       │
       │ 1. Searches "Pale Ale Malt"
       │ 2. Selects from dropdown
       │ 3. Enters 4.5 kg
       │ 4. Repeats for crystal, wheat
       │
       ▼      ◄─── Real-time OG calculation displays
┌──────────────┐
│  Add Hops    │
└──────┬───────┘
       │
       │ 1. Searches "Citra"
       │ 2. Selects timing: "Dry Hop"
       │ 3. Enters 30g, start day 5, 3 days
       │ 4. Repeats for more hops
       │
       ▼      ◄─── Real-time IBU & flavor calc
┌──────────────┐
│ Select Yeast │
└──────┬───────┘
       │
       │ 1. Searches "US-05"
       │ 2. System auto-fills attenuation
       │
       ▼      ◄─── FG calculated automatically
┌──────────────┐
│ Config Mash  │
└──────┬───────┘
       │
       │ 1. Sets mash temp: 65°C
       │ 2. Sets time: 60 min
       │
       ▼      ◄─── Strike temp calculated
┌──────────────┐
│Config Ferment│
└──────┬───────┘
       │
       │ 1. Primary: 18°C, 7 days
       │ 2. Dry hop: day 5 reminder
       │ 3. Cold crash: 2°C, 2 days
       │
       ▼
┌──────────────┐
│ Config Water │
└──────┬───────┘
       │
       │ 1. Selects "APA" target profile
       │ 2. Adjusts salts for 2:1 SO4:Cl
       │ 3. Views mash/sparge volumes
       │
       ▼      ◄─── All calculations complete
┌──────────────┐
│ Review       │
│ Summary      │
└──────┬───────┘
       │
       │ OG: 1.061, FG: 1.012, ABV: 6.4%
       │ IBU: 65, SRM: 7
       │ All sections complete ✓
       │
       │ Clicks "Save Recipe"
       ▼
┌──────────────┐
│   Saved!     │
│ Recipe list  │
│  updated     │
└──────────────┘
```

### Journey 2: Use Quick Calculator

```
┌──────────────┐
│   User at    │
│   Homepage   │
└──────┬───────┘
       │ Clicks "Open Calculators"
       ▼
┌──────────────┐
│ Calculators  │
│    Page      │
└──────┬───────┘
       │ Scrolls to "IBU Calculator"
       ▼
┌──────────────┐
│IBU Calculator│
└──────┬───────┘
       │
       │ 1. Enters batch volume: 20L
       │ 2. Enters OG: 1.050
       │
       ▼
┌──────────────┐
│  Add Hops    │
└──────┬───────┘
       │
       │ 1. Clicks "Add Hop"
       │ 2. Selects "Cascade"
       │ 3. Enters 30g, 60 min, Boil
       │ 4. Clicks "Add Hop" again
       │ 5. Selects "Centennial"
       │ 6. Enters 20g, 15 min, Boil
       │
       ▼      ◄─── IBU updates live
┌──────────────┐
│  View Result │
│              │
│  Total IBU:  │
│     42       │
└──────────────┘
```

### Journey 3: Brew Day Execution

```
┌──────────────┐
│ Recipe List  │
└──────┬───────┘
       │ Clicks "Brew" on "My IPA"
       ▼
┌──────────────┐
│  Brew Mode   │
│   Overview   │
└──────┬───────┘
       │
       │ Shows:
       │ - Water volumes (mash 15L, sparge 12L)
       │ - Strike temp: 69°C
       │ - Grain bill checklist
       │ - Hop schedule with times
       │ - Fermentation plan
       │
       ▼
┌──────────────┐
│ Mash Timer   │
└──────┬───────┘
       │
       │ 1. Starts timer: 60 min
       │ 2. Monitors temp
       │ 3. Timer alerts when done
       │
       ▼
┌──────────────┐
│ Boil & Hops  │
└──────┬───────┘
       │
       │ For each hop addition:
       │ - Shows timing (60, 15, 5, 0 min)
       │ - Checkbox to mark complete
       │ - Timer counts down
       │
       ▼
┌──────────────┐
│   Chill &    │
│  Transfer    │
└──────┬───────┘
       │
       │ 1. Records actual OG: 1.059
       │ 2. Records actual volume: 19.5L
       │
       ▼
┌──────────────┐
│ Fermentation │
│   Tracking   │
└──────┬───────┘
       │
       │ Shows timeline:
       │ - Day 0-7: Primary @ 18°C
       │ - Day 5: DRY HOP REMINDER! 🔔
       │ - Day 7-9: Cold crash @ 2°C
       │ - Day 9: Package
       │
       ▼
┌──────────────┐
│   Package    │
└──────┬───────┘
       │
       │ 1. Records actual FG: 1.011
       │ 2. Calculates actual ABV: 6.3%
       │ 3. Adds tasting notes
       │ 4. Marks session complete
       │
       ▼
┌──────────────┐
│   Session    │
│   Archived   │
└──────────────┘
```

---

## Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface Layer                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  React 19.1.1 (Component rendering & lifecycle)             │
│    │                                                         │
│    ├─ React Router DOM 7.8.0 (Client-side routing)          │
│    │   └─ Lazy loading for code splitting                   │
│    │                                                         │
│    ├─ TypeScript 5.8.3 (Type safety)                        │
│    │   └─ Strict mode enabled                               │
│    │                                                         │
│    └─ Tailwind CSS 4.1.11 (Styling)                         │
│        ├─ Utility-first classes                             │
│        ├─ Custom design tokens                              │
│        └─ Responsive breakpoints                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   State & Data Layer                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Zustand 5.0.7 (Global state)                               │
│    └─ Minimal, unopinionated state management               │
│                                                             │
│  React Hooks (Local state & effects)                        │
│    ├─ useState (Component state)                            │
│    ├─ useMemo (Calculated values)                           │
│    ├─ useEffect (Side effects)                              │
│    └─ useCallback (Function memoization)                    │
│                                                             │
│  localStorage (Persistence)                                 │
│    └─ JSON serialization with versioning                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    Visualization Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Recharts 3.1.2 (Charts & graphs)                           │
│    ├─ RadarChart (Hop flavor profiles)                      │
│    ├─ BarChart (Style ranges)                               │
│    └─ Responsive containers                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  Interaction Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DND Kit 6.3.1 (Drag & drop)                                │
│    ├─ @dnd-kit/core (Core drag/drop)                        │
│    ├─ @dnd-kit/sortable (List reordering)                   │
│    └─ @dnd-kit/utilities (Helpers)                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     Build Layer                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vite 7.1.2 (Build tool & dev server)                       │
│    ├─ Fast HMR (Hot Module Replacement)                     │
│    ├─ Optimized production builds                           │
│    └─ Native ES modules                                     │
│                                                             │
│  @vitejs/plugin-react 5.0.0 (React integration)             │
│    └─ JSX transformation                                    │
│                                                             │
│  ESLint 9.33.0 (Code quality)                               │
│    └─ TypeScript & React plugins                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

This document provides comprehensive visual representations of the BeerApp architecture, including:

1. **System Architecture**: Overall application structure and layer separation
2. **Data Flow**: How data moves through the application from input to display
3. **Component Hierarchy**: Complete component tree with all major components
4. **State Management**: Zustand store integration with local state
5. **Calculation Pipelines**: Detailed step-by-step calculation flows
6. **Storage Architecture**: localStorage structure and organization
7. **Data Models**: Visual representation of the Recipe type structure
8. **Water Chemistry**: Detailed flow of water calculations and ion contributions
9. **Hop Flavor**: Algorithm visualization for flavor estimation
10. **User Journeys**: Common user workflows through the application

Use these diagrams as reference when:
- Onboarding new developers
- Planning new features
- Debugging data flow issues
- Understanding calculation dependencies
- Designing new components
- Optimizing performance

For code-level details, see the main DOCUMENTATION.md file.
