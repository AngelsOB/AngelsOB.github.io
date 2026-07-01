# POF / STA-1 yeast trait data — Phase 1 collection report

Generated from 524 research verdicts over 524 strains.

## Coverage

| Trait | positive | negative | unknown | known % | indexable known % |
|---|---|---|---|---|---|
| POF | 152 | 324 | 48 | 91% | 92% |
| STA-1 | 85 | 377 | 62 | 88% | 90% |

POF confidence: high:297  medium:152  low:27
STA-1 confidence: high:384  medium:66  low:12

## Anchor regression check

✅ All anchors pass.
- ✅ **SafAle US-05** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **WLP001 California Ale Yeast** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **1056 American Ale** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafLager W-34/70** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafLager S-23** — POF exp=negative got=negative | STA-1 exp=· got=negative
- ✅ **LalBrew BRY-97 American West Coast Ale** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafAle S-04** — POF exp=negative got=negative | STA-1 exp=negative got=negative
- ✅ **SafAle WB-06** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **WLP300 Hefeweizen Ale Yeast** — POF exp=positive got=positive | STA-1 exp=negative got=negative
- ✅ **3068 Weihenstephan Weizen** — POF exp=positive got=positive | STA-1 exp=negative got=negative
- ✅ **WLP351 Bavarian Weizen Ale Yeast** — POF exp=positive got=positive | STA-1 exp=· got=positive
- ✅ **SafAle T-58** — POF exp=positive got=positive | STA-1 exp=· got=unknown
- ✅ **WLP570 Belgian Golden Ale Yeast** — POF exp=positive got=positive | STA-1 exp=· got=positive
- ✅ **1214 Belgian Abbey Style Ale** — POF exp=positive got=positive | STA-1 exp=· got=negative
- ✅ **LalBrew Belle Saison** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **3724 Belgian Saison** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **WLP565 Belgian Saison I Ale Yeast** — POF exp=positive got=positive | STA-1 exp=positive got=positive
- ✅ **3711 French Saison** — POF exp=· got=positive | STA-1 exp=positive got=positive
- ✅ **WLP653 Brettanomyces lambicus** — POF exp=positive got=positive | STA-1 exp=· got=unknown
- ✅ **LalBrew Farmhouse** — POF exp=positive got=positive | STA-1 exp=negative got=negative
- ✅ **WLP561 Non STA1son Ale Yeast Blend** — POF exp=· got=positive | STA-1 exp=negative got=negative
- ✅ **OYL-071DRY Dried Lutra** — POF exp=negative got=negative | STA-1 exp=negative got=negative

## Intra-group conflicts (same strain, contradictory trait — needs a human call)


- **wlp540** / pof: St-Remy Abbey Ale=negative (high) · OYL-020 Belgian Ale R=positive (high) · WLP540 Abbey IV Ale Yeast=negative (medium) · 1762 Belgian Abbey Style Ale II=positive (medium)
- **wlp590** / pof: SafAle BE-256=negative (high) · WLP590 French Saison Ale Yeast=positive (high)
- **wlp885** / pof: SafLager S-189=negative (high) · WLP885 Zurich Lager Yeast=positive (high)
- **wlp885** / sta1: SafLager S-189=negative (medium) · WLP885 Zurich Lager Yeast=positive (high)
- **wlp400** / pof: A44 Kveiking=negative (high) · OYL-030 Tropical IPA=positive (high) · WLP400 Belgian Wit Ale Yeast=positive (high) · 3944 Belgian Witbier=positive (high)
- **wlp500** / pof: B53 Precious=negative (high) · LalBrew Abbaye=positive (high) · OYL-018 Abbey Ale C=positive (medium) · WLP500 Trappist Ale Yeast=positive (medium) · 1214 Belgian Abbey Style Ale=positive (high)
- **wlp585** / sta1: LalBrew Farmhouse=negative (high) · WLP585 Belgian Saison III Ale Yeast=positive (high)
- **wlp320** / pof: OYL-002 American Wheat=negative (high) · WLP320 American Hefeweizen Ale Yeast=positive (medium)
- **wlp351** / sta1: OYL-025 Bavarian Wheat I=positive (high) · WLP351 Bavarian Weizen Ale Yeast=positive (high) · 3638 Bavarian Wheat=negative (medium)

## Consistency flags (50 strains)

- **Kolsch Ale** [Escarpment Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **St-Remy Abbey Ale** [Escarpment Labs] pof=negative sta1=negative — group-conflict:pof; pof- on a phenolic-style strain — verify
- **SafAle BE-256** [Fermentis] pof=negative sta1=positive — group-conflict:pof; pof- on a phenolic-style strain — verify
- **SafLager S-189** [Fermentis] pof=negative sta1=negative — group-conflict:pof; group-conflict:sta1
- **A07 Flagship** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **A20 Citrus** [Imperial Yeast] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **A24 Dry Hop** [Imperial Yeast] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **A44 Kveiking** [Imperial Yeast] pof=negative sta1=negative — group-conflict:pof
- **B53 Precious** [Imperial Yeast] pof=negative sta1=negative — group-conflict:pof
- **G02 Kaiser** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **G03 Dieter** [Imperial Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **W05 Brett Drei** [Imperial Yeast] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **LalBrew Abbaye** [Lallemand] pof=positive sta1=negative — group-conflict:pof
- **LalBrew Farmhouse** [Lallemand] pof=positive sta1=negative — group-conflict:sta1
- **Sourvisiae** [Lallemand] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **WildBrew Philly Sour** [Lallemand] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-002 American Wheat** [Omega Yeast] pof=negative sta1=negative — group-conflict:pof
- **OYL-018 Abbey Ale C** [Omega Yeast] pof=positive sta1=negative — group-conflict:pof
- **OYL-019 Belgian Ale D** [Omega Yeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **OYL-020 Belgian Ale R** [Omega Yeast] pof=positive sta1=negative — group-conflict:pof
- **OYL-025 Bavarian Wheat I** [Omega Yeast] pof=positive sta1=positive — group-conflict:sta1; sta1+ but low attenuation — verify
- **OYL-030 Tropical IPA** [Omega Yeast] pof=positive sta1=negative — group-conflict:pof
- **OYL-049 Belgian Ale DK** [Omega Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-057 Wallonian Farmhouse** [Omega Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-101 Saisonstein's Monster** [Omega Yeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **OYL-501 Gulo Ale** [Omega Yeast] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **WLDSOURVISIAE Sourvisiae** [White Labs] pof=negative sta1=unknown — pof- on a phenolic-style strain — verify
- **WLP026 Premium Bitter Ale Yeast** [White Labs] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **WLP067 Coastal Haze Ale Yeast Blend** [White Labs] pof=negative sta1=positive — sta1+ but low attenuation — verify
- **WLP320 American Hefeweizen Ale Yeast** [White Labs] pof=positive sta1=negative — group-conflict:pof
- **WLP351 Bavarian Weizen Ale Yeast** [White Labs] pof=positive sta1=positive — group-conflict:sta1
- **WLP400 Belgian Wit Ale Yeast** [White Labs] pof=positive sta1=negative — group-conflict:pof
- **WLP4645 Transatlantic Berliner Blend** [White Labs] pof=negative sta1=unknown — pof- on a phenolic-style strain — verify
- **WLP500 Trappist Ale Yeast** [White Labs] pof=positive sta1=negative — group-conflict:pof
- **WLP540 Abbey IV Ale Yeast** [White Labs] pof=negative sta1=negative — group-conflict:pof; pof- on a phenolic-style strain — verify
- **WLP585 Belgian Saison III Ale Yeast** [White Labs] pof=positive sta1=positive — group-conflict:sta1
- **WLP590 French Saison Ale Yeast** [White Labs] pof=positive sta1=positive — group-conflict:pof
- **WLP644 Saccharomyces brux-like Trois** [White Labs] pof=negative sta1=positive — pof- on a phenolic-style strain — verify
- **WLP815 Belgian Lager Yeast** [White Labs] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **WLP885 Zurich Lager Yeast** [White Labs] pof=positive sta1=positive — group-conflict:pof; group-conflict:sta1; pof+ on a clean-style strain — verify
- **1007 German Ale** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **1214 Belgian Abbey Style Ale** [Wyeast] pof=positive sta1=negative — group-conflict:pof
- **1388 Belgian Strong Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **1581-PC Belgian Stout** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **1762 Belgian Abbey Style Ale II** [Wyeast] pof=positive sta1=negative — group-conflict:pof
- **2565 Kölsch** [Wyeast] pof=negative sta1=negative — pof- on a phenolic-style strain — verify
- **3638 Bavarian Wheat** [Wyeast] pof=positive sta1=negative — group-conflict:sta1
- **3739-PC Flanders Golden Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **3822-PC Belgian Dark Ale** [Wyeast] pof=positive sta1=positive — sta1+ but low attenuation — verify
- **3944 Belgian Witbier** [Wyeast] pof=positive sta1=negative — group-conflict:pof

## STA-1 candidates to confirm (36) — undocumented but style/attenuation suggests possible diastaticus

- **H. uvarum (LSB8001)** [Escarpment Labs] type=wild attMax=0.1 styles=·
- **Optimus Primary** [Escarpment Labs] type=ale attMax=0.87 styles=·
- **SafAle F-2** [Fermentis] type=ale attMax=0.9 styles=Cask
- **SafBrew DA-16** [Fermentis] type=ale attMax=1 styles=Brut IPA & IPA
- **SafBrew HA-18** [Fermentis] type=ale attMax=1 styles=Strong Ales & Barleywine
- **M31 Belgian Tripel Yeast** [Mangrove Jack's] type=ale attMax=0.92 styles=·
- **OYL-201 Brett. Claussenii** [Omega Yeast] type=brett attMax=0.85 styles=Farmhouse
- **OYL-202 Brett. Bruxellensis** [Omega Yeast] type=brett attMax=0.85 styles=Farmhouse/Lambic & Flanders Red Ale
- **OYL-203 Hefe Weizen** [Omega Yeast] type=brett attMax=0.85 styles=Farmhouse/Lambic & Flanders Red Ales
- **OYL-216 Northwest Farmhouse Brett** [Omega Yeast] type=blend attMax=0.85 styles=Farmhouse
- **OYL-218 All the Bretts** [Omega Yeast] type=brett attMax=· styles=Farmhouse
- **WLDSOURVISIAE Sourvisiae** [White Labs] type=wild attMax=0.82 styles=·
- **WLP4605 Beersel Brettanomyces** [White Labs] type=brett attMax=0.85 styles=·
- **WLP4615 Brussels Brettanomyces** [White Labs] type=brett attMax=0.9 styles=·
- **WLP4620 Lochristi Brettanomyces** [White Labs] type=brett attMax=0.88 styles=·
- **WLP4637 Amalgamation I Brettanomyces Blend** [White Labs] type=brett attMax=0.95 styles=·
- **WLP4638 Brettanomyces bruxellensis strain TYB184** [White Labs] type=brett attMax=0.88 styles=·
- **WLP4639 Brettanomyces bruxellensis strain TYB207** [White Labs] type=brett attMax=0.82 styles=·
- **WLP4640 Brettanomyces bruxellensis strain TYB261** [White Labs] type=brett attMax=0.82 styles=·
- **WLP4641 Amalgamation II Brettanomyces Blend** [White Labs] type=brett attMax=0.86 styles=·
- **WLP4642 Oud Vat Brett** [White Labs] type=brett attMax=0.9 styles=·
- **WLP4643 Amalgamation V Brettanomyces Blend** [White Labs] type=brett attMax=0.9 styles=·
- **WLP4645 Transatlantic Berliner Blend** [White Labs] type=blend attMax=1 styles=·
- **WLP4650 Metschnikowia reukaufii** [White Labs] type=wild attMax=0.25 styles=·
- **WLP4653 Dark Belgian Cask Yeast Blend** [White Labs] type=blend attMax=0.85 styles=·
- **WLP4655 Brettanomyces bruxellensis strain TYB307** [White Labs] type=brett attMax=0.84 styles=·
- **WLP4656 Brettanomyces bruxellensis strain TYB415** [White Labs] type=brett attMax=0.86 styles=·
- **WLP4665 Berkeley Hills Sour Yeast** [White Labs] type=wild attMax=0.75 styles=·
- **WLP648 Brettanomyces bruxellensis Trois Vrai** [White Labs] type=brett attMax=· styles=·
- **WLP650 Brettanomyces bruxellensis** [White Labs] type=brett attMax=0.85 styles=·
- **WLP653 Brettanomyces lambicus** [White Labs] type=brett attMax=0.85 styles=Lambic/Flanders Red Ale & Sours
- **WLP665 Flemish Ale Blend** [White Labs] type=blend attMax=0.85 styles=·
- **3209-PC Oud Bruin Ale Blend** [Wyeast] type=blend attMax=0.8 styles=Sour Ale/Belgian/Foreign Extra Stout/Fruit Beer/Fruit and Spice Beer/Oud Bruin/Saison/Specialty Ales/Specialty Fruit Beer/Wild Specialty Beer
- **5112 Brettanomyces bruxellensis** [Wyeast] type=brett attMax=0.85 styles=Flanders Red Ale/Gueuze & Lambic
- **5151-PC Brettanomyces claussenii** [Wyeast] type=brett attMax=0.8 styles=·
- **5526 Brettanomyces lambicus** [Wyeast] type=brett attMax=0.85 styles=Lambic/Berliner Weisse/Flanders Red Ale & Gueuze

## Data hygiene

- Verdicts unmatched to any manifest strain: 0
- Manifest strains with NO verdict returned: 0
- Duplicate verdict names: 0
- Residual POF-unknown (→ inference pass): 48