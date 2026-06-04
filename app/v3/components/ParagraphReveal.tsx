"use client";

import { motion } from "framer-motion";
import { Fragment, useMemo } from "react";

// Snappier than the page-wide EASE.smooth ([0.22, 1, 0.36, 1]). At 200ms
// the standard curve hangs at the tail and reads as awkward; this curve
// front-loads the motion and settles cleanly so the reveal reads as a
// continuous left-to-right wave.
const CHAR_EASE = [0.16, 1, 0.3, 1] as const;

// Reveals a paragraph left-to-right one CHARACTER at a time inside an
// intact <p> block. Word wrapping is preserved by wrapping each word in
// an inline-block container with `whitespace: nowrap` — the word stays
// atomic for layout, but its characters animate independently.
//
// Spaces between words render as plain text (no per-space motion span)
// but they still advance the cumulative delay, so the wave keeps moving
// during whitespace and the next word starts at the right offset.
//
// A small extra pause after a sentence-ending character ('.', '?', '!')
// gives the storytelling beats a deliberate cadence without breaking the
// flow.
//
// Usage:
//   <p style={{ ... }}>
//     <ParagraphReveal text={STAGES.x.body} inView={inView} baseDelay={0.6} />
//   </p>
export default function ParagraphReveal({
  text,
  inView,
  baseDelay = 0,
  charDuration = 0.2,
  charStagger = 0.006,
  sentencePause = 0.03,
}: {
  text: string;
  inView: boolean;
  baseDelay?: number;
  charDuration?: number;
  charStagger?: number;
  sentencePause?: number;
}) {
  // Build a flat list of items: words (each broken into characters with
  // delays) and whitespace runs (plain text). Cumulative delay is computed
  // once so the rendered output is just a stream of spans.
  const items = useMemo(() => {
    const tokens = text.match(/\S+|\s+/g) ?? [];
    let delay = baseDelay;
    let prevTokenWasSentenceEnd = false;
    const out: Array<
      | { kind: "word"; chars: { char: string; delay: number }[] }
      | { kind: "space"; text: string }
    > = [];

    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        // Whitespace: advance delay for each space char, plus the
        // sentence pause if the previous word ended a sentence.
        if (prevTokenWasSentenceEnd) {
          delay += sentencePause;
          prevTokenWasSentenceEnd = false;
        }
        delay += token.length * charStagger;
        out.push({ kind: "space", text: token });
      } else {
        const chars = token.split("").map((char) => {
          const d = delay;
          delay += charStagger;
          return { char, delay: d };
        });
        const lastChar = token[token.length - 1];
        prevTokenWasSentenceEnd = /[.?!]/.test(lastChar);
        out.push({ kind: "word", chars });
      }
    }

    return out;
  }, [text, baseDelay, charStagger, sentencePause]);

  return (
    <>
      {items.map((item, i) =>
        item.kind === "space" ? (
          <Fragment key={i}>{item.text}</Fragment>
        ) : (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {item.chars.map((c, ci) => (
              <motion.span
                key={ci}
                initial={{ opacity: 0, y: 2 }}
                animate={inView ? { opacity: 1, y: 0 } : undefined}
                transition={{
                  duration: charDuration,
                  delay: c.delay,
                  ease: CHAR_EASE,
                }}
                style={{ display: "inline-block" }}
              >
                {c.char}
              </motion.span>
            ))}
          </span>
        ),
      )}
    </>
  );
}

// Helper for layouts that need to know how long a paragraph's reveal will
// take so the next paragraph can start near the end of this one. Returns
// the delay value the *next* element should use as baseDelay. Defaults
// must match `ParagraphReveal`'s defaults above.
export function endDelay(
  text: string,
  baseDelay: number,
  charDuration = 0.2,
  charStagger = 0.006,
  sentencePause = 0.03,
): number {
  const tokens = text.match(/\S+|\s+/g) ?? [];
  let delay = baseDelay;
  let prevTokenWasSentenceEnd = false;

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (prevTokenWasSentenceEnd) {
        delay += sentencePause;
        prevTokenWasSentenceEnd = false;
      }
      delay += token.length * charStagger;
    } else {
      delay += token.length * charStagger;
      const lastChar = token[token.length - 1];
      prevTokenWasSentenceEnd = /[.?!]/.test(lastChar);
    }
  }

  return delay + charDuration;
}
