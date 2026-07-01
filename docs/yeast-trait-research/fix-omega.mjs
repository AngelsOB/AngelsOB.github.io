#!/usr/bin/env node
// Fix the scrambled Omega OYL strain NAMES (verified against Omega's official
// catalog — docs/yeast-trait-research/_omega-corrections.json). Only the `name`
// field was wrong; id/type/temp/styles/traits already describe the real strain.
// Also reverts the two erroneous trait edits that trusted the bad names:
//   OYL-101 (really Pilsner I, a clean lager) → pof/sta1 false
//   OYL-203 (really Brettanomyces Lambicus)   → drop the inferred pof
// Renaming a strain means updating every substitutes[] / strainGroupLabel that
// pointed at the old name.

import { readFileSync, writeFileSync } from "node:fs";

const J = "src/utils/presets.generated.yeasts.json";
const live = JSON.parse(readFileSync(J, "utf8"));
const corr = JSON.parse(
  readFileSync("docs/yeast-trait-research/_omega-corrections.json", "utf8")
);
const byId = new Map(live.map((y) => [y.labProductId, y]));

// 1. rename + build old→new full-name map
const nameMap = new Map();
const renames = [];
for (const c of corr) {
  const y = byId.get(c.id);
  if (!y) { console.log(`WARN: no entry for ${c.id}`); continue; }
  const oldName = y.name;
  const newName = `${c.id} ${c.correctName}`;
  if (oldName !== newName) {
    nameMap.set(oldName, newName);
    y.name = newName;
    renames.push(`${oldName}  →  ${newName}`);
  }
  // NOTE: types already correct in our data (OYL-030 stays `wheat` to match its
  // Wit groupmates), so we do NOT apply c.correctType.
}

// 2. trait reverts (my earlier edits trusted the scrambled names)
const oyl101 = byId.get("OYL-101"); // Pilsner I — clean Czech lager
if (oyl101) { oyl101.pof = false; oyl101.sta1 = false; }
const oyl203 = byId.get("OYL-203"); // Brettanomyces Lambicus — Sacc POF/4-VG is N/A
if (oyl203 && "pof" in oyl203) delete oyl203.pof;

// 3. propagate renames into every substitutes[] and strainGroupLabel
let subFixes = 0, labelFixes = 0;
for (const y of live) {
  if (Array.isArray(y.substitutes)) {
    y.substitutes = y.substitutes.map((s) => {
      if (nameMap.has(s)) { subFixes++; return nameMap.get(s); }
      return s;
    });
  }
  if (y.strainGroupLabel && nameMap.has(y.strainGroupLabel)) {
    y.strainGroupLabel = nameMap.get(y.strainGroupLabel);
    labelFixes++;
  }
}

// 4. integrity: no dup full names, no dangling substitute refs
const names = new Set(live.map((y) => y.name));
const dups = [];
const seen = new Set();
for (const y of live) { if (seen.has(y.name)) dups.push(y.name); seen.add(y.name); }
const dangling = [];
for (const y of live)
  for (const s of y.substitutes || [])
    if (!names.has(s)) dangling.push(`${y.name} → ${s}`);

writeFileSync(J, JSON.stringify(live, null, 1) + "\n");

console.log(`Renamed ${renames.length} strains:`);
renames.forEach((r) => console.log("  " + r));
console.log(`\nTrait reverts: OYL-101 → pof/sta1 false; OYL-203 → pof dropped`);
console.log(`Substitute refs updated: ${subFixes}; strainGroupLabels updated: ${labelFixes}`);
console.log(`Duplicate full names: ${dups.length ? dups.join(", ") : "none"}`);
console.log(`Dangling substitute refs: ${dangling.length ? dangling.join(", ") : "none"}`);
