import React from "react";
import type { Recipe, RecipeCalculations } from "../../domain/models/Recipe";
import { starterCalculationService } from "../../domain/services/StarterCalculationService";
import { ionDeltaFromSalts } from "@/utils/water";

/**
 * Generate handwritten "margin scribble" lines for each sidebar section.
 * Returns an array of ReactNodes. All numbers are wrapped in <strong> for emphasis.
 */
export function getScribbleLines(
  accent: string,
  recipe: Recipe | null,
  calculations: RecipeCalculations | null
): React.ReactNode[] {
  if (!recipe) return [];

  switch (accent) {
    case "recipe": {
      if (!calculations) return [];
      const lines: React.ReactNode[] = [];
      if (calculations.og > 1) {
        lines.push(
          <span className="sidebar-scribble-recipe-og">
            <span className="sidebar-recipe-gravities">
              <span>
                OG <strong>{calculations.og.toFixed(3)}&nbsp;</strong>
              </span>
              <span>
                FG <strong>{calculations.fg.toFixed(3)}&nbsp;</strong>
              </span>
            </span>
            <span className="sidebar-recipe-abv">
              <strong> {calculations.abv.toFixed(1)}</strong>%
            </span>
            <span className="sidebar-scribble-recipe-og">ABV</span>
          </span>
        );
      }
      if (calculations.ibu > 0)
        lines.push(
          <>
            <br></br>
            <strong>{Math.round(calculations.ibu)}</strong> IBU · <strong>{calculations.srm.toFixed(1)}</strong> SRM
          </>
        );
      return lines;
    }
    case "equipment": {
      const eq = recipe.equipment;
      const batchVol = recipe.batchVolumeL;
      return [
        <span className="sidebar-scribble-equipment">
          <span className="sidebar-equip-batch">
            <strong>{batchVol}</strong>L batch
          </span>
          {calculations && (
            <span className="sidebar-equip-volumes">
              <span>
                mash <strong>{calculations.mashWaterL.toFixed(1)}</strong>L
              </span>
              <span>
                sparge <strong>{calculations.spargeWaterL.toFixed(1)}</strong>L
              </span>
            </span>
          )}
        </span>,
        <>
          <strong>{eq.boilTimeMin}</strong> min boil · <strong>{eq.mashEfficiencyPercent}</strong>% eff
        </>,
      ];
    }
    case "grain": {
      if (recipe.fermentables.length === 0) return [];
      const totalKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
      if (totalKg === 0) return [];
      const sorted = [...recipe.fermentables].sort((a, b) => b.weightKg - a.weightKg);
      return sorted.map((f) => {
        const pct = Math.round((f.weightKg / totalKg) * 100);
        const shortName = f.name.includes(" - ")
          ? f.name.split(" - ").slice(1).join(" - ")
          : f.name;
        return (
          <>
            {shortName}{"\u00A0"}<strong>{pct}%</strong>
          </>
        );
      });
    }
    case "mash": {
      const lines: React.ReactNode[] = recipe.mashSteps.map((s) => (
        <>
          <strong>{s.temperatureC}</strong>°C · <strong>{s.durationMinutes}</strong>min
        </>
      ));
      if (calculations?.strikeTempC != null)
        lines.push(
          <span className="sidebar-scribble-mash-strike">
            Strike <strong>{calculations.strikeTempC.toFixed(1)}</strong>°C
          </span>
        );
      return lines;
    }
    case "hops": {
      if (recipe.hops.length === 0) return [];
      const typeOrder: Record<string, number> = {
        "first wort": 0,
        boil: 1,
        whirlpool: 2,
        "dry hop": 3,
        mash: 4,
      };
      const sorted = [...recipe.hops].sort((a, b) => {
        const oa = typeOrder[a.type] ?? 5;
        const ob = typeOrder[b.type] ?? 5;
        if (oa !== ob) return oa - ob;
        if (a.type === "boil") return (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0);
        return 0;
      });
      const additionLabel = (h: Recipe["hops"][number]) => {
        if (h.type === "boil") return `@${h.timeMinutes ?? 0}m`;
        if (h.type === "dry hop") return "DH";
        if (h.type === "whirlpool") return "WP";
        if (h.type === "first wort") return "FW";
        if (h.type === "mash") return "Mash";
        return "";
      };
      const groups: { label: string; hops: typeof sorted }[] = [];
      for (const h of sorted) {
        const lbl = additionLabel(h);
        const last = groups[groups.length - 1];
        if (last && last.label === lbl) {
          last.hops.push(h);
        } else {
          groups.push({ label: lbl, hops: [h] });
        }
      }
      const lines: React.ReactNode[] = groups.map((g) => (
        <span className="sidebar-scribble-hop-group">
          <span className="sidebar-hop-names">
            {g.hops.map((h, k) => (
              <span key={k}>
                {h.name} <strong>{h.grams}</strong>g
              </span>
            ))}
          </span>
          <span className="sidebar-hop-addition">
            <strong>{g.label}</strong>
          </span>
        </span>
      ));
      const totalG = sorted.reduce((s, h) => s + h.grams, 0);
      const totalOz = (totalG * 0.03527).toFixed(1);
      const ibu = calculations ? Math.round(calculations.ibu) : 0;
      lines.push(
        <span className="sidebar-hop-summary">
          <span className="sidebar-hop-ibu">
            <strong>{ibu}</strong> IBU
          </span>
          <span className="sidebar-hop-total">
            Total: <strong>{totalOz}</strong>oz
          </span>
        </span>
      );
      return lines;
    }
    case "yeast": {
      if (recipe.yeasts.length === 0) return [];
      const y = recipe.yeasts[0];
      const att = Math.round(y.attenuation * 100);
      const lines: React.ReactNode[] = [
        <span className="sidebar-scribble-yeast">
          {y.laboratory && <span className="sidebar-yeast-lab">{y.laboratory}</span>}
          <span>
            {y.name} · <strong>{att}</strong>% att
          </span>
        </span>,
      ];
      if (y.starter && y.starter.steps.length > 0) {
        const steps = y.starter.steps;
        const totalL = steps.reduce((s, st) => s + st.liters, 0);
        const totalDme = steps.reduce(
          (s, st) => s + starterCalculationService.dmeGramsForGravity(st.liters, st.gravity),
          0
        );
        const og = steps[0].gravity;
        lines.push(
          <span className="sidebar-yeast-starter">
            Starter: <strong>{totalL}</strong>L @ <strong>{og.toFixed(3)}</strong> · <strong>{Math.round(totalDme)}</strong>g DME
          </span>
        );
      }
      return lines;
    }
    case "water": {
      const left: React.ReactNode[] = [];
      const right: React.ReactNode[] = [];
      if (recipe.waterChemistry) {
        const wc = recipe.waterChemistry;
        if (wc.sourceProfileName) left.push(<span key="profile">{wc.sourceProfileName}</span>);
        const totalWaterL = calculations?.totalWaterL ?? 0;
        const saltDelta = totalWaterL > 0
          ? ionDeltaFromSalts(wc.saltAdditions, totalWaterL)
          : { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 };
        const finalSO4 = wc.sourceProfile.SO4 + saltDelta.SO4;
        const finalCl = wc.sourceProfile.Cl + saltDelta.Cl;
        if (finalCl > 0)
          left.push(
            <span key="ratio">
              SO₄:Cl <strong>{(finalSO4 / finalCl).toFixed(1)}</strong>
            </span>
          );
        const sa = wc.saltAdditions;
        if (sa.gypsum_g)
          right.push(
            <span key="gypsum">
              Gypsum <strong>{sa.gypsum_g}</strong>g
            </span>
          );
        if (sa.cacl2_g)
          right.push(
            <span key="cacl2">
              CaCl₂ <strong>{sa.cacl2_g}</strong>g
            </span>
          );
        if (sa.epsom_g)
          right.push(
            <span key="epsom">
              Epsom <strong>{sa.epsom_g}</strong>g
            </span>
          );
        if (sa.nacl_g)
          right.push(
            <span key="nacl">
              NaCl <strong>{sa.nacl_g}</strong>g
            </span>
          );
        if (sa.nahco3_g)
          right.push(
            <span key="nahco3">
              Baking soda <strong>{sa.nahco3_g}</strong>g
            </span>
          );
      }
      const waterAgents = recipe.otherIngredients.filter((i) => i.category === "water-agent");
      for (const agent of waterAgents) {
        right.push(
          <span key={agent.id}>
            {agent.name} <strong>{agent.amount}</strong>
            {agent.unit}
          </span>
        );
      }
      if (left.length === 0 && right.length === 0) return [];
      return [
        <span className="sidebar-scribble-cols">
          <span className="sidebar-scribble-col-left">{left}</span>
          <span className="sidebar-scribble-col-right">{right}</span>
        </span>,
      ];
    }
    case "fermentation": {
      if (recipe.fermentationSteps.length === 0) return [];
      return recipe.fermentationSteps.map((s) => (
        <>
          <strong>{s.temperatureC}</strong>°C · <strong>{s.durationDays}</strong>d
        </>
      ));
    }
    case "targets": {
      if (!calculations) return [];
      const lines: React.ReactNode[] = [];
      if (calculations.mashWaterL > 0)
        lines.push(
          <>
            Mash <strong>{calculations.mashWaterL.toFixed(1)}</strong>L · Sparge{" "}
            <strong>{calculations.spargeWaterL.toFixed(1)}</strong>L
          </>
        );
      if (calculations.preBoilVolumeL > 0)
        lines.push(
          <>
            Preboil: <strong>{calculations.preBoilVolumeL.toFixed(1)}</strong>L @{" "}
            <strong>{calculations.preBoilGravity.toFixed(3)}</strong>
          </>
        );
      return lines;
    }
    default:
      return [];
  }
}

/**
 * Section definitions for the sidebar.
 * Each maps to a brew-section[data-accent] on the page.
 */
export const SECTIONS = [
  {
    id: "recipe-info",
    accent: "recipe",
    label: "Recipe",
    shortLabel: "Rec.",
    number: "01",
    bg: "var(--sidebar-recipe-bg)",
    text: "var(--sidebar-recipe-text)",
  },
  {
    id: "equipment",
    accent: "equipment",
    label: "Equipment",
    shortLabel: "Equip.",
    number: "02",
    bg: "var(--sidebar-equipment-bg)",
    text: "var(--sidebar-equipment-text)",
  },
  {
    id: "grain",
    accent: "grain",
    label: "Fermentables",
    shortLabel: "Grain",
    number: "03",
    bg: "var(--sidebar-grain-bg)",
    text: "var(--sidebar-grain-text)",
  },
  {
    id: "mash",
    accent: "mash",
    label: "Mash",
    shortLabel: "Mash",
    number: "04",
    bg: "var(--sidebar-mash-bg)",
    text: "var(--sidebar-mash-text)",
  },
  {
    id: "hops",
    accent: "hops",
    label: "Hops",
    shortLabel: "Hops",
    number: "05",
    bg: "var(--sidebar-hops-bg)",
    text: "var(--sidebar-hops-text)",
  },
  {
    id: "yeast",
    accent: "yeast",
    label: "Yeast",
    shortLabel: "Yeast",
    number: "06",
    bg: "var(--sidebar-yeast-bg)",
    text: "var(--sidebar-yeast-text)",
  },
  {
    id: "water",
    accent: "water",
    label: "Water Chem.",
    shortLabel: "Chem.",
    number: "07",
    bg: "var(--sidebar-water-bg)",
    text: "var(--sidebar-water-text)",
  },
  {
    id: "fermentation",
    accent: "fermentation",
    label: "Fermentation",
    shortLabel: "Ferm.",
    number: "08",
    bg: "var(--sidebar-fermentation-bg)",
    text: "var(--sidebar-fermentation-text)",
  },
  {
    id: "targets",
    accent: "targets",
    label: "Brew Day",
    shortLabel: "B.Day",
    number: "09",
    bg: "var(--sidebar-targets-bg)",
    text: "var(--sidebar-targets-text)",
  },
] as const;
