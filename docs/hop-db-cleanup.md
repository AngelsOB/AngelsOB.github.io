# Hop DB cleanup — 2026-07-01

Cleanup pass over `src/utils/presets.generated.hops.json` (222 entries). Analysis was done by 8 parallel agents (7 per-batch canonical/name/value checks + 1 duplicate-cluster analyst), cross-checked against grower/breeder sources (YCH, Hopsteiner, BarthHaas, HPA, NZ Hops, Charles Faram, USDA, BJCP).

## Round 2 — owner decisions applied (2026-07-01)
Owner preference: **wide coverage — "rather too many than not enough."** So near-duplicates that could be distinct products or names people actually search are KEPT; only genuine bad-scrape/garbage rows were removed.
- **Deleted (bad data):** `Wai` (bad scrape of Wai-iti), `Cluster fugget` (scraper artifact).
- **Merged (owner-approved):** `East kent golding` → **East Kent Goldings**; `Golding` + `Goldings` → **Goldings** (kept the row with full numeric data).
- **`Eureka!` → `Eureka`** (dropped the "!").
- **Nectaron values corrected** (the one value fix owner wanted): alpha `24→11` (10.5–11.5), beta `11.5→4.8` (4.5–5), oil `4.5→1.7`, cohumulone `0→27`. Sourced from Charles Faram / NZ Hops. Other flagged value rows (Sticklebract, HQG 3, Saphir) left as-is per owner ("don't care").
- **Kept for coverage (NOT merged):** Saaz/Saazer, Hersbrucker/Hersbrucker Spät, the whole CTZ complex (Columbus/Tomahawk/Zeus/CTZ — "people call it CTZ"), and every experimental-code hop (BRU-1, HBC 472/630/638/682/682 c.v./1019 c.v., YCR 1, USDA 008 [confirmed real], HQG 3, HS09326) — nothing was removed from these, names were only re-cased. Also kept: the German-prefix pairs, accent/spelling variants, Spalt/Tettnang/Strisselspalt variants, Mt Hood/Mount Hood, Hüll/Huell Melon, Lublin/Lubelski, Celeia/Styrian Celeia, WGV pair, and the Styrian cluster (**preferred name = "Styrian Golding"**). The tables below remain as an optional future-merge reference.
- Result: **218 entries** (was 222). Preferred names: no apostrophes ever; "Styrian Golding" over "Savinjski Golding".
- **Open:** "Noble Hops" category — the DB tags every Czech variety Noble, including modern high-alpha bittering hops (Agnus, Bor, Vital ~13%, Premiant, Kazbek, Harmonie) that aren't noble aroma hops. Decide: leave as a regional bucket, or reclassify the modern Czech hops to a plain "Czech Hops" category.

## Round 3 — corpus-gap hops + Czech category (2026-07-01)
Closed the gaps in `docs/corpus-lab-hop-gaps.md` (section A) via 5 research agents (grower/breeder-sourced: John I. Haas, Charles Faram, NZ Hops, Hopsteiner, ZA Hops).
- **14 new entries added** to `HOP_PRESETS` (now 232 total): African Queen, Southern Passion, Southern Promise, Southern Star (ZA, new **"South African Hops"** category); Jester, Bullion, Archer, Pioneer, Olicana (GB); Barbe Rouge (FR); Styrian Wolf (SI); Denali, Medusa (US); Iunga (PL). All with sourced alpha/beta/oil/cohumulone + a house-style flavor vector (`flavorSource:"derived"`; Iunga `low` confidence, rest `high`). Denali kept as its own entry despite = Sultana (cross-link on hop pages).
- **"Czech Hops" category created** — moved the 8 modern Czech hops out of "Noble Hops" (Agnus, Bor, Premiant, Vital, Kazbek, Harmonie, Sladek, Sládek). "Noble Hops" now = the 6 true nobles (Saaz, Saazer, Saaz Late, Hallertau Mittelfrüh, Spalt, Tettnang).
- **Aliases added to `build-hop-map.mjs`** (corpus resolution): Taiheke→Cascade, Super Alpha→Dr. Rudi, Idaho→Idaho 7, German Select→Spalter Select, Super Styrian(s)→Aurora, HBC 438→Sabro, ŽPČ→Saaz, generic Hallertau→Hallertau Mittelfrüh, simco→Simcoe, mosiac→Mosaic. **Needs a map rebuild to take effect.**
- **Skipped** (not varieties): Fortnight (blend), Hopshot (CO2 extract).
- 1104 tests pass, lint clean. No numeric values on existing entries touched.

## Safety basis (verified before editing)
- **Recipes snapshot** hop name/alpha/flavor into their own object — renaming presets does **not** break saved recipes.
- **No generator** rebuilds this JSON; it is a hand-editable committed artifact. (`build-hop-map.mjs` *reads* it and writes a separate map.)
- **Import enrichment matches case-insensitively** (`HopEnrichmentService`), so casing fixes are safe / helpful.
- Exact-name code references: `COMMON_PICKS` in `HopPresetModal.tsx` (Amarillo, Cascade, Centennial, Citra, East Kent Goldings, Galaxy, **Hallertau Mittelfrüh**, Magnum, Mosaic, Nelson Sauvin, Saaz, Simcoe) and `build-hop-map.mjs` ALIAS targets. All preserved; the one renamed ALIAS target (`Mt. rainier`→`Mt. Rainier`, plus a pre-existing `Mt. hood`→`Mt. Hood` typo) was updated in lockstep.

## ✅ Applied in this pass (no numeric brewing values touched)
- **47 name casing/format fixes**, keeping proper diacritics (e.g. `Hallertauer mittelfrüh`→`Hallertauer Mittelfrüh`, `Sorachi ace`→`Sorachi Ace`, `Us saaz`→`US Saaz`, `Hbc 682`→`HBC 682`, `Bru-1`→`BRU-1`, `Superdelic , hops`→`Superdelic`).
- **5 wrong origin/category corrections:** Comet `DE`→`US`; Perle & Magnum category `US Hops`→`German Hops`; Styrian Celeia & Styrian Goldings → `SI` / `Slovenian Hops`.
- **~65 empty origin/category fills** with confidently-sourced values (US/GB/AU/SI). Additive only — no existing field overwritten.

Root cause of the mess: the kasperg3 data merge didn't recognise sparse hand-curated entries and their data-rich twins as the same hop, so both survived (hence the duplicates and the sparse-vs-rich value split).

---

## ⏳ Duplicates — flagged, NOT merged (your decision)
Recommended approach when you're ready: **keep the data-richer row, rename it to the canonical name, drop the redundant twin** (no numbers edited). Merging all of the below drops the DB from 222 to ~188 — the smoke test `expect(HOP_PRESETS.length).toBeGreaterThan(200)` will then need its threshold lowered (e.g. to `> 180`).

### Confident duplicate clusters
| Cluster | Members (idx) | Keep (canonical) | Drop | Notes |
|---|---|---|---|---|
| CTZ complex | Columbus[35], Columbus / tomahawk[36], CTZ[41], Tomahawk[195], Zeus[220] | **Columbus** (or CTZ) | 36, 41, 195, (220?) | Columbus=Tomahawk=CTZ. Zeus defensibly separate — your call. **Columbia[34] is a DIFFERENT hop, keep it.** |
| Golding / Goldings | Golding[69], Goldings[70] | **Goldings** | one | Keep separate from East Kent Goldings. |
| East Kent Goldings | East kent golding[45], East Kent Goldings[46] | **East Kent Goldings** | 45 | Canonical is app-referenced. |
| Hallertau Mittelfrüh | Hallertau Mittelfrüh[73], Hallertauer Mittelfrüh[76] | **Hallertau Mittelfrüh** | 76 | Keep name (COMMON_PICKS); [76] holds the fuller ranges — carry them over. |
| Hallertauer Taurus | Hallertauer Taurus[77], Taurus[190] | **Hallertauer Taurus** | 190 | [190] is a stub. |
| Hallertauer Tradition | German Tradition[67], Hallertauer Tradition[78], Tradition[197] | **Hallertauer Tradition** | 67, 197 | 3-way; [67] stub. |
| Opal | German Opal[64], Opal[130] | **Opal** | 64 | "German " is a vendor prefix. |
| Saphir | German Saphir[65], Saphir[154] | **Saphir** | 65 | ⚠ Saphir[154] `oil=8.8` is a data error (see flags). |
| Smaragd | German Smaragd[66], Smaragd[159] | **Smaragd** | 66 | |
| Huell Melon | Huell Melon[95], Hüll Melon[96] | **Hüll Melon** (diacritic) or Huell | one | [96] holds fuller data. |
| Mt. Hood | Mount Hood[119], Mt. Hood[121] | **Mt. Hood** (or Mount Hood) | one | |
| Sládek | Sladek[157], Sládek[158] | **Sládek** (diacritic) | 157 | |
| Spalt | Spalt[164], Spalt Spalter[165], Spalter[166] | **Spalt** (or Spalter) | two | **Spalter Select[167] is DISTINCT, keep it.** |
| Tettnanger | Tettnang[191], Tettnang Tettnanger[192], Tettnanger[193] | **Tettnanger**[193] | 191, 192 | [193] has fullest data. |
| Strisselspalt | Strisselspalt[171], Strisselspalter[172] | **Strisselspalt** | 172 | |
| HBC 682 | HBC 682[84], HBC 682 c.v.[85] | **HBC 682** | one | ⚠ Reconcile AA 18.5 vs 15.8 before merge. |
| Comet | Comet[37], Comet - estate grown[38] | **Comet** | 38 | "estate grown" is a lot label. |
| WGV | Whitbread Golding[214], Whitbread Goldings Variety[215] | **Whitbread Goldings Variety** | one | Not a true Golding. |
| Savinjski Golding | Savinjski Golding[155], Styrian Golding[175], Styrian Goldings[176], Styrian Savinjski Golding[177] | **Savinjski Golding** (or Styrian Golding) | three | ⚠ modern "Styrian Golding" stock is often *Celeia* — confirm your source. **Styrian Gold[174] & Extra Styrian Dana[57] are DISTINCT.** |
| Celeia | Celeia[26], Styrian Celeia[173] | **Celeia** | 173 | |
| Lublin | Lubelski[107], Lublin[108] | **Lublin** | one | Same Polish variety; keep separate from Saaz. |
| Ahtanum | Ahtanum[3], YCR 1[218] | **Ahtanum** | 218 | YCR 1 is Ahtanum's breeding code. |

### Uncertain — needs your call
- **Saaz[149] vs Saazer[151]:** almost certainly the same Žatec landrace → keep **Saaz** (app-referenced), drop Saazer. Keep **Saaz Late[150]** and **US Saaz[203]** separate.
- **Hersbrucker[89] vs Hersbrucker Spät[90]:** same variety, but numbers diverge → lean keep **Hersbrucker**.
- **Wai[209] vs Wai-iti[210]:** "Wai" isn't a real standalone NZ variety — looks like a truncation → lean merge into **Wai-iti**. (Waimea[211] is a different hop.)
- **Cluster[32] vs Cluster fugget[33]:** "Cluster fugget" is a scraper artifact with single-point ranges — can't verify if it's a mangled "Cluster" or a real lot. Needs your eyes.

---

## 🚩 Value / data flags — NOT changed (per instruction)
Egregious, needs a data-correction pass (I left every number untouched):
- **Sticklebract[169]** — every numeric field is `0` (placeholder). Real ≈ 12–15% alpha.
- **HQG 3[92]** — corrupt ranges: `alphaLow 7.5 / alphaHigh 0`, `betaLow 3.4 / betaHigh 0`.
- **Saphir[154]** — `oilTotalMlPer100g = 8.8` (impossible; ~0.6–1.6). Likely misplaced decimal.
- **Nectaron[123]** — `alpha 24 (21–27)`, `beta 11.5` — roughly 2× reality (~10–13% / ~5%).

Systemic patterns:
- **`cohumulone: 0` as a "missing" sentinel** on ~30 rows (not true zeros) — e.g. Agnus, Harmonie, Eclipse, Ella, East Kent Goldings.
- **"Noble Hops" applied to every Czech variety** including high-alpha bittering hops (Agnus, Bor, Vital, Kazbek). Misleading label — left as-is because it's a deliberate-looking systemic bucket; decide whether to reclassify wholesale.
- **USDA 008[204]** — could not verify what this designates (USDA accessions are 5-digit). Left as-is.

## ❓ Open naming questions
- **Apostrophes:** I applied Title Case only. Do you want the official apostrophe'd forms — `Brewers Gold`→`Brewer's Gold`, `Falconers Flight`→`Falconer's Flight`, `Falconers Flight 7Cs`→`Falconer's Flight 7 C's`?
- **`Eureka!`[56]** — keep the trailing "!" (some vendors stylise it) or drop it?
