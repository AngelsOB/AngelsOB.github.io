"use client";

import HopFlavorRadar from "@/modules/beta-builder/presentation/components/HopFlavorRadar";

/** West Coast IPA hop profile — Centennial/Simcoe/Citra/Cascade blend */
const westCoastIpaSeries = [
  {
    name: "West Coast IPA",
    flavor: {
      citrus: 3.8,
      tropicalFruit: 2.4,
      stoneFruit: 1.2,
      berry: 0.4,
      floral: 1.0,
      grassy: 0.3,
      herbal: 0.5,
      spice: 0.3,
      resinPine: 3.2,
    },
  },
];

export default function HopRadarDemo() {
  return (
    <div className="flex justify-center py-4">
      <HopFlavorRadar
        series={westCoastIpaSeries}
        size={340}
        labelColorize
        showLegend={false}
      />
    </div>
  );
}
