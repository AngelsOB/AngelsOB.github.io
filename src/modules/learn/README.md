# learn

Shared pieces for the `/learn` section. The article/nav UI lives in the
builder module (`HSLearnArticle`, `HSLearnNav`, `HSFormulaCallout`); this
module holds what they consume:

- `docsConfig.ts` — source of truth for article ordering and metadata
- `MathBlock.tsx` — KaTeX math rendering
- `HopRadarDemo.tsx` — interactive hop-flavor radar demo for the hop-flavor
  article (renders the shared `@/components/HopFlavorRadar`)
