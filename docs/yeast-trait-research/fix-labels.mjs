#!/usr/bin/env node
// Relabel the 71 cross-lab strainGroups with canonical brewing names
// (docs/yeast-trait-research/_group-labels.json, researched + reviewed), and emit
// the per-group search aliases as a TS module for keyword surfacing.

import { readFileSync, writeFileSync } from "node:fs";

const D = "docs/yeast-trait-research";
const labels = JSON.parse(readFileSync(`${D}/_group-labels.json`, "utf8"));

// Review fix: a01 was mislabeled "Chico (British Ale I)" — it's the Whitbread
// British ale (Wyeast 1098), explicitly NOT the Chico/US-05 family.
const a01 = labels.find((g) => g.slug === "a01");
if (a01) {
  a01.canonicalLabel = "British Ale I (Whitbread)";
  a01.overSplit = false;
  a01.aliases = ["Whitbread B", "British Ale I", "Wyeast 1098", "Imperial A01 House"];
}

const labelBySlug = new Map(labels.map((g) => [g.slug, g.canonicalLabel]));

// 1. relabel the live data
const J = "src/utils/presets.generated.yeasts.json";
const live = JSON.parse(readFileSync(J, "utf8"));
let relabeled = 0;
for (const y of live) {
  if (y.strainGroup && labelBySlug.has(y.strainGroup)) {
    const next = labelBySlug.get(y.strainGroup);
    if (y.strainGroupLabel !== next) { y.strainGroupLabel = next; relabeled++; }
  }
}
writeFileSync(J, JSON.stringify(live, null, 1) + "\n");

// 2. emit the alias map (slug -> search terms) as a TS module. Aliases fold into
// keyword surfaces so a strain matches "Chico"/"Heady Topper"/etc.
const aliasEntries = labels
  .filter((g) => (g.aliases || []).length)
  .map((g) => {
    const terms = [...new Set(g.aliases)].filter(Boolean);
    return `  ${JSON.stringify(g.slug)}: ${JSON.stringify(terms)},`;
  })
  .join("\n");
const ts = `// AUTO-GENERATED from docs/yeast-trait-research/_group-labels.json (canonical
// strain-group names researched from Mr Malty / suregork / MTF / lab origins).
// Maps a strainGroup slug to the OTHER names brewers search for that isolate —
// origin breweries, famous beers, cross-lab codes — for SEO keyword surfacing.
// Regenerate via docs/yeast-trait-research/fix-labels.mjs.

export const STRAIN_GROUP_ALIASES: Record<string, string[]> = {
${aliasEntries}
};
`;
writeFileSync("src/modules/ingredients/yeast/strainAliases.ts", ts);

console.log(`Relabeled ${relabeled} entries across ${labelBySlug.size} groups.`);
console.log(`a01 fixed → "British Ale I (Whitbread)".`);
console.log(`Wrote strainAliases.ts with ${labels.filter((g) => (g.aliases || []).length).length} alias sets.`);
