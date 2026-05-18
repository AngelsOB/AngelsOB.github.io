# DEPRECATED CLASSIC UI (with one exception)

This folder contains the original classic learn-module presentation components: `LearnArticle.tsx`, `LearnNav.tsx`, `FormulaCallout.tsx`, `BuilderMockups.tsx`, `HopRadarDemo.tsx`, `MathBlock.tsx`. These are quarantined — do not modify; do not import from outside `app/betabuilder/`. HS-native replacements ship in Phase 4 under `src/modules/hopskip/components/` (e.g. `HSLearnArticle`, `HSLearnNav`, `HSFormulaCallout`).

**Exception:** `docsConfig.ts` stays active and is consumed by HopSkip as the source of truth for article ordering and metadata. Do NOT mark it deprecated.

See [/HOPSKIP_MIGRATION_PRD.md](/HOPSKIP_MIGRATION_PRD.md) for the migration plan.
