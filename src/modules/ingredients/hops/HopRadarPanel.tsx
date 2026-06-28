"use client";

import HopFlavorRadar from "@/components/HopFlavorRadar";
import type { HopFlavorProfile } from "@/modules/recipe/models/Presets";

/**
 * Thin client wrapper around the shared HopFlavorRadar so it can be dropped
 * into the server-rendered detail page. The radar uses useState (hover
 * highlight), so it needs a client boundary — but its `<text>` axis labels
 * still render in the initial server HTML, keeping the chart crawlable.
 */
export default function HopRadarPanel({
  name,
  flavor,
}: {
  name: string;
  flavor: HopFlavorProfile;
}) {
  return (
    <HopFlavorRadar
      series={[{ name, flavor }]}
      responsive
      showLegend={false}
      labelColorize
      colorStrategy="dominant"
    />
  );
}
