#!/usr/bin/env node
// Collapse the redundant strainGroup(slug) + strainGroupLabel into ONE field:
// `strainGroup` becomes the canonical strain name (both the grouping key AND the
// display), and the search aliases move INTO the data as `strainGroupAliases`.
// Deletes the strainGroupLabel field and the strainAliases.ts code map (done
// separately). Single-member "groups" (leftover heads after de-grouping) are
// nulled — a group of one isn't a group.

import { readFileSync, writeFileSync } from "node:fs";

const J = "src/utils/presets.generated.yeasts.json";
const live = JSON.parse(readFileSync(J, "utf8"));
const groups = JSON.parse(
  readFileSync("docs/yeast-trait-research/_group-labels.json", "utf8")
);
const aliasBySlug = new Map(
  groups.map((g) => [g.slug, [...new Set(g.aliases || [])].filter(Boolean)])
);
aliasBySlug.set("a01", ["Whitbread B", "British Ale I", "Wyeast 1098", "Imperial A01 House"]);

const count = new Map();
for (const y of live) if (y.strainGroup) count.set(y.strainGroup, (count.get(y.strainGroup) || 0) + 1);

let collapsed = 0, nulled = 0;
const out = live.map((entry) => {
  if (!entry.strainGroup) return entry;
  const slug = entry.strainGroup;
  const single = count.get(slug) === 1;
  const next = {};
  for (const [k, v] of Object.entries(entry)) {
    if (k === "strainGroup") {
      if (single) { nulled++; continue; } // drop the meaningless one-member group
      next.strainGroup = entry.strainGroupLabel; // canonical name = key + display
      const al = aliasBySlug.get(slug);
      if (al && al.length) next.strainGroupAliases = al;
      collapsed++;
      continue;
    }
    if (k === "strainGroupLabel") continue; // folded into strainGroup
    next[k] = v;
  }
  return next;
});
writeFileSync(J, JSON.stringify(out, null, 1) + "\n");
console.log(`Collapsed ${collapsed} entries into single-field strainGroup; nulled ${nulled} single-member groups.`);
console.log(`Distinct groups now: ${new Set(out.map((y) => y.strainGroup).filter(Boolean)).size}`);
