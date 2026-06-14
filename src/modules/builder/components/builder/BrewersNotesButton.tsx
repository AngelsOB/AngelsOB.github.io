"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "framer-motion";

import { hsTokens } from "../../tokens";
import { dur, easeStandard, tweenFast, tweenStandard } from "../../motion";
import HSEyebrow from "../HSEyebrow";

interface Props {
  notes: string;
  tags: string[];
  onNotesChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
  readOnly?: boolean;
}

const PLACEHOLDER =
  "Last brew leaned a little thin — bump up the crystal next time…";

// A honey-forward mix for the sticky note — reads bright / post-it but still
// blends in cream-2 so it adapts in dark mode (solid honey would leave light
// ink text on a light note).
const STICKY_NOTE =
  "color-mix(in srgb, var(--hs-cream-2) 48%, var(--hs-honey))";

// Square-ish footprints, post-it style. The note morphs between them in place.
const COLLAPSED_W = 150;
const COLLAPSED_H = 130;
const EXPANDED_W = 340;
const EXPANDED_H = 340;

// Fluid, non-bouncy morph for the size/position change. Sourced from the
// shared motion tokens (dur.slow + easeStandard).
const MORPH = { duration: dur.slow, ease: easeStandard } as const;

/**
 * Recipe-level Brewer's notes as a sticky note in the recipe title band.
 *
 * Clicking it does NOT summon a separate popover — the note itself *morphs*:
 * a framer-motion `layout` element grows in place from the little square
 * sticky into the full editor (textarea + tags), and shrinks back on close.
 * A fixed-size placeholder holds the collapsed footprint so the title band
 * never reflows while the note is expanded. A dim backdrop catches
 * outside-clicks; Escape / scroll / resize also close it.
 */
export default function BrewersNotesButton({
  notes,
  tags,
  onNotesChange,
  onTagsChange,
  readOnly,
}: Props) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const noteRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const snippetRef = useRef<HTMLSpanElement>(null);

  // Draft state; refs hold the latest so close/commit can read without
  // re-binding listeners each keystroke.
  const [draftNotes, setDraftNotes] = useState(notes);
  const [draftTags, setDraftTags] = useState(tags.join(" "));
  const draftNotesRef = useRef(draftNotes);
  draftNotesRef.current = draftNotes;
  const draftTagsRef = useRef(draftTags);
  draftTagsRef.current = draftTags;

  const hasContent = !!notes || tags.length > 0;

  // Snapshot props into the drafts each time the note opens, then focus.
  useEffect(() => {
    if (!open) return;
    setDraftNotes(notes);
    setDraftTags(tags.join(" "));
    requestAnimationFrame(() => textareaRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-fit the collapsed preview: shrink the snippet font until the text
  // fits its box (down to a floor) so short notes show in full and only
  // genuinely long ones truncate — minimumScaleFactor-style.
  useLayoutEffect(() => {
    if (open) return;
    const el = snippetRef.current;
    if (!el) return;
    const MAX = 12.5;
    const MIN = 8.5;
    let size = MAX;
    el.style.fontSize = `${size}px`;
    let guard = 0;
    while (el.scrollHeight > el.clientHeight && size > MIN && guard < 24) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  }, [notes, tags, open]);

  function commitNotes() {
    const next = draftNotesRef.current.trim();
    if (next !== notes) onNotesChange(next);
  }
  function commitTags() {
    const next = draftTagsRef.current
      .split(/\s+/)
      .map((t) => t.replace(/^#+/, "").trim().toLowerCase())
      .filter(Boolean);
    if (next.join(" ") !== tags.join(" ")) onTagsChange(next);
  }
  function closeAndSave() {
    if (!readOnly) {
      commitNotes();
      commitTags();
    }
    setOpen(false);
  }

  // Close on Escape / scroll / resize while open (backdrop handles
  // outside-click). The note is anchored to the title band, so a page scroll
  // would otherwise drift it away from the fixed backdrop.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        noteRef.current?.focus();
      }
    }
    function onScroll(e: Event) {
      // Ignore scrolls that originate inside the note (e.g. the textarea
      // scrolling as you add lines) — only a page/ancestor scroll should
      // close, since the note is anchored to the title band.
      const t = e.target as Node | null;
      if (t && noteRef.current?.contains(t)) return;
      closeAndSave();
    }
    function onResize() {
      closeAndSave();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Read-only shared recipe with nothing to show → render nothing.
  if (readOnly && !hasContent) return null;

  const tagCount = tags.length;
  const snippet =
    notes ||
    (tagCount > 0 ? `${tagCount} tag${tagCount === 1 ? "" : "s"}` : "");

  return (
    <LazyMotion features={domMax} strict>
      <AnimatePresence>
        {open ? (
          <m.div
            key="backdrop"
            onClick={closeAndSave}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tweenStandard}
            style={{
              position: "fixed",
              inset: 0,
              background: "color-mix(in srgb, var(--hs-ink) 14%, transparent)",
              zIndex: 48,
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* Placeholder holds the collapsed footprint so the title band doesn't
          reflow while the note is expanded. */}
      <div style={{ position: "relative", width: COLLAPSED_W, height: COLLAPSED_H }}>
        <m.div
          ref={noteRef}
          layout
          transition={{ layout: reduced ? { duration: 0 } : MORPH }}
          animate={reduced ? undefined : { rotate: open ? 0 : -2.5 }}
          initial={false}
          role={open ? "dialog" : "button"}
          aria-label="Brewer's notes"
          tabIndex={open ? -1 : 0}
          onClick={open ? undefined : () => setOpen(true)}
          onKeyDown={
            open
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(true);
                  }
                }
          }
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: open ? EXPANDED_W : COLLAPSED_W,
            maxWidth: "calc(100vw - 32px)",
            height: open ? EXPANDED_H : COLLAPSED_H,
            background: STICKY_NOTE,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 3,
            boxShadow: hover || open ? hsTokens.sh4 : hsTokens.sh3,
            cursor: open ? "default" : "pointer",
            overflow: "hidden",
            zIndex: open ? 49 : 1,
          }}
        >
          <AnimatePresence initial={false}>
            {open ? (
              <m.div
                key="editor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: tweenFast }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { duration: dur.standard, ease: easeStandard, delay: 0.16 }
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 16,
                  boxSizing: "border-box",
                }}
              >
                <HSEyebrow>Brewer&apos;s notes</HSEyebrow>

                {readOnly ? (
                  <p
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      margin: 0,
                      fontFamily: hsTokens.script,
                      fontSize: 20,
                      lineHeight: 1.4,
                      color: notes ? hsTokens.ink : hsTokens.muted,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {notes || "No notes."}
                  </p>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    onBlur={commitNotes}
                    onKeyDown={(e) => {
                      // Enter inserts a newline (only ⌘/Ctrl-Enter saves).
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setOpen(false);
                        noteRef.current?.focus();
                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        closeAndSave();
                      }
                    }}
                    placeholder={PLACEHOLDER}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      width: "100%",
                      background: hsTokens.paper,
                      border: `1.5px solid ${hsTokens.malt}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontFamily: hsTokens.script,
                      fontSize: 20,
                      lineHeight: 1.4,
                      color: hsTokens.ink,
                      outline: "none",
                      resize: "none",
                      overflowY: "auto",
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {/* Tags row */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {readOnly ? (
                    tags.length > 0 ? (
                      tags.map((t) => <TagChip key={t} tag={t} />)
                    ) : null
                  ) : (
                    <input
                      type="text"
                      value={draftTags}
                      onChange={(e) => setDraftTags(e.target.value)}
                      onBlur={commitTags}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setOpen(false);
                          noteRef.current?.focus();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          commitTags();
                        }
                      }}
                      placeholder="#irish-red #malty"
                      aria-label="Tags"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: hsTokens.paper,
                        border: `1.5px solid ${hsTokens.malt}`,
                        borderRadius: 999,
                        padding: "6px 12px",
                        fontFamily: hsTokens.body,
                        fontSize: 12,
                        color: hsTokens.ink,
                        outline: "none",
                      }}
                    />
                  )}
                </div>
              </m.div>
            ) : (
              <m.div
                key="label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: tweenFast }}
                transition={
                  reduced ? { duration: 0 } : { ...tweenStandard, delay: 0.1 }
                }
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  padding: "12px 14px",
                  boxSizing: "border-box",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: hsTokens.script,
                    fontSize: 19,
                    lineHeight: 1.05,
                    color: hsTokens.ink,
                  }}
                >
                  Brewer&apos;s notes
                </span>
                {hasContent ? (
                  <span
                    ref={snippetRef}
                    style={{
                      flex: 1,
                      minHeight: 0,
                      width: "100%",
                      overflow: "hidden",
                      whiteSpace: "pre-line",
                      fontFamily: hsTokens.body,
                      // fontSize is owned by the auto-fit layout effect.
                      lineHeight: 1.3,
                      color: "color-mix(in srgb, var(--hs-ink) 68%, transparent)",
                      WebkitMaskImage:
                        "linear-gradient(to bottom, #000 84%, transparent)",
                      maskImage:
                        "linear-gradient(to bottom, #000 84%, transparent)",
                    }}
                  >
                    {snippet}
                    {notes && tagCount > 0
                      ? `  ·  ${tagCount} tag${tagCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                ) : (
                  <span
                    style={{
                      fontFamily: hsTokens.script,
                      fontSize: 15,
                      color: "color-mix(in srgb, var(--hs-ink) 55%, transparent)",
                    }}
                  >
                    Jot a thought…
                  </span>
                )}
                {/* folded corner — the post-it dog-ear */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 18,
                    height: 18,
                    background:
                      "color-mix(in srgb, var(--hs-honey) 70%, var(--hs-ink) 16%)",
                    clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
                    borderBottomRightRadius: 3,
                  }}
                />
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
      </div>
    </LazyMotion>
  );
}

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        padding: "3px 10px",
        fontFamily: hsTokens.body,
        fontWeight: 600,
        fontSize: 11,
        color: hsTokens.ink,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      #{tag}
    </span>
  );
}
