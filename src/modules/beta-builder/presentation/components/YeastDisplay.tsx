/**
 * Yeast Display Component
 *
 * Shows selected yeast with lab badge, name/lab info,
 * and inline attenuation badge (like hop AA%).
 */

import YeastLabBadge from "./YeastLabBadge";
import type { Yeast } from "../../domain/models/Recipe";

interface YeastDisplayProps {
  yeast: Yeast;
}

export default function YeastDisplay({ yeast }: YeastDisplayProps) {
  return (
    <>
      <YeastLabBadge laboratory={yeast.laboratory} size="md" />

      <div className="yeast-card-info">
        <div className="yeast-card-name-row">
          <span className="yeast-card-name">{yeast.name}</span>
          <span className="yeast-att-badge">
            {(yeast.attenuation * 100).toFixed(0)}%
          </span>
        </div>
        {yeast.laboratory && (
          <span className="yeast-card-lab">{yeast.laboratory}</span>
        )}
      </div>
    </>
  );
}
