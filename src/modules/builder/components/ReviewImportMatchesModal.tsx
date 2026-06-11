'use client';

/**
 * Review Import Matches Modal
 *
 * Shown after a BeerXML import when one or more ingredients (or the BJCP
 * style) couldn't be auto-matched to a high-confidence preset. Lets the
 * brewer pick from ranked candidates or keep the imported name as-is.
 *
 * Confirm emits a MatchResolution[] back to the import committer in
 * BeerXmlImportService.applyResolutions(); cancel aborts the import.
 */

import { useMemo, useState } from 'react';

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

interface Props {
  isOpen: boolean;
  pendingMatches: PendingMatch[];
  onCancel: () => void;
  onConfirm: (resolutions: MatchResolution[]) => void;
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

  const handleConfirm = () => {
    const resolutions: MatchResolution[] = pendingMatches.map((m): MatchResolution => {
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
    onConfirm(resolutions);
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
          A few items couldn&apos;t be confidently matched to your ingredient/style
          database. Pick the right one (or keep the imported name) so flavor
          profiles, strain info, and BJCP targets all line up.
        </p>

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
      </HSModalBody>
      <HSModalFooter align="between">
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12.5,
            color: hsTokens.muted,
          }}
        >
          {totalApplied} of {pendingMatches.length} will be matched
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
    </div>
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
