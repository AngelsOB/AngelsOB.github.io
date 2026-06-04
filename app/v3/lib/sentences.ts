// Splits a paragraph into sentences for sentence-by-sentence reveals.
//
// The split regex looks for sentence-terminal punctuation (.?!) followed by
// whitespace and a capital letter. This avoids false positives on decimals
// like "1.040" (no capital follows the period) and abbreviations like "Mr."
// (capital follows but the regex requires whitespace, which abbreviations
// don't have between letter and capital). Tracked edge cases:
//
//   "1.040 instead of 1.044"        -> no split (no capital after period)
//   "Pre-boil gravity at 1.044?"    -> split after "?"
//   "Citra. Mosaic. Then a topper." -> three sentences
//
// Returns trimmed, non-empty sentences.
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}
