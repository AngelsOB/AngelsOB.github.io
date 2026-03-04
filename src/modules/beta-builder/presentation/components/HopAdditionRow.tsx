import type { Hop } from "../../domain/models/Recipe";

type HopAdditionRowProps = {
  hop: Hop;
  onUpdate: (id: string, updates: Partial<Hop>) => void;
  onRemove: (id: string) => void;
};

export default function HopAdditionRow({ hop, onUpdate, onRemove }: HopAdditionRowProps) {
  return (
    <div className="brew-row-hover flex items-center py-0.5">
      {/* Unified row container: type pill + timing + weight in one shared surface */}
      <div
        className="flex items-center gap-0 flex-1 min-w-0 rounded-lg overflow-hidden"
        style={{
          background: "color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.4))",
          border: "1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))",
          boxShadow: "var(--shadow-inset)",
        }}
      >
        {/* Type selector as compact pill */}
        <select
          value={hop.type}
          onChange={(e) =>
            onUpdate(hop.id, { type: e.target.value as Hop["type"] })
          }
          className="appearance-none bg-transparent text-xs font-semibold pl-2.5 pr-5 py-1.5 border-r border-[rgb(var(--brew-border-subtle))] cursor-pointer shrink-0 focus:outline-none"
          style={{
            color: "var(--brew-accent-700)",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 6px center",
            backgroundSize: "8px 5px",
          }}
          aria-label="Hop addition type"
        >
          <option value="boil">Boil</option>
          <option value="whirlpool">Whirlpool</option>
          <option value="dry hop">Dry Hop</option>
          <option value="first wort">First Wort</option>
          <option value="mash">Mash Hop</option>
        </select>

        {/* Timing section — inline values with embedded labels */}
        <div className="flex items-center gap-0 flex-1 min-w-0">
          {hop.type === "boil" && (
            <div className="flex items-center">
              <input
                type="number"
                value={hop.timeMinutes || 0}
                onChange={(e) =>
                  onUpdate(hop.id, { timeMinutes: parseFloat(e.target.value) || 0 })
                }
                className="bg-transparent text-xs w-[40px] py-1.5 px-2 text-center focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
                style={{ color: "var(--fg-strong)" }}
                step="5"
                min="0"
                aria-label="Boil time minutes"
              />
              <span className="text-[10px] text-muted pr-2">min</span>
            </div>
          )}

          {hop.type === "whirlpool" && (
            <>
              <div className="flex items-center">
                <input
                  type="number"
                  value={hop.temperatureC || 80}
                  onChange={(e) =>
                    onUpdate(hop.id, { temperatureC: parseFloat(e.target.value) || 80 })
                  }
                  className="bg-transparent text-xs w-[44px] py-1.5 px-1.5 text-center focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
                  style={{ color: "var(--fg-strong)" }}
                  step="5"
                  min="40"
                  max="100"
                  aria-label="Whirlpool temperature"
                />
                <span className="text-[10px] text-muted">°C</span>
              </div>
              <span className="text-[10px] text-muted px-0.5">/</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={hop.whirlpoolTimeMinutes || 15}
                  onChange={(e) =>
                    onUpdate(hop.id, { whirlpoolTimeMinutes: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-transparent text-xs w-[44px] py-1.5 px-1.5 text-center focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
                  style={{ color: "var(--fg-strong)" }}
                  step="5"
                  min="0"
                  aria-label="Whirlpool time minutes"
                />
                <span className="text-[10px] text-muted pr-1">min</span>
              </div>
            </>
          )}

          {hop.type === "dry hop" && (
            <>
              <div className="flex items-center">
                <span className="text-[10px] text-muted pl-2">day</span>
                <input
                  type="number"
                  value={hop.dryHopStartDay ?? 0}
                  onChange={(e) =>
                    onUpdate(hop.id, { dryHopStartDay: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-transparent text-xs w-[40px] py-1.5 px-1 text-center focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
                  style={{ color: "var(--fg-strong)" }}
                  step="1"
                  min="0"
                  aria-label="Dry hop start day"
                />
              </div>
              <span className="text-[10px] text-muted px-0.5">for</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={hop.dryHopDays ?? 3}
                  onChange={(e) =>
                    onUpdate(hop.id, { dryHopDays: parseFloat(e.target.value) || 0 })
                  }
                  className="bg-transparent text-xs w-[40px] py-1.5 px-1 text-center focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
                  style={{ color: "var(--fg-strong)" }}
                  step="1"
                  min="0"
                  aria-label="Dry hop duration days"
                />
                <span className="text-[10px] text-muted pr-1">days</span>
              </div>
            </>
          )}

          {/* Empty space for types with no timing */}
          {(hop.type === "first wort" || hop.type === "mash") && (
            <div className="flex-1 py-1.5" />
          )}
        </div>

        {/* Weight — right-aligned inside the shared container */}
        <div className="flex items-center border-l border-[rgb(var(--brew-border-subtle))] shrink-0">
          <input
            type="number"
            value={hop.grams}
            onChange={(e) =>
              onUpdate(hop.id, { grams: parseFloat(e.target.value) || 0 })
            }
            className="bg-transparent text-xs w-[44px] py-1.5 px-1.5 text-right font-medium focus:outline-none focus:bg-[color-mix(in_oklch,var(--brew-accent-100)_20%,transparent)] rounded"
            style={{ color: "var(--fg-strong)" }}
            step="1"
            min="0"
            aria-label="Weight in grams"
          />
          <span className="text-[10px] text-muted pr-2">g</span>
        </div>
      </div>

      {/* Hover-reveal actions — morphs inline */}
      <div className="brew-row-actions">
        <button
          onClick={() => onRemove(hop.id)}
          className="brew-row-action-btn brew-danger-text"
          aria-label={`Remove ${hop.name} ${hop.type} addition`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
