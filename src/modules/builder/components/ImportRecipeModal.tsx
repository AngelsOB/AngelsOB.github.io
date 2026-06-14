"use client";

/**
 * Import-a-recipe modal (combined).
 *
 * One modal, two tabs:
 *  • "Paste recipe" — the deterministic text parser runs on every keystroke
 *    and shows a live "parsed N grains · M hops" summary plus any lines it
 *    couldn't place. "Clean up with AI" sends the text to /api/parse-recipe
 *    (Haiku, guarded server-side) and swaps in its draft. Continue converts
 *    the draft through textRecipeImportService into the same
 *    { recipe, pendingMatches } shape BeerXML import produces.
 *  • "BeerXML file" — drop or pick a .xml; the file's text is handed back for
 *    parsing.
 *
 * The modal only collects input — the caller (ImportRecipeFlow) drives the
 * review sheet + commit for both paths.
 */

import { useMemo, useRef, useState } from "react";

import { hsTokens } from "../tokens";
import HSButton from "./HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./modals/HSModal";

import {
  parseRecipeText,
  sanitizeDraft,
  type ParsedRecipeDraft,
} from "@/modules/recipe/services/recipeTextParser";
import { textRecipeImportService } from "@/modules/recipe/services/textRecipeImportService";
import type { BeerXmlImportResult } from "@/modules/recipe/services/BeerXmlImportService";
import { auth } from "@/config/firebase";
import { toast } from "@/stores/toastStore";

const AI_MAX_CHARS = 4000; // mirrors the server cap in app/api/parse-recipe

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Paste path: the parsed result (+ the stated OG when the text carried one,
   * for the review sheet's comparison strip). The caller drives review + commit.
   */
  onPasteContinue: (result: BeerXmlImportResult, targetOg?: number) => void;
  /** BeerXML path: the raw text of the chosen file. The caller parses + commits. */
  onBeerXmlText: (text: string) => void;
}

type Tab = "paste" | "beerxml";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function ImportRecipeModal({
  isOpen,
  onClose,
  onPasteContinue,
  onBeerXmlText,
}: Props) {
  const [tab, setTab] = useState<Tab>("paste");

  // ── Paste tab state ──────────────────────────────────────────────────
  const [text, setText] = useState("");
  // AI result, when the user opted in. Cleared on any edit — it's a snapshot
  // of the text it was generated from.
  const [aiDraft, setAiDraft] = useState<ParsedRecipeDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const draft = useMemo<ParsedRecipeDraft>(
    () => aiDraft ?? parseRecipeText(text),
    [aiDraft, text],
  );

  const ingredientCount = draft.fermentables.length + draft.hops.length + draft.yeasts.length;

  const handleTextChange = (value: string) => {
    setText(value);
    setAiDraft(null);
  };

  const handleAiCleanup = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("Sign in to use AI cleanup");
      return;
    }
    setAiLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/parse-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? "AI cleanup failed");
        return;
      }
      setAiDraft(sanitizeDraft(body.draft));
    } catch {
      toast.error("AI cleanup failed — check your connection");
    } finally {
      setAiLoading(false);
    }
  };

  const handlePasteContinue = () => {
    const result = textRecipeImportService.fromDraft(draft);
    setText("");
    setAiDraft(null);
    onPasteContinue(result, draft.targetOg);
  };

  // ── BeerXML tab state ────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const fileText = typeof reader.result === "string" ? reader.result : "";
      onBeerXmlText(fileText);
    };
    reader.readAsText(file);
  };

  const summaryParts: string[] = [];
  if (draft.fermentables.length) summaryParts.push(plural(draft.fermentables.length, "grain"));
  if (draft.hops.length) summaryParts.push(plural(draft.hops.length, "hop addition"));
  if (draft.yeasts.length) summaryParts.push(plural(draft.yeasts.length, "yeast"));
  if (draft.batchVolumeL) summaryParts.push(`${draft.batchVolumeL} L batch`);
  if (draft.targetOg) summaryParts.push(`OG ${draft.targetOg.toFixed(3)}`);
  if (draft.mashSteps?.length) {
    summaryParts.push(
      draft.mashSteps.length === 1
        ? `mash ${draft.mashSteps[0].temperatureC}°C × ${draft.mashSteps[0].durationMinutes ?? 60}`
        : `${draft.mashSteps.length}-step mash`,
    );
  }
  if (draft.fermentTempC) summaryParts.push(`ferment ${draft.fermentTempC}°C`);
  if (draft.efficiencyPercent) summaryParts.push(`eff ${draft.efficiencyPercent}%`);

  const overAiLimit = text.length > AI_MAX_CHARS;

  const tabButton = (id: Tab, label: string) => {
    const active = tab === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setTab(id)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          margin: 0,
          padding: "8px 16px",
          background: active ? hsTokens.ink : "transparent",
          color: active ? hsTokens.paper : hsTokens.muted,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 999,
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.01em",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <HSModal isOpen={isOpen} onClose={onClose} size="xl" accent={hsTokens.malt}>
      <HSModalHeader
        kicker="bring a recipe in —"
        title="Import a recipe"
        onClose={onClose}
      />
      <HSModalBody>
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {tabButton("paste", "Paste recipe")}
          {tabButton("beerxml", "BeerXML file")}
        </div>

        {tab === "paste" ? (
          <>
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={
                "11 lb 2-row\n1 lb Crystal 40\n1 oz Magnum @60\n2 oz Citra dry hop 3 days\nWyeast 1056…"
              }
              data-autofocus
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: 220,
                resize: "vertical",
                padding: "12px 14px",
                background: hsTokens.cream,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 10,
                fontFamily: hsTokens.mono,
                fontSize: 13,
                lineHeight: 1.55,
                color: hsTokens.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {text.trim() ? (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: hsTokens.script,
                  fontSize: 19,
                  color: ingredientCount > 0 ? hsTokens.hops : hsTokens.muted,
                  transform: "rotate(-1.5deg)",
                  transformOrigin: "left center",
                }}
              >
                {ingredientCount > 0
                  ? `parsed ${summaryParts.join(" · ")}${aiDraft ? " (AI cleaned)" : ""}`
                  : "nothing parsed yet — keep pasting"}
              </div>
            ) : null}

            {draft.unparsedLines.length > 0 ? (
              <div
                style={{
                  marginTop: 12,
                  border: `1.5px dashed ${hsTokens.ink}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: hsTokens.cream2,
                }}
              >
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                    marginBottom: 6,
                  }}
                >
                  {plural(draft.unparsedLines.length, "line")} didn&rsquo;t parse
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {draft.unparsedLines.slice(0, 6).map((line, i) => (
                    <li
                      key={i}
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 12,
                        color: hsTokens.ink,
                        lineHeight: 1.6,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {line}
                    </li>
                  ))}
                  {draft.unparsedLines.length > 6 ? (
                    <li style={{ fontFamily: hsTokens.body, fontSize: 12, color: hsTokens.muted }}>
                      …and {draft.unparsedLines.length - 6} more
                    </li>
                  ) : null}
                </ul>
                <p style={{ fontFamily: hsTokens.body, fontSize: 12, color: hsTokens.muted, margin: "8px 0 0" }}>
                  Fix them in the text above, or let AI sort the whole paste into ingredients.
                </p>
              </div>
            ) : null}

            {text.trim() ? (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <HSButton
                  variant="solid"
                  color={hsTokens.water}
                  size="sm"
                  onClick={handleAiCleanup}
                  disabled={aiLoading || overAiLimit || !!aiDraft}
                >
                  {aiLoading ? "Cleaning up…" : aiDraft ? "Cleaned up ✓" : "Clean up with AI"}
                </HSButton>
                <span style={{ fontFamily: hsTokens.body, fontSize: 12, color: overAiLimit ? hsTokens.roast : hsTokens.muted }}>
                  {overAiLimit
                    ? `Too long for AI cleanup (${text.length.toLocaleString()}/${AI_MAX_CHARS.toLocaleString()} characters)`
                    : "Optional — reads the paste and sorts it into ingredients. A few uses per day."}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readFile(file);
            }}
            style={{
              border: `2px dashed ${dragOver ? hsTokens.hops : hsTokens.ink}`,
              borderRadius: 12,
              padding: "40px 24px",
              background: dragOver ? hsTokens.cream2 : hsTokens.cream,
              textAlign: "center",
              transition: "background 140ms ease, border-color 140ms ease",
            }}
          >
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 24,
                letterSpacing: "-0.03em",
                color: hsTokens.ink,
                marginBottom: 6,
              }}
            >
              Drop a BeerXML file
            </div>
            <p style={{ fontFamily: hsTokens.body, fontSize: 13, color: hsTokens.muted, margin: "0 0 16px" }}>
              Exported from Brewfather, BeerSmith, Brewer&rsquo;s Friend, and most other tools.
            </p>
            <HSButton variant="ink" color={hsTokens.malt} onClick={() => fileInputRef.current?.click()}>
              Choose a .xml file
            </HSButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,text/xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>
        )}
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton variant="ghost" onClick={onClose}>
          Cancel
        </HSButton>
        {tab === "paste" ? (
          <HSButton
            variant="ink"
            color={hsTokens.malt}
            arrow
            onClick={handlePasteContinue}
            disabled={ingredientCount === 0}
          >
            Continue
          </HSButton>
        ) : null}
      </HSModalFooter>
    </HSModal>
  );
}
