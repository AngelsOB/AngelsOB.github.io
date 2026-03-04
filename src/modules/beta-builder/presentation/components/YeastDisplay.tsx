/**
 * Yeast Display Component
 *
 * Machined card showing selected yeast with lab badge,
 * name/lab info, and editable attenuation datum readout.
 */

import YeastLabBadge from "./YeastLabBadge";
import type { Yeast } from "../../domain/models/Recipe";

interface YeastDisplayProps {
  yeast: Yeast;
  onChangeYeast: () => void;
  onUpdateAttenuation: (attenuation: number) => void;
}

export default function YeastDisplay({
  yeast,
  onChangeYeast,
  onUpdateAttenuation,
}: YeastDisplayProps) {
  return (
    <div className="yeast-card">
      <YeastLabBadge laboratory={yeast.laboratory} size="md" />

      <div className="yeast-card-info">
        <span className="yeast-card-name">{yeast.name}</span>
        {yeast.laboratory && (
          <span className="yeast-card-lab">{yeast.laboratory}</span>
        )}
      </div>

      {/* Attenuation datum readout */}
      <div className="equip-datum is-small">
        <label htmlFor="yeast-attenuation" className="equip-datum-label">Attenuation</label>
        <div className="equip-datum-value">
          <input
            id="yeast-attenuation"
            type="number"
            value={(yeast.attenuation * 100).toFixed(0)}
            onChange={(e) =>
              onUpdateAttenuation((parseFloat(e.target.value) || 0) / 100)
            }
            className="equip-datum-input"
            step="1"
            min="0"
            max="100"
          />
          <span className="equip-datum-unit">%</span>
        </div>
      </div>

      {/* Hover-reveal change action */}
      <div className="brew-row-actions">
        <button
          onClick={onChangeYeast}
          className="brew-row-action-btn brew-link"
          aria-label="Change yeast"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
      </div>
    </div>
  );
}
