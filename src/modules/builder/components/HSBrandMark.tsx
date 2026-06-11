'use client';

import Link from "next/link";

import { hsTokens } from "../tokens";
import HSScriptNote from "./HSScriptNote";
import { useGuardedLinkClick } from "@/modules/recipe/hooks/useGuardedLinkClick";

interface Props {
  caption?: string;
  href?: string;
}

export default function HSBrandMark({ caption, href = "/" }: Props) {
  // Route the logo click through the unsaved-changes guard so leaving the
  // editor via the brand mark prompts for unsaved edits. Pass-through when
  // no editor is mounted (other pages).
  const handleClick = useGuardedLinkClick(href);
  const ink = hsTokens.ink;
  const mark = (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: 24,
          height: 24,
          background: hsTokens.roast,
          borderRadius: "50%",
          border: `2px solid ${ink}`,
        }}
      />
      <div
        style={{
          width: 24,
          height: 24,
          background: hsTokens.malt,
          marginLeft: -10,
          border: `2px solid ${ink}`,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          width: 24,
          height: 24,
          background: hsTokens.water,
          marginLeft: -10,
          border: `2px solid ${ink}`,
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
        }}
      />
    </div>
  );

  const inner = (
    <>
      {mark}
      <span
        className="hs-brandmark-word"
        style={{
          fontFamily: hsTokens.display,
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: hsTokens.ink,
        }}
      >
        BREWING.IT
      </span>
      {caption ? (
        <HSScriptNote color={hsTokens.yeast} size={20} style={{ marginLeft: 4 }}>
          {caption}
        </HSScriptNote>
      ) : null}
    </>
  );

  return (
    <Link
      href={href}
      onClick={handleClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
        color: hsTokens.ink,
      }}
    >
      {inner}
    </Link>
  );
}
