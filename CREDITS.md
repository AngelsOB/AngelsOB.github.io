# Credits & Attribution

Brewing.It is built on work by a lot of other people. Thanks to all of them.

## Ingredient data

### Hops

Hop facts — alpha and beta acids, total oil, cohumulone, and country of origin —
come from the **HopDatabase** project by Kasper Andreas Rømer Grøntved, which
aggregates specifications published by hop growers including Yakima Chief Hops,
BarthHaas, Crosby Hops, and Hopsteiner. Used under the MIT License.

- Source: https://github.com/kasperg3/HopDatabase

Hop flavor/aroma profiles (the 0–5 radar across nine categories) are our own. A
core set was hand-rated; for the rest we derived a profile by starting from the
growers' published aroma data and adjusting it toward their written descriptors.
These are estimates, not lab measurements — hop flavor is subjective and even the
major references disagree with each other.

```
MIT License

Copyright (c) 2024 Kasper Andreas Rømer Grøntved

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Grains

Grain specifications are compiled from maltster published data.

### Yeast

Yeast facts — attenuation, temperature range, flocculation, type, form, and
alcohol tolerance — are compiled from the producers' own published data:
Escarpment Labs, White Labs, Wyeast, Fermentis/Lallemand, Imperial Yeast, Omega
Yeast, and Mangrove Jack's. We reproduce only the factual specs, not the
producers' written descriptions.

### Yeast strain matching

The "same strain, other labs" groupings and substitute suggestions are built
from the homebrew community's strain-equivalence work — dmtaylor's Yeast Master
chart, the suregork (Kristoffer Krogerus) genome analysis, and the Mr. Malty
strain chart — informed by published brewing-yeast genomics (Gallone et al.,
2016). We compiled these into our own dataset. Honest caveat: which commercial
products are genetically "the same strain" is partly inference, not lab-verified
identity, so treat substitutes as well-informed suggestions, not certainties.

## Built with

Brewing.It runs on Next.js, React, and Firebase, plus many other open-source
libraries. Thanks to everyone who maintains them.
