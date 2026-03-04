import type { Hop } from "../../domain/models/Recipe";
import type { HopFlavorProfile } from "../../domain/models/Presets";
import type { HopGroup } from "../hooks/useHopGroups";
import HopFlavorMini from "./HopFlavorMini";
import HopAdditionRow from "./HopAdditionRow";

type HopVarietyCardProps = {
  group: HopGroup;
  onUpdateHop: (id: string, updates: Partial<Hop>) => void;
  onRemoveHop: (id: string) => void;
  onAddAddition: (
    varietyName: string,
    alphaAcid: number,
    flavor?: HopFlavorProfile
  ) => void;
};

export default function HopVarietyCard({
  group,
  onUpdateHop,
  onRemoveHop,
  onAddAddition,
}: HopVarietyCardProps) {
  return (
    <div className="brew-ingredient-row p-4">
      {/* Header: name + stats */}
      <div className="flex items-start justify-between mb-2 pb-2 border-b border-[rgb(var(--brew-border-subtle))]">
        <div className="flex items-center gap-2 min-w-0">
          {group.flavor && (
            <HopFlavorMini
              flavor={group.flavor}
              size={28}
              className="min-w-[28px] shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">
                {group.varietyName}
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                style={{
                  background:
                    "color-mix(in oklch, var(--brew-accent-200) 40%, transparent)",
                  color: "var(--brew-accent-800)",
                }}
              >
                {group.alphaAcid.toFixed(1)}% AA
              </span>
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              {group.totalGrams}g total &middot;{" "}
              {group.totalIBU.toFixed(1)} IBU &middot;{" "}
              {group.gramsPerLiter.toFixed(2)} g/L
            </div>
          </div>
        </div>
      </div>

      {/* Addition sub-rows */}
      <div className="space-y-0.5">
        {group.additions.map((hop) => (
          <HopAdditionRow
            key={hop.id}
            hop={hop}
            onUpdate={onUpdateHop}
            onRemove={onRemoveHop}
          />
        ))}
      </div>

      {/* Add Addition button */}
      <div className="mt-2 pt-1 brew-action-add">
        <button
          onClick={() =>
            onAddAddition(group.varietyName, group.alphaAcid, group.flavor)
          }
          className="text-xs font-medium py-1 px-3 rounded-md transition-colors"
          style={{
            color: "var(--brew-accent-600)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "color-mix(in oklch, var(--brew-accent-100) 30%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          + Add Addition
        </button>
      </div>
    </div>
  );
}
