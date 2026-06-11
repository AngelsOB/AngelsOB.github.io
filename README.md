# Brewing.It

Homebrewing recipe builder & calculators. Next.js (App Router) + Firebase
(Auth + Firestore) + Stripe, styled with Tailwind v4 + an in-house design
system (the `HS*` components).

## Local dev

```bash
npm install
npm run dev
```

Requires Node 22+. Firebase/Stripe keys go in `.env.local`.

## Checks

```bash
npm run ci        # lint + tests + build
npm run test:run  # vitest only
```

## Layout

- `app/` — routes only (thin pages; logic lives in modules)
- `src/modules/recipe/` — shared domain layer: models, calculation services,
  Firestore repositories, Zustand stores, ingredient data. No UI.
- `src/modules/builder/` — the recipe builder UI and HS* design system
- `src/modules/home/` — the homepage (GSAP scroll tour + signed-in hero)
- `src/modules/auth|sharing|labels|compare|learn` — feature modules
- `quarantine/` — parked features (version history UI, 3D can experiment);
  excluded from compile, each with a README explaining how to revive
- `docs/` — PRDs and build notes (`docs/archive/` for historical)

## Deploy

Production deploys from the `brewtool` remote's `main` branch.
