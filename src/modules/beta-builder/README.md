# DEPRECATED CLASSIC UI (presentation layer only)

The `presentation/components/` UI in this folder is quarantined classic UI during the HopSkip migration. Do not modify those components; do not import them from outside `app/betabuilder/`. HS-native replacements ship section-by-section in Phase 2 under `src/modules/hopskip/components/builder/`.

**Reused by HS (NOT deprecated):**
- `domain/**` — models, services, repositories
- `presentation/stores/recipeStore.ts` and other Zustand stores
- `presentation/hooks/useRecipeCalculations.ts` and other hooks

See [/HOPSKIP_MIGRATION_PRD.md](/HOPSKIP_MIGRATION_PRD.md) for the migration plan. The architecture guide below is preserved for historical context — it accurately describes the data + calculation layer that HS continues to reuse.

---

# Beta Builder - Clean Architecture Implementation

## Overview

This is a complete refactor of the BeerApp recipe builder using **Clean Architecture** principles, designed to match your SwiftUI experience with Managers + Views + Data Layer.

## Architecture Layers

### 1. Domain Layer (`domain/`)

The core business logic - NO dependencies on React, UI, or storage implementations.

#### `domain/models/` - Your Swift Structs
- **Recipe.ts**: Core data types (Recipe, Fermentable, Hop, RecipeCalculations)
- Pure TypeScript types with no logic
- These are your "source of truth" data shapes

#### `domain/services/` - Your Swift Managers
- **RecipeCalculationService.ts**: All calculation logic (ABV, OG, FG, IBU, SRM)
- Contains business rules and formulas
- Pure functions - can be tested without React or UI
- Equivalent to your SwiftUI `RecipeManager` classes

#### `domain/repositories/` - Your Data Layer
- **RecipeRepository.ts**: Handles localStorage persistence
- Abstracts storage implementation (easy to swap localStorage for API/IndexedDB later)
- Equivalent to your SwiftUI UserDefaults/CoreData layer

### 2. Presentation Layer (`presentation/`)

React-specific code that uses the domain layer.

#### `presentation/stores/` - Your @Published Properties
- **recipeStore.ts**: Zustand store with state and actions
- Like SwiftUI `ObservableObject` with `@Published` properties
- Coordinates between Repository (data) and UI (components)

#### `presentation/hooks/` - React Adapters
- **useRecipeCalculations.ts**: Makes services reactive with useMemo
- Thin wrappers that optimize performance for React
- In SwiftUI you don't need this - it happens automatically

#### `presentation/components/` - Your SwiftUI Views
- **BetaBuilderPage.tsx**: Main UI component
- Pure UI code - no business logic, no direct storage access
- Like your SwiftUI `View` structs

## Data Flow

```
USER INTERACTION
     ↓
[Component] ───calls──→ [Store Action]
                             ↓
                    [Repository.save()]
                             ↓
                      localStorage
                             ↓
                    [Store State Updated]
                             ↓
                    [Component Re-renders]
                             ↓
                    [Hook calls Service]
                             ↓
                    [Service.calculate()]
                             ↓
                    [Display Result]
```

## Comparison to Your Current Code

### Old Architecture (Current Recipe Builder)
```typescript
// Everything mixed together
function useRecipeCalculations(recipe) {
  // 304 lines with:
  // - Data extraction
  // - Business logic
  // - Calculations
  // - React hooks
  // - localStorage access
}
```

### New Architecture (Beta Builder)
```typescript
// Separated by concern

// 1. Models (data shapes)
type Recipe = { ... }

// 2. Service (business logic)
class RecipeCalculationService {
  calculateABV(og, fg) { return (og - fg) * 131.25; }
}

// 3. Repository (storage)
class RecipeRepository {
  save(recipe) { localStorage.setItem(...); }
}

// 4. Store (state management)
const useRecipeStore = create((set) => ({
  currentRecipe: null,
  saveCurrentRecipe: () => repository.save(get().currentRecipe)
}));

// 5. Hook (React adapter)
function useRecipeCalculations(recipe) {
  return useMemo(() => service.calculate(recipe), [recipe]);
}

// 6. Component (UI only)
function BetaBuilderPage() {
  const recipe = useRecipeStore(s => s.currentRecipe);
  const calculations = useRecipeCalculations(recipe);
  return <div>{calculations.abv}%</div>;
}
```

## Key Benefits

1. **Testable**: Services can be tested without React or UI
2. **Maintainable**: Each file has one clear responsibility
3. **Familiar**: Matches your SwiftUI mental model
4. **Scalable**: Easy to add features without breaking existing code
5. **Portable**: Services can be reused in other projects
6. **Type-safe**: Full TypeScript coverage

## Current Features

Phase 1 (Completed):
- ✅ Recipe creation and editing
- ✅ Fermentable management
- ✅ OG/FG/ABV calculations
- ✅ IBU calculations (boil, whirlpool, dry hop, FWH, mash)
- ✅ SRM color calculations
- ✅ localStorage persistence (separate from old builder)

## Next Steps

### Phase 2: Full Fermentable Support
- Add fermentable presets database
- Allow editing fermentable properties inline
- Support for extract, sugar, adjuncts

### Phase 3: Hop Features
- Hop presets database
- Hop flavor profile calculations
- Better hop addition UI

### Phase 4: Water & Process
- Water chemistry service
- Mash schedule service
- Volume calculations with proper hop absorption

### Phase 5: Advanced Features
- Yeast management
- Equipment profiles
- Brew session tracking
- Recipe sharing

### Phase 6: Cutover
- User testing period
- Bug fixes and polish
- Swap routes: `/recipes` → new builder, `/recipes-legacy` → old builder
- Keep old version as fallback for 1 month

## Testing the Beta Builder

1. Fix Node.js icu4c dependency issue:
   ```bash
   brew reinstall icu4c
   brew reinstall node
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Navigate to: `http://localhost:5173/beta-builder`

4. Test flow:
   - Click "Add Fermentable" button
   - See OG/FG/ABV/SRM calculations update
   - Change batch volume or efficiency
   - Click "Save Recipe to localStorage"
   - Refresh page (future: should load saved recipes)

## Storage

- Beta Builder uses `beta-recipes-v1` localStorage key
- Completely separate from old builder's storage
- Safe to test without affecting production data

## Why This Architecture is Industry Standard

- **Used by**: Stripe, Vercel, Linear, GitHub, Shopify
- **Recommended by**: Kent C. Dodds, Tanner Linsley, Uncle Bob Martin
- **Pattern**: Clean Architecture / Hexagonal Architecture / Ports & Adapters
- **React-specific**: Combines Clean Architecture with React best practices (hooks, Zustand)

## Questions?

See the inline comments in each file for detailed explanations of what each part does and why it exists.
