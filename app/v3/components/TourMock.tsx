"use client";

import { useEffect, useReducer, useState } from "react";
import { MockBuilderShell } from "./mock/MockBuilderShell";
import type { Highlight, TabKey } from "./mock/types";

// TourMock is now a thin adapter — translates scroll-driven `mockState`
// into a `highlight` value that MockBuilderShell uses to drive every
// bone's state.

export type MockState =
  | "default"
  | "fermentables"
  | "hops"
  | "water"
  | "mash"
  | "yeast"
  | "brewsheet";

interface Props {
  controlledTab: TabKey | undefined;
  onTabChange: (tab: TabKey) => void;
  mockState: MockState;
  reducedMotion: boolean;
}

function mockStateToHighlight(state: MockState): Highlight {
  switch (state) {
    case "fermentables":
      return "fermentables";
    case "hops":
      return "hops";
    case "water":
      return "water";
    case "mash":
      return "mash";
    case "yeast":
      return "yeast";
    case "brewsheet":
      return "brewsheet";
    default:
      return "none";
  }
}

export default function TourMock({
  controlledTab,
  onTabChange,
  mockState,
  reducedMotion,
}: Props) {
  const highlight = mockStateToHighlight(mockState);

  // Content reveal inside BrewSheetPanel starts shortly after the
  // brewsheet bone arrives at panel state.
  const [contentPlaying, setContentPlaying] = useState(false);
  useEffect(() => {
    const isBrewsheet = highlight === "brewsheet";
    if (!isBrewsheet) {
      setContentPlaying(false);
      return;
    }
    const t = setTimeout(
      () => setContentPlaying(true),
      reducedMotion ? 100 : 300,
    );
    return () => clearTimeout(t);
  }, [highlight, reducedMotion]);

  return (
    <MockBuilderShell
      activeTab={controlledTab}
      onTabChange={onTabChange}
      highlight={highlight}
      contentPlaying={contentPlaying}
    />
  );
}

// prefers-reduced-motion hook.
export function useReducedMotion(): boolean {
  const [enabled, set] = useReducer((_: boolean, v: boolean) => v, false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    set(mq.matches);
    const onChange = (e: MediaQueryListEvent) => set(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return enabled;
}
