'use client'

import { useState } from 'react'
import { hsTokens } from '@/modules/builder/tokens'

/**
 * Small client island for the recipe share page's "Copy as Markdown" action.
 * The Markdown string is built server-side (buildRecipeMarkdown) and passed in,
 * so the visible summary and the copied text always match.
 */
export default function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard unavailable (insecure context / denied) — no-op.
        }
      }}
      style={{
        flexShrink: 0,
        cursor: 'pointer',
        fontFamily: hsTokens.body,
        fontSize: 13,
        fontWeight: 700,
        color: hsTokens.ink,
        background: copied ? hsTokens.yeast : hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: `2px 2px 0 ${hsTokens.ink}`,
        padding: '8px 16px',
        transition: 'background 160ms ease',
      }}
    >
      {copied ? 'Copied ✓' : 'Copy as Markdown'}
    </button>
  )
}
