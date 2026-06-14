'use client';

/**
 * Review Import Matches Modal
 *
 * BeerXML imports: shown only when ingredients/style couldn't be auto-matched
 * to a high-confidence preset — pick from ranked candidates or keep the
 * imported name.
 *
 * Text imports (`recipe` + `vitals` props present): a full confirmation
 * sheet. Every ingredient row appears with editable amounts and a remove
 * button, the title is editable, process vitals are editable, and a live
 * calculated stat strip (vs the stated OG when the paste carried one) makes
 * misses obvious. Confirm/deny/change, then import.
 */

import { useEffect, useMemo, useState } from 'react';

import HSModal, {
  HSModalBody,
  HSModalFooter,
  HSModalHeader,
} from '@/modules/builder/components/modals/HSModal';
import HSButton from '@/modules/builder/components/HSButton';
import { hsTokens } from '@/modules/builder/tokens';
import type {
  MatchResolution,
  PendingGrainMatch,
  PendingHopMatch,
  PendingMatch,
  PendingStyleMatch,
  PendingYeastMatch,
} from '@/modules/recipe/services/BeerXmlImportService';
import {
  textRecipeImportService,
  type ImportAmountEdits,
  type ImportSheetEdits,
  type ImportVitals,
} from '@/modules/recipe/services/textRecipeImportService';
import { recipeCalculationService } from '@/modules/recipe/services/RecipeCalculationService';
import type { Recipe, RecipeCalculations } from '@/modules/recipe/models/Recipe';

interface Props {
  isOpen: boolean;
  pendingMatches: PendingMatch[];
  /** Full parsed recipe — renders the confirmation sheet (text imports only). */
  recipe?: Recipe;
  /** Stated OG from the pasted text, for the live comparison strip. */
  targetOg?: number;
  /** Extracted process values for confirmation (text imports only). */
  vitals?: ImportVitals;
  onCancel: () => void;
  onConfirm: (
    resolutions: MatchResolution[],
    vitals?: ImportVitals,
    sheet?: ImportSheetEdits,
  ) => void;
}

// Selection key — one entry per pending match. Value is either a preset name
// (or canonical style code) the user picked, or '__keep__' meaning "leave
// the imported name in place".
const KEEP_ORIGINAL = '__keep__';

function selectionKey(match: PendingMatch): string {
  if (match.kind === 'style') return 'style';
  return `${match.kind}:${match.ingredientId}`;
}

function partition(matches: PendingMatch[]) {
  const style = matches.find((m): m is PendingStyleMatch => m.kind === 'style');
  const hops = matches.filter((m): m is PendingHopMatch => m.kind === 'hop');
  const grains = matches.filter((m): m is PendingGrainMatch => m.kind === 'grain');
  const yeasts = matches.filter((m): m is PendingYeastMatch => m.kind === 'yeast');
  return { style, hops, grains, yeasts };
}

export default function ReviewImportMatchesModal({
  isOpen,
  pendingMatches,
  recipe,
  targetOg,
  vitals,
  onCancel,
  onConfirm,
}: Props) {
  // Default each row to the best candidate (preselected). Recomputed
  // whenever the set of pending matches changes (i.e., a new import).
  const defaultSelections = useMemo(() => {
    const next: Record<string, string> = {};
    for (const m of pendingMatches) {
      const key = selectionKey(m);
      if (m.kind === 'style') {
        next[key] = m.best?.preset.canonical ?? KEEP_ORIGINAL;
      } else {
        next[key] = m.best?.presetName ?? KEEP_ORIGINAL;
      }
    }
    return next;
  }, [pendingMatches]);

  const [selections, setSelections] = useState<Record<string, string>>(defaultSelections);

  // Reset selections when modal opens with new matches
  const [seenKey, setSeenKey] = useState<string>('');
  const currentKey = pendingMatches.map(selectionKey).join('|');
  if (isOpen && currentKey !== seenKey) {
    setSelections(defaultSelections);
    setSeenKey(currentKey);
  }

  const { style, hops, grains, yeasts } = useMemo(
    () => partition(pendingMatches),
    [pendingMatches]
  );

  // Editable copy of the extracted process values (text imports). Reset
  // whenever a new import hands in a fresh vitals object.
  const [editedVitals, setEditedVitals] = useState<ImportVitals | null>(vitals ?? null);
  useEffect(() => {
    setEditedVitals(vitals ?? null);
  }, [vitals]);

  // Confirmation-sheet state (text imports): editable title, per-ingredient
  // amounts, and denied rows. Reset per import.
  const [title, setTitle] = useState('');
  const [amountEdits, setAmountEdits] = useState<ImportAmountEdits>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  useEffect(() => {
    setTitle(recipe?.name ?? '');
    setRemovedIds([]);
    if (!recipe) {
      setAmountEdits({});
      return;
    }
    const init: ImportAmountEdits = {};
    for (const f of recipe.fermentables) {
      init[f.id] = { weightKg: Math.round(f.weightKg * 1000) / 1000 };
    }
    for (const h of recipe.hops) {
      init[h.id] = {
        grams: Math.round(h.grams * 10) / 10,
        ...(h.type === 'dry hop'
          ? { dryHopDays: h.dryHopDays ?? 3 }
          : { timeMinutes: (h.type === 'whirlpool' ? h.whirlpoolTimeMinutes : h.timeMinutes) ?? 0 }),
      };
    }
    setAmountEdits(init);
  }, [recipe]);

  const removed = useMemo(() => new Set(removedIds), [removedIds]);
  const pendingByIngredient = useMemo(() => {
    const map = new Map<string, PendingHopMatch | PendingGrainMatch | PendingYeastMatch>();
    for (const m of pendingMatches) {
      if (m.kind !== 'style') map.set(m.ingredientId, m);
    }
    return map;
  }, [pendingMatches]);

  const buildResolutions = (): MatchResolution[] =>
    pendingMatches.map((m): MatchResolution => {
      const key = selectionKey(m);
      const choice = selections[key];
      if (m.kind === 'style') {
        return {
          kind: 'style',
          canonical: choice && choice !== KEEP_ORIGINAL ? choice : undefined,
        };
      }
      return {
        kind: m.kind,
        ingredientId: m.ingredientId,
        presetName: choice && choice !== KEEP_ORIGINAL ? choice : undefined,
      };
    });

  const sheetEdits: ImportSheetEdits | undefined = recipe
    ? { name: title, amounts: amountEdits, removedIngredientIds: removedIds }
    : undefined;

  // Live calculated stats — exactly what would be imported with the current
  // selections/edits. Cheap (pure calc service, small recipes).
  const previewCalc = useMemo<RecipeCalculations | null>(() => {
    if (!recipe) return null;
    try {
      let r = textRecipeImportService.applyResolutions(recipe, buildResolutions());
      if (sheetEdits) r = textRecipeImportService.applySheetEdits(r, sheetEdits);
      if (editedVitals) r = textRecipeImportService.applyVitals(r, editedVitals);
      return recipeCalculationService.calculate(r);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe, pendingMatches, selections, amountEdits, removedIds, title, editedVitals]);

  const handleConfirm = () => {
    onConfirm(buildResolutions(), editedVitals ?? undefined, sheetEdits);
  };

  const totalApplied = Object.values(selections).filter((v) => v && v !== KEEP_ORIGINAL).length;

  return (
    <HSModal
      isOpen={isOpen}
      onClose={onCancel}
      size="2xl"
      accent={hsTokens.honey}
      closeOnBackdropClick={false}
    >
      <HSModalHeader
        kicker="check this —"
        title="Match imported items to your library"
        onClose={onCancel}
      />
      <HSModalBody style={{ padding: '18px 22px' }}>
        <p
          style={{
            margin: '0 0 16px',
            fontFamily: hsTokens.body,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: hsTokens.ink,
          }}
        >
          {recipe
            ? 'Everything we read from the paste — names, amounts, and process. Fix anything that’s off, remove what doesn’t belong, then import.'
            : 'A few items couldn’t be confidently matched to your ingredient/style database. Pick the right one (or keep the imported name) so flavor profiles, strain info, and BJCP targets all line up.'}
        </p>

        {recipe ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: hsTokens.muted,
              }}
            >
              Name
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recipe name"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 12px',
                fontFamily: hsTokens.body,
                fontWeight: 600,
                fontSize: 14,
                color: hsTokens.ink,
                background: hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 6,
                outline: 'none',
              }}
            />
          </div>
        ) : null}

        {previewCalc ? <StatStrip calc={previewCalc} targetOg={targetOg} /> : null}

        {style ? (
          <SectionBlock
            label="BJCP Style"
            accent={hsTokens.ink}
            rows={[
              <StyleRow
                key="style"
                match={style}
                selection={selections[selectionKey(style)] ?? KEEP_ORIGINAL}
                onChange={(value) =>
                  setSelections((s) => ({ ...s, [selectionKey(style)]: value }))
                }
              />,
            ]}
          />
        ) : null}

        {recipe ? (
          <>
            {recipe.fermentables.filter((f) => !removed.has(f.id)).length > 0 ? (
              <SectionBlock
                label={`Fermentables · ${recipe.fermentables.filter((f) => !removed.has(f.id)).length}`}
                accent={hsTokens.malt}
                rows={recipe.fermentables
                  .filter((f) => !removed.has(f.id))
                  .map((f) => {
                    const pending = pendingByIngredient.get(f.id);
                    return (
                      <SheetRow
                        key={f.id}
                        name={f.name}
                        pending={pending}
                        selection={pending ? selections[`grain:${f.id}`] ?? KEEP_ORIGINAL : undefined}
                        onSelect={
                          pending
                            ? (v) => setSelections((s) => ({ ...s, [`grain:${f.id}`]: v }))
                            : undefined
                        }
                        fields={
                          <VitalField
                            suffix="kg"
                            value={amountEdits[f.id]?.weightKg ?? 0}
                            onChange={(v) =>
                              setAmountEdits((a) => ({ ...a, [f.id]: { ...a[f.id], weightKg: v } }))
                            }
                          />
                        }
                        onRemove={() => setRemovedIds((ids) => [...ids, f.id])}
                      />
                    );
                  })}
              />
            ) : null}

            {recipe.hops.filter((h) => !removed.has(h.id)).length > 0 ? (
              <SectionBlock
                label={`Hops · ${recipe.hops.filter((h) => !removed.has(h.id)).length}`}
                accent={hsTokens.hops}
                rows={recipe.hops
                  .filter((h) => !removed.has(h.id))
                  .map((h) => {
                    const pending = pendingByIngredient.get(h.id);
                    return (
                      <SheetRow
                        key={h.id}
                        name={h.name}
                        sub={h.type}
                        pending={pending}
                        selection={pending ? selections[`hop:${h.id}`] ?? KEEP_ORIGINAL : undefined}
                        onSelect={
                          pending
                            ? (v) => setSelections((s) => ({ ...s, [`hop:${h.id}`]: v }))
                            : undefined
                        }
                        fields={
                          <>
                            <VitalField
                              suffix="g"
                              value={amountEdits[h.id]?.grams ?? 0}
                              onChange={(v) =>
                                setAmountEdits((a) => ({ ...a, [h.id]: { ...a[h.id], grams: v } }))
                              }
                            />
                            {h.type === 'dry hop' ? (
                              <VitalField
                                suffix="days"
                                value={amountEdits[h.id]?.dryHopDays ?? 0}
                                onChange={(v) =>
                                  setAmountEdits((a) => ({
                                    ...a,
                                    [h.id]: { ...a[h.id], dryHopDays: v },
                                  }))
                                }
                              />
                            ) : (
                              <VitalField
                                suffix="min"
                                value={amountEdits[h.id]?.timeMinutes ?? 0}
                                onChange={(v) =>
                                  setAmountEdits((a) => ({
                                    ...a,
                                    [h.id]: { ...a[h.id], timeMinutes: v },
                                  }))
                                }
                              />
                            )}
                          </>
                        }
                        onRemove={() => setRemovedIds((ids) => [...ids, h.id])}
                      />
                    );
                  })}
              />
            ) : null}

            {recipe.yeasts.filter((y) => !removed.has(y.id)).length > 0 ? (
              <SectionBlock
                label={`Yeast · ${recipe.yeasts.filter((y) => !removed.has(y.id)).length}`}
                accent={hsTokens.yeast}
                rows={recipe.yeasts
                  .filter((y) => !removed.has(y.id))
                  .map((y) => {
                    const pending = pendingByIngredient.get(y.id);
                    return (
                      <SheetRow
                        key={y.id}
                        name={y.name}
                        sub={y.laboratory}
                        pending={pending}
                        selection={pending ? selections[`yeast:${y.id}`] ?? KEEP_ORIGINAL : undefined}
                        onSelect={
                          pending
                            ? (v) => setSelections((s) => ({ ...s, [`yeast:${y.id}`]: v }))
                            : undefined
                        }
                        onRemove={() => setRemovedIds((ids) => [...ids, y.id])}
                      />
                    );
                  })}
              />
            ) : null}
          </>
        ) : (
          <>
            {hops.length > 0 ? (
              <SectionBlock
                label={`Hops · ${hops.length}`}
                accent={hsTokens.hops}
                rows={hops.map((m) => (
                  <IngredientRow
                    key={selectionKey(m)}
                    imported={m.imported}
                    reason={m.reason}
                    options={m.candidates.map((c) => ({
                      value: c.presetName,
                      label: c.presetName,
                      score: c.score,
                    }))}
                    selection={selections[selectionKey(m)] ?? KEEP_ORIGINAL}
                    onChange={(value) =>
                      setSelections((s) => ({ ...s, [selectionKey(m)]: value }))
                    }
                  />
                ))}
              />
            ) : null}

            {grains.length > 0 ? (
              <SectionBlock
                label={`Fermentables · ${grains.length}`}
                accent={hsTokens.malt}
                rows={grains.map((m) => (
                  <IngredientRow
                    key={selectionKey(m)}
                    imported={m.imported}
                    reason={m.reason}
                    options={m.candidates.map((c) => ({
                      value: c.presetName,
                      label: c.presetName,
                      score: c.score,
                    }))}
                    selection={selections[selectionKey(m)] ?? KEEP_ORIGINAL}
                    onChange={(value) =>
                      setSelections((s) => ({ ...s, [selectionKey(m)]: value }))
                    }
                  />
                ))}
              />
            ) : null}

            {yeasts.length > 0 ? (
              <SectionBlock
                label={`Yeast · ${yeasts.length}`}
                accent={hsTokens.yeast}
                rows={yeasts.map((m) => (
                  <IngredientRow
                    key={selectionKey(m)}
                    imported={m.imported}
                    reason={m.reason}
                    options={m.candidates.map((c) => ({
                      value: c.presetName,
                      label: c.presetName,
                      score: c.score,
                    }))}
                    selection={selections[selectionKey(m)] ?? KEEP_ORIGINAL}
                    onChange={(value) =>
                      setSelections((s) => ({ ...s, [selectionKey(m)]: value }))
                    }
                  />
                ))}
              />
            ) : null}
          </>
        )}

        {editedVitals ? (
          <VitalsSection vitals={editedVitals} onChange={setEditedVitals} />
        ) : null}
      </HSModalBody>
      <HSModalFooter align="between">
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12.5,
            color: hsTokens.muted,
          }}
        >
          {pendingMatches.length > 0
            ? `${totalApplied} of ${pendingMatches.length} will be matched`
            : 'All ingredients matched'}
        </span>
        <span style={{ display: 'inline-flex', gap: 12 }}>
          <HSButton variant="ghost" size="sm" onClick={onCancel}>
            Cancel import
          </HSButton>
          <HSButton variant="solid" color={hsTokens.hops} size="sm" onClick={handleConfirm}>
            Import recipe
          </HSButton>
        </span>
      </HSModalFooter>
    </HSModal>
  );
}

// ============================================================
// Section block (shared shell for each ingredient/style group)
// ============================================================

interface SectionBlockProps {
  label: string;
  accent: string;
  rows: React.ReactNode[];
}

function SectionBlock({ label, accent, rows }: SectionBlockProps) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h4
        style={{
          margin: '0 0 8px',
          fontFamily: hsTokens.display,
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: hsTokens.ink,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: accent,
            border: `1.5px solid ${hsTokens.ink}`,
          }}
        />
        {label}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{rows}</div>
    </section>
  );
}

// ============================================================
// Ingredient row — imported name + dropdown to choose preset
// ============================================================

interface IngredientRowProps {
  imported: string;
  reason?: string;
  options: Array<{ value: string; label: string; score: number }>;
  selection: string;
  onChange: (value: string) => void;
}

function IngredientRow({ imported, reason, options, selection, onChange }: IngredientRowProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
        gap: 12,
        alignItems: 'center',
        padding: '10px 12px',
        background: hsTokens.cream,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 6,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13.5,
            fontWeight: 600,
            color: hsTokens.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={imported}
        >
          {imported}
        </div>
        {reason ? (
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11.5,
              color: hsTokens.muted,
              marginTop: 2,
            }}
          >
            {reason}
          </div>
        ) : null}
      </div>
      <MatchSelect options={options} selection={selection} onChange={onChange} />
    </div>
  );
}

interface MatchSelectProps {
  options: Array<{ value: string; label: string; score: number }>;
  selection: string;
  onChange: (value: string) => void;
}

function MatchSelect({ options, selection, onChange }: MatchSelectProps) {
  return (
    <select
      value={selection}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '7px 10px',
        fontFamily: hsTokens.body,
        fontSize: 13,
        color: hsTokens.ink,
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label} ({(opt.score * 100).toFixed(0)}%)
        </option>
      ))}
      <option value={KEEP_ORIGINAL}>Keep as-is — no preset</option>
    </select>
  );
}

// ============================================================
// Confirmation sheet (text imports) — full ingredient rows
// ============================================================

function RemoveDot({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        background: 'transparent',
        border: `1.5px solid ${hsTokens.ink}`,
        color: hsTokens.ink,
        cursor: 'pointer',
        fontFamily: hsTokens.body,
        fontSize: 13,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      ×
    </button>
  );
}

interface SheetRowProps {
  name: string;
  /** Muted secondary line: hop type, yeast lab. */
  sub?: string;
  pending?: PendingHopMatch | PendingGrainMatch | PendingYeastMatch;
  selection?: string;
  onSelect?: (value: string) => void;
  fields?: React.ReactNode;
  onRemove: () => void;
}

function SheetRow({ name, sub, pending, selection, onSelect, fields, onRemove }: SheetRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: hsTokens.cream,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 6,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {pending && selection !== undefined && onSelect ? (
          <>
            <MatchSelect
              options={pending.candidates.map((c) => ({
                value: c.presetName,
                label: c.presetName,
                score: c.score,
              }))}
              selection={selection}
              onChange={onSelect}
            />
            <div
              style={{ fontFamily: hsTokens.body, fontSize: 11.5, color: hsTokens.muted, marginTop: 3 }}
            >
              pasted: {pending.imported}
            </div>
          </>
        ) : (
          <div
            title={name}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 13.5,
              fontWeight: 600,
              color: hsTokens.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
        )}
        {sub ? (
          <div style={{ fontFamily: hsTokens.body, fontSize: 11.5, color: hsTokens.muted, marginTop: 2 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {fields ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {fields}
        </div>
      ) : null}
      <RemoveDot onClick={onRemove} label={`Remove ${name}`} />
    </div>
  );
}

function StatStrip({ calc, targetOg }: { calc: RecipeCalculations; targetOg?: number }) {
  const ogOff = targetOg !== undefined && Math.abs(calc.og - targetOg) > 0.004;
  const item = (label: string, value: string, warn = false) => (
    <span
      key={label}
      style={{
        fontFamily: hsTokens.mono,
        fontSize: 12.5,
        color: warn ? hsTokens.roast : hsTokens.ink,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: hsTokens.muted }}>{label} </span>
      {value}
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        padding: '10px 14px',
        marginBottom: 16,
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 8,
      }}
    >
      {item(
        'OG',
        calc.og.toFixed(3) + (targetOg !== undefined ? ` (stated ${targetOg.toFixed(3)})` : ''),
        ogOff,
      )}
      {item('FG', calc.fg.toFixed(3))}
      {item('ABV', `${calc.abv.toFixed(1)}%`)}
      {item('IBU', `${Math.round(calc.ibu)}`)}
      {item('SRM', `${Math.round(calc.srm)}`)}
    </div>
  );
}

// ============================================================
// Process & vitals — editable extracted values (text imports)
// ============================================================

interface VitalsSectionProps {
  vitals: ImportVitals;
  onChange: (next: ImportVitals) => void;
}

function VitalsSection({ vitals, onChange }: VitalsSectionProps) {
  const set = (patch: Partial<ImportVitals>) => onChange({ ...vitals, ...patch });
  const setStep = (i: number, patch: Partial<ImportVitals['mashSteps'][number]>) =>
    set({ mashSteps: vitals.mashSteps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <SectionBlock
      label="Process & vitals"
      accent={hsTokens.water}
      rows={[
        <div
          key="vitals"
          style={{
            padding: '12px 12px',
            background: hsTokens.cream,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <VitalField
              label="Batch"
              suffix="L"
              value={vitals.batchVolumeL}
              onChange={(v) => set({ batchVolumeL: v })}
            />
            <VitalField
              label="Boil"
              suffix="min"
              value={vitals.boilTimeMin}
              onChange={(v) => set({ boilTimeMin: v })}
            />
            <VitalField
              label="Efficiency"
              suffix="%"
              value={vitals.efficiencyPercent}
              onChange={(v) => set({ efficiencyPercent: v })}
            />
            <VitalField
              label="Ferment"
              suffix="°C"
              value={vitals.fermentTempC}
              onChange={(v) => set({ fermentTempC: v })}
            />
            <VitalField
              label="Primary"
              suffix="days"
              value={vitals.fermentDays}
              onChange={(v) => set({ fermentDays: v })}
            />
          </div>

          <div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: hsTokens.muted,
                marginBottom: 6,
              }}
            >
              Mash schedule
            </div>
            {vitals.mashSteps.length === 0 ? (
              <div style={{ fontFamily: hsTokens.body, fontSize: 12.5, color: hsTokens.muted }}>
                Nothing found in the text — add a rest, or set it up later in the builder.
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vitals.mashSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <VitalField
                    label={vitals.mashSteps.length === 1 ? 'Rest' : `Rest ${i + 1}`}
                    suffix="°C"
                    value={step.temperatureC}
                    onChange={(v) => setStep(i, { temperatureC: v })}
                  />
                  <VitalField
                    label="for"
                    suffix="min"
                    value={step.durationMinutes}
                    onChange={(v) => setStep(i, { durationMinutes: v })}
                  />
                  <button
                    type="button"
                    aria-label={`Remove mash step ${i + 1}`}
                    onClick={() =>
                      set({ mashSteps: vitals.mashSteps.filter((_, j) => j !== i) })
                    }
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: 'transparent',
                      border: `1.5px solid ${hsTokens.ink}`,
                      color: hsTokens.ink,
                      cursor: 'pointer',
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {vitals.mashSteps.length < 4 ? (
              <button
                type="button"
                onClick={() =>
                  set({
                    mashSteps: [...vitals.mashSteps, { temperatureC: 66, durationMinutes: 60 }],
                  })
                }
                style={{
                  marginTop: 8,
                  padding: '4px 10px',
                  background: 'transparent',
                  border: `1.5px dashed ${hsTokens.ink}`,
                  borderRadius: 999,
                  color: hsTokens.ink,
                  cursor: 'pointer',
                  fontFamily: hsTokens.body,
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                + add rest
              </button>
            ) : null}
          </div>
        </div>,
      ]}
    />
  );
}

interface VitalFieldProps {
  label?: string;
  suffix: string;
  value: number;
  onChange: (value: number) => void;
}

function VitalField({ label, suffix, value, onChange }: VitalFieldProps) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: hsTokens.body,
        fontSize: 12.5,
        color: hsTokens.ink,
      }}
    >
      {label ? <span style={{ fontWeight: 600 }}>{label}</span> : null}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Number.isFinite(v) ? v : 0);
        }}
        style={{
          width: 64,
          padding: '5px 8px',
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.ink,
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 6,
        }}
      />
      <span style={{ color: hsTokens.muted }}>{suffix}</span>
    </label>
  );
}

// ============================================================
// Style row (separate because it carries the canonical "21A. American IPA")
// ============================================================

interface StyleRowProps {
  match: PendingStyleMatch;
  selection: string;
  onChange: (value: string) => void;
}

function StyleRow({ match, selection, onChange }: StyleRowProps) {
  const options = match.candidates.map((c) => ({
    value: c.preset.canonical,
    label: c.preset.canonical,
    score: c.score,
  }));
  return (
    <IngredientRow
      imported={match.imported}
      reason={match.reason}
      options={options}
      selection={selection}
      onChange={onChange}
    />
  );
}
