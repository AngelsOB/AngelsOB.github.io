#!/usr/bin/env node
// User correction: WLP320 American Hefeweizen = OYL-002 American Wheat (same
// Widmer American wheat/hefe strain). Group them, reconcile POF to + (weak clove,
// per user). Wyeast 1010 is the "~" near-match → mutual substitute, kept separate
// (it stays POF- as its own strain). BE-256 / S-189 / Farmhouse stay ungrouped
// (strict model: their verified POF/STA-1 differ from the strains they'd pair with).

import { readFileSync, writeFileSync } from "node:fs";

const J = "src/utils/presets.generated.yeasts.json";
const live = JSON.parse(readFileSync(J, "utf8"));
const byName = new Map(live.map((y) => [y.name, y]));

const GROUP = "American Hefeweizen (Widmer)";
const ALIASES = ["American Hefeweizen", "American Wheat", "Widmer", "WLP320", "OYL-002", "1010"];
const MEMBERS = ["WLP320 American Hefeweizen Ale Yeast", "OYL-002 American Wheat"];
const NEAR = "1010 American Wheat";

// insert strainGroup + strainGroupAliases just before the `source` block (canonical spot)
function withGroup(entry) {
  const next = {};
  for (const [k, v] of Object.entries(entry)) {
    if (k === "strainGroup" || k === "strainGroupAliases") continue; // reposition cleanly
    if (k === "source") {
      next.strainGroup = GROUP;
      next.strainGroupAliases = ALIASES;
    }
    next[k] = v;
  }
  if (!("strainGroup" in next)) { next.strainGroup = GROUP; next.strainGroupAliases = ALIASES; }
  return next;
}
const addSub = (y, name) => {
  const arr = y.substitutes ? [...y.substitutes] : [];
  if (!arr.includes(name) && name !== y.name) arr.unshift(name);
  y.substitutes = arr;
};

for (let i = 0; i < live.length; i++) {
  const y = live[i];
  if (MEMBERS.includes(y.name)) {
    y.pof = true; // reconcile group POF to + (weak clove)
    live[i] = withGroup(y);
  }
}
// mutual near-match substitutes with 1010
for (const m of MEMBERS) addSub(byName.get(m), NEAR);
if (byName.get(NEAR)) for (const m of MEMBERS) addSub(byName.get(NEAR), m);

writeFileSync(J, JSON.stringify(live, null, 1) + "\n");
console.log(`Grouped ${MEMBERS.join(" + ")} as "${GROUP}" (POF+).`);
console.log(`1010 kept separate; mutual substitute link added.`);
