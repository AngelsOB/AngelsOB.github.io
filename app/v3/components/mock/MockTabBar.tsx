"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import { TABS, type TabKey, type Highlight } from "./types";

// Tab bar. Each tab is its own little bone — the active tab visually
// surfaces, others recede. When a tab IS the highlight (its section is
// being discussed), it gets an extra emphasis (slight lift). When some
// OTHER tab is the highlight, this tab dims further.

interface Props {
  activeTab: TabKey;
  highlight: Highlight;
  onTabChange: (tab: TabKey) => void;
}

export function MockTabBar({ activeTab, highlight, onTabChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 3,
        marginTop: 16,
        borderBottom: `2px solid ${hsTokens.ink}`,
        paddingLeft: 4,
      }}
    >
      {TABS.map((tab) => (
        <Tab
          key={tab.key}
          tabKey={tab.key}
          label={tab.label}
          enabled={tab.enabled}
          isActive={tab.key === activeTab}
          isHighlight={tab.key === highlight}
          onClick={() => tab.enabled && onTabChange(tab.key)}
        />
      ))}
    </div>
  );
}

function Tab({
  tabKey,
  label,
  enabled,
  isActive,
  isHighlight,
  onClick,
}: {
  tabKey: TabKey;
  label: string;
  enabled: boolean;
  isActive: boolean;
  isHighlight: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      data-bone={`tab-${tabKey}`}
      type="button"
      onClick={onClick}
      disabled={!enabled}
      animate={{
        y: isHighlight ? -3 : 0,
      }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        padding: "8px 12px",
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: isActive || isHighlight ? 700 : 500,
        color: isActive || isHighlight
          ? hsTokens.ink
          : enabled
            ? hsTokens.muted
            : `color-mix(in oklch, ${hsTokens.muted} 60%, transparent)`,
        background: isActive ? hsTokens.paper : "transparent",
        border: isActive
          ? `2px solid ${hsTokens.ink}`
          : "2px solid transparent",
        borderBottom: isActive ? "2px solid transparent" : undefined,
        borderRadius: "10px 10px 0 0",
        marginBottom: -2,
        whiteSpace: "nowrap",
        position: "relative",
        cursor: enabled ? "pointer" : "not-allowed",
      }}
    >
      {label}
    </motion.button>
  );
}
