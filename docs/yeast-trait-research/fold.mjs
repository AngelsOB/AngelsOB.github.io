#!/usr/bin/env node
// Fold the collected POF/STA-1 values + mis-grouping fixes into the LIVE dataset.
//   - pof/sta1 booleans: positive→true, negative→false, unknown→omit (inserted after the
//     attenuation cluster, the file's canonical position; existing keys updated in place).
//   - de-group the 6 confirmed mis-grouped "intruder" strains (drop strainGroup + label).
// Writes src/utils/presets.generated.yeasts.json with JSON.stringify(.,null,1)+"\n" (byte-exact format).
// Provenance/confidence stays in docs/yeast-trait-research/pof-sta1-data.json (the live schema
// carries only the booleans — same as the 51/41 entries already populated).

import { readFileSync, writeFileSync } from 'node:fs'

const LIVE = 'src/utils/presets.generated.yeasts.json'
const DATA = 'docs/yeast-trait-research/pof-sta1-data.json'
const live = JSON.parse(readFileSync(LIVE, 'utf8'))
const data = JSON.parse(readFileSync(DATA, 'utf8'))
const dByName = new Map(data.map((r) => [r.name, r]))

const DEGROUP = new Set([
  'A44 Kveiking', 'SafAle BE-256', 'SafLager S-189', 'B53 Precious', 'LalBrew Farmhouse', 'OYL-002 American Wheat',
])
// pof/sta1 sit right after the attenuation cluster; fall back through form/type/category/name
// (always present) so thin entries lacking attenuation data still get the keys inserted.
const ANCHOR_ORDER = ['alcoholTolerance', 'attenuationPercent', 'attenuationMax', 'attenuationMin', 'flocculation', 'form', 'type', 'category', 'name']
const triBool = (v) => (v === 'positive' ? true : v === 'negative' ? false : undefined) // undefined = omit

const stats = { pofAdded: 0, pofChanged: 0, pofRemoved: 0, sta1Added: 0, sta1Changed: 0, sta1Removed: 0, degrouped: [], warnings: [], unchanged: 0 }

const out = live.map((entry) => {
  const rec = dByName.get(entry.name)
  if (!rec) { stats.warnings.push(`no data record for live entry "${entry.name}"`); return entry }

  const wantPof = triBool(rec.pof)
  const wantSta1 = triBool(rec.sta1)
  const hadPof = Object.prototype.hasOwnProperty.call(entry, 'pof')
  const hadSta1 = Object.prototype.hasOwnProperty.call(entry, 'sta1')
  const isDegroup = DEGROUP.has(entry.name)

  // SAFETY: never silently blank an existing curated value because our data says unknown.
  let finalPof = wantPof, finalSta1 = wantSta1
  if (wantPof === undefined && hadPof) { finalPof = entry.pof; stats.warnings.push(`kept existing pof=${entry.pof} for "${entry.name}" (our data: unknown)`) }
  if (wantSta1 === undefined && hadSta1) { finalSta1 = entry.sta1; stats.warnings.push(`kept existing sta1=${entry.sta1} for "${entry.name}" (our data: unknown)`) }

  // tally
  if (finalPof !== undefined) { if (!hadPof) stats.pofAdded++; else if (entry.pof !== finalPof) stats.pofChanged++ }
  else if (hadPof) stats.pofRemoved++
  if (finalSta1 !== undefined) { if (!hadSta1) stats.sta1Added++; else if (entry.sta1 !== finalSta1) stats.sta1Changed++ }
  else if (hadSta1) stats.sta1Removed++
  if (isDegroup && (entry.strainGroup !== undefined || entry.strainGroupLabel !== undefined)) {
    stats.degrouped.push(`${entry.name} (was ${entry.strainGroup})`)
  }

  // rebuild preserving key order; update pof/sta1 in place, else insert after the attenuation anchor
  const anchor = ANCHOR_ORDER.find((k) => Object.prototype.hasOwnProperty.call(entry, k))
  const next = {}
  let changed = false
  for (const [k, v] of Object.entries(entry)) {
    if (k === 'pof') { if (finalPof !== undefined) next.pof = finalPof; if (finalPof !== v) changed = true; continue }
    if (k === 'sta1') { if (finalSta1 !== undefined) next.sta1 = finalSta1; if (finalSta1 !== v) changed = true; continue }
    if (isDegroup && (k === 'strainGroup' || k === 'strainGroupLabel')) { changed = true; continue }
    next[k] = v
    if (k === anchor) {
      if (!hadPof && finalPof !== undefined) { next.pof = finalPof; changed = true }
      if (!hadSta1 && finalSta1 !== undefined) { next.sta1 = finalSta1; changed = true }
    }
  }
  if (!changed) stats.unchanged++
  return next
})

writeFileSync(LIVE, JSON.stringify(out, null, 1) + '\n')

// post-write coverage in the live file
const liveAfter = JSON.parse(readFileSync(LIVE, 'utf8'))
const c = (p) => liveAfter.filter(p).length
console.log('── Fold complete ──')
console.log(`POF   added ${stats.pofAdded}, changed ${stats.pofChanged}, removed ${stats.pofRemoved}`)
console.log(`STA-1 added ${stats.sta1Added}, changed ${stats.sta1Changed}, removed ${stats.sta1Removed}`)
console.log(`Live now: pof set on ${c((e) => 'pof' in e)} (${c((e) => e.pof === true)}+/${c((e) => e.pof === false)}−), sta1 set on ${c((e) => 'sta1' in e)} (${c((e) => e.sta1 === true)}+/${c((e) => e.sta1 === false)}−)`)
console.log(`De-grouped ${stats.degrouped.length}: ${stats.degrouped.join('; ')}`)
console.log(`Entries unchanged: ${stats.unchanged}/${live.length}`)
if (stats.warnings.length) { console.log(`\nWarnings (${stats.warnings.length}):`); for (const w of stats.warnings) console.log('  • ' + w) }
