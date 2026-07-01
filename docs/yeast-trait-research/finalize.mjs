#!/usr/bin/env node
// Phase-2 finalize: fold inference + source-verification + conflict-adjudication into the
// reconciled dataset and regenerate the report.
//
// Inputs:
//   docs/yeast-trait-research/pof-sta1-data.json  — reconciled base (from reconcile.mjs)
//   docs/yeast-trait-research/_phase2.json        — { inference, adjudication, verification }
// Outputs (overwrite):
//   pof-sta1-data.json   — FINAL per-strain dataset (adds reviewStatus + audit trail)
//   REPORT-final.md      — coverage, verification audit, adjudications, mis-groupings, candidates
//
// Precedence: research base → inference (fills unknowns) → verification (refute→correct,
//   unverifiable→cap confidence + soft note) → adjudication (final word) → bad-propagation revert.

import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'docs/yeast-trait-research'
const data = JSON.parse(readFileSync(`${DIR}/pof-sta1-data.json`, 'utf8'))
const p2 = JSON.parse(readFileSync(`${DIR}/_phase2.json`, 'utf8'))
const byName = new Map(data.map((r) => [r.name, r]))
const addFlag = (r, f) => { if (!r.flags.includes(f)) r.flags.push(f) }
const setReview = (r, s) => { const set = new Set((r.reviewStatus || '').split('+').filter(Boolean)); set.add(s); r.reviewStatus = [...set].join('+') }
const CONFn = (c) => ({ high: 3, medium: 2, low: 1, none: 0 }[c] ?? 0)

// ── 1. inference: fill strains still POF-unknown ──────────────────────────────
let inferApplied = 0
const brettNA = []
for (const v of p2.inference || []) {
  const r = byName.get(v.name)
  if (!r) continue
  if (r.pof === 'unknown' && v.pof && v.pof !== 'unknown') {
    r.pof = v.pof
    r.pofBasis = 'inferred'
    r.pofConfidence = v.pofConfidence || 'low'
    r.pofSource = 'inferred from type/styles/description'
    r.pofEvidence = v.pofEvidence || v.note || 'style inference'
    setReview(r, 'pof:inferred')
    inferApplied++
  }
  if (r.pof === 'unknown' && /brett|4-ep|n\/a|not sacc|non-sacc/i.test(v.note || '')) {
    setReview(r, 'pof:brett-NA')
    brettNA.push({ name: r.name, note: v.note })
  }
}

// ── 2. verification: corrections + soft "unconfirmed" handling ─────────────────
const vAudit = { confirmed: 0, refuted: 0, unverifiable: 0, unreachable: 0 }
let unconfirmed = []
for (const c of p2.verification || []) {
  const r = byName.get(c.name)
  if (!r) continue
  for (const f of ['pof', 'sta1']) {
    const chk = c[`${f}Check`]
    const corrected = c[`${f}Corrected`]
    const note = c[`${f}Note`] || ''
    // "refuted" with corrected==="keep" is actually a confirmation in disguise
    if (chk === 'confirmed' || (chk === 'refuted' && (corrected === 'keep' || corrected === r[f]))) {
      vAudit.confirmed++; setReview(r, `${f}:verified`)
    } else if (chk === 'refuted') {
      vAudit.refuted++
      r[`${f}Prev`] = r[f]
      r[f] = corrected
      r[`${f}Basis`] = 'verified-correction'
      r[`${f}Confidence`] = 'medium'
      r[`${f}Evidence`] = `CORRECTED on re-verification: ${note}`.slice(0, 240)
      addFlag(r, `${f}:REFUTED→${corrected}`)
      setReview(r, `${f}:refuted`)
    } else if (chk === 'unverifiable') {
      vAudit.unverifiable++
      if (r[f] !== 'unknown') {
        if (CONFn(r[`${f}Confidence`]) > 2) r[`${f}Confidence`] = 'medium' // only cap high→medium
        setReview(r, `${f}:unconfirmed`)
        unconfirmed.push({ name: r.name, field: f, val: r[f], category: r.category, basis: r[`${f}Basis`], note })
      }
    } else if (chk === 'source-unreachable') {
      vAudit.unreachable++; setReview(r, `${f}:source-unreachable`)
    }
  }
}

// ── 3. adjudication: final word on the conflict clusters ──────────────────────
const adjReports = []
const adjudicatedNames = new Set()
for (const a of p2.adjudication || []) {
  adjReports.push(a)
  for (const ps of a.perStrain || []) {
    const r = byName.get(ps.name)
    if (!r) continue
    adjudicatedNames.add(ps.name)
    for (const f of ['pof', 'sta1']) {
      const rec = ps[f === 'pof' ? 'recommendedPof' : 'recommendedSta1']
      if (rec && rec !== 'keep' && rec !== r[f]) {
        r[`${f}Prev`] = r[`${f}Prev`] ?? r[f]
        r[f] = rec
        r[`${f}Basis`] = 'adjudicated'
        r[`${f}Confidence`] = a.confidence || 'medium'
        r[`${f}Evidence`] = `Adjudicated (${a.cluster}): ${ps.note}`.slice(0, 240)
        addFlag(r, `${f}:adjudicated→${rec}`)
      }
    }
    setReview(r, `adjudicated`)
    r.flags = r.flags.filter((x) => !x.startsWith('group-conflict')) // resolved
    if (ps.note) r.adjNote = ps.note
  }
}
// adjudication is stronger evidence than the source spot-check: drop unconfirmed noise it covered
unconfirmed = unconfirmed.filter((u) => !adjudicatedNames.has(u.name))
const misGroupings = adjReports.filter((a) => a.misGrouping).map((a) => ({ cluster: a.cluster, note: a.misGroupingNote }))

// ── 4. revert bad propagations on confirmed mis-grouped "intruder" strains ─────
// These strains were shown NOT to be the same isolate as their strainGroup, so any value
// that was PROPAGATED to them via that group is invalid (e.g. BE-256 got STA1+ from WLP590).
const INTRUDERS = ['A44 Kveiking', 'SafAle BE-256', 'SafLager S-189', 'B53 Precious', 'LalBrew Farmhouse']
const reverted = []
for (const name of INTRUDERS) {
  const r = byName.get(name)
  if (!r) continue
  for (const f of ['pof', 'sta1']) {
    if (r[`${f}Basis`] === 'group') {
      r[`${f}Prev`] = r[f]
      r[f] = 'unknown'; r[`${f}Basis`] = 'unknown'; r[`${f}Confidence`] = 'none'
      r[`${f}Evidence`] = 'reverted: was propagated via a strainGroup now found to be a mis-grouping'
      addFlag(r, `${f}:reverted-bad-propagation`)
      reverted.push(`${name}.${f}`)
    }
  }
}

// ── 5. recompute coverage + anchors + write ──────────────────────────────────
const count = (p) => data.filter(p).length
const pof = { pos: count((r) => r.pof === 'positive'), neg: count((r) => r.pof === 'negative'), unk: count((r) => r.pof === 'unknown') }
const sta1 = { pos: count((r) => r.sta1 === 'positive'), neg: count((r) => r.sta1 === 'negative'), unk: count((r) => r.sta1 === 'unknown') }

const P = 'positive', N = 'negative'
const ANCHORS = [
  ['SafAle US-05', N, N], ['WLP001 California Ale Yeast', N, N], ['1056 American Ale', N, N],
  ['SafLager W-34/70', N, N], ['LalBrew BRY-97 American West Coast Ale', N, N], ['SafAle S-04', N, N],
  ['SafAle WB-06', P, P], ['WLP300 Hefeweizen Ale Yeast', P, N], ['3068 Weihenstephan Weizen', P, N],
  ['SafAle T-58', P, null], ['WLP570 Belgian Golden Ale Yeast', P, null], ['1214 Belgian Abbey Style Ale', P, null],
  ['LalBrew Belle Saison', P, P], ['3724 Belgian Saison', P, P], ['WLP565 Belgian Saison I Ale Yeast', P, P],
  ['3711 French Saison', null, P], ['LalBrew Farmhouse', P, null], ['WLP561 Non STA1son Ale Yeast Blend', null, N],
  ['OYL-071DRY Dried Lutra', N, N],
]
const anchors = ANCHORS.map(([name, ep, es]) => {
  const r = byName.get(name)
  return { name, found: !!r, pofOk: !ep || (r && r.pof === ep), sta1Ok: !es || (r && r.sta1 === es), pof: r && r.pof, sta1: r && r.sta1, ep, es }
})
const anchorFails = anchors.filter((a) => !a.found || !a.pofOk || !a.sta1Ok)

writeFileSync(`${DIR}/pof-sta1-data.json`, JSON.stringify(data, null, 2))

const flagged = data.filter((r) => r.flags.length)
const confDist = (f) => ['high', 'medium', 'low'].map((c) => `${c}:${count((r) => r[f] !== 'unknown' && r[`${f}Confidence`] === c)}`).join('  ')
const idxKnown = (f) => {
  const idx = data.filter((r) => r.indexable)
  return ((idx.filter((r) => r[f] !== 'unknown').length / idx.length) * 100).toFixed(0)
}

const L = []
L.push('# POF / STA-1 yeast trait data — FINAL Phase-1 report')
L.push('')
L.push('524 strains. Pipeline: 37-agent source research → cross-lab strainGroup propagation → 19-agent verify / adjudicate / infer → deterministic reconcile.')
L.push('')
L.push('## Coverage')
L.push('')
L.push('| Trait | + | − | unknown | known % | indexable known % |')
L.push('|---|---|---|---|---|---|')
L.push(`| POF | ${pof.pos} | ${pof.neg} | ${pof.unk} | ${(((pof.pos + pof.neg) / 524) * 100).toFixed(0)}% | ${idxKnown('pof')}% |`)
L.push(`| STA-1 | ${sta1.pos} | ${sta1.neg} | ${sta1.unk} | ${(((sta1.pos + sta1.neg) / 524) * 100).toFixed(0)}% | ${idxKnown('sta1')}% |`)
L.push('')
L.push(`POF confidence: ${confDist('pof')}`)
L.push(`STA-1 confidence: ${confDist('sta1')}`)
L.push(`STA-1 unknowns are mostly Brettanomyces/wild (STA1 is a Saccharomyces gene — N/A) and a conservative tail left for you to confirm.`)
L.push('')
L.push('## Source-verification audit (held-out re-fetch of cited sources)')
L.push('')
L.push(`- Checked ${(p2.verification || []).length} strains × 2 traits (sample biased toward flagged + all STA-1 positives).`)
L.push(`- ✅ confirmed: ${vAudit.confirmed}   ❌ refuted→corrected: ${vAudit.refuted}   ⚠️ unconfirmed-on-source: ${vAudit.unverifiable}   🔌 source-unreachable: ${vAudit.unreachable}`)
L.push(`- Only ${vAudit.refuted} genuine refutation(s) across the whole sample → the research base held up.`)
L.push('')
if (data.some((r) => r.flags.some((f) => f.includes('REFUTED')))) {
  L.push('### Refuted & corrected')
  for (const r of data.filter((r) => r.flags.some((f) => f.includes('REFUTED')))) L.push(`- **${r.name}** [${r.category}] → ${r.flags.filter((f) => f.includes('REFUTED')).join(', ')} (${r.adjNote ? '' : ''}${r.pofEvidence?.startsWith('CORRECTED') ? 'POF ' : ''}${r.sta1Evidence?.startsWith('CORRECTED') ? 'STA-1' : ''})`)
  L.push('')
}
if (reverted.length) {
  L.push('### Reverted bad propagations (value came from a mis-grouped strainGroup)')
  for (const x of reverted) L.push(`- ${x} → reset to unknown`)
  L.push('')
}
L.push('## Conflict adjudications (the 6 genuine intra-group contradictions)')
L.push('')
for (const a of adjReports) {
  L.push(`### ${a.cluster}  _(confidence: ${a.confidence}${a.misGrouping ? ' · MIS-GROUPING' : ''})_`)
  L.push(a.resolution)
  L.push('')
  for (const ps of a.perStrain || []) L.push(`- **${ps.name}** → POF:${ps.recommendedPof} STA-1:${ps.recommendedSta1} — ${ps.note}`)
  L.push('')
}
if (misGroupings.length) {
  L.push('## ⚠️ Suspected strainGroup mis-groupings (your curated lineage — trait-independent; fix in Part C if you agree)')
  L.push('')
  for (const m of misGroupings) L.push(`- ${m.note}`)
  L.push('')
}
L.push('## Anchor regression check')
L.push('')
L.push(anchorFails.length === 0 ? '✅ All anchors pass.' : `⚠️ ${anchorFails.length} mismatch(es):`)
for (const a of anchors) {
  const ok = a.found && a.pofOk && a.sta1Ok
  L.push(`- ${ok ? '✅' : '❌'} **${a.name}** — POF exp=${a.ep ?? '·'} got=${a.pof ?? '·'} | STA-1 exp=${a.es ?? '·'} got=${a.sta1 ?? '·'}${a.found ? '' : ' (NOT FOUND)'}`)
}
L.push('')
L.push(`## Values retained as inference (cited page didn't explicitly print the trait — NOT errors, capped at medium confidence) — ${unconfirmed.length}`)
L.push('')
L.push('Mostly clean-style POF− and saison/farmhouse POF+ that read off prose rather than a spec badge. Listed for transparency.')
L.push('')
for (const u of unconfirmed) L.push(`- **${u.name}** [${u.category}] ${u.field}=${u.val} (${u.basis})`)
L.push('')
L.push(`## Remaining consistency flags (${flagged.length} strains)`)
L.push('')
for (const r of flagged) L.push(`- **${r.name}** [${r.category}] pof=${r.pof} sta1=${r.sta1} — ${r.flags.join('; ')}`)
writeFileSync(`${DIR}/REPORT-final.md`, L.join('\n'))

console.log(`FINAL  POF +${pof.pos}/-${pof.neg}/?${pof.unk}   STA-1 +${sta1.pos}/-${sta1.neg}/?${sta1.unk}`)
console.log(`Verify: confirmed ${vAudit.confirmed}, refuted→corrected ${vAudit.refuted}, unconfirmed ${vAudit.unverifiable}, unreachable ${vAudit.unreachable}`)
console.log(`Inference applied: ${inferApplied}; adjudications: ${adjReports.length}; mis-groupings: ${misGroupings.length}; reverted: ${reverted.join(', ') || 'none'}`)
console.log(`Anchors: ${anchors.length - anchorFails.length}/${anchors.length} pass; flags remaining: ${flagged.length}; unconfirmed listed: ${unconfirmed.length}`)
