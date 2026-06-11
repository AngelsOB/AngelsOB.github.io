# BeerApp

Homebrewing recipe builder and brewing calculator. React SPA deployed to GitHub Pages.

## Stack

- React 19 + TypeScript 5.8, Vite 7
- Zustand (state) + localStorage (persistence)
- Tailwind CSS 4 (class-based dark mode)
- Recharts (charts), @dnd-kit (drag-and-drop)
- React Router 7 with lazy-loaded routes

## Commands

```bash
npm run dev          # Dev server with HMR
npm run build        # Typecheck + production build (tsc -b && vite build)
npm run lint         # ESLint on all TS/TSX
npm run format       # Format code with Prettier
npm run format:check # Check formatting without writing
npm run preview      # Serve dist/ locally
npm run test         # Run vitest in watch mode
npm run test:run     # Run vitest once
```

## Project Structure

```
src/
├── pages/              # Route pages (Home, Calculators, RecipeBuilder, BrewMode)
├── components/         # Shared UI components
├── calculators/        # Pure calculation modules (abv, ibu)
├── utils/              # Helpers: calculations, water chemistry, BJCP styles, units, storage
├── hooks/              # useRecipeStore, useRecipeCalculations
├── stores/             # Zustand stores (theme)
├── types/              # TypeScript type definitions
└── modules/
    └── beta-builder/   # Clean architecture refactor (domain/presentation/data layers)
        ├── domain/     # Models, repositories, services — no React deps
        ├── presentation/  # Components and local stores
        └── data/       # Presets and seed data
```

## Key Patterns

- **Calculations are pure functions** in `utils/` and `calculators/` — no side effects, no React imports
- **Storage** uses a versioned `{ version, value }` wrapper around localStorage, keyed as `beerapp.*`
- **Beta builder** follows clean architecture: domain layer has zero UI dependencies; repositories abstract storage; presentation layer owns components and stores
- **Path aliases**: `@components/*`, `@pages/*`, `@calculators/*`, `@utils/*` (defined in tsconfig.app.json)
- **Theme**: CSS variables (`--bg`, `--text`, `--surface`, `--accent`, `--border`) toggled via `.dark` class
- **Vite chunking**: recharts, dnd-kit, and react are split into separate chunks

## Domain Terms

- **OG/FG**: Original/Final Gravity — density of wort before/after fermentation
- **IBU**: International Bitterness Units — hop bitterness, calculated via Tinseth formula
- **SRM**: Standard Reference Method — beer color, calculated via Morey formula
- **ABV**: Alcohol By Volume
- **BJCP**: Beer Judge Certification Program — style guidelines the app validates against
- **Mash pH**: Calculated using a proton deficit solver (recent refactor from RA-coefficient model)
