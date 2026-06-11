"use client";

import { useEffect, useRef, useState } from "react";

import { hsTokens } from "../../tokens";
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

export default function SharedBrewersNotesCard({
  notes,
  tags,
  onNotesChange,
  onTagsChange,
  readOnly,
}: Props) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [editingTags, setEditingTags] = useState(false);
  const [draftTags, setDraftTags] = useState(tags.join(" "));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNotes) {
      setDraftNotes(notes);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [editingNotes, notes]);

  useEffect(() => {
    if (editingTags) {
      setDraftTags(tags.join(" "));
      requestAnimationFrame(() => tagInputRef.current?.focus());
    }
  }, [editingTags, tags]);

  const commitNotes = () => {
    const next = draftNotes.trim();
    if (next !== notes) onNotesChange(next);
    setEditingNotes(false);
  };
  const cancelNotes = () => {
    setDraftNotes(notes);
    setEditingNotes(false);
  };
  const commitTags = () => {
    const next = draftTags
      .split(/\s+/)
      .map((t) => t.replace(/^#+/, "").trim().toLowerCase())
      .filter(Boolean);
    if (next.join(" ") !== tags.join(" ")) onTagsChange(next);
    setEditingTags(false);
  };
  const cancelTags = () => {
    setDraftTags(tags.join(" "));
    setEditingTags(false);
  };

  return (
    <div
      className="hs-shared-notes-card"
      style={{
        background:
          "color-mix(in srgb, var(--hs-cream-2) 80%, var(--hs-honey))",
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: `1px solid ${hsTokens.ink}22`,
          paddingBottom: 8,
        }}
      >
        <HSEyebrow>Brewer&apos;s notes</HSEyebrow>
        {readOnly ? null : (
          <button
            type="button"
            onClick={() => setEditingNotes((v) => !v)}
            aria-label={editingNotes ? "Save notes" : "Edit notes"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              borderRadius: 4,
            }}
          >
            {editingNotes ? "Save" : "Edit"}{" "}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
        )}
      </div>

      {editingNotes && !readOnly ? (
        <textarea
          ref={textareaRef}
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelNotes();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitNotes();
            }
          }}
          placeholder={PLACEHOLDER}
          rows={4}
          style={{
            width: "100%",
            background: hsTokens.paper,
            border: `1.5px solid ${hsTokens.malt}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontFamily: hsTokens.script,
            fontSize: 19,
            lineHeight: 1.35,
            color: hsTokens.ink,
            outline: "none",
            resize: "vertical",
            minHeight: 90,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => !readOnly && setEditingNotes(true)}
          aria-label={readOnly ? "Brewer's notes" : "Edit brewer's notes"}
          disabled={readOnly}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: readOnly ? "default" : "text",
            textAlign: "left",
            display: "block",
            width: "100%",
            color: "inherit",
            fontFamily: "inherit",
          }}
        >
          <p
            style={{
              fontFamily: hsTokens.script,
              fontSize: 19,
              lineHeight: 1.35,
              color: notes ? hsTokens.ink : hsTokens.muted,
              margin: 0,
              whiteSpace: "pre-wrap",
              opacity: notes ? 1 : 0.7,
            }}
          >
            {notes || PLACEHOLDER}
          </p>
        </button>
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
        {editingTags && !readOnly ? (
          <input
            ref={tagInputRef}
            type="text"
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            onBlur={commitTags}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelTags();
              } else if (e.key === "Enter") {
                e.preventDefault();
                commitTags();
              }
            }}
            placeholder="#irish-red #malty"
            style={{
              flex: 1,
              minWidth: 0,
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.malt}`,
              borderRadius: 999,
              padding: "5px 10px",
              fontFamily: hsTokens.body,
              fontSize: 12,
              color: hsTokens.ink,
              outline: "none",
            }}
          />
        ) : (
          <>
            {tags.length > 0 ? (
              tags.map((t) => (
                <span
                  key={t}
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
                  #{t}
                </span>
              ))
            ) : (
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 11,
                  color: hsTokens.muted,
                  letterSpacing: "0.02em",
                }}
              >
                No tags yet —
              </span>
            )}
            {readOnly ? null : (
              <button
                type="button"
                onClick={() => setEditingTags(true)}
                aria-label="Edit tags"
                style={{
                  background: "transparent",
                  border: `1.5px dashed ${hsTokens.ink}44`,
                  borderRadius: 999,
                  padding: "2px 9px",
                  fontFamily: hsTokens.body,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                  cursor: "pointer",
                }}
              >
                + tag
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
