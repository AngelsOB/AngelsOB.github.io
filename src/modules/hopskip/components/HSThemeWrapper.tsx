import type { ReactNode } from "react";

import { hsTokens } from "../tokens";
import HSFooter from "./HSFooter";
import HSHeader from "./HSHeader";

interface Props {
  children: ReactNode;
  /** Whether to render the HS header + footer chrome. Default: true. */
  chrome?: boolean;
}

export default function HSThemeWrapper({ children, chrome = true }: Props) {
  return (
    <div
      className="hs-theme"
      style={{
        background: hsTokens.cream,
        color: hsTokens.ink,
        minHeight: "100dvh",
        fontFamily: hsTokens.body,
      }}
    >
      {chrome ? <HSHeader /> : null}
      {children}
      {chrome ? <HSFooter /> : null}
    </div>
  );
}
