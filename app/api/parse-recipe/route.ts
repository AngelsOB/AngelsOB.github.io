import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb, adminAuth } from '@/config/firebase-admin';

/**
 * Guarded AI cleanup for the paste-a-recipe importer.
 *
 * POST { text } → ParsedRecipeDraft (same shape the deterministic parser
 * emits — see src/modules/recipe/services/recipeTextParser.ts). Only called
 * on an explicit "Clean up with AI" click; the deterministic parser handles
 * the structured common case for free.
 *
 * Guards: signed-in users only, 4,000-char input cap, per-user daily call
 * limit via a Firestore counter. ~$0.003/call on claude-haiku-4-5.
 */

const MODEL = 'claude-haiku-4-5';
const MAX_TEXT_LENGTH = 4000;
const DAILY_LIMIT = 10;

// Keep in sync with ParsedRecipeDraft. Every value the text doesn't state is
// null — the client runs the result through sanitizeDraft() before use, and
// the human review modal remains the final gate.
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'style',
    'batchVolumeL',
    'boilTimeMin',
    'targetOg',
    'targetFg',
    'efficiencyPercent',
    'mashSteps',
    'fermentTempC',
    'fermentDays',
    'fermentables',
    'hops',
    'yeasts',
    'unparsedLines',
  ],
  properties: {
    name: { type: ['string', 'null'], description: 'Recipe name if stated' },
    style: { type: ['string', 'null'], description: 'Beer style as written, e.g. "American IPA"' },
    batchVolumeL: { type: ['number', 'null'], description: 'Batch volume in LITERS' },
    boilTimeMin: { type: ['number', 'null'], description: 'Boil time in minutes' },
    targetOg: { type: ['number', 'null'], description: 'Original gravity, e.g. 1.064' },
    targetFg: { type: ['number', 'null'], description: 'Final gravity, e.g. 1.012' },
    efficiencyPercent: {
      type: ['number', 'null'],
      description: 'Stated brewhouse/mash efficiency percentage',
    },
    mashSteps: {
      type: 'array',
      description: 'Mash rests in order (single infusion = one entry)',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['temperatureC', 'durationMinutes'],
        properties: {
          temperatureC: { type: 'number', description: 'Rest temperature in °C' },
          durationMinutes: { type: ['number', 'null'] },
        },
      },
    },
    fermentTempC: { type: ['number', 'null'], description: 'Fermentation temperature in °C' },
    fermentDays: { type: ['number', 'null'], description: 'Primary fermentation length in days' },
    fermentables: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rawName', 'weightKg', 'relativePct'],
        properties: {
          rawName: {
            type: 'string',
            description: 'Grain/fermentable name as written, keep color numbers ("Crystal 60")',
          },
          weightKg: { type: ['number', 'null'], description: 'Weight in KILOGRAMS' },
          relativePct: {
            type: ['number', 'null'],
            description: 'Percent of grist when the recipe gives percentages instead of weights',
          },
        },
      },
    },
    hops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rawName', 'grams', 'type', 'timeMinutes', 'dryHopDays', 'alphaAcid'],
        properties: {
          rawName: { type: 'string', description: 'Hop variety name only' },
          grams: { type: ['number', 'null'], description: 'Amount in GRAMS' },
          type: {
            type: 'string',
            enum: ['boil', 'whirlpool', 'dry hop', 'first wort', 'mash'],
            description: 'whirlpool covers flameout/hopstand/steep; default to boil',
          },
          timeMinutes: {
            type: ['number', 'null'],
            description: 'Boil minutes for boil/first wort, stand minutes for whirlpool; null for dry hop',
          },
          dryHopDays: { type: ['number', 'null'] },
          alphaAcid: {
            type: ['number', 'null'],
            description: 'Alpha acid % ONLY if stated for this hop',
          },
        },
      },
    },
    yeasts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rawName', 'laboratory'],
        properties: {
          rawName: { type: 'string', description: 'Strain name/code as written' },
          laboratory: {
            type: ['string', 'null'],
            description: 'Wyeast, White Labs, Fermentis, Lallemand, Omega Yeast, Imperial Yeast, Escarpment Labs, Verdant…',
          },
        },
      },
    },
    unparsedLines: {
      type: 'array',
      items: { type: 'string' },
      description: 'Lines with recipe-relevant info you could not classify',
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract homebrew recipe data from free-form text (books, forum posts, handwritten notes).

Rules:
- Only extract what is written. NEVER invent ingredients, amounts, times, or numbers that are not in the text. If a value is not stated, use null.
- Convert units: pounds → kilograms (×0.45359), ounces → grams (×28.35), gallons → liters (×3.78541). Values already metric stay as-is.
- Grain bills given as percentages: fill relativePct, leave weightKg null.
- Keep ingredient names as written (including color numbers like "Crystal 60"), but strip amounts, timings, and packaging ("1 pack of").
- Hop "type": timed boil additions → "boil"; flameout/whirlpool/hopstand/steep → "whirlpool"; dry hop → "dry hop"; FWH/first wort → "first wort"; mash hops → "mash".
- From directions prose, extract: mash rests (°C — prefer the stated °C, else convert °F) with durations → mashSteps (step mashes produce multiple entries, in order); fermentation temperature → fermentTempC and primary duration in days → fermentDays; stated efficiency → efficiencyPercent. Strike/sparge/total water volumes are deliberately NOT extracted. Everything else in directions (packaging, priming, water chemistry) is ignored — do not put it in unparsedLines.
- Use unparsedLines only for lines that look like ingredients or vitals you could not classify.
- A recipe title (if present) goes in name. A style ("American IPA", "21A") goes in style.`;

async function consumeDailyQuota(uid: string): Promise<boolean> {
  const ref = adminDb.collection('aiParseQuotas').doc(uid);
  const today = new Date().toISOString().slice(0, 10);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const count = data?.date === today ? ((data.count as number) ?? 0) : 0;
    if (count >= DAILY_LIMIT) return false;
    tx.set(ref, { date: today, count: count + 1 });
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    // Auth — same pattern as app/api/recipes/delete.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI cleanup is not configured' }, { status: 503 });
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_TEXT_LENGTH.toLocaleString()} characters)` },
        { status: 400 },
      );
    }

    if (!(await consumeDailyQuota(uid))) {
      return NextResponse.json(
        { error: `Daily AI cleanup limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` },
        { status: 429 },
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
      output_config: { format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'The AI declined to process this text' }, { status: 422 });
    }

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') {
      return NextResponse.json({ error: 'AI returned no usable output' }, { status: 502 });
    }

    // Schema-constrained, but stop_reason max_tokens can truncate — JSON.parse
    // failing lands in the catch below.
    const draft = JSON.parse(block.text);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('[API] parse-recipe Anthropic error:', err.status, err.message);
      return NextResponse.json({ error: 'AI cleanup failed — try again shortly' }, { status: 502 });
    }
    console.error('[API] parse-recipe error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
