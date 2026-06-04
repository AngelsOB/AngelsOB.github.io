"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { STAGES } from "../data";
import StageEyebrow from "./StageEyebrow";

// Stage 9. Full-width 2x2 tile grid below the tour. No mock. Hover lift +
// staggered fade-in land in task #7.
export default function StageWhatElse() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <StageEyebrow>{STAGES.whatElse.h2}</StageEyebrow>
        <div
          style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
          }}
          className="v3-tiles"
        >
          {STAGES.whatElse.tiles.map((tile) => (
            <div
              key={tile.title}
              style={{
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 14,
                boxShadow: hsTokens.sh3,
                padding: "22px 22px",
              }}
            >
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 22,
                  letterSpacing: "-0.025em",
                  color: hsTokens.ink,
                  marginBottom: 6,
                }}
              >
                {tile.title}
              </div>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: hsTokens.muted,
                }}
              >
                {tile.body}
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .v3-tiles { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
