# Beta Builder Refactor - Complete Specification

## Project Overview

**Goal**: Refactor BeerApp recipe builder using Clean Architecture principles (similar to SwiftUI's Manager/View/Data Layer pattern) while keeping the existing calculator running in production.

**Strategy**: Build a new "Beta Builder" at `/beta-builder` route alongside the existing recipe builder at `/recipes`. Once the Beta Builder reaches feature parity and is tested, swap the routes to make it the default.

**Why**: The current codebase has grown organically and has several issues:
- Business logic mixed with UI code
- No clear separation of concerns
- Difficult to test
- Recurring bugs (e.g., hop absorption calculation)
- Type system duality (UI types vs Storage types)
- Direct localStorage access scattered everywhere

**What We're Building**: A recipe builder with the same architecture pattern you use in SwiftUI:
- **Domain Services** = Your Swift Managers (business logic)
- **Repositories** = Your Data Layer (storage abstraction)
- **Stores** = Your @Published properties (state management)
- **Components** = Your Views (pure UI)
- **Hooks** = React adapters (performance optimization layer)

---

## Architecture Layers

### 1. Domain Layer (`src/modules/beta-builder/domain/`)

**Purpose**: Core business logic with ZERO dependencies on React, UI, or storage implementation.

#### Models (`domain/models/`)
- Pure TypeScript type definitions
- No functions, no logic - just data shapes
- These are your "source of truth" types

**Current Files:**
- `Recipe.ts` - Recipe, Fermentable, Hop, RecipeCalculations types

**Future Files:**
- `Yeast.ts` - Yeast strains, starters, attenuation
- `Water.ts` - Water profile, salts, ion adjustments
- `Equipment.ts` - Equipment profiles, volumes, losses
- `Process.ts` - Mash schedule, fermentation timeline
- `Style.ts` - BJCP style guidelines

#### Services (`domain/services/`)
- Business logic classes/functions
- Pure functions - can be tested without React
- NO imports from React, UI, or storage

**Current Files:**
- `RecipeCalculationService.ts` - Implements:
  - `calculateOG()` - Original Gravity from fermentables
  - `calculateFG()` - Final Gravity (currently 75% attenuation estimate)
  - `calculateABV()` - Alcohol by Volume: (OG - FG) × 131.25
  - `calculateIBU()` - Tinseth formula with all hop types
  - `calculateSRM()` - Morey color equation

**Future Files:**
- `WaterChemistryService.ts` - Ion calculations, pH modeling
- `VolumeCalculationService.ts` - All water volume math (pre-boil, post-boil, losses)
- `HopFlavorService.ts` - 9-axis flavor profile estimation
- `YeastService.ts` - Attenuation prediction, cell count, starter calculations
- `ValidationService.ts` - Recipe validation rules
- `StyleMatchingService.ts` - Compare recipe to BJCP guidelines

#### Repositories (`domain/repositories/`)
- Data persistence abstraction
- Wraps localStorage/API/IndexedDB
- Services use repositories, NEVER localStorage directly

**Current Files:**
- `RecipeRepository.ts` - Implements:
  - `loadAll()` - Load all recipes from storage
  - `loadById(id)` - Load single recipe
  - `save(recipe)` - Create or update recipe
  - `delete(id)` - Delete recipe
  - Uses key: `beta-recipes-v1` (separate from old builder)

**Future Files:**
- `PresetRepository.ts` - Load fermentables, hops, yeasts from presets database
- `EquipmentRepository.ts` - Equipment profile CRUD
- `BrewSessionRepository.ts` - Brew session tracking and history

---

### 2. Presentation Layer (`src/modules/beta-builder/presentation/`)

**Purpose**: React-specific code that uses domain layer.

#### Stores (`presentation/stores/`)
- Zustand stores with state and actions
- Like SwiftUI `ObservableObject` with `@Published` properties
- Coordinates between Repositories (data) and Components (UI)

**Current Files:**
- `recipeStore.ts` - State:
  - `recipes: Recipe[]` - All saved recipes
  - `currentRecipe: Recipe | null` - Currently editing recipe
  - `isLoading: boolean`
  - `error: string | null`

  Actions:
  - `loadRecipes()` - Load all from repository
  - `createNewRecipe()` - Create with defaults
  - `updateRecipe(updates)` - Modify current recipe (in-memory)
  - `saveCurrentRecipe()` - Persist to repository
  - `deleteRecipe(id)`
  - `addFermentable()`, `updateFermentable()`, `removeFermentable()`
  - `addHop()`, `updateHop()`, `removeHop()`

**Future Files:**
- `equipmentStore.ts` - Equipment profile management
- `presetStore.ts` - Cached presets (fermentables, hops, yeasts)
- `uiStore.ts` - UI state (modals, panels, selected tabs)

#### Hooks (`presentation/hooks/`)
- React hooks that wrap domain services
- Make services reactive with `useMemo`/`useCallback`
- Thin adapters - just performance wrappers

**Current Files:**
- `useRecipeCalculations.ts` - Wraps RecipeCalculationService:
  - `useRecipeCalculations(recipe)` - Returns full RecipeCalculations
  - `useOG(recipe)` - Just OG
  - `useABV(og, fg)` - Just ABV
  - `useIBU(recipe)` - Just IBU
  - `useSRM(recipe)` - Just SRM

**Future Files:**
- `useWaterChemistry.ts` - Wrap WaterChemistryService
- `useVolumeCalculations.ts` - Wrap VolumeCalculationService
- `useHopFlavor.ts` - Wrap HopFlavorService
- `useDebounce.ts` - Debounce user input (fix performance issue)

#### Components (`presentation/components/`)
- Pure UI - NO business logic
- Like SwiftUI Views
- Use stores for state, hooks for calculations

**Current Files:**
- `BetaBuilderPage.tsx` - Main page with:
  - Recipe name input
  - Equipment settings (batch volume, efficiency, boil time)
  - Fermentables list with add/remove buttons
  - Live calculations display (OG/FG/ABV/IBU/SRM in cards)
  - Save button

**Future Files:**
- `RecipeList.tsx` - List of all saved recipes
- `FermentableSection.tsx` - Full fermentable editor with presets
- `HopSection.tsx` - Hop additions with timing controls
- `YeastSection.tsx` - Yeast selection and starter calculator
- `WaterChemistryPanel.tsx` - Water profile and salt additions
- `MashSchedule.tsx` - Mash step editor
- `RecipeHeader.tsx` - Name, style, description
- `RecipeStats.tsx` - Extracted calculation display cards
- `PresetPicker.tsx` - Reusable preset selection modal

---

## Current Status (Phase 1 Complete ✅)

### What Works Now

**✅ Infrastructure:**
- Complete directory structure (`domain/` and `presentation/`)
- Domain models defined (Recipe, Fermentable, Hop, RecipeCalculations)
- RecipeCalculationService with all core calculations
- RecipeRepository with localStorage persistence
- Zustand store with state management and actions
- React hooks for reactive calculations
- BetaBuilderPage component with basic UI

**✅ Features:**
- Create new recipe with defaults
- Edit recipe name
- Edit equipment settings (batch volume, efficiency, boil time)
- Add/remove fermentables (currently hard-coded 2-Row Pale Malt)
- Real-time calculations:
  - Original Gravity (OG) - from fermentables
  - Final Gravity (FG) - estimated at 75% attenuation
  - Alcohol by Volume (ABV) - accurate formula
  - International Bitterness Units (IBU) - 0 currently (no hops yet)
  - Standard Reference Method (SRM) - color from fermentables
- Save recipe to localStorage (key: `beta-recipes-v1`)
- Route added: `/beta-builder`
- Homepage button: "🚀 Beta Builder (New!)"

**✅ Documentation:**
- `DOCUMENTATION.md` - Complete technical reference of entire codebase
- `ARCHITECTURE-DIAGRAMS.md` - Visual diagrams of data flow
- `REFACTOR-PLAN.md` - Initial refactor roadmap (now superseded by this doc)
- `BETA-BUILDER-SETUP.md` - Setup and testing instructions
- `src/modules/beta-builder/README.md` - Architecture deep dive

**✅ Separation from Old Builder:**
- Old recipe builder at `/recipes` is completely untouched
- Beta Builder uses separate localStorage key
- No shared code - completely independent
- Safe to test without affecting production

### What Doesn't Work Yet

**❌ Missing Features:**
- Load saved recipes list
- Edit fermentable properties (weight, type, color, PPG)
- Fermentable presets picker
- Hop additions UI
- Hop timing controls (boil time, whirlpool temp/time, dry hop days)
- Hop presets picker
- Yeast section (selection, attenuation, starter)
- Water chemistry section
- Mash schedule builder
- Volume calculations (strike water, sparge, losses, hop absorption)
- Equipment profile management
- Brew session tracking
- Recipe notes
- Recipe sharing/export
- Recipe duplication
- Delete confirmation modal
- Undo/redo
- Validation errors display
- BJCP style guidelines
- Recipe comparison

**❌ Known Issues:**
- FG calculation is just 75% attenuation estimate (needs yeast data)
- No error boundaries in React tree
- No debouncing on inputs (every keystroke triggers full recalculation)
- No loading states for save/load operations
- Fermentable "Add" button always adds same hard-coded malt
- Cannot edit fermentable properties after adding
- No confirmation before deleting fermentables
- No preset databases loaded yet

---

## Development Roadmap

### Phase 2: Full Fermentable Support (Week 1, ~10 hours)

**Goal**: Allow users to select from preset database and edit fermentable properties.

**Tasks:**
1. Copy preset data from old builder:
   - Extract `GENERATED_GRAINS` from `src/utils/presets.ts`
   - Create `domain/models/Presets.ts` with `FermentablePreset` type
   - Create `src/modules/beta-builder/data/fermentablePresets.ts` with data

2. Create PresetRepository:
   - `loadFermentablePresets()` - Load from JSON + localStorage custom presets
   - `saveFermentablePreset()` - Save custom preset
   - Add memoization to prevent reloading on every call

3. Update recipeStore:
   - Load presets on initialization
   - Add preset selection to `addFermentable()`

4. Build FermentableSection component:
   - Replace hard-coded "Add Fermentable" with preset picker modal
   - Show list of current fermentables with editable properties
   - Inline editing: click weight/color/type to edit
   - Delete button with confirmation
   - Group presets by type (Base Malt, Crystal, Roasted, Sugar, Extract)

5. Test:
   - Add fermentables from presets
   - Edit properties inline
   - See OG/SRM update in real-time
   - Save and reload recipe

**Acceptance Criteria:**
- ✅ Can select from 100+ fermentable presets
- ✅ Can edit weight, color, PPG, efficiency inline
- ✅ OG and SRM calculations update correctly
- ✅ Custom fermentables can be created
- ✅ Presets are cached and don't reload every render

---

### Phase 3: Hops (Week 2, ~10 hours)

**Goal**: Full hop addition support with IBU calculations.

**Tasks:**
1. Copy hop preset data:
   - Extract `GENERATED_HOPS` from `src/utils/presets.ts`
   - Create `data/hopPresets.ts` with 144 hop varieties

2. Build HopSection component:
   - Preset picker modal (searchable by name/alpha acid)
   - Hop list with timing controls
   - Addition type dropdown: Boil / Whirlpool / Dry Hop / First Wort / Mash
   - Time input (minutes) for boil/whirlpool
   - Temperature input (°C) for whirlpool
   - Days input for dry hop
   - Weight input (grams) with unit toggle (g/oz)
   - Delete button

3. Verify IBU calculations:
   - Boil hops - Tinseth utilization
   - Whirlpool - Temperature-adjusted utilization
   - Dry hop - 5% contribution
   - First wort - Bonus 20 minutes
   - Mash hops - 2% contribution

4. **Fix hop absorption bug** (the recurring issue!):
   - In old code: `hopsAbsorptionLPerKg` is optional with `?? 0.7` fallbacks everywhere
   - In Beta Builder: Make it required in Equipment type with default 0.7
   - Remove all `??` fallbacks
   - Add to equipment settings UI

5. Add hop flavor estimation (optional):
   - Port `src/utils/hopsFlavor.ts` to HopFlavorService
   - 9-axis flavor profile (citrus, tropical, stone fruit, berry, floral, grassy, herbal, spice, resin)
   - Timing factors for contribution
   - Display as radar chart or bars

6. Test:
   - Add hops with different timing
   - See IBU update in real-time
   - Change addition type and see IBU change
   - Verify hop absorption in volume calculations
   - Check flavor profile display

**Acceptance Criteria:**
- ✅ Can select from 144 hop presets
- ✅ Can add multiple hop additions with different timings
- ✅ IBU calculations are accurate for all addition types
- ✅ Hop absorption is properly factored into volumes
- ✅ Flavor profile estimation works (optional)

---

### Phase 4: Water & Volume Calculations (Week 3, ~12 hours)

**Goal**: Accurate water volume calculations and chemistry modeling.

**Tasks:**
1. Create VolumeCalculationService:
   - Port calculations from `src/utils/calculations.ts`
   - `calculateStrikeWater()` - Mash water volume
   - `calculateSpargeWater()` - Sparge volume
   - `calculatePreBoilVolume()` - After mash
   - `calculatePostBoilVolume()` - After boil
   - `calculateKettleLoss()` - Trub + hop absorption (FIXED!)
   - `calculateFermenterVolume()` - Final batch size
   - ALL losses: grain absorption, kettle, chiller, fermenter

2. Update Equipment model:
   - Add all equipment parameters:
     - `mashThicknessLPerKg: number` - Required, default 3.0
     - `grainAbsorptionLPerKg: number` - Required, default 1.04
     - `mashTunDeadspaceL: number` - Required, default 2.0
     - `boilOffRateLPerHour: number` - Required, default 4.0
     - `kettleLossL: number` - Required, default 1.0
     - `hopsAbsorptionLPerKg: number` - Required, default 0.7 (FIX!)
     - `chillerLossL: number` - Required, default 0.5
     - `fermenterLossL: number` - Required, default 0.5
     - `trubLossL: number` - Required, default 1.0
     - `coolingShrinkagePercent: number` - Required, default 4.0

3. Create WaterChemistryService:
   - Port from `src/calculators/water.ts`
   - `calculateIonLevels()` - From salt additions
   - `estimateMashPH()` - Simplified pH model
   - Salt types: Gypsum, Calcium Chloride, Epsom, Table Salt, Baking Soda, Chalk

4. Build WaterChemistryPanel component:
   - Water profile editor (Ca, Mg, Na, SO4, Cl, HCO3)
   - Salt addition inputs
   - Ion level display
   - Target profile presets (Balanced, Hoppy, Malty)

5. Build VolumeDisplay component:
   - Show all calculated volumes:
     - Strike water
     - Sparge water
     - Pre-boil volume
     - Post-boil volume
     - Into fermenter
     - All losses breakdown

6. Test:
   - Add hops and see hop absorption factor into losses
   - Change equipment settings and see volumes update
   - Add salts and see ion levels change
   - Verify all volumes are accurate

**Acceptance Criteria:**
- ✅ All water volumes are calculated correctly
- ✅ Hop absorption is properly implemented (not optional!)
- ✅ Water chemistry calculations work
- ✅ Can edit equipment profile
- ✅ Losses are clearly broken down

---

### Phase 5: Mash, Yeast, and Advanced Features (Week 4-5, ~20 hours)

**Goal**: Full feature parity with old builder plus improvements.

**Tasks:**
1. Yeast:
   - Yeast preset database (200+ strains)
   - Attenuation ranges (update FG calculation)
   - Temperature ranges
   - Flocculation
   - Starter calculator (Mr. Malty method)
   - Cell count and viability

2. Mash Schedule:
   - Mash step editor (Infusion, Temperature, Decoction)
   - Step timing
   - Temperature targets
   - Volume calculations per step
   - Strike temperature calculator

3. Fermentation:
   - Primary fermentation duration
   - Secondary/conditioning
   - Temperature control
   - Dry hop schedule

4. Equipment Profiles:
   - Save/load multiple equipment profiles
   - Default profile
   - Profile selector on recipe

5. Brew Sessions:
   - Link recipe to brew session
   - Actual vs expected values
   - Brew day timer (fixed with timestamp-based logic!)
   - Brew notes
   - Efficiency tracking

6. Recipe Management:
   - Recipe list page
   - Search and filter
   - Duplicate recipe
   - Delete with confirmation
   - Recipe history/versions

7. Import/Export:
   - Export to BeerXML
   - Export to PDF (brew sheet)
   - Import from BeerXML
   - Share recipe (URL or JSON)

8. BJCP Styles:
   - Style picker
   - Style guidelines display
   - Recipe vs style comparison
   - In-range indicators (OG, FG, IBU, SRM, ABV)

9. Performance:
   - Add debouncing to all inputs (300ms delay)
   - Memoize expensive calculations
   - Lazy load preset databases
   - Virtual scrolling for long lists

10. Error Handling:
    - React Error Boundaries
    - Try/catch in all async operations
    - User-friendly error messages
    - Validation errors inline

**Acceptance Criteria:**
- ✅ Can select yeast and see accurate FG
- ✅ Can build mash schedule
- ✅ Can save equipment profiles
- ✅ Can track brew sessions
- ✅ Can export to BeerXML
- ✅ Can compare to BJCP styles
- ✅ No performance issues with large recipes
- ✅ Graceful error handling everywhere

---

### Phase 6: Testing and Cutover (Week 6, ~10 hours)

**Goal**: Deploy Beta Builder as the default recipe builder.

**Tasks:**
1. User Testing:
   - Test with real recipes
   - Get feedback from users
   - Fix reported bugs
   - Performance testing

2. Migration Tool:
   - Build tool to migrate old recipes to new format
   - Handle all edge cases
   - Dry run with validation
   - Backup before migration

3. Documentation:
   - User guide
   - Video tutorial
   - Changelog
   - Migration guide

4. Route Swap:
   - `/recipes` → Beta Builder (new)
   - `/recipes-legacy` → Old Builder (fallback)
   - Add banner on legacy: "Try the new builder!"
   - Keep legacy for 1 month

5. Monitoring:
   - Track usage
   - Monitor errors
   - Collect feedback
   - Quick fixes if needed

6. Deprecation:
   - After 1 month, remove legacy builder
   - Clean up old code
   - Celebrate! 🎉

**Acceptance Criteria:**
- ✅ Users can migrate recipes seamlessly
- ✅ New builder is default
- ✅ No critical bugs reported
- ✅ Performance is good
- ✅ Users are happy

---

## How to Continue Development

### Starting a New Session

Since Claude Code doesn't retain memory between sessions, here's what to do:

1. **Navigate to main directory:**
   ```bash
   cd /Users/lucascg/Developer/Projects/BeerApp
   ```

2. **Checkout the branch:**
   ```bash
   git checkout beta-builder-clean-architecture
   ```

3. **Start Claude Code:**
   ```bash
   claude
   ```

4. **Tell Claude:**
   ```
   I'm working on the Beta Builder refactor. Read REFACTOR-SPEC.md for context.
   I want to work on Phase [X]: [Phase Name]. Where do we start?
   ```

### Development Workflow

1. **Pick a task** from the current phase in this spec

2. **Create files in the right layer:**
   - Models → `domain/models/`
   - Services → `domain/services/`
   - Repositories → `domain/repositories/`
   - Stores → `presentation/stores/`
   - Hooks → `presentation/hooks/`
   - Components → `presentation/components/`

3. **Follow the pattern:**
   - Services are classes with methods (your Managers)
   - Repositories wrap storage (your Data Layer)
   - Stores coordinate between repository and UI
   - Hooks wrap services with useMemo
   - Components use stores and hooks, render UI

4. **Test incrementally:**
   - Write service → Test in isolation
   - Add repository → Test save/load
   - Update store → Test state updates
   - Create hook → Test reactivity
   - Build component → Test in browser

5. **Commit frequently:**
   ```bash
   git add .
   git commit -m "feat: [what you added]"
   ```

### Code Style Guidelines

**Services (Business Logic):**
```typescript
// domain/services/ExampleService.ts
export class ExampleService {
  // Pure functions - no React, no storage
  calculateSomething(input: Recipe): number {
    // Business logic here
    return result;
  }
}

export const exampleService = new ExampleService();
```

**Repositories (Data Layer):**
```typescript
// domain/repositories/ExampleRepository.ts
export class ExampleRepository {
  private readonly storageKey = 'example-key';

  load(): Example[] {
    // Storage access here
    return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
  }

  save(item: Example): void {
    // Storage access here
    localStorage.setItem(this.storageKey, JSON.stringify(item));
  }
}

export const exampleRepository = new ExampleRepository();
```

**Stores (State Management):**
```typescript
// presentation/stores/exampleStore.ts
import { create } from 'zustand';

type ExampleStore = {
  items: Example[];
  currentItem: Example | null;

  loadItems: () => void;
  saveItem: (item: Example) => void;
}

export const useExampleStore = create<ExampleStore>((set, get) => ({
  items: [],
  currentItem: null,

  loadItems: () => {
    const items = exampleRepository.load();
    set({ items });
  },

  saveItem: (item: Example) => {
    exampleRepository.save(item);
    get().loadItems(); // Reload after save
  },
}));
```

**Hooks (React Adapters):**
```typescript
// presentation/hooks/useExample.ts
import { useMemo } from 'react';

export function useExample(input: Recipe) {
  return useMemo(() => {
    return exampleService.calculateSomething(input);
  }, [input]);
}
```

**Components (UI):**
```typescript
// presentation/components/ExampleComponent.tsx
export function ExampleComponent() {
  const item = useExampleStore(s => s.currentItem);
  const result = useExample(item);

  return (
    <div>
      <h1>Result: {result}</h1>
    </div>
  );
}
```

---

## Key Differences from Old Builder

### Old Builder Issues

1. **Mixed concerns:**
   ```typescript
   // Everything in one place
   function useRecipeCalculations(recipe) {
     // Data extraction
     const hops = recipe.ingredients.hops;

     // Business logic
     const ibu = calculateIBU(hops);

     // Storage
     localStorage.setItem('recipe', JSON.stringify(recipe));

     // UI state
     const [loading, setLoading] = useState(false);
   }
   ```

2. **Type duality:**
   - UI uses `GrainItem` with different shape than storage `FermentableAddition`
   - Constant mapping back and forth
   - Source of bugs

3. **Optional everywhere:**
   - `hopsAbsorptionLPerKg?: number` with `?? 0.7` fallbacks scattered
   - Inconsistent defaults
   - Hard to know actual value

4. **Direct localStorage:**
   - `localStorage.setItem()` called from components
   - No abstraction
   - Can't swap storage implementation

5. **Calculations in Recipe object:**
   - `recipe.calculated.ibu` stored
   - Gets out of sync
   - Wasted storage space

### Beta Builder Solutions

1. **Clear separation:**
   ```typescript
   // Service (business logic)
   class RecipeCalculationService {
     calculateIBU(recipe: Recipe): number { ... }
   }

   // Repository (storage)
   class RecipeRepository {
     save(recipe: Recipe): void { ... }
   }

   // Store (state)
   const useRecipeStore = create((set) => ({
     saveRecipe: () => repository.save(recipe)
   }));

   // Hook (adapter)
   function useIBU(recipe: Recipe) {
     return useMemo(() => service.calculateIBU(recipe), [recipe]);
   }

   // Component (UI)
   function RecipeStats() {
     const recipe = useRecipeStore(s => s.currentRecipe);
     const ibu = useIBU(recipe);
     return <div>IBU: {ibu}</div>;
   }
   ```

2. **Single type system:**
   - One `Recipe` type for everything
   - No mapping needed
   - Single source of truth

3. **Required with defaults:**
   - `hopsAbsorptionLPerKg: number` (required)
   - Default set in one place: equipment creation
   - No `??` fallbacks
   - Always know the value

4. **Repository abstraction:**
   - All storage through RecipeRepository
   - Easy to swap localStorage for API
   - Centralized error handling
   - Can add caching/versioning

5. **Calculated on demand:**
   - No `recipe.calculated` object
   - Calculate when needed
   - Always fresh
   - No sync issues

---

## Testing Strategy

### Unit Tests (Future)

**Services** - Pure functions, easy to test:
```typescript
describe('RecipeCalculationService', () => {
  it('calculates ABV correctly', () => {
    const service = new RecipeCalculationService();
    const abv = service.calculateABV(1.050, 1.010);
    expect(abv).toBeCloseTo(5.25, 2);
  });
});
```

**Repositories** - Mock localStorage:
```typescript
describe('RecipeRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads recipe', () => {
    const repo = new RecipeRepository();
    const recipe = { id: '1', name: 'Test' };

    repo.save(recipe);
    const loaded = repo.loadById('1');

    expect(loaded).toEqual(recipe);
  });
});
```

### Manual Testing (Current)

For each phase:
1. Start dev server: `npm run dev`
2. Navigate to `/beta-builder`
3. Test all features in the phase
4. Check calculations are correct
5. Save and reload - verify persistence
6. Check browser console for errors
7. Test edge cases (empty recipe, zero values, etc.)

### Comparison Testing

Run old and new builders side-by-side:
1. Create same recipe in both
2. Compare calculated values
3. Should be identical (or new one is correct!)
4. File bugs if different

---

## Known Issues to Fix

### High Priority (Fix during refactor)

1. **Hop absorption bug** (Phase 4):
   - Make `hopsAbsorptionLPerKg` required, not optional
   - Remove all `?? 0.7` fallbacks
   - Centralize default in equipment creation

2. **Timer drift** (Phase 5):
   - Mash timer uses `setInterval` - browser throttles when tab loses focus
   - Fix: Use timestamp-based timing (compare `Date.now()` to target)

3. **No debouncing** (Phase 5):
   - Every keystroke triggers full recalculation
   - Fix: Debounce inputs with 300ms delay

4. **Preset performance** (Phase 2):
   - `getGrainPresets()` loads from localStorage and processes on every call
   - Fix: Load once, memoize, use Zustand store

5. **No error boundaries** (Phase 5):
   - React errors crash entire app
   - Fix: Add Error Boundary components

### Medium Priority

6. **Type duality** (Phase 5):
   - `GrainItem` vs `FermentableAddition`
   - Fix: Use single `Fermentable` type everywhere

7. **Equipment snapshot** (Phase 5):
   - Full equipment profile duplicated in every recipe
   - Fix: Reference equipment profile by ID, include snapshot for historical record

8. **Mash temp adjustment** (Phase 5):
   - FG calculation doesn't account for mash temp
   - Fix: Add mash temp factor to FG estimation

### Low Priority

9. **Magic numbers** (Phase 5):
   - Constants like 131.25, 1.4922 not commented
   - Fix: Add comments explaining formulas

10. **No validation** (Phase 5):
    - Can create recipe with negative volumes
    - Fix: Add ValidationService

---

## Resources

### Documentation Files

- `DOCUMENTATION.md` - Complete technical reference of old codebase
- `ARCHITECTURE-DIAGRAMS.md` - Visual diagrams of data flow
- `BETA-BUILDER-SETUP.md` - Setup and testing instructions
- `src/modules/beta-builder/README.md` - Architecture deep dive
- **This file (`REFACTOR-SPEC.md`)** - Complete specification and roadmap

### Key Old Files to Reference

**Calculations:**
- `src/utils/calculations.ts` - Water volume calculations
- `src/calculators/ibu.ts` - IBU calculations (Tinseth)
- `src/calculators/abv.ts` - ABV formula
- `src/calculators/water.ts` - Water chemistry
- `src/utils/hopsFlavor.ts` - Hop flavor profiles

**Preset Data:**
- `src/utils/presets.ts` - Fermentables, hops, yeasts databases (2000+ lines)

**Types:**
- `src/types/recipe.ts` - Old Recipe type definition

**Hooks:**
- `src/hooks/useRecipeCalculations.ts` - Old calculation hook (304 lines of mixed concerns)

**Components:**
- `src/modules/recipe/components/` - Old recipe components for UI reference

### External References

**Formulas:**
- Tinseth IBU: http://realbeer.com/hops/research.html
- Morey SRM: http://brewwiki.com/index.php/Estimating_Color
- ABV: (OG - FG) × 131.25
- Strike temp: (Mash temp - grain temp) × (0.41 / thickness) + mash temp

**Standards:**
- BeerXML: http://www.beerxml.com/
- BJCP Styles: https://www.bjcp.org/style/2021/

**Architecture:**
- Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- Zustand: https://github.com/pmndrs/zustand
- React Performance: https://react.dev/learn/render-and-commit

---

## Success Criteria

The refactor is successful when:

1. ✅ **Feature Parity**: Beta Builder has all features of old builder
2. ✅ **Accurate Calculations**: All calculations match or improve upon old builder
3. ✅ **Clean Architecture**: Clear separation between domain and presentation
4. ✅ **Testable**: Services can be unit tested without React
5. ✅ **Performant**: No lag on user input, calculations are fast
6. ✅ **Maintainable**: New features are easy to add
7. ✅ **Bug-Free**: All known bugs fixed (hop absorption, timer drift, etc.)
8. ✅ **User-Friendly**: Better UX than old builder
9. ✅ **Documented**: Clear documentation for future developers
10. ✅ **Deployed**: Beta Builder is the default at `/recipes`

---

## Current Git Status

**Branch**: `beta-builder-clean-architecture`
**Location**: `/Users/lucascg/Developer/Projects/BeerApp`
**Last Commit**: `feat: Add Beta Builder with Clean Architecture` (cf18f9a)

**Changed Files:**
- `src/main.tsx` - Added `/beta-builder` route
- `src/pages/Home.tsx` - Added "🚀 Beta Builder (New!)" button
- `src/types/recipe.ts` - Minor modifications

**New Files:**
- `src/modules/beta-builder/` - Complete Beta Builder implementation (14 files)
- `DOCUMENTATION.md` - Complete codebase documentation
- `ARCHITECTURE-DIAGRAMS.md` - Visual diagrams
- `REFACTOR-PLAN.md` - Initial refactor plan (outdated, use this file instead)
- `BETA-BUILDER-SETUP.md` - Setup instructions
- **This file** - `REFACTOR-SPEC.md`

**Storage Key**: `beta-recipes-v1` (separate from old builder)

---

## Next Steps

**Immediate (Phase 2):**
1. Fix Node.js icu4c dependency: `brew reinstall icu4c && brew reinstall node`
2. Test Phase 1: `npm run dev` and visit `/beta-builder`
3. Start Phase 2: Full Fermentable Support
   - Extract preset data
   - Build preset picker
   - Add inline editing

**Questions for Next Session:**
- "I want to start Phase 2: Full Fermentable Support. Where do we begin?"
- "Can you create the FermentablePreset type and extract the preset data?"
- "Can you build the fermentable preset picker component?"

---

## Final Notes

**This is industry-standard architecture.** Companies like Stripe, Vercel, Linear, and GitHub use similar patterns. It matches your SwiftUI experience perfectly:

- **Services** = Your Swift Managers
- **Repositories** = Your Data Layer
- **Stores** = Your @Published properties
- **Components** = Your Views

The old builder works fine and will stay live until Beta Builder is ready. No pressure, no risk. Build it right, test thoroughly, and swap when ready.

You've got this! 🍺
