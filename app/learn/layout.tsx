import "katex/dist/katex.min.css";
import type { Metadata } from "next";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSLearnNav from "@/modules/hopskip/components/HSLearnNav";

export const metadata: Metadata = {
  title: {
    template: "%s | Hop & Skip Learn",
    default: "Learn Brewing Science | Hop & Skip",
  },
};

export default function HopSkipLearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(32px, 4vw, 56px) clamp(20px, 4vw, 56px)",
        display: "grid",
        gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)",
        gap: "clamp(24px, 4vw, 56px)",
        background: hsTokens.cream,
        minHeight: "60dvh",
      }}
      className="hs-learn-layout"
    >
      <aside>
        <HSLearnNav />
      </aside>
      <main style={{ minWidth: 0 }}>{children}</main>
      <style>{`
        @media (max-width: 720px) {
          .hs-learn-layout {
            grid-template-columns: 1fr !important;
          }
          .hs-learn-layout > aside {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
