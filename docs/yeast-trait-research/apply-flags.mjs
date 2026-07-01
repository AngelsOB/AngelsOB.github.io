#!/usr/bin/env node
// Apply the flag-verification verdicts to the final dataset.
//   confirm  → value stays; clear the heuristic "verify" flag for that trait
//   correct  → update value (basis flag-verified), record the change
//   uncertain → keep value + flag, add an uncertain note for human follow-up
//
// Inputs:  pof-sta1-data.json (final), _flagverify.json (workflow {results})
// Output:  pof-sta1-data.json (in place) + FLAG-RESOLUTION.md

import { readFileSync, writeFileSync } from 'node:fs'
const DIR = 'docs/yeast-trait-research'
const data = JSON.parse(readFileSync(`${DIR}/pof-sta1-data.json`, 'utf8'))
const fv = JSON.parse(readFileSync(`${DIR}/_flagverify.json`, 'utf8'))
const byName = new Map(data.map((r) => [r.name, r]))

// which heuristic flags belong to which trait (cleared when that trait is resolved)
const POF_FLAGS = ['pof- on a phenolic-style strain — verify', 'pof+ on a clean-style strain — verify', 'group-conflict:pof']
const STA1_FLAGS = ['sta1+ but low attenuation — verify', 'group-conflict:sta1']
const addFlag = (r, f) => { if (!r.flags.includes(f)) r.flags.push(f) }
const clearFlags = (r, list) => { r.flags = r.flags.filter((f) => !list.includes(f)) }

const changes = []
for (const res of fv.results || []) {
  const r = byName.get(res.name)
  if (!r) continue
  for (const f of ['pof', 'sta1']) {
    const verdict = res[`${f}Verdict`]
    const value = res[`${f}Value`]
    const reason = res[`${f}Reason`] || ''
    const flagList = f === 'pof' ? POF_FLAGS : STA1_FLAGS
    if (verdict === 'confirm') {
      clearFlags(r, flagList)
    } else if (verdict === 'correct' && value && value !== r[f]) {
      changes.push({ name: r.name, trait: f, from: r[f], to: value, reason })
      r[`${f}Prev`] = r[`${f}Prev`] ?? r[f]
      r[f] = value
      r[`${f}Basis`] = 'flag-verified'
      r[`${f}Confidence`] = 'medium'
      r[`${f}Evidence`] = `Flag re-verification: ${reason}`.slice(0, 240)
      clearFlags(r, flagList)
      addFlag(r, `${f}:flag-corrected→${value}`)
    } else if (verdict === 'correct') {
      // verdict correct but value == current (no-op confirmation)
      clearFlags(r, flagList)
    } else if (verdict === 'uncertain') {
      addFlag(r, `${f}:UNCERTAIN — ${reason.slice(0, 80)}`)
    }
  }
}

// Clean up: the provenance of every change lives in basis/evidence/reviewStatus, so the
// `flags` array is reduced to genuinely-unresolved items only (UNCERTAIN). Audit markers
// (adjudicated→/REFUTED→/reverted/flag-corrected→) and now-confirmed heuristic flags drop out.
for (const r of data) r.flags = r.flags.filter((f) => f.includes('UNCERTAIN'))

writeFileSync(`${DIR}/pof-sta1-data.json`, JSON.stringify(data, null, 2))

const remaining = data.filter((r) => r.flags.length)
const uncertain = data.filter((r) => r.flags.some((f) => f.includes('UNCERTAIN')))
const L = []
L.push('# Flag resolution')
L.push('')
L.push(`Re-verified ${(fv.results || []).length} flagged strains.`)
L.push('')
L.push(`## Corrections (${changes.length})`)
for (const c of changes) L.push(`- **${c.name}** ${c.trait}: ${c.from} → **${c.to}** — ${c.reason}`)
L.push('')
L.push(`## Still uncertain (${uncertain.length})`)
for (const r of uncertain) L.push(`- **${r.name}** [${r.category}] pof=${r.pof} sta1=${r.sta1} — ${r.flags.filter((f) => f.includes('UNCERTAIN')).join('; ')}`)
L.push('')
L.push(`## Strains still carrying any flag (${remaining.length})`)
for (const r of remaining) L.push(`- **${r.name}** [${r.category}] — ${r.flags.join('; ')}`)
writeFileSync(`${DIR}/FLAG-RESOLUTION.md`, L.join('\n'))

console.log(`Corrections: ${changes.length}`)
for (const c of changes) console.log(`  ${c.name} ${c.trait}: ${c.from}→${c.to}`)
console.log(`Still uncertain: ${uncertain.length}; strains with any remaining flag: ${remaining.length}`)
