'use client';

import type { Recipe, RecipeCalculations, Hop, BrewDayStage, BrewDayChecklistItem } from "@/modules/recipe/models/Recipe";
import { recipeCalculationService, RecipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import { beerXmlExportService } from "@/modules/recipe/services/BeerXmlExportService";
import { volumeCalculationService } from "@/modules/recipe/services/VolumeCalculationService";
import { ionDeltaFromSalts, addProfiles, type WaterProfile } from "@/utils/water";
import { mergeChecklist } from "@/modules/recipe/services/BrewDayChecklistService";

/* ------------------------------------------------------------------ */
/*  Unit helpers                                                       */
/* ------------------------------------------------------------------ */

const litersToGallons = (l: number | undefined): number | undefined =>
  l == null ? undefined : l * 0.2641720524;

const kgToLb = (kg: number | undefined): number | undefined =>
  kg == null ? undefined : kg * 2.2046226218;

const gToOz = (g: number | undefined): number | undefined =>
  g == null ? undefined : g * 0.03527396195;

const cToF = (c: number | undefined): number | undefined =>
  c == null ? undefined : (c * 9) / 5 + 32;

const fmt = (n: number | undefined, digits = 2): string => {
  if (n == null || Number.isNaN(n)) return "–";
  return Number(n).toFixed(digits);
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export const sanitizeFileName = (raw: string): string => {
  const base = (raw || "Untitled").trim().replace(/[\n\r]+/g, " ");
  const sanitized = base.replace(/[^a-zA-Z0-9-_ .]/g, "").replace(/\s+/g, " ");
  return (sanitized || "Untitled").slice(0, 120);
};

export const downloadTextFile = (
  filename: string,
  content: string,
  mime = "text/markdown;charset=utf-8"
) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generateBeerXml = (recipe: Recipe): string =>
  beerXmlExportService.generate(recipe);

/* ------------------------------------------------------------------ */
/*  Markdown generation                                                */
/* ------------------------------------------------------------------ */

export const generateRecipeMarkdown = (
  recipe: Recipe,
  calculations?: RecipeCalculations | null
): string => {
  const calc = calculations ?? recipeCalculationService.calculate(recipe);
  const lines: string[] = [];

  const batchGal = litersToGallons(recipe.batchVolumeL);
  const totalGrainKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
  const totalGrainLb = kgToLb(totalGrainKg);

  // Derived values
  const gravityPoints = Math.round((calc.og - 1) * 1000);
  const buGu = gravityPoints > 0 ? calc.ibu / gravityPoints : 0;

  const boilOffL =
    (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const postBoilVolumeL = Math.max(0, calc.preBoilVolumeL - boilOffL);

  // Pre-boil gravity derived from OG via concentration through the boil.
  // Only boil-off and cooling shrinkage concentrate the wort — post-boil
  // losses (kettle trub, chiller, fermenter) remove wort at the same gravity
  // and do NOT change gravity. So we conserve sugar between pre-boil and
  // post-boil cold volume, not between pre-boil and batch volume.
  const shrinkageFactor = 1 + recipe.equipment.coolingShrinkagePercent / 100;
  const postBoilColdL = postBoilVolumeL / shrinkageFactor;
  const preBoilGravity =
    calc.preBoilVolumeL > 0
      ? 1 + ((calc.og - 1) * postBoilColdL) / calc.preBoilVolumeL
      : calc.og;

  const firstMashTemp = recipe.mashSteps[0]?.temperatureC;
  const strikeTemp =
    firstMashTemp != null
      ? volumeCalculationService.calculateStrikeTemp(
          firstMashTemp,
          recipe.equipment.mashThicknessLPerKg
        )
      : undefined;

  // Build merged brew day checklist (smart defaults + user overrides)
  const checklist = mergeChecklist(recipe, calc);
  const checklistByStage = new Map<BrewDayStage, BrewDayChecklistItem[]>();
  for (const item of checklist) {
    if (!item.enabled) continue;
    const list = checklistByStage.get(item.stage) ?? [];
    list.push(item);
    checklistByStage.set(item.stage, list);
  }

  /** Render checklist items as a compact table */
  const renderChecklist = (title: string, ...stages: BrewDayStage[]) => {
    const items = stages.flatMap(s => checklistByStage.get(s) ?? []);
    if (items.length === 0) return;
    lines.push(`### ${title}`);
    lines.push("");
    lines.push("| ✓ | Check | Target |");
    lines.push("|:--|:--|:--|");
    for (const item of items) {
      lines.push(`| [ ] | ${item.label} | ${item.details ?? ""} |`);
    }
    lines.push("");
  };

  // ── Header ──────────────────────────────────────────────────────
  lines.push(`# ${recipe.name || "Untitled Recipe"}`);
  lines.push("");
  if (recipe.subtitle) {
    lines.push(`*${recipe.subtitle}*`);
    lines.push("");
  }
  if (recipe.style) {
    lines.push(`**${recipe.style}**`);
    lines.push("");
  }
  if (recipe.notes) {
    lines.push(`> ${recipe.notes.replace(/\n/g, "  \n> ")}`);
    lines.push("");
  }

  // ── Vital Statistics ────────────────────────────────────────────
  lines.push("## Vital Statistics");
  lines.push("");
  lines.push("| | |");
  lines.push("|:--|:--|");
  lines.push(
    `| **Batch Size** | ${fmt(recipe.batchVolumeL, 1)} L (${fmt(batchGal, 2)} gal) |`
  );
  lines.push(
    `| **Boil Time** | ${fmt(recipe.equipment.boilTimeMin, 0)} min |`
  );
  lines.push(
    `| **Efficiency** | ${fmt(recipe.equipment.mashEfficiencyPercent, 0)}% |`
  );
  lines.push(`| **Pre-Boil Gravity** | ${fmt(preBoilGravity, 3)} |`);
  lines.push(`| **OG** | ${fmt(calc.og, 3)} |`);
  lines.push(`| **FG** | ${fmt(calc.fg, 3)} |`);
  lines.push(`| **ABV** | ${fmt(calc.abv, 1)}% |`);
  lines.push(`| **IBU** | ${fmt(calc.ibu, 0)} |`);
  lines.push(`| **SRM** | ${fmt(calc.srm, 1)} |`);
  if (calc.estimatedMashPh != null) {
    lines.push(`| **Est. Mash pH** | ${fmt(calc.estimatedMashPh, 2)} |`);
  }
  lines.push(`| **BU:GU** | ${fmt(buGu, 2)} |`);
  lines.push(`| **Calories** | ${fmt(calc.calories, 0)} per 12 oz |`);
  lines.push(`| **Carbs** | ${fmt(calc.carbsG, 1)} g per 12 oz |`);
  lines.push("");

  // ══════════════════════════════════════════════════════════════════
  //  BREW DAY — sections ordered by when you need them
  // ══════════════════════════════════════════════════════════════════

  // ── 1. Water ────────────────────────────────────────────────────
  lines.push("## Water");
  lines.push("");
  lines.push("| | |");
  lines.push("|:--|--:|");
  if (strikeTemp != null) {
    lines.push(
      `| **Strike Temp** | ${fmt(strikeTemp, 1)}°C (${fmt(cToF(strikeTemp), 0)}°F) |`
    );
  }
  lines.push(
    `| **Mash Water** | ${fmt(calc.mashWaterL, 1)} L (${fmt(litersToGallons(calc.mashWaterL), 2)} gal) |`
  );
  lines.push(
    `| **Sparge Water** | ${fmt(calc.spargeWaterL, 1)} L (${fmt(litersToGallons(calc.spargeWaterL), 2)} gal) |`
  );
  lines.push(
    `| **Total Water** | ${fmt(calc.totalWaterL, 1)} L (${fmt(litersToGallons(calc.totalWaterL), 2)} gal) |`
  );
  lines.push(
    `| **Pre-Boil Volume** | ${fmt(calc.preBoilVolumeL, 1)} L (${fmt(litersToGallons(calc.preBoilVolumeL), 2)} gal) |`
  );
  lines.push(
    `| **Post-Boil Volume** | ${fmt(postBoilVolumeL, 1)} L (${fmt(litersToGallons(postBoilVolumeL), 2)} gal) |`
  );
  lines.push(
    `| **Batch Volume** | ${fmt(recipe.batchVolumeL, 1)} L (${fmt(batchGal, 2)} gal) |`
  );
  lines.push("");

  // Water chemistry (inline under Water)
  if (recipe.waterChemistry) {
    const w = recipe.waterChemistry;

    if (w.sourceProfileName || w.targetStyleName) {
      lines.push(
        `Source: **${w.sourceProfileName ?? "–"}** → Target: **${w.targetStyleName ?? "–"}**`
      );
      lines.push("");
    }

    const sa = w.saltAdditions;
    const hasSalts =
      (sa.gypsum_g ?? 0) > 0 ||
      (sa.cacl2_g ?? 0) > 0 ||
      (sa.epsom_g ?? 0) > 0 ||
      (sa.nacl_g ?? 0) > 0 ||
      (sa.nahco3_g ?? 0) > 0;

    if (hasSalts) {
      const totalWater = calc.totalWaterL || 1;
      const mashRatio = (calc.mashWaterL || 0) / totalWater;
      const spargeRatio = 1 - mashRatio;

      const splitSalt = (total: number | undefined): { mash: string; sparge: string } => {
        const t = total ?? 0;
        return { mash: fmt(t * mashRatio, 1), sparge: fmt(t * spargeRatio, 1) };
      };

      const gypsum = splitSalt(sa.gypsum_g);
      const cacl2 = splitSalt(sa.cacl2_g);
      const epsom = splitSalt(sa.epsom_g);
      const nacl = splitSalt(sa.nacl_g);
      const nahco3 = splitSalt(sa.nahco3_g);

      lines.push("### Salt Additions (g)");
      lines.push("");
      lines.push("| | Gypsum | CaCl₂ | Epsom | NaCl | Baking Soda |");
      lines.push("|:--|--:|--:|--:|--:|--:|");
      lines.push(
        `| **Mash** | ${gypsum.mash} | ${cacl2.mash} | ${epsom.mash} | ${nacl.mash} | ${nahco3.mash} |`
      );
      lines.push(
        `| **Sparge** | ${gypsum.sparge} | ${cacl2.sparge} | ${epsom.sparge} | ${nacl.sparge} | ${nahco3.sparge} |`
      );
      lines.push(
        `| **Total** | ${fmt(sa.gypsum_g, 1)} | ${fmt(sa.cacl2_g, 1)} | ${fmt(sa.epsom_g, 1)} | ${fmt(sa.nacl_g, 1)} | ${fmt(sa.nahco3_g, 1)} |`
      );
      lines.push("");
    }

    const adjustedProfile: WaterProfile = hasSalts
      ? addProfiles(
          w.sourceProfile,
          ionDeltaFromSalts(sa, calc.totalWaterL || 1)
        )
      : w.sourceProfile;

    lines.push("### Water Profile (ppm)");
    lines.push("");
    lines.push("| | Ca | Mg | Na | Cl | SO₄ | HCO₃ |");
    lines.push("|:--|--:|--:|--:|--:|--:|--:|");
    lines.push(
      `| **Source** | ${fmt(w.sourceProfile.Ca, 0)} | ${fmt(w.sourceProfile.Mg, 0)} | ${fmt(w.sourceProfile.Na, 0)} | ${fmt(w.sourceProfile.Cl, 0)} | ${fmt(w.sourceProfile.SO4, 0)} | ${fmt(w.sourceProfile.HCO3, 0)} |`
    );
    if (hasSalts) {
      lines.push(
        `| **Adjusted** | ${fmt(adjustedProfile.Ca, 0)} | ${fmt(adjustedProfile.Mg, 0)} | ${fmt(adjustedProfile.Na, 0)} | ${fmt(adjustedProfile.Cl, 0)} | ${fmt(adjustedProfile.SO4, 0)} | ${fmt(adjustedProfile.HCO3, 0)} |`
      );
    }
    lines.push("");
  }

  // ── 2. Fermentables ─────────────────────────────────────────────
  lines.push("## Fermentables");
  lines.push("");
  if (recipe.fermentables.length === 0) {
    lines.push("_No fermentables_");
  } else {
    lines.push("| Fermentable | Amount | % | Color | PPG |");
    lines.push("|:--|--:|--:|--:|--:|");
    recipe.fermentables.forEach((f) => {
      const pct = totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
      const lb = kgToLb(f.weightKg);
      lines.push(
        `| ${f.name} | ${fmt(f.weightKg, 2)} kg (${fmt(lb, 2)} lb) | ${fmt(pct, 1)}% | ${fmt(f.colorLovibond, 0)} °L | ${fmt(f.ppg, 0)} |`
      );
    });
    lines.push(
      `| **Total** | **${fmt(totalGrainKg, 2)} kg (${fmt(totalGrainLb, 2)} lb)** | | | |`
    );
  }
  lines.push("");

  // ── 3. Hops ─────────────────────────────────────────────────────
  lines.push("## Hops");
  lines.push("");
  if (recipe.hops.length === 0) {
    lines.push("_No hops_");
  } else {
    const batchGalForIbu = (recipe.batchVolumeL || 1) * 0.264172;
    const calcService = new RecipeCalculationService();

    // Sort: FW → boil (longest first) → whirlpool → mash → dry hop (by day, then name)
    const hopOrder: Record<string, number> = {
      "first wort": 0, boil: 1, whirlpool: 2, mash: 3, "dry hop": 4,
    };
    const sorted = [...recipe.hops].sort((a, b) => {
      const oa = hopOrder[a.type] ?? 5;
      const ob = hopOrder[b.type] ?? 5;
      if (oa !== ob) return oa - ob;
      // Dry hops: sort by start day, then by name
      if (a.type === "dry hop" && b.type === "dry hop") {
        const dayA = a.dryHopStartDay ?? Infinity;
        const dayB = b.dryHopStartDay ?? Infinity;
        if (dayA !== dayB) return dayA - dayB;
        return a.name.localeCompare(b.name);
      }
      return (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0);
    });

    lines.push("| Hop | Amount | AA | Use | Time | IBU |");
    lines.push("|:--|--:|--:|:--|:--|--:|");

    sorted.forEach((h) => {
      const oz = gToOz(h.grams);
      const hopIbu = calcService.calculateSingleHopIBU(h, calc.og, batchGalForIbu);
      lines.push(
        `| ${h.name} | ${fmt(h.grams, 0)} g (${fmt(oz, 2)} oz) | ${fmt(h.alphaAcid, 1)}% | ${formatHopUse(h)} | ${formatHopTime(h)} | ${fmt(hopIbu, 1)} |`
      );
    });

    const totalHopG = recipe.hops.reduce((s, h) => s + h.grams, 0);
    const totalHopOz = gToOz(totalHopG);
    lines.push(
      `| **Total** | **${fmt(totalHopG, 0)} g (${fmt(totalHopOz, 2)} oz)** | | | | **${fmt(calc.ibu, 0)}** |`
    );
  }
  lines.push("");

  // ── 4. Yeast ────────────────────────────────────────────────────
  lines.push("## Yeast");
  lines.push("");
  if (recipe.yeasts.length === 0) {
    lines.push("_No yeast_");
  } else {
    recipe.yeasts.forEach((y) => {
      const labLabel = y.laboratory ? ` (${y.laboratory})` : "";
      lines.push(
        `- **${y.name}**${labLabel} — ${fmt(y.attenuation * 100, 0)}% attenuation`
      );
      if (y.starter && y.starter.steps.length > 0) {
        lines.push(`  - **Starter:** ${y.starter.packs} pack(s), ${y.starter.yeastType}`);
        y.starter.steps.forEach((s, idx) => {
          const modelLabel =
            s.model.kind === "white"
              ? `White / ${s.model.aeration}`
              : "Braukaiser";
          lines.push(
            `    ${idx + 1}. ${fmt(s.liters, 2)} L @ ${fmt(s.gravity, 3)} — ${modelLabel}`
          );
        });
      }
    });
  }
  lines.push("");

  // ── 4b. Other Ingredients ──────────────────────────────────────
  if (recipe.otherIngredients && recipe.otherIngredients.length > 0) {
    lines.push("## Other Ingredients");
    lines.push("");
    lines.push("| Ingredient | Amount | Timing | Notes |");
    lines.push("|:--|--:|:--|:--|");
    recipe.otherIngredients.forEach((i) => {
      lines.push(
        `| ${i.name} | ${fmt(i.amount, 1)} ${i.unit} | ${capitalize(i.timing)} | ${i.notes || "–"} |`
      );
    });
    lines.push("");
  }

  // ── 5. Mash Schedule ────────────────────────────────────────────
  lines.push("## Mash");
  lines.push("");
  if (recipe.mashSteps.length === 0) {
    lines.push("_No mash steps_");
  } else {
    lines.push("| Step | Temperature | Duration |");
    lines.push("|:--|--:|--:|");
    recipe.mashSteps.forEach((s) => {
      const tempF = cToF(s.temperatureC);
      lines.push(
        `| ${s.name} | ${fmt(s.temperatureC, 0)}°C (${fmt(tempF, 0)}°F) | ${fmt(s.durationMinutes, 0)} min |`
      );
    });
  }
  lines.push("");

  // Checklist: brew day measurements & tests
  renderChecklist('Brew Day Checks', 'mash', 'pre-boil', 'post-boil', 'pitch');

  // ── 6. Fermentation ─────────────────────────────────────────────
  lines.push("## Fermentation");
  lines.push("");
  if (recipe.fermentationSteps.length === 0) {
    lines.push("_No fermentation steps_");
  } else {
    lines.push("| Step | Temperature | Duration | Notes |");
    lines.push("|:--|--:|--:|:--|");
    recipe.fermentationSteps.forEach((s) => {
      const tempF = cToF(s.temperatureC);
      lines.push(
        `| ${s.name || capitalize(s.type)} | ${fmt(s.temperatureC, 0)}°C (${fmt(tempF, 0)}°F) | ${fmt(s.durationDays, 0)} days | ${s.notes || "–"} |`
      );
    });
  }
  lines.push("");

  // Checklist: fermentation checks
  renderChecklist('Fermentation Checks', 'fermentation');

  // ── Equipment (reference) ───────────────────────────────────────
  lines.push("## Equipment");
  lines.push("");
  if (recipe.equipmentProfileName) {
    lines.push(`**${recipe.equipmentProfileName}**`);
    lines.push("");
  }
  lines.push("| | |");
  lines.push("|:--|--:|");
  lines.push(
    `| Boil Off Rate | ${fmt(recipe.equipment.boilOffRateLPerHour, 1)} L/hr |`
  );
  lines.push(
    `| Mash Thickness | ${fmt(recipe.equipment.mashThicknessLPerKg, 2)} L/kg |`
  );
  lines.push(
    `| Grain Absorption | ${fmt(recipe.equipment.grainAbsorptionLPerKg, 2)} L/kg |`
  );
  lines.push(
    `| Hop Absorption | ${fmt(recipe.equipment.hopsAbsorptionLPerKg, 2)} L/kg |`
  );
  lines.push(
    `| Mash Tun Deadspace | ${fmt(recipe.equipment.mashTunDeadspaceLiters, 1)} L |`
  );
  if (recipe.equipment.mashTunLossLiters > 0) {
    lines.push(
      `| Mash Tun Loss | ${fmt(recipe.equipment.mashTunLossLiters, 1)} L |`
    );
  }
  lines.push(
    `| Kettle Loss | ${fmt(recipe.equipment.kettleLossLiters, 1)} L |`
  );
  lines.push(
    `| Chiller Loss | ${fmt(recipe.equipment.chillerLossLiters, 1)} L |`
  );
  lines.push(
    `| Fermenter Loss | ${fmt(recipe.equipment.fermenterLossLiters, 1)} L |`
  );
  lines.push(
    `| Cooling Shrinkage | ${fmt(recipe.equipment.coolingShrinkagePercent, 1)}% |`
  );
  lines.push("");

  // ── Footer ──────────────────────────────────────────────────────
  lines.push("---");
  lines.push(
    `*Exported from BrewTool — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}*`
  );

  return lines.join("\n");
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function formatHopUse(h: Hop): string {
  switch (h.type) {
    case "boil":
      return "Boil";
    case "first wort":
      return "First Wort";
    case "whirlpool":
      return "Whirlpool";
    case "dry hop":
      return "Dry Hop";
    case "mash":
      return "Mash";
    default:
      return h.type;
  }
}

function formatHopTime(h: Hop): string {
  switch (h.type) {
    case "boil":
    case "first wort":
      return `${fmt(h.timeMinutes, 0)} min`;
    case "whirlpool": {
      const time = h.whirlpoolTimeMinutes ?? h.timeMinutes;
      const tempStr =
        h.temperatureC != null
          ? ` @ ${fmt(h.temperatureC, 0)}°C`
          : "";
      return `${fmt(time, 0)} min${tempStr}`;
    }
    case "dry hop": {
      const parts: string[] = [];
      if (h.dryHopStartDay != null) parts.push(`day ${h.dryHopStartDay}`);
      if (h.dryHopDays != null) parts.push(`${h.dryHopDays} days`);
      return parts.length > 0 ? parts.join(", ") : "–";
    }
    case "mash":
      return h.timeMinutes != null ? `${fmt(h.timeMinutes, 0)} min` : "–";
    default:
      return "–";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
