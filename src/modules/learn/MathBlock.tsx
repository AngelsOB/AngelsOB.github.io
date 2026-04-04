import katex from "katex";

interface MathBlockProps {
  /** LaTeX expression to render */
  expression: string;
  /** Display mode renders as a centered block; inline renders within text */
  displayMode?: boolean;
}

/**
 * Server-rendered KaTeX math expression.
 * Renders to static HTML — no client JS required.
 */
export default function MathBlock({
  expression,
  displayMode = true,
}: MathBlockProps) {
  const html = katex.renderToString(expression, {
    displayMode,
    throwOnError: false,
    strict: false,
  });

  if (displayMode) {
    return (
      <div
        className="my-6 overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
