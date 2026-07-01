#!/usr/bin/env node
// Deterministic reconcile + group-propagation + QA for the POF/STA-1 research pass.
//
// Inputs:
//   docs/yeast-trait-research/raw-verdicts.json   — flat array of agent verdicts (research workflow output)
//   docs/yeast-trait-research/manifest.json       — full per-strain manifest (all fields)
// Outputs:
//   docs/yeast-trait-research/pof-sta1-data.json       — final per-strain trait dataset
//   docs/yeast-trait-research/residual-pof-unknown.json — strains still POF-unknown (feed the inference pass)
//   docs/yeast-trait-research/REPORT.md                 — coverage, anchors, flags, STA-1 candidates
//
// PRINCIPLES
//  • POF & STA-1 are genetic → identical within a strainGroup. We propagate a known
//    value to unknown group members (downgraded confidence) and FLAG intra-group conflicts.
//  • STA-1 is safety-sensitive: never invented here; only documented + group-propagated.
//  • Honest "unknown" is a valid final state.

import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'docs/yeast-trait-research'
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8'))
const rawVerdicts = JSON.parse(readFileSync(`${DIR}/raw-verdicts.json`, 'utf8'))

// ── matching ────────────────────────────────────────────────────────────────
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const byName = new Map()
const byNorm = new Map()
for (const v of rawVerdicts) {
  if (!v || !v.name) continue
  if (!byName.has(v.name)) byName.set(v.name, v) // first wins; dups flagged below
  byNorm.set(norm(v.name), v)
}
const dupVerdicts = (() => {
  const seen = new Set(), dup = []
  for (const v of rawVerdicts) {
    if (!v || !v.name) continue
    if (seen.has(v.name)) dup.push(v.name)
    seen.add(v.name)
  }
  return dup
})()

// ── confidence helpers ────────────────────────────────────────────────────────
const CONF = { high: 3, medium: 2, low: 1, none: 0 }
const confName = (n) => (['none', 'low', 'medium', 'high'][n] || 'none')
const downgrade = (c) => (c === 'high' ? 'medium' : c === 'medium' ? 'low' : null) // low/none don't propagate

// ── 1. attach the best available raw verdict to each manifest strain ──────────
const unmatchedVerdicts = new Set(byName.keys())
const records = manifest.map((m) => {
  let v = byName.get(m.name) || byNorm.get(norm(m.name))
  if (v) unmatchedVerdicts.delete(v.name)
  const rec = {
    name: m.name,
    category: m.category,
    type: m.type ?? null,
    strainGroup: m.strainGroup ?? null,
    strainGroupLabel: m.strainGroupLabel ?? null,
    styles: m.styles ?? null,
    attenuationMax: m.attenuationMax ?? m.attenuationPercent ?? null,
    indexable: !!m.indexable,
    // current (pre-existing) values in the live dataset
    priorPof: m.currentPof ?? null,
    priorSta1: m.currentSta1 ?? null,
    // resolved
    pof: 'unknown', pofBasis: 'unknown', pofSource: '', pofConfidence: 'none', pofEvidence: '',
    sta1: 'unknown', sta1Basis: 'unknown', sta1Source: '', sta1Confidence: 'none', sta1Evidence: '',
    flags: [],
    matched: !!v,
  }
  if (v) {
    rec.pof = v.pof; rec.pofBasis = v.pofBasis; rec.pofSource = v.pofSource || ''
    rec.pofConfidence = v.pofConfidence; rec.pofEvidence = v.pofEvidence || ''
    rec.sta1 = v.sta1; rec.sta1Basis = v.sta1Basis; rec.sta1Source = v.sta1Source || ''
    rec.sta1Confidence = v.sta1Confidence; rec.sta1Evidence = v.sta1Evidence || ''
  }
  // honor a strong pre-existing value if research returned unknown (don't lose committed high-conf facts)
  for (const f of ['pof', 'sta1']) {
    const prior = f === 'pof' ? rec.priorPof : rec.priorSta1
    if (rec[f] === 'unknown' && (prior === true || prior === false)) {
      rec[f] = prior ? 'positive' : 'negative'
      rec[`${f}Basis`] = 'prior'
      rec[`${f}Source`] = m.currentSource || 'pre-existing dataset value'
      rec[`${f}Confidence`] = m.currentConfidence || 'medium'
      rec[`${f}Evidence`] = 'carried over from existing dataset'
    }
  }
  return rec
})
const recByName = new Map(records.map((r) => [r.name, r]))

// ── 2. group propagation (genetic identity within strainGroup) ────────────────
const groups = new Map()
for (const r of records) {
  if (!r.strainGroup) continue
  if (!groups.has(r.strainGroup)) groups.set(r.strainGroup, [])
  groups.get(r.strainGroup).push(r)
}
const groupConflicts = []
for (const [g, members] of groups) {
  for (const field of ['pof', 'sta1']) {
    const known = members.filter((m) => m[field] !== 'unknown')
    const vals = new Set(known.map((m) => m[field]))
    if (vals.size > 1) {
      // genuine conflict among documented members — flag, do not propagate
      groupConflicts.push({
        group: g, field,
        members: known.map((m) => `${m.name}=${m[field]} (${m[`${field}Confidence`]})`),
      })
      known.forEach((m) => m.flags.push(`group-conflict:${field}`))
      continue
    }
    if (vals.size === 1) {
      const val = [...vals][0]
      const best = known.reduce((a, b) => (CONF[b[`${field}Confidence`]] > CONF[a[`${field}Confidence`]] ? b : a))
      const propConf = downgrade(best[`${field}Confidence`])
      if (!propConf) continue
      for (const m of members) {
        if (m[field] === 'unknown') {
          m[field] = val
          m[`${field}Basis`] = 'group'
          m[`${field}Source`] = `same strain as ${best.name} (${best.strainGroupLabel || g}); ${best[`${field}Source`]}`
          m[`${field}Confidence`] = propConf
          m[`${field}Evidence`] = `propagated within strainGroup "${g}" from ${best.name}`
        }
      }
    }
  }
}

// ── 3. anchor regression check (indisputable facts) ───────────────────────────
const P = 'positive', N = 'negative'
const ANCHORS = [
  ['SafAle US-05', P_(N), P_(N)], // clean American ale
  ['WLP001 California Ale Yeast', P_(N), P_(N)],
  ['1056 American Ale', P_(N), P_(N)],
  ['SafLager W-34/70', P_(N), P_(N)],
  ['SafLager S-23', P_(N), null],
  ['LalBrew BRY-97 American West Coast Ale', P_(N), P_(N)],
  ['SafAle S-04', P_(N), P_(N)],
  ['SafAle WB-06', P_(P), P_(P)], // specialty wheat, phenolic + documented S. cerevisiae var. diastaticus (Fermentis ingredient line)
  ['WLP300 Hefeweizen Ale Yeast', P_(P), P_(N)],
  ['3068 Weihenstephan Weizen', P_(P), P_(N)],
  ['WLP351 Bavarian Weizen Ale Yeast', P_(P), null],
  ['SafAle T-58', P_(P), null], // phenolic Belgian
  ['WLP570 Belgian Golden Ale Yeast', P_(P), null],
  ['1214 Belgian Abbey Style Ale', P_(P), null],
  ['LalBrew Belle Saison', P_(P), P_(P)], // diastatic
  ['3724 Belgian Saison', P_(P), P_(P)], // Dupont, diastatic
  ['WLP565 Belgian Saison I Ale Yeast', P_(P), P_(P)],
  ['3711 French Saison', null, P_(P)], // famously diastatic (POF intentionally not anchored)
  ['WLP653 Brettanomyces lambicus', P_(P), null],
  ['LalBrew Farmhouse', P_(P), P_(N)], // POF+ but sold as non-diastatic
  ['WLP561 Non STA1son Ale Yeast Blend', null, P_(N)],
  ['OYL-071DRY Dried Lutra', P_(N), P_(N)], // clean kveik
]
function P_(x) { return x } // readability shim
const anchorResults = ANCHORS.map(([name, expPof, expSta1]) => {
  const r = recByName.get(name)
  const out = { name, found: !!r, pof: { expected: expPof, actual: r ? r.pof : null, pass: true }, sta1: { expected: expSta1, actual: r ? r.sta1 : null, pass: true } }
  if (!r) { out.pof.pass = out.sta1.pass = false; return out }
  if (expPof) out.pof.pass = r.pof === expPof
  if (expSta1) out.sta1.pass = r.sta1 === expSta1
  return out
})
const anchorFails = anchorResults.filter((a) => !a.found || !a.pof.pass || !a.sta1.pass)

// ── 4. consistency flags (catch mis-assignments) ──────────────────────────────
const phenolicHint = (r) => {
  const hay = `${r.name} ${(r.styles || []).join(' ')} ${r.type}`.toLowerCase()
  return /weiss|weizen|wit|hefe|saison|farmhouse|belg|abbey|trappist|tripel|dubbel|brett|biere de garde|gose|berliner/.test(hay) ||
    ['wheat', 'brett', 'wild'].includes(r.type)
}
const cleanHint = (r) => r.type === 'lager' || /american ale|west coast|cali|chico|british ale|kolsch|cream ale|neipa|ipa/.test(`${r.name} ${(r.styles || []).join(' ')}`.toLowerCase())
const diastaticHint = (r) =>
  (r.attenuationMax != null && r.attenuationMax >= 0.85) ||
  /saison|farmhouse|biere de garde|brut|diastatic|super/.test(`${r.name} ${(r.styles || []).join(' ')}`.toLowerCase()) ||
  ['brett', 'wild'].includes(r.type)

for (const r of records) {
  if (r.pof === 'positive' && cleanHint(r) && !phenolicHint(r)) r.flags.push('pof+ on a clean-style strain — verify')
  if (r.pof === 'negative' && phenolicHint(r) && !/american hefe|american wheat|dunkelweizen-clean/.test(`${r.name}`.toLowerCase())) r.flags.push('pof- on a phenolic-style strain — verify')
  if (r.sta1 === 'positive' && r.attenuationMax != null && r.attenuationMax < 0.8 && !diastaticHint(r)) r.flags.push('sta1+ but low attenuation — verify')
}

// STA-1 candidates a human should confirm (style/attenuation suggests possible diastaticus, but undocumented)
const sta1Candidates = records
  .filter((r) => r.sta1 === 'unknown' && diastaticHint(r))
  .map((r) => ({ name: r.name, category: r.category, type: r.type, attenuationMax: r.attenuationMax, styles: r.styles }))

// residual POF-unknowns (feed the inference pass)
const residualPof = records
  .filter((r) => r.pof === 'unknown')
  .map((r) => ({ name: r.name, category: r.category, type: r.type, styles: r.styles, strainGroupLabel: r.strainGroupLabel, description: (manifest.find((m) => m.name === r.name) || {}).description || null }))

// ── 5. write outputs ──────────────────────────────────────────────────────────
writeFileSync(`${DIR}/pof-sta1-data.json`, JSON.stringify(records, null, 2))
writeFileSync(`${DIR}/residual-pof-unknown.json`, JSON.stringify(residualPof, null, 2))

const count = (pred) => records.filter(pred).length
const pofPos = count((r) => r.pof === 'positive')
const pofNeg = count((r) => r.pof === 'negative')
const pofUnk = count((r) => r.pof === 'unknown')
const sta1Pos = count((r) => r.sta1 === 'positive')
const sta1Neg = count((r) => r.sta1 === 'negative')
const sta1Unk = count((r) => r.sta1 === 'unknown')
const byConf = (field) => ['high', 'medium', 'low'].map((c) => `${c}:${count((r) => r[field] !== 'unknown' && r[`${field}Confidence`] === c)}`).join('  ')
const idx = (pred) => records.filter((r) => r.indexable && pred(r)).length

const lines = []
lines.push('# POF / STA-1 yeast trait data — Phase 1 collection report')
lines.push('')
lines.push(`Generated from ${rawVerdicts.length} research verdicts over ${manifest.length} strains.`)
lines.push('')
lines.push('## Coverage')
lines.push('')
lines.push('| Trait | positive | negative | unknown | known % | indexable known % |')
lines.push('|---|---|---|---|---|---|')
lines.push(`| POF | ${pofPos} | ${pofNeg} | ${pofUnk} | ${(((pofPos + pofNeg) / records.length) * 100).toFixed(0)}% | ${((idx((r) => r.pof !== 'unknown') / Math.max(1, records.filter((r) => r.indexable).length)) * 100).toFixed(0)}% |`)
lines.push(`| STA-1 | ${sta1Pos} | ${sta1Neg} | ${sta1Unk} | ${(((sta1Pos + sta1Neg) / records.length) * 100).toFixed(0)}% | ${((idx((r) => r.sta1 !== 'unknown') / Math.max(1, records.filter((r) => r.indexable).length)) * 100).toFixed(0)}% |`)
lines.push('')
lines.push(`POF confidence: ${byConf('pof')}`)
lines.push(`STA-1 confidence: ${byConf('sta1')}`)
lines.push('')
lines.push('## Anchor regression check')
lines.push('')
lines.push(anchorFails.length === 0 ? '✅ All anchors pass.' : `⚠️ ${anchorFails.length} anchor mismatch(es):`)
for (const a of anchorResults) {
  const ok = a.found && a.pof.pass && a.sta1.pass
  lines.push(`- ${ok ? '✅' : '❌'} **${a.name}** — POF exp=${a.pof.expected ?? '·'} got=${a.pof.actual ?? '·'} | STA-1 exp=${a.sta1.expected ?? '·'} got=${a.sta1.actual ?? '·'}${a.found ? '' : ' (NOT FOUND)'}`)
}
lines.push('')
lines.push('## Intra-group conflicts (same strain, contradictory trait — needs a human call)')
lines.push('')
lines.push(groupConflicts.length === 0 ? 'None.' : '')
for (const c of groupConflicts) lines.push(`- **${c.group}** / ${c.field}: ${c.members.join(' · ')}`)
lines.push('')
lines.push(`## Consistency flags (${records.filter((r) => r.flags.length).length} strains)`)
lines.push('')
for (const r of records.filter((r) => r.flags.length)) lines.push(`- **${r.name}** [${r.category}] pof=${r.pof} sta1=${r.sta1} — ${r.flags.join('; ')}`)
lines.push('')
lines.push(`## STA-1 candidates to confirm (${sta1Candidates.length}) — undocumented but style/attenuation suggests possible diastaticus`)
lines.push('')
for (const c of sta1Candidates) lines.push(`- **${c.name}** [${c.category}] type=${c.type} attMax=${c.attenuationMax ?? '·'} styles=${(c.styles || []).join('/') || '·'}`)
lines.push('')
lines.push('## Data hygiene')
lines.push('')
lines.push(`- Verdicts unmatched to any manifest strain: ${unmatchedVerdicts.size}${unmatchedVerdicts.size ? ' → ' + [...unmatchedVerdicts].join(', ') : ''}`)
lines.push(`- Manifest strains with NO verdict returned: ${records.filter((r) => !r.matched).length}${records.filter((r) => !r.matched).length ? ' → ' + records.filter((r) => !r.matched).map((r) => r.name).join(', ') : ''}`)
lines.push(`- Duplicate verdict names: ${dupVerdicts.length}${dupVerdicts.length ? ' → ' + dupVerdicts.join(', ') : ''}`)
lines.push(`- Residual POF-unknown (→ inference pass): ${residualPof.length}`)
writeFileSync(`${DIR}/REPORT.md`, lines.join('\n'))

console.log(`POF: +${pofPos} / -${pofNeg} / ?${pofUnk}    STA-1: +${sta1Pos} / -${sta1Neg} / ?${sta1Unk}`)
console.log(`Anchors: ${anchorResults.length - anchorFails.length}/${anchorResults.length} pass; group conflicts: ${groupConflicts.length}; flags: ${records.filter((r) => r.flags.length).length}; residual POF unknown: ${residualPof.length}`)
console.log(`Unmatched verdicts: ${unmatchedVerdicts.size}; strains missing a verdict: ${records.filter((r) => !r.matched).length}`)
