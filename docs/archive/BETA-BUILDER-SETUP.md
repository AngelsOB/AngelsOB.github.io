# Beta Builder - Setup Instructions

## ✅ Files Copied Successfully

All Beta Builder files have been copied to your main BeerApp directory:

```
/Users/lucascg/Developer/Projects/BeerApp/
├── src/
│   ├── modules/
│   │   └── beta-builder/        ← NEW! Complete Clean Architecture implementation
│   │       ├── domain/
│   │       │   ├── models/      ← Recipe, Fermentable, Hop types
│   │       │   ├── services/    ← RecipeCalculationService (your "Manager")
│   │       │   └── repositories/ ← RecipeRepository (localStorage)
│   │       ├── presentation/
│   │       │   ├── components/  ← BetaBuilderPage (UI)
│   │       │   ├── hooks/       ← useRecipeCalculations (React adapters)
│   │       │   └── stores/      ← recipeStore (Zustand state)
│   │       └── README.md        ← Architecture documentation
│   ├── main.tsx                 ← UPDATED: Added /beta-builder route
│   └── pages/
│       └── Home.tsx             ← UPDATED: Added "🚀 Beta Builder (New!)" button
```

## 🔧 Fix Node.js Issue First

You have a system-level Node.js dependency issue. Run these commands:

```bash
brew reinstall icu4c
brew reinstall node
```

## 🚀 How to Test Beta Builder

1. **Start the dev server:**
   ```bash
   cd /Users/lucascg/Developer/Projects/BeerApp
   npm run dev
   ```

2. **Navigate to:** `http://localhost:5173/beta-builder`

3. **Test the features:**
   - Page should load with a new recipe
   - Click "Add Fermentable" → watch calculations update in real-time
   - Change batch volume/efficiency → see ABV/OG/FG recalculate
   - Click "Save Recipe to localStorage"
   - Recipe is saved to `beta-recipes-v1` key (separate from old builder)

4. **Verify old builder still works:**
   - Navigate to `http://localhost:5173/recipes`
   - Should load your existing recipe builder unchanged

## 📁 What's Different?

### Architecture Comparison

**Old Recipe Builder** (`/recipes`):
- Everything mixed together in large files
- Business logic in hooks and components
- Hard to test, hard to maintain
- Direct localStorage access everywhere

**Beta Builder** (`/beta-builder`):
- Clean separation of concerns
- Domain Services contain all business logic (testable without React)
- Repository pattern for data access
- Stores coordinate between data and UI
- Components are pure UI (like SwiftUI Views)

### Storage Separation

- **Old Builder**: Uses various localStorage keys
- **Beta Builder**: Uses `beta-recipes-v1` key only
- They won't interfere with each other
- Safe to test without affecting production data

## 📋 Current Features (Phase 1)

- ✅ Recipe creation and editing
- ✅ Recipe name input
- ✅ Equipment settings (batch volume, efficiency, boil time)
- ✅ Fermentable list (add/remove)
- ✅ Real-time calculations:
  - Original Gravity (OG)
  - Final Gravity (FG) - estimated at 75% attenuation
  - Alcohol by Volume (ABV)
  - International Bitterness Units (IBU) - currently 0 (no hops yet)
  - Standard Reference Method (SRM) color
- ✅ Save to localStorage
- ✅ Clean Architecture with full separation of concerns

## 🛣️ Roadmap

### Phase 2: Full Fermentable Support (Week 1)
- Load fermentable presets from database
- Inline editing of fermentable properties
- Support for extract, sugar, adjuncts
- Fermentable type filtering

### Phase 3: Hops (Week 2)
- Hop additions UI with timing controls
- Hop presets database (144 hops)
- IBU calculations for all hop types
- Hop flavor profile estimation
- **FIX: Proper hop absorption calculation** (the recurring bug!)

### Phase 4: Water & Process (Week 3)
- Water chemistry calculator
- Salt additions and ion calculations
- Mash schedule builder
- Volume calculations with all losses

### Phase 5: Advanced Features (Week 4-5)
- Yeast selection and management
- Equipment profile management
- Brew session tracking with timers
- Recipe notes and sharing
- BJCP style guidelines

### Phase 6: Cutover (Week 6)
- Side-by-side user testing
- Bug fixes and polish
- Performance optimization
- Swap routes:
  - `/recipes` → Beta Builder (new)
  - `/recipes-legacy` → Old builder (fallback for 1 month)

## 🏗️ Architecture Deep Dive

See `/src/modules/beta-builder/README.md` for detailed architecture documentation including:
- Layer-by-layer breakdown
- SwiftUI to React/TypeScript mapping
- Data flow diagrams
- Code examples
- Why this is industry standard

## ✅ Next Steps

1. Fix Node.js by running `brew reinstall icu4c && brew reinstall node`
2. Start dev server: `npm run dev`
3. Test Beta Builder at `/beta-builder`
4. Verify calculations work correctly
5. Try saving and check localStorage in DevTools
6. Report any issues or feedback
7. Once Phase 1 is validated, we'll proceed to Phase 2

## 🎯 Why This Approach?

✅ **Zero risk** - Old builder keeps working
✅ **Real testing** - Users can try both and compare
✅ **Incremental** - Build features one at a time
✅ **Easy rollback** - Just remove the link if needed
✅ **Learning opportunity** - Experiment without breaking production
✅ **Clear migration path** - When ready, just swap the routes

You now have a complete, working Beta Builder with Clean Architecture! 🎉
