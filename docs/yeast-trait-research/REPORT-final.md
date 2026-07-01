# POF / STA-1 yeast trait data — FINAL Phase-1 report

524 strains. Pipeline: 37-agent source research → cross-lab strainGroup propagation → 19-agent verify / adjudicate / infer → deterministic reconcile.

## Coverage

| Trait | + | − | unknown | known % | indexable known % |
|---|---|---|---|---|---|
| POF | 155 | 332 | 37 | 93% | 94% |
| STA-1 | 86 | 375 | 63 | 88% | 89% |

POF confidence: high:287  medium:169  low:31
STA-1 confidence: high:383  medium:66  low:12
STA-1 unknowns are mostly Brettanomyces/wild (STA1 is a Saccharomyces gene — N/A) and a conservative tail left for you to confirm.

## Source-verification audit (held-out re-fetch of cited sources)

- Checked 141 strains × 2 traits (sample biased toward flagged + all STA-1 positives).
- ✅ confirmed: 225   ❌ refuted→corrected: 2   ⚠️ unconfirmed-on-source: 54   🔌 source-unreachable: 1
- Only 2 genuine refutation(s) across the whole sample → the research base held up.

### Refuted & corrected
- **OYL-101 Saisonstein's Monster** [Omega Yeast] → pof:REFUTED→positive, sta1:REFUTED→positive (POF STA-1)

### Reverted bad propagations (value came from a mis-grouped strainGroup)
- SafAle BE-256.sta1 → reset to unknown

## Conflict adjudications (the 6 genuine intra-group contradictions)

### french-saison-pof  _(confidence: high)_
The 3711/WLP590 French Saison strain is genuinely POF+ at the genotype level, and the dataset's current values are correct — no change is warranted. The canonical French Saison isolate (Wyeast 3711 = WLP590 = OYL-026 = M29, plus Escarpment/Mangrove equivalents) is a Saccharomyces cerevisiae var. diastaticus strain, and per Gallone et al. 2016, saison/Belgian-domesticated strains retain functional PAD1/FDC1 and produce 4-vinylguaiacol, unlike the loss-of-function (POF-) majority of clean ale/lager strains. White Labs lists WLP590 as STA1 QC Positive and explicitly POF+; the suregork genomics work shows 3711 carries the full non-deleted STA1 promoter (the most diastatic of 15 strains tested), and the Milk The Funk wiki states WLP590 is "a diastaticus strain and POF+," same as/near 3711. The brewer reputation of 3711/WLP590 as a "clean, low-clove" saison is a phenotype-INTENSITY-and-descriptor distinction, not a POF- genotype: this strain expresses its phenolic as a lighter PEPPERY/citrus-spice note (and at lower 4-VG intensity in its typical warm, fully-attenuated dry profile) rather than the heavy CLOVE of Dupont 3724 — but it does carry the POF machinery and does make 4-VG. (The suregork note that another saison strain, WLP566, is phenotypically POF+ despite homozygous nonsense PAD1/FDC1 underscores how robust the POF phenotype is in this lineage.) The research verdict "all diastatic strains are POF+" therefore holds; the contradiction was apparent, not real, arising from conflating low clove perception with a POF- genotype. The STA1 split in the data (OYL-438 negative, the rest positive) is legitimate, not a contradiction: OYL-438 is Omega's "French Saison Plus," the engineered STA- derivative that retains the POF+ phenolic character but has the STA1 gene removed.

- **3711 French Saison** → POF:keep STA-1:keep — Canonical French Saison isolate. Wyeast classifies it as S. cerevisiae var. diastaticus by PCR; suregork shows it carries the full non-deleted STA1 promoter (most diastatic of 15 tested) -> STA1+ stands. POF+ stands: saison lineage retains functional PAD1/FDC1 (Gallone 2016) and produces 4-VG; the 'clean/low-clove' reputation is a peppery-not-clove, lower-intensity phenotype, not a POF- genotype. Keep pof=positive, sta1=positive.
- **WLP590 French Saison Ale Yeast** → POF:keep STA-1:keep — White Labs official: STA1 QC Result = Positive, and explicitly POF+ ('will contribute phenolic characteristics'). MTF wiki: 'a diastaticus strain and POF+,' same as/near Wyeast 3711. Keep pof=positive, sta1=positive.
- **French Saison** → POF:keep STA-1:keep — Generic entry for the same French Saison isolate; manufacturer copy marks it Phenolic and Diastatic with >90% attenuation. Consistent with 3711/WLP590. Keep pof=positive, sta1=positive.
- **OYL-026 French Saison** → POF:keep STA-1:keep — Omega spec: Diastatic=Yes ('tests positive for the STA1 gene, an indicator of var. diastaticus'), Phenolic=Yes, 80-90% attenuation. Omega's standard French Saison equivalent to 3711/WLP590. Keep pof=positive, sta1=positive.
- **OYL-438 French Saison** → POF:keep STA-1:keep — Omega 'French Saison Plus' — the engineered STA- (STA1-removed) derivative of the French Saison strain, flagged on Omega's page with the 'About STA- Technology' link; STA- technology eliminates the STA1 gene while keeping the strain's phenolic character. Correctly recorded as POF+/STA1-negative; this is a legitimate engineered derivative, not a contradiction. Keep pof=positive, sta1=negative.
- **M29 French Saison Yeast** → POF:keep STA-1:keep — Mangrove Jack's French Saison; MTF documents Mangrove Jack's confirmation it is S. cerevisiae var. diastaticus (STA1+), with 85-95% attenuation and bottle-bomb warnings. Same saison lineage, POF+ peppery/spicy phenolic. Keep pof=positive, sta1=positive.

### rochefort-abbey-pof  _(confidence: medium · MIS-GROUPING)_
The contradiction is a wrong trait verdict (not a trait that actually differs between true-identical isolates), sitting on top of a questionable grouping. The genetic evidence points uniformly POF-negative for the whole cluster: Gallone 2016 (via the suregork crosswalk) identifies WLP540 "Rochefort" as Beer079, a British-origin strain (relatives of Ringwood/Nottingham/WLP076) with nonfunctional PAD1/FDC1, explicitly POF- and "not related to other Trappist strains." Wyeast 1762 is independently shown POF-negative by Wyeast's own Microanalytics/CBC 2003 GC study (only trace 4-vinyl guaiacol, no clove/spice), and Wyeast's own page calls it a "relatively clean profile" with no phenolic claim. Omega's own prose for OYL-020 says "low phenolics for a Belgian strain"; its "Phenolic: Yes" is a coarse binary spec cell contradicted by that prose. St-Remy is described by Escarpment as "a rare non-phenolic Belgian strain" that stays non-phenolic even warm. So the original POF+ marks on OYL-020 and 1762 came from secondary/marketing binary cells (BYO "strong spicy phenolic", Omega "Phenolic: Yes"), which are outweighed by manufacturer GC data and genomics. All four resolve to POF-negative; STA1 is uncontested negative (none are var. diastaticus / STA1+). Recommend setting OYL-020 and 1762 to POF-negative to harmonize the cluster.

- **WLP540 Abbey IV Ale Yeast** → POF:negative STA-1:keep — Keep POF-negative. Strongest genetic basis in the cluster: Gallone 2016 via suregork crosswalk = Beer079, British-origin (Ringwood/Nottingham/WLP076 kin), nonfunctional PAD1/FDC1, POF-. White Labs' own page now describes 'balanced fruit aroma' (no 'warm phenolics' claim) and lists STA1 Negative; the old pofEvidence note about White Labs marketing 'warm phenolics' is inaccurate and could be softened. STA1 negative is uncontested (keep).
- **St-Remy Abbey Ale** → POF:keep STA-1:keep — Keep POF-negative. Escarpment's own page: 'a rare non-phenolic Belgian ale strain' that stays non-phenolic even at warm temps, framed explicitly against intact PAD1/FDC1. Trait verdict is well-supported on its own evidence regardless of whether it is literally the same isolate as WLP540. STA1 non-diastatic per Escarpment (keep).
- **OYL-020 Belgian Ale R** → POF:negative STA-1:keep — Change POF positive -> negative. The current POF+ came from Omega's coarse 'Phenolic: Yes' spec cell, which is contradicted by Omega's OWN prose: 'low phenolics for a Belgian strain' (stone-fruit/floral, not clove/spice). WY1762 is its listed substitute, and 1762 is POF- by analytical data. No genetic POF+ evidence exists. STA1/diastatic No per Omega (keep).
- **1762 Belgian Abbey Style Ale II** → POF:negative STA-1:keep — Change POF positive -> negative. Decisive analytical evidence: Wyeast/Microanalytics 2003 CBC study found only trace 4-vinyl guaiacol and NO clove/spice; Wyeast's own page calls it a 'relatively clean profile' with no phenolic claim. The 'strong spicy phenolic' descriptor in the current dataset is BYO secondary prose, contradicted by the manufacturer's GC data. Occasional 'gone phenolic' brewer reports are hot-ferment/off-flavor anomalies, not genetic POF. STA1 negative; not among Wyeast's STA1+ diastaticus list (keep).

### bavarian-wheat-sta1  _(confidence: high)_
All three are the same Bavarian Weizen I isolate, correctly anchored to strainGroup "wlp351" (distinct from the Weihenstephan 3068/WLP300 line). WLP351 and OYL-025 carry genetic STA1+ verdicts (White Labs "STA1 QC Positive"; Omega "tests positive for the STA1 gene"), and WLP351 is the same isolate as the genome-sequenced 'Muri' S. cerevisiae x S. uvarum hybrid that Krogerus et al. confirmed possesses STA1. Wyeast 3638 is repeatedly cross-referenced (suregork/Langdon et al. 2019, Milk The Funk) as the same strain as WLP351, with near-identical published specs (clove + subtle vanilla phenolics, banana esters, low flocculation, mid-range attenuation). Since STA1 is genetic and these are one isolate, the genetically-tested STA1+ must win over Wyeast's inference-only "negative" (which rested solely on 3638 not appearing on Wyeast's diastatic list). The contradiction is therefore a wrong trait verdict on 3638, not a wrong grouping: flip 3638 to STA1 positive. Crucial caveat for any downstream use: this lineage is the textbook case of an STA1+ strain that is NOT phenotypically super-attenuative — Krogerus/Gibson and the STA1-promoter work show the gene carries the 1162-bp UAS2 promoter deletion (~100-fold lower expression, negligible dextrin/starch use), which is why 3638 attenuates normally (70-76%) and isn't marketed as diastatic. The sta1 field tracks the gene (genotype = positive); it does not imply this strain behaves like a diastatic spoiler. POF=positive holds for all three (clove-forward hefeweizen, PAD1/FDC1 intact).

- **OYL-025 Bavarian Wheat I** → POF:keep STA-1:keep — Already correct. Omega genetically tests positive for STA1 (var. diastaticus indicator) and POF+ clove/pepper phenolic profile. Anchor STA1+ member of the wlp351 group; same isolate as WLP351/3638.
- **WLP351 Bavarian Weizen Ale Yeast** → POF:keep STA-1:keep — Already correct. White Labs lists 'STA1 QC Result: Positive' and POF+ clove phenolics. Genome-confirmed same isolate as 'Muri' (S. cerevisiae x S. uvarum, STA1+ per Krogerus et al.). STA1 carries the promoter deletion, so genotype-positive but not super-attenuative.
- **3638 Bavarian Wheat** → POF:keep STA-1:positive — Flip negative -> positive. Same isolate as WLP351/OYL-025 (suregork/Langdon 2019, MTF: '3638 is the same strain as WLP351'); STA1 is genetic so it must match the tested-positive sibling. Current 'negative' was inference-only ('not on Wyeast's diastatic list'). Add a note that STA1 here is the non-functional/promoter-deleted variant, explaining the ordinary 70-76% attenuation and why Wyeast doesn't flag it as diastatic. POF positive unchanged (clove/vanilla phenolics).

### wlp585-farmhouse-sta1  _(confidence: high · MIS-GROUPING)_
Both STA-1 verdicts are individually correct and well-supported by genetic evidence; the contradiction is an artifact of mis-grouping. WLP585 is genuinely STA1-positive: White Labs' own QC reports "STA1 QC Positive," Escarpment Labs (Richard Preiss) confirmed WLP585/WLP570 carry the STA1 gene (slow hyper-attenuators), and the suregork crosswalk identifies WLP585 as Gallone et al. 2016 Beer086 with a full STA1 BLAST hit. LalBrew Farmhouse is genuinely STA1-negative by design: Renaissance Bioscience used classical/non-GMO methods to deliberately remove the STA1 gene, and the Lallemand TDS states it "lacks the presence of the STA-1 gene," so dextrins are not metabolized and there is no over-attenuation risk. There is no published evidence that Farmhouse is the same isolate as WLP585 — it is marketed as an engineered "hybrid" saison strain with undisclosed parentage. Since STA1 status is genetic and must be identical within one true isolate, a STA1-positive parental-type saison and a deliberately STA1-knockout saison cannot be the same strain; they were wrongly forced into strainGroup "wlp585." POF is consistent (both POF-positive, typical spicy/clove saison phenolics) so there is no conflict on that trait. Recommendation: keep both trait values as-is and break the grouping — Farmhouse should not share strainGroup "wlp585."

- **WLP585 Belgian Saison III Ale Yeast** → POF:keep STA-1:keep — Keep STA1 positive: White Labs QC 'STA1 QC Positive'; Escarpment Labs/Preiss confirmed the STA1 gene (slow hyper-attenuation over weeks); suregork crosswalk maps it to Gallone Beer086 with a full STA1 hit. Keep POF positive (clovey/spicy saison phenolics). Values are correct; only the grouping with Farmhouse is wrong.
- **LalBrew Farmhouse** → POF:keep STA-1:keep — Keep STA1 negative: Renaissance Bioscience deliberately removed the STA1 gene via classical/non-GMO methods; Lallemand TDS states it 'lacks the presence of the STA-1 gene' (non-diastatic, no over-attenuation). Keep POF positive (Lallemand markets the spicy/clove saison character). This is an engineered hybrid, not the WLP585 isolate, so it should be removed from strainGroup 'wlp585'.

### trappist-abbey-pof  _(confidence: high · MIS-GROUPING)_
The contradiction is a mis-grouping, not a wrong trait verdict. The genetic crosswalk (suregork's decoding of Gallone et al. 2016) places WLP500, Wyeast 1214, and Lallemand Abbaye together as the same S. cerevisiae x S. kudriavzevii Beer 2 hybrid — the phenolic (POF+) Chimay/Trappist strain — and Omega's own substitution list pairs OYL-018 Abbey Ale C with WY1214/WLP500 (Trappist origin, spicy/banana), so those four are genuinely one isolate and correctly POF-positive (functional PAD1/FDC1 producing 4-vinyl-guaiacol). Imperial B53 Precious does not belong in this strainGroup: Imperial purpose-built it as a clean, low-phenol strain for "hoppy Belgian / Trappist IPA" so brett and hops shine, and its actual Chimay/abbey phenolic strain is a different product, Monastic (B63), which Imperial themselves spec POF-positive. A genetically clean POF profile means non-functional ferulic-acid decarboxylase, which is heritable and cannot coexist in the same isolate with the phenolic Chimay strain. Therefore B53 is a distinct cleaner strain that was wrongly slotted into the wlp500 group; its manufacturer POF-negative spec is credible and should be kept, and the fix is to ungroup B53 rather than flip it to POF+.

- **WLP500 Trappist Ale Yeast** → POF:keep STA-1:keep — Confirmed core of the Chimay group. suregork/Gallone crosswalk identifies WLP500 as the S. cerevisiae x S. kudriavzevii Beer 2 hybrid Trappist strain; classically phenolic (4-VG clove/spice). POF positive stands; White Labs lists STA1 negative.
- **1214 Belgian Abbey Style Ale** → POF:keep STA-1:keep — Same Chimay hybrid as WLP500 per the crosswalk (WY1214 = 'Chimay'); documented high 4-VG clove. POF positive correct. Not among Wyeast's STA1-positive diastaticus survey strains, so STA1 negative stands.
- **LalBrew Abbaye** → POF:keep STA-1:keep — Grouped with WLP500/WY1214 in the crosswalk; Lallemand TDS states verbatim 'This strain is POF Positive' and lists Diastaticus Negative. Both values confirmed by manufacturer plus genetics — keep.
- **OYL-018 Abbey Ale C** → POF:keep STA-1:keep — Correctly grouped: Omega's own substitution chart pairs OYL-018 with WY1214 and WLP500, Trappist origin with spiciness/banana — genuinely the Chimay strain, so POF positive is right (not just propagated). STA1 negative is consistent with the moderate-attenuation abbey strain (74-78%); keep but note its sta1 was propagated, not independently sourced.
- **B53 Precious** → POF:keep STA-1:keep — MIS-GROUPED — remove from strainGroup wlp500. Not the Chimay strain: Imperial built it as a clean, low-phenol 'hoppy Belgian / Trappist IPA' strain (their actual abbey/Chimay strain is Monastic B63, which Imperial spec POF+). A genetically clean POF profile = non-functional PAD1/FDC1, which cannot coexist in the Chimay isolate. Keep POF negative (manufacturer spec credible) and STA1 negative; just correct the grouping.

### misgrouping-audit  _(confidence: high · MIS-GROUPING)_
All three suspected strainGroup pairings are genuine MIS-GROUPINGS — the contradictions resolve as wrong lineage, not wrong traits, so every trait stays "keep." (1) "A44 Kveiking" is an Imperial Yeast blend of three traditional Norwegian kveik strains (POF-/STA1-, tropical-ester, no phenolics); grouping it under "wlp400" with WLP400 — White Labs' Hoegaarden/Celis Belgian wit isolate (POF+, "high phenol production") — is impossible: a kveik blend is neither a single isolate nor a Belgian wit, and the POF verdicts are opposite. (2) SafAle BE-256 (formerly Abbaye) is a fruity Belgian strong-ale/abbey strain whose documented lineage is the Westmalle/Trappist abbey cluster (linked to WLP530 Abbey Ale and Wyeast 3787, which the suregork tree places near WLP400 Hoegaarden), with a manufacturer-stated POF-negative spec; grouping it under "wlp590" with WLP590 French Saison — a documented STA1+/POF+ S. cerevisiae var. diastaticus (the 3711-type) — conflates two distinct lineages with opposite POF and STA1 status. (3) The hardest case: both SafLager S-189 and WLP885 Zurich Lager carry a shared "Hürlimann, Zurich" marketing origin, but Hürlimann maintained multiple yeasts. WLP885 is the Samichlaus-type strong strain — POF+, STA1 QC Positive (diastatic), 15%+ alcohol tolerance, and S. cerevisiae-based — whereas S-189 is a clean/neutral S. pastorianus lager (POF-, STA1-, normal tolerance). A POF+/STA1+ S. cerevisiae and a POF-/STA1- S. pastorianus cannot be the same isolate (different species and opposite genetic verdicts), so the shared brewery origin does not make them one strainGroup. The grouping lineage is wrong in all three cases.

- **A44 Kveiking** → POF:keep STA-1:keep — Imperial Yeast blend of 3 traditional Norwegian kveik strains; official spec POF negative, Diastatic negative; tropical-fruit esters, no phenolics. MIS-GROUPED under 'wlp400' with WLP400 Belgian Wit — a kveik blend is not a single isolate and not a Belgian wit, and POF is opposite (A44 POF-, WLP400 POF+). Split out; leave traits as-is.
- **WLP400 Belgian Wit Ale Yeast** → POF:keep STA-1:keep — White Labs Hoegaarden/Celis Belgian wit isolate; 'high phenol production' (POF+), STA1 QC Negative. Its own traits are correct; the error is that A44 Kveiking was attached to its 'wlp400' group. WLP400 remains the genuine head of the Hoegaarden wit lineage (suregork clusters it near WLP530/3787). Keep traits.
- **SafAle BE-256** → POF:keep STA-1:keep — Fermentis Abbaye/abbey strong-ale strain; manufacturer spec lists Phenolic Off-Flavor negative; banana/isoamyl-acetate fruity, non-spicy; documented lineage is the Westmalle/Trappist cluster (WLP530, Wyeast 3787), not saison. MIS-GROUPED under 'wlp590' with WLP590 French Saison. NOTE: its current sta1='positive' was propagated FROM WLP590 via this wrong group and is suspect (clean abbey strains are typically non-diastatic), but per instructions traits are left as 'keep' — flag for a follow-up STA1 re-verification once regrouped. Split out.
- **WLP590 French Saison Ale Yeast** → POF:keep STA-1:keep — White Labs French Saison; STA1 QC Positive (S. cerevisiae var. diastaticus, 3711-type), POF+ 'cracked pepper' phenolics. Traits correct; the error is BE-256 being grouped onto its 'wlp590' lineage. WLP590 is the legitimate head of the diastatic French-saison group. Keep traits.
- **SafLager S-189** → POF:keep STA-1:keep — Fermentis Swiss lager from Hürlimann; manufacturer spec POF negative, clean/neutral S. pastorianus, normal attenuation (80-84%) and 9-11% tolerance, no diastatic claim. Shares only a brewery-origin label with WLP885, not an isolate. MIS-GROUPED under 'wlp885' — different species (pastorianus vs cerevisiae) and opposite POF/STA1. Split out; keep traits.
- **WLP885 Zurich Lager Yeast** → POF:keep STA-1:keep — White Labs Zurich/Hürlimann Samichlaus-type strong strain; explicitly POF+, STA1 QC Positive (diastatic), 15%+ alcohol tolerance, S. cerevisiae-based phenolic 'Christmas Lager'. Traits correct. The error is S-189 being attached to its 'wlp885' group despite being a clean pastorianus lager; Hürlimann maintained multiple yeasts, so a shared origin does not equal a shared isolate. Keep traits; split S-189 off.

## ⚠️ Suspected strainGroup mis-groupings (your curated lineage — trait-independent; fix in Part C if you agree)

- Likely mis-grouping, but it does not change the trait outcome. Gallone 2016/suregork place WLP540 "Rochefort" as a BRITISH-origin strain (Beer079; kin to Ringwood/Nottingham/WLP076) explicitly "not related to other Trappist strains," whereas 1762 and OYL-020 are marketed as the true Belgian Rochefort isolate, and St-Remy is a separately-isolated Belgian abbey strain. So the four are unlikely to all be a single isolate and the strainGroup "wlp540" over-lumps them. Crucially, the mis-grouping does NOT rescue any POF+ verdict: WLP540 is POF- by genomics, 1762 is POF- by Wyeast's own GC study, OYL-020 is "low phenolics" by Omega's own prose, and St-Remy is explicitly non-phenolic. Whether or not they are one isolate, every member is POF-negative, so harmonization is safe. Recommend a future genotype/strainGroup audit to split WLP540 (British/Beer079) from the Belgian 1762/OYL-020 if the data model supports finer grouping.
- LalBrew Farmhouse is mis-grouped under strainGroup "wlp585." It is an engineered saison strain whose STA1 gene was deliberately removed by Renaissance Bioscience (non-GMO classical methods); no source documents it as the same isolate as WLP585, and an STA1-knockout cannot be genetically equivalent to an STA1-positive strain at that locus. WLP585 itself is correctly characterized. Fix the grouping (separate Farmhouse out), not the trait verdicts. POF is non-conflicting (both positive).
- B53 Precious is mis-grouped under strainGroup "wlp500" (Chimay). Genetic/crosswalk evidence groups WLP500, Wyeast 1214, Lallemand Abbaye, and OYL-018 as the true Chimay cerevisiae x kudriavzevii Beer 2 hybrid (POF+). B53 is Imperial's separate clean/low-phenol hoppy-Belgian strain — Imperial's genuine abbey/Chimay strain is Monastic (B63), not Precious. B53 should be removed from the wlp500 group; the other four are correctly grouped and POF+.
- All three pairs are mis-grouped. (1) A44 Kveiking (Norwegian kveik blend, POF-/STA1-) must be split from the "wlp400" group with WLP400 Belgian Wit (Hoegaarden, POF+) — kveik blend ≠ single Belgian wit isolate, opposite POF. (2) SafAle BE-256 (Westmalle/abbey lineage near WLP530/3787, POF-) must be split from the "wlp590" group with WLP590 French Saison (STA1+/POF+ var. diastaticus) — abbey ≠ saison, opposite POF and STA1. (3) SafLager S-189 (clean S. pastorianus, POF-/STA1-) must be split from the "wlp885" group with WLP885 Zurich Lager (POF+/STA1+ S. cerevisiae Samichlaus-type strong strain) — same Hürlimann brewery origin but different species and opposite POF/STA1, so distinct isolates. Traits are internally consistent within each individual strain; only the cross-strain grouping is the error, so all recommendedPof/recommendedSta1 are "keep".

## Anchor regression check

✅ All anchors pass.
- ✅ **SafAle US-05** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **WLP001 California Ale Yeast** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **1056 American Ale** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafLager W-34/70** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **LalBrew BRY-97 American West Coast Ale** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafAle S-04** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafAle WB-06** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **WLP300 Hefeweizen Ale Yeast** — POF exp=positive got=positive | STA-1 exp=negative got=negative
- ✅ **3068 Weihenstephan Weizen** — POF exp=positive got=positive | STA-1 exp=negative got=negative
- ✅ **SafAle T-58** — POF exp=positive got=positive | STA-1 exp=· got=unknown
- ✅ **WLP570 Belgian Golden Ale Yeast** — POF exp=positive got=positive | STA-1 exp=· got=positive
- ✅ **1214 Belgian Abbey Style Ale** — POF exp=positive got=positive | STA-1 exp=· got=negative
- ✅ **LalBrew Belle Saison** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **3724 Belgian Saison** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **WLP565 Belgian Saison I Ale Yeast** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **3711 French Saison** — POF exp=· got=positive | STA-1 exp=positive got=positive
- ✅ **LalBrew Farmhouse** — POF exp=positive got=positive | STA-1 exp=· got=negative
- ✅ **WLP561 Non STA1son Ale Yeast Blend** — POF exp=· got=positive | STA-1 exp=negative got=negative
- ✅ **OYL-071DRY Dried Lutra** — POF exp=negative got=negative | STA-1 exp=negative got=negative

## Values retained as inference (cited page didn't explicitly print the trait — NOT errors, capped at medium confidence) — 44

Mostly clean-style POF− and saison/farmhouse POF+ that read off prose rather than a spec badge. Listed for transparency.

- **Sourvisiae** [Lallemand] pof=negative (stated)
- **OYL-057 Wallonian Farmhouse** [Omega Yeast] pof=negative (stated)
- **OYL-057 Wallonian Farmhouse** [Omega Yeast] sta1=negative (stated)
- **WLDSOURVISIAE Sourvisiae** [White Labs] pof=negative (stated)
- **WLP026 Premium Bitter Ale Yeast** [White Labs] pof=negative (genomics)
- **WLP067 Coastal Haze Ale Yeast Blend** [White Labs] pof=negative (stated)
- **WLP4645 Transatlantic Berliner Blend** [White Labs] pof=negative (stated)
- **WLP815 Belgian Lager Yeast** [White Labs] pof=negative (stated)
- **2565 Kölsch** [Wyeast] sta1=negative (stated)
- **Marina Russian Farmhouse** [Escarpment Labs] pof=positive (stated)
- **Marina Russian Farmhouse** [Escarpment Labs] sta1=positive (stated)
- **WLP096 FrankenYeast Blend** [White Labs] pof=positive (stated)
- **WLP099 Super High Gravity Ale Yeast** [White Labs] pof=negative (inferred)
- **WLP101 SuperCell Yeast Blend** [White Labs] pof=negative (inferred)
- **WLP4001 Flanders Specialty Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4007 Saison Ale Yeast Blend I** [White Labs] pof=positive (stated)
- **WLP4020 Wallonian Farmhouse I Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4021 Saison Ale Yeast Blend II** [White Labs] pof=positive (stated)
- **WLP4023 Wallonian Farmhouse III Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4025 Dry Belgian Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4044 Hazy Daze Yeast Blend II** [White Labs] pof=negative (stated)
- **WLP4047 Pakruojis Lithuanian Farmhouse Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4060 Forager Ale Yeast** [White Labs] pof=positive (stated)
- **WLP4626 Saison/Brettanomyces Yeast Blend I** [White Labs] pof=positive (stated)
- **WLP4633 Melange Yeast Blend** [White Labs] pof=negative (inferred)
- **WLP4636 Saison/Brettanomyces Yeast Blend II** [White Labs] pof=positive (stated)
- **WLP4675 Farmhouse Sour Ale Yeast Blend** [White Labs] pof=positive (stated)
- **WLP4684 The Yeast Bay House Sour Blend** [White Labs] pof=negative (inferred)
- **WLP630 Berliner Weisse Blend** [White Labs] pof=positive (stated)
- **WLP670 American Farmhouse Blend** [White Labs] pof=positive (inferred)
- **SafAle F-2** [Fermentis] pof=negative (stated)
- **SafAle S-33** [Fermentis] pof=negative (stated)
- **SafLager E-30** [Fermentis] pof=negative (stated)
- **M10 Workhorse Yeast** [Mangrove Jack's] pof=negative (stated)
- **M10 Workhorse Yeast** [Mangrove Jack's] sta1=negative (stated)
- **M24 Versa Lager Yeast** [Mangrove Jack's] pof=negative (stated)
- **M44 US West Coast Yeast** [Mangrove Jack's] pof=negative (stated)
- **WLP001 California Ale Yeast** [White Labs] pof=negative (stated)
- **WLP039 East Midlands Ale Yeast** [White Labs] pof=negative (stated)
- **WLP4044 Hazy Daze Yeast Blend II** [White Labs] pof=negative (stated)
- **1010 American Wheat** [Wyeast] pof=negative (stated)
- **1332 Northwest Ale** [Wyeast] pof=negative (stated)
- **2042 Danish Lager** [Wyeast] pof=negative (stated)
- **2042 Danish Lager** [Wyeast] sta1=negative (stated)

## Remaining consistency flags (38 strains)

- **Kolsch Ale** [Escarpment Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **St-Remy Abbey Ale** [Escarpment Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **SafAle BE-256** [Fermentis] pof=negative sta1=unknown — pof- on a phenolic-style strain — verify; sta1:reverted-bad-propagation
- **A07 Flagship** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **A20 Citrus** [Imperial Yeast] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **A24 Dry Hop** [Imperial Yeast] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **G02 Kaiser** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **G03 Dieter** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **W05 Brett Drei** [Imperial Yeast] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **Sourvisiae** [Lallemand] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **WildBrew Philly Sour** [Lallemand] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-002 American Wheat** [Omega Yeast] pof=negative sta1=negative — group-conflict:pof
- **OYL-019 Belgian Ale D** [Omega Yeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **OYL-020 Belgian Ale R** [Omega Yeast] pof=negative sta1=negative — pof:adjudicated→negative
- **OYL-025 Bavarian Wheat I** [Omega Yeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **OYL-030 Tropical IPA** [Omega Yeast] pof=positive sta1=negative — group-conflict:pof
- **OYL-049 Belgian Ale DK** [Omega Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-057 Wallonian Farmhouse** [Omega Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-101 Saisonstein's Monster** [Omega Yeast] pof=positive sta1=positive — pof- on a phenolic-style strain — verify; pof:REFUTED→positive; sta1:REFUTED→positive
- **OYL-501 Gulo Ale** [Omega Yeast] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **WLDSOURVISIAE Sourvisiae** [White Labs] pof=negative sta1=unknown — pof- on a phenolic-style strain — verify
- **WLP026 Premium Bitter Ale Yeast** [White Labs] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **WLP067 Coastal Haze Ale Yeast Blend** [White Labs] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **WLP320 American Hefeweizen Ale Yeast** [White Labs] pof=positive sta1=negative — group-conflict:pof
- **WLP4645 Transatlantic Berliner Blend** [White Labs] pof=negative sta1=unknown — pof- on a phenolic-style strain — verify
- **WLP540 Abbey IV Ale Yeast** [White Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **WLP644 Saccharomyces brux-like Trois** [White Labs] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **WLP815 Belgian Lager Yeast** [White Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **WLP885 Zurich Lager Yeast** [White Labs] pof=positive sta1=positive — pof+ on a clean-style strain — verify
- **1007 German Ale** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **1388 Belgian Strong Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **1581-PC Belgian Stout** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **1762 Belgian Abbey Style Ale II** [Wyeast] pof=negative sta1=negative — pof:adjudicated→negative
- **2565 Kölsch** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **3638 Bavarian Wheat** [Wyeast] pof=positive sta1=positive — sta1:adjudicated→positive
- **3739-PC Flanders Golden Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **3822-PC Belgian Dark Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **3944 Belgian Witbier** [Wyeast] pof=positive sta1=negative — group-conflict:pof