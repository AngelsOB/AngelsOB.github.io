# PRD-001: Vite SPA to Next.js + Vercel Migration

> **Status:** Complete
> **Completed:** 2026-03-04
> **Branch:** `feat/nextjs-migration`
> **Blocks:** PRD-002

---

## Summary

Migrated from Vite SPA + GitHub Pages to Next.js 16 App Router + Vercel. Zero feature changes — pure infrastructure swap. All 230 tests pass, build succeeds, Vercel preview deploys working.

**Key changes:** Removed `vite`, `react-router-dom`. Added `next`. Created `app/` directory with file-based routing. Split layout into server (metadata/SEO) + client (interactive shell). Added `'use client'` to 56 files. Renamed `src/pages/` → `src/views/`.

---

## Gotchas for Future Work

1. **`src/pages/` is reserved** — Next.js treats any `pages/` dir as Pages Router. We use `src/views/`. Don't create `pages/` anywhere.

2. **Image imports return objects** — In Next.js, `import img from './foo.png'` returns `{ src, width, height }`, not a string. See `yeastLabIcons.ts` `src()` helper for the pattern.

3. **No `import.meta.env`** — Use `process.env.NODE_ENV` instead. Won't work during SSR prerendering.

4. **Path aliases live in two places** — `tsconfig.json` AND `vitest.config.ts`. Update both. Note: `@pages` → `./src/views/`.

5. **`'use client'` boundary** — Sits at `app/ClientShell.tsx`. Pure domain models/services/calculators don't have it — keep it that way.

6. **Vitest is standalone** — No Vite dependency. If you add component tests (JSX), you'll need `@vitejs/plugin-react` back.

7. **`NavLink` replacement** — Uses `Link` + `usePathname()` for active state. See `NavBar.tsx`.

---

## Remaining Work

- [x] Update `.github/workflows/deploy.yml` — remove GitHub Pages deploy job, keep lint + test (renamed to `ci.yml`)
- [x] Add dynamic metadata for `/recipes/[id]` pages — client-side `document.title` update (server-side `generateMetadata` deferred to PRD-002 when recipes move to Firestore)
- [x] Full manual QA: recipe editor, dnd-kit, recharts, themes, mobile, import/export

### Deferred to PRD-002

- Configure `brewing.it.com` domain in Vercel + update DNS
- Add `metadataBase` to root layout once domain is live
- Server-side `generateMetadata` for SEO (needs Firestore)
