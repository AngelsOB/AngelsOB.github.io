import type { Hop } from "../../domain/models/Recipe";
import type { HopFlavorProfile } from "../../domain/models/Presets";
import type { HopGroup } from "../hooks/useHopGroups";
import OLD_HopFlavorMini from "./OLD_HopFlavorMini";
import OLD_HopAdditionRow from "./OLD_HopAdditionRow";

type OLD_HopVarietyCardProps = {
  group: HopGroup;
  onUpdateHop: (id: string, updates: Partial<Hop>) => void;
  onRemoveHop: (id: string) => void;
  onAddAddition: (
    varietyName: string,
    alphaAcid: number,
    flavor?: HopFlavorProfile
  ) => void;
};

export default function OLD_HopVarietyCard({
  group,
  onUpdateHop,
  onRemoveHop,
  onAddAddition,
}: OLD_HopVarietyCardProps) {
  return (
    <div className="hop-variety-card">
      {/* Header: name + AA on left, visualizer on right */}
      <div className="hop-variety-header">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="hop-variety-name">
            {group.varietyName}
          </span>
          <span className="hop-variety-aa-badge">
            {group.alphaAcid.toFixed(1)}% AA
          </span>
        </div>
        {group.flavor && (
          <OLD_HopFlavorMini
            flavor={group.flavor}
            size={40}
            className="min-w-[40px] shrink-0"
          />
        )}
      </div>

      {/* Addition sub-rows */}
      <div className="space-y-1.5">
        {group.additions.map((hop) => (
          <OLD_HopAdditionRow
            key={hop.id}
            hop={hop}
            onUpdate={onUpdateHop}
            onRemove={onRemoveHop}
          />
        ))}
      </div>

      {/* Footer: add button on left, totals on right */}
      <div className="hop-variety-footer">
        <button
          onClick={() =>
            onAddAddition(group.varietyName, group.alphaAcid, group.flavor)
          }
          className="hop-add-addition-btn"
        >
          + Add Addition
        </button>
        <div className="hop-variety-stats">
          <span className="hop-variety-stats-label">Total:</span>
          <span className="hop-variety-stats-value">{group.totalIBU.toFixed(1)}</span> IBU
          <span className="hop-variety-stats-sep">&middot;</span>
          <span className="hop-variety-stats-value">{group.gramsPerLiter.toFixed(2)}</span> g/L
          <span className="hop-variety-stats-sep">&middot;</span>
          <span className="hop-variety-stats-total">{group.totalGrams}</span>g
        </div>
      </div>
    </div>
  );
}
