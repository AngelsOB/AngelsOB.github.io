"use client";

import { Fragment, useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";

import type {
  FermentationStep,
  FermentationStepType,
  Recipe,
  RecipeCalculations,
} from "@/modules/beta-builder/domain/models/Recipe";
import { waterChemistryService } from "@/modules/beta-builder/domain/services/WaterChemistryService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { hsTokens } from "@/modules/hopskip/tokens";

interface Props {
  recipe: Recipe;
  calculations: RecipeCalculations | null;
}

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
const lToGal = (l: number) => (l * 0.264172).toFixed(2);
const kgToLb = (kg: number) => (kg * 2.20462).toFixed(2);

type SaltAdditionsObj = NonNullable<
  NonNullable<Recipe["waterChemistry"]>["saltAdditions"]
>;

export default function HSBrewSheetSection({ recipe, calculations }: Props) {
  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  const hasData =
    calculations && (calculations.og > 1 || calculations.strikeTempC != null);

  if (!hasData || !calculations) {
    return (
      <section className="hs-print-area" style={pageStyle}>
        <PrintStyles />
        <TitleBlock onPrint={handlePrint} />
        <div
          style={{
            padding: "28px 22px",
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 12,
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
            textAlign: "center",
            lineHeight: 1.5,
            boxShadow: hsTokens.sh2,
          }}
        >
          Add fermentables and mash steps to see your brew sheet.
        </div>
      </section>
    );
  }

  // Derived data
  const boilOff =
    (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const postBoilHotL = Math.max(0, calculations.preBoilVolumeL - boilOff);
  const pitchTempC = recipe.fermentationSteps?.[0]?.temperatureC;
  const totalGrainKg = recipe.fermentables.reduce(
    (sum, f) => sum + f.weightKg,
    0,
  );
  const totalHopG = recipe.hops.reduce((sum, h) => sum + h.grams, 0);
  const apparentAttenuation =
    calculations.og > 1.0 && calculations.fg > 0
      ? Math.round(
          ((calculations.og - calculations.fg) / (calculations.og - 1)) * 100,
        )
      : 0;

  const salts = recipe.waterChemistry?.saltAdditions;
  const hasSalts =
    salts &&
    Object.values(salts).some((v): v is number => typeof v === "number" && v > 0);
  const saltSplit =
    hasSalts && salts
      ? waterChemistryService.splitSaltsProportionally(
          salts,
          calculations.mashWaterL,
          calculations.spargeWaterL,
        )
      : { mashSalts: {}, spargeSalts: {} };
  const mashSplitSalts = saltSplit.mashSalts as SaltAdditionsObj;
  const spargeSplitSalts = saltSplit.spargeSalts as SaltAdditionsObj;

  // Final mineral profile (source + salts dissolved in total water).
  // Renders only when both source profile and salts are present.
  const sourceProfile = recipe.waterChemistry?.sourceProfile;
  const finalProfile =
    sourceProfile && hasSalts && salts
      ? waterChemistryService.calculateFinalProfileFromTotalSalts(
          sourceProfile,
          salts,
          calculations.mashWaterL,
          calculations.spargeWaterL,
        )
      : null;

  // Hop flavor aggregate (gram-weighted, hops without inline flavor data skipped)
  const aggregateFlavor = computeAggregateHopFlavor(recipe.hops);

  // Other ingredients filtered by timing
  const mashAdditions = recipe.otherIngredients.filter((o) => o.timing === "mash");
  const boilAdditions = recipe.otherIngredients.filter(
    (o) => o.timing === "boil" || o.timing === "whirlpool",
  );

  // First/last runnings estimates.
  // First runnings = the wort drained before sparge. Assuming uniform extract
  // concentration in the mash, its SG equals the mash concentration:
  //   first SG = 1 + (preBoilSG - 1) × (preBoilVol / mashVol)
  // Last runnings target ≥ 1.010 — safety floor to avoid tannin extraction.
  const firstRunningsSG =
    calculations.mashWaterL > 0 && calculations.preBoilGravity > 1
      ? 1 +
        (calculations.preBoilGravity - 1) *
          (calculations.preBoilVolumeL / calculations.mashWaterL)
      : null;

  // Hop grouping
  const boilHops = recipe.hops
    .filter(
      (h) => h.type === "boil" || h.type === "first wort" || h.type === "mash",
    )
    .sort((a, b) => (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0));
  const whirlpoolHops = recipe.hops.filter((h) => h.type === "whirlpool");
  const dryHops = recipe.hops
    .filter((h) => h.type === "dry hop")
    .sort((a, b) => (a.dryHopStartDay ?? 0) - (b.dryHopStartDay ?? 0));

  return (
    <section className="hs-print-area" style={pageStyle}>
      <PrintStyles />
      <TitleBlock onPrint={handlePrint} />

      {/* Top strip: brew data + targets + yeast */}
      <div
        className="hs-print-cols-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <MiniTable
          title="Brew Data"
          accent={hsTokens.honey}
          rows={[
            { label: "Recipe", target: recipe.name || "—" },
            { label: "Beer Style", target: recipe.style || "—" },
            { label: "Brew Date", actualSlot: true },
            { label: "Brew #", actualSlot: true },
            { label: "Brewer", actualSlot: true },
            {
              left: {
                label: "Batch Volume",
                target: `${recipe.batchVolumeL.toFixed(1)} L`,
                hint: `${lToGal(recipe.batchVolumeL)} gal`,
              },
              topRight: {
                label: "Mash",
                target: `${calculations.mashWaterL.toFixed(1)} L`,
                hint: `${lToGal(calculations.mashWaterL)} gal`,
              },
              bottomRight: {
                label: "Sparge",
                target: `${calculations.spargeWaterL.toFixed(1)} L`,
                hint: `${lToGal(calculations.spargeWaterL)} gal`,
              },
            },
          ]}
        />
        <MiniTable
          title="Targets"
          accent={hsTokens.malt}
          rows={[
            { label: "OG", target: calculations.og.toFixed(3), actualSlot: true },
            { label: "FG", target: calculations.fg.toFixed(3), actualSlot: true },
            {
              label: "ABV",
              target: `${calculations.abv.toFixed(1)} %`,
              actualSlot: true,
            },
            { label: "IBU", target: `${Math.round(calculations.ibu)}` },
            {
              label: "SRM",
              target: (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: srmToRgb(calculations.srm),
                      border: `1px solid ${hsTokens.ink}`,
                    }}
                  />
                  {calculations.srm.toFixed(1)}
                </span>
              ),
            },
            {
              label: "Mash pH",
              target:
                calculations.estimatedMashPh != null
                  ? calculations.estimatedMashPh.toFixed(2)
                  : "—",
              actualSlot: true,
            },
          ]}
        />
        <MiniTable
          title="Yeast"
          accent={hsTokens.yeast}
          rows={buildYeastRows(recipe, pitchTempC)}
        />
      </div>

      {/* 01 Ingredients — category header + 2 sub-framed sections */}
      <CategoryHeader
        eyebrow="01"
        title="Ingredients"
        accent={hsTokens.malt}
        scriptNote="prep before brew day ✦"
      />
      <div
        className="hs-print-cols-2"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        <ScheduleSection
          title="Grains"
          accent={hsTokens.malt}
          compactHeader
        >
          {recipe.fermentables.length === 0 ? (
            <EmptyRow text="No fermentables — add grains in the Fermentables tab." />
          ) : (
            <Table>
              <THead
                columns={[
                  { label: "Grain", width: "auto" },
                  { label: "kg", width: "70px", align: "center" },
                  { label: "lb", width: "70px", align: "center" },
                  { label: "%", width: "60px", align: "center" },
                ]}
              />
              <tbody>
                {recipe.fermentables.map((f, i) => {
                  const pct =
                    totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
                  const srmApprox = Math.max(
                    0,
                    f.colorLovibond * 1.3546 - 0.76,
                  );
                  return (
                    <tr key={f.id ?? i}>
                      <Td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: srmToRgb(srmApprox),
                              border: `1px solid ${hsTokens.ink}`,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>
                            {f.name || "Unnamed grain"}
                          </span>
                        </span>
                      </Td>
                      <Td align="center" font="mono">
                        {f.weightKg.toFixed(2)}
                      </Td>
                      <Td align="center" font="mono">
                        {kgToLb(f.weightKg)}
                      </Td>
                      <Td align="center" font="mono">
                        {pct.toFixed(1)}%
                      </Td>
                    </tr>
                  );
                })}
                <tr>
                  <Td>
                    <span
                      style={{
                        fontWeight: 600,
                        color: hsTokens.muted,
                        textTransform: "uppercase",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                      }}
                    >
                      Total
                    </span>
                  </Td>
                  <Td align="center" font="mono">
                    <strong>{totalGrainKg.toFixed(2)}</strong>
                  </Td>
                  <Td align="center" font="mono">
                    <strong>{kgToLb(totalGrainKg)}</strong>
                  </Td>
                  <Td align="center" font="mono">
                    100%
                  </Td>
                </tr>
              </tbody>
            </Table>
          )}
        </ScheduleSection>

        <ScheduleSection
          title="Hops"
          accent={hsTokens.hops}
          compactHeader
        >
          {recipe.hops.length === 0 ? (
            <EmptyRow text="No hops — add additions in the Hops tab." />
          ) : (
            <HopsList
              boilHops={boilHops}
              whirlpoolHops={whirlpoolHops}
              dryHops={dryHops}
              totalHopG={totalHopG}
              flavor={aggregateFlavor}
            />
          )}
        </ScheduleSection>
      </div>

      {/* 02 Water — matrix: Mash | Sparge × (Target | Actual), rows = volume / temp / salts / adjustments */}
      <ScheduleSection
        title="Water"
        eyebrow="02"
        accent={hsTokens.water}
        scriptNote="measure carefully ✦"
      >
        <WaterMatrix
          mashWaterL={calculations.mashWaterL}
          spargeWaterL={calculations.spargeWaterL}
          totalWaterL={calculations.totalWaterL}
          strikeTempC={calculations.strikeTempC}
          spargeTempC={76}
          salts={hasSalts ? (salts as SaltAdditionsObj) : undefined}
          mashSalts={mashSplitSalts}
          spargeSalts={spargeSplitSalts}
          mashPhAdjustment={calculations.mashPhAdjustment}
          estimatedMashPh={calculations.estimatedMashPh}
          finalProfile={finalProfile}
        />
      </ScheduleSection>

      {/* 03 Mash — stat strip + schedule + measurements log + (optional) additions */}
      <ScheduleSection
        title="Mash"
        eyebrow="03"
        accent={hsTokens.roast}
        scriptNote="hit your rests ✦"
      >
        {recipe.mashSteps.length === 0 ? (
          <EmptyRow text="No mash schedule — add steps in the Mash tab." />
        ) : (
          <div className="hs-mash-schedule">
            <Table>
              <THead
                columns={[
                  { label: "Step", width: "auto" },
                  { label: "Temp", width: "180px", align: "center" },
                  { label: "Duration", width: "120px", align: "center" },
                  { label: "Actual Temp", width: "160px", align: "center", isActual: true },
                  { label: "Time Hit", width: "140px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {recipe.mashSteps.map((s, i) => (
                  <tr key={s.id ?? i}>
                    <td style={mashStepCellStyle}>
                      <span style={mashStepIndexStyle}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={mashStepNameStyle}>
                        {s.name || `Step ${i + 1}`}
                      </span>
                    </td>
                    <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
                      <span style={mashStepValueStyle}>
                        {s.temperatureC.toFixed(1)} °C
                      </span>
                      <span style={mashStepHintStyle}>
                        {cToF(s.temperatureC)} °F
                      </span>
                    </td>
                    <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
                      <span style={mashStepValueStyle}>
                        {s.durationMinutes} min
                      </span>
                    </td>
                    <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>
                      &nbsp;
                    </td>
                    <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>
                      &nbsp;
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        {/* Mash additions (whirlfloc/yeast nutrient added at mash, lactic, etc.) */}
        {mashAdditions.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <Table>
              <THead
                columns={[
                  { label: "Mash addition", width: "auto" },
                  { label: "Amount", width: "120px", align: "center" },
                  { label: "Actual", width: "120px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {mashAdditions.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <span style={{ fontWeight: 600 }}>{o.name}</span>
                      {o.notes ? <span style={hintStyle}>{o.notes}</span> : null}
                    </Td>
                    <Td align="center" font="mono">
                      {o.amount} {o.unit}
                    </Td>
                    <ActualTd />
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}

        {/* Mash checks log — subordinated below the schedule */}
        <MashChecks
          firstRunningsSG={firstRunningsSG}
        />
      </ScheduleSection>

      {/* 04 Boil — numbers (2-col) + combined additions (hops + other) */}
      <ScheduleSection
        title="Boil"
        eyebrow="04"
        accent={hsTokens.hops}
        scriptNote="rolling boil ✦"
      >
        <BoilNumbersMatrix
          preBoilVolumeL={calculations.preBoilVolumeL}
          preBoilGravity={calculations.preBoilGravity}
          boilTimeMin={recipe.equipment.boilTimeMin}
          boilOffRateLPerHour={recipe.equipment.boilOffRateLPerHour}
          boilOff={boilOff}
          postBoilHotL={postBoilHotL}
          og={calculations.og}
        />

        {/* Additions section: hops (boil + whirlpool) + other (whirlfloc, nutrient) */}
        {boilHops.length > 0 || whirlpoolHops.length > 0 || boilAdditions.length > 0 ? (
          <>
            <SubLabel>Additions</SubLabel>
            <BoilAdditionsTable
              boilHops={boilHops}
              whirlpoolHops={whirlpoolHops}
              otherAdditions={boilAdditions}
            />
          </>
        ) : null}
      </ScheduleSection>

      {/* 05 Fermentation — schedule is primary; pitch temp is a small lead-in chip */}
      <ScheduleSection
        title="Fermentation"
        eyebrow="05"
        accent={hsTokens.yeast}
        scriptNote="patience pays ✦"
      >
        <PitchTempChip pitchTempC={pitchTempC} />

        {recipe.fermentationSteps.length === 0 ? (
          <EmptyRow text="No fermentation steps — add them in the Fermentation tab." />
        ) : (
          <div className="hs-ferment-schedule">
            <Table>
              <THead
                columns={[
                  { label: "Step", width: "auto" },
                  { label: "Type", width: "150px" },
                  { label: "Temp", width: "180px", align: "center" },
                  { label: "Duration", width: "120px", align: "center" },
                  { label: "Actual Temp", width: "160px", align: "center", isActual: true },
                  { label: "Actual Days", width: "140px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {recipe.fermentationSteps.map((s, i) => (
                  <FermentRow key={s.id ?? i} step={s} index={i} />
                ))}
                <tr>
                  <td style={mashStepCellStyle} colSpan={2}>&nbsp;</td>
                  <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
                    <span style={mashStepNameStyle}>FG target</span>
                    <span style={mashStepHintStyle}>
                      {apparentAttenuation}% apparent attenuation
                    </span>
                  </td>
                  <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
                    <span style={mashStepValueStyle}>
                      {calculations.fg.toFixed(3)}
                    </span>
                  </td>
                  <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>
                    &nbsp;
                  </td>
                  <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>
                    &nbsp;
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        )}
      </ScheduleSection>

      {/* 06 Gravity log — blank rows for writing */}
      <ScheduleSection
        title="Gravity Log"
        eyebrow="06"
        accent={hsTokens.malt}
        scriptNote="track every reading ✦"
        compactHeader
      >
        <Table>
          <THead
            columns={[
              { label: "Date", width: "120px", isActual: true },
              { label: "SG", width: "100px", align: "center", isActual: true },
              { label: "pH", width: "90px", align: "center", isActual: true },
              { label: "Temp °C", width: "100px", align: "center", isActual: true },
              { label: "Notes", width: "auto", isActual: true },
            ]}
          />
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                <ActualTd />
                <ActualTd />
                <ActualTd />
                <ActualTd />
                <ActualTd />
              </tr>
            ))}
          </tbody>
        </Table>
      </ScheduleSection>

      {/* Footer note for paper */}
      <div
        className="hs-print-only"
        style={{
          marginTop: 6,
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
          textAlign: "right",
        }}
      >
        — generated from {recipe.name} · {totalGrainKg.toFixed(2)} kg grain ·{" "}
        {totalHopG.toFixed(0)} g hops
      </div>
    </section>
  );
}

/* ─────────────────── styles ─────────────────── */

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: "0 0 14px 14px",
  boxShadow: hsTokens.sh3,
};

const hintStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.body,
  fontSize: 10,
  color: hsTokens.muted,
  marginTop: 2,
  fontWeight: 400,
  letterSpacing: 0,
  textTransform: "none",
};

/* mash step row — bolder + bigger than default Td to feel like the main mash content */

const mashStepCellStyle: CSSProperties = {
  padding: "12px 12px",
  borderBottom: `1.5px solid ${hsTokens.ink}`,
  fontFamily: hsTokens.body,
  fontSize: 14,
  color: hsTokens.ink,
  verticalAlign: "middle",
  lineHeight: 1.3,
};

const mashStepIndexStyle: CSSProperties = {
  fontFamily: hsTokens.display,
  fontSize: 18,
  color: hsTokens.muted,
  marginRight: 12,
  fontVariantNumeric: "tabular-nums",
  opacity: 0.55,
};

const mashStepNameStyle: CSSProperties = {
  fontFamily: hsTokens.display,
  fontSize: 16,
  letterSpacing: "-0.015em",
  color: hsTokens.ink,
};

const mashStepValueStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.display,
  fontSize: 18,
  letterSpacing: "-0.02em",
  color: hsTokens.ink,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
};

const mashStepHintStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.mono,
  fontSize: 10,
  color: hsTokens.muted,
  fontVariantNumeric: "tabular-nums",
  marginTop: 3,
  lineHeight: 1,
};

const mashStepActualStyle: CSSProperties = {
  borderLeft: `1px solid ${hsTokens.ink}`,
  background: hsTokens.cream,
  minHeight: 36,
};

/* ─────────────────── title block (with print button) ─────────────────── */

function TitleBlock({ onPrint }: { onPrint: () => void }) {
  return (
    <header
      className="hs-print-hide"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 4,
      }}
    >
      <div>
        <div style={{ marginBottom: 4 }}>
          <HSScriptNote color={hsTokens.honey} size={20} rotate={-3}>
            brew day —
          </HSScriptNote>
        </div>
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(28px, 4vw, 40px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            color: hsTokens.ink,
            margin: 0,
          }}
        >
          Brew sheet.
        </h2>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.muted,
            marginTop: 6,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          Every target your brew day will need — read top to bottom, kettle to fermenter.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <IconButton onClick={onPrint} label="Print" title="Print brew sheet">
          <PrinterIcon />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  onClick,
  label,
  title,
  children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 8,
        boxShadow: hsTokens.sh1,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function PrinterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

/* ─────────────────── schedule section frame ─────────────────── */

function ScheduleSection({
  title,
  eyebrow,
  accent,
  scriptNote,
  compactHeader,
  children,
}: {
  title: string;
  eyebrow?: string;
  accent: string;
  scriptNote?: string;
  compactHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="hs-print-block"
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: compactHeader ? "12px 14px 8px" : "16px 16px 12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {eyebrow ? (
            <span
              style={{
                fontFamily: hsTokens.display,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {eyebrow}
            </span>
          ) : null}
          <h3
            style={{
              fontFamily: hsTokens.display,
              fontSize: compactHeader ? 16 : 18,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: hsTokens.ink,
              margin: 0,
              textTransform: "none",
            }}
          >
            {title}
          </h3>
        </div>
        {scriptNote ? (
          <HSScriptNote color={accent} size={16} rotate={-4}>
            {scriptNote}
          </HSScriptNote>
        ) : null}
      </header>
      <div style={{ padding: "0 12px 12px" }}>{children}</div>
    </section>
  );
}

function CategoryHeader({
  eyebrow,
  title,
  accent,
  scriptNote,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  scriptNote?: string;
}) {
  return (
    <header
      className="hs-print-block"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 4px 0",
        marginTop: 4,
        marginBottom: -6,
        borderBottom: `2px solid ${accent}`,
        paddingBottom: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {eyebrow}
        </span>
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: 22,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            color: hsTokens.ink,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {scriptNote ? (
        <HSScriptNote color={accent} size={17} rotate={-4}>
          {scriptNote}
        </HSScriptNote>
      ) : null}
    </header>
  );
}

/* ─────────────────── mini-table (top strip) ─────────────────── */

interface MiniRow {
  label: string;
  target?: ReactNode;
  hint?: string;
  actualSlot?: boolean;
}

type MiniRowEntry =
  | MiniRow
  | [MiniRow, MiniRow]
  | { left: MiniRow; topRight: MiniRow; bottomRight: MiniRow };

function isPairEntry(entry: MiniRowEntry): entry is [MiniRow, MiniRow] {
  return Array.isArray(entry);
}

function isSplitRightEntry(
  entry: MiniRowEntry,
): entry is { left: MiniRow; topRight: MiniRow; bottomRight: MiniRow } {
  return !Array.isArray(entry) && "topRight" in entry;
}

function MiniTable({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: MiniRowEntry[];
}) {
  return (
    <section
      className="hs-print-block"
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <div
        className="hs-mini-title"
        style={{
          padding: "12px 12px 8px",
          fontFamily: hsTokens.display,
          fontSize: 13,
          color: hsTokens.ink,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
        }}
      >
        {title}
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: hsTokens.body,
          fontSize: 12,
          tableLayout: "auto",
        }}
      >
        <tbody>
          {rows.map((entry, i) => {
            if (isPairEntry(entry)) {
              const [a, b] = entry;
              return (
                <tr key={`${i}-${a.label}-${b.label}`}>
                  <MiniLabelCell label={a.label} />
                  <MiniValueCell row={a} />
                  <MiniLabelCell label={b.label} bordered />
                  <MiniValueCell row={b} />
                </tr>
              );
            }
            if (isSplitRightEntry(entry)) {
              return (
                <Fragment key={`${i}-${entry.left.label}-split`}>
                  <tr>
                    <MiniLabelCell label={entry.left.label} rowSpan={2} />
                    <MiniValueCell row={entry.left} rowSpan={2} />
                    <MiniLabelCell label={entry.topRight.label} bordered compact />
                    <MiniValueCell row={entry.topRight} compact />
                  </tr>
                  <tr>
                    <MiniLabelCell label={entry.bottomRight.label} bordered compact />
                    <MiniValueCell row={entry.bottomRight} compact />
                  </tr>
                </Fragment>
              );
            }
            return (
              <tr key={`${i}-${entry.label}`}>
                <MiniLabelCell label={entry.label} />
                <MiniValueCell row={entry} colSpan={3} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function MiniLabelCell({
  label,
  bordered,
  rowSpan,
  compact,
}: {
  label: string;
  bordered?: boolean;
  rowSpan?: number;
  compact?: boolean;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className="hs-mini-label-cell"
      style={{
        padding: compact ? "2px 12px" : "5px 12px",
        borderTop: `1px solid ${hsTokens.ink}`,
        borderRight: `1px solid ${hsTokens.ink}`,
        borderLeft: bordered ? `1px solid ${hsTokens.ink}` : undefined,
        color: hsTokens.muted,
        fontWeight: 600,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: hsTokens.cream2,
        textAlign: "right",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {label}
    </td>
  );
}

function MiniValueCell({
  row,
  colSpan,
  rowSpan,
  compact,
}: {
  row: MiniRow;
  colSpan?: number;
  rowSpan?: number;
  compact?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className="hs-mini-value-cell"
      style={{
        padding: compact ? "2px 10px" : "5px 10px",
        borderTop: `1px solid ${hsTokens.ink}`,
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 600,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        background: row.actualSlot && !row.target ? hsTokens.cream : hsTokens.paper,
        lineHeight: 1.2,
      }}
    >
      {row.target ?? (
        <span style={{ color: hsTokens.muted, fontStyle: "italic", fontWeight: 400 }}>
          —
        </span>
      )}
      {row.hint ? (
        <span
          style={{
            display: compact ? "inline" : "block",
            fontSize: 10,
            color: hsTokens.muted,
            fontWeight: 400,
            marginLeft: compact ? 6 : 0,
            marginTop: compact ? 0 : 1,
          }}
        >
          {compact ? `· ${row.hint}` : row.hint}
        </span>
      ) : null}
    </td>
  );
}

/* ─────────────────── water matrix ─────────────────── */

interface WaterMatrixProps {
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
  strikeTempC: number | null;
  spargeTempC: number;
  salts?: SaltAdditionsObj;
  mashSalts: SaltAdditionsObj;
  spargeSalts: SaltAdditionsObj;
  mashPhAdjustment: RecipeCalculations["mashPhAdjustment"];
  estimatedMashPh: RecipeCalculations["estimatedMashPh"];
  finalProfile: import("@/modules/beta-builder/domain/services/WaterChemistryService").WaterProfile | null;
}

const SALT_DEFS: Array<{ key: keyof SaltAdditionsObj; label: string; unit: string }> = [
  { key: "gypsum_g", label: "Gypsum (CaSO₄)", unit: "g" },
  { key: "cacl2_g", label: "Calcium Chloride (CaCl₂)", unit: "g" },
  { key: "epsom_g", label: "Epsom (MgSO₄)", unit: "g" },
  { key: "nacl_g", label: "Salt (NaCl)", unit: "g" },
  { key: "nahco3_g", label: "Baking Soda (NaHCO₃)", unit: "g" },
];

function WaterMatrix({
  mashWaterL,
  spargeWaterL,
  totalWaterL,
  strikeTempC,
  spargeTempC,
  salts,
  mashSalts,
  spargeSalts,
  mashPhAdjustment,
  estimatedMashPh,
  finalProfile,
}: WaterMatrixProps) {
  const visibleSalts = salts
    ? SALT_DEFS.filter((d) => {
        const v = salts[d.key];
        return typeof v === "number" && v > 0;
      })
    : [];

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: hsTokens.body,
        fontSize: 13,
        tableLayout: "auto",
      }}
    >
      <thead>
        <tr>
          <th
            rowSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              textAlign: "left",
              background: hsTokens.cream2,
            }}
          >
            Measurement
          </th>
          <th
            colSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Mash
          </th>
          <th
            colSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Sparge
          </th>
        </tr>
        <tr>
          <th
            style={{
              ...matrixHeadSubStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Target
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              background: hsTokens.cream,
              color: hsTokens.muted,
            }}
          >
            Actual
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Target
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              background: hsTokens.cream,
              color: hsTokens.muted,
            }}
          >
            Actual
          </th>
        </tr>
      </thead>
      <tbody>
        {/* Volume row */}
        <MatrixRow
          label="Volume"
          mashTarget={`${mashWaterL.toFixed(1)} L`}
          mashHint={`${lToGal(mashWaterL)} gal`}
          spargeTarget={`${spargeWaterL.toFixed(1)} L`}
          spargeHint={`${lToGal(spargeWaterL)} gal`}
        />
        {/* Temp row */}
        <MatrixRow
          label="Strike / sparge temp"
          mashTarget={
            strikeTempC != null
              ? `${strikeTempC.toFixed(1)} °C`
              : "—"
          }
          mashHint={strikeTempC != null ? `${cToF(strikeTempC)} °F` : undefined}
          spargeTarget={`${spargeTempC.toFixed(0)} °C`}
          spargeHint={`${cToF(spargeTempC)} °F`}
        />
        {/* Salt rows */}
        {visibleSalts.map((def) => {
          const mashVal = mashSalts[def.key] ?? 0;
          const spargeVal = spargeSalts[def.key] ?? 0;
          return (
            <MatrixRow
              key={def.key}
              label={def.label}
              mashTarget={
                mashVal > 0 ? `${mashVal.toFixed(2)} ${def.unit}` : "—"
              }
              spargeTarget={
                spargeVal > 0 ? `${spargeVal.toFixed(2)} ${def.unit}` : "—"
              }
            />
          );
        })}
        {/* Mash-only adjustments */}
        {mashPhAdjustment && mashPhAdjustment.lacticAcid88Ml > 0 ? (
          <MatrixRow
            label="Lactic Acid (88%)"
            labelHint={`to pH ${mashPhAdjustment.targetPh.toFixed(2)}`}
            mashTarget={`${mashPhAdjustment.lacticAcid88Ml.toFixed(2)} mL`}
            spargeOmit
          />
        ) : null}
        {mashPhAdjustment && mashPhAdjustment.bakingSodaG > 0 ? (
          <MatrixRow
            label="Baking Soda (pH adj.)"
            labelHint={`to pH ${mashPhAdjustment.targetPh.toFixed(2)}`}
            mashTarget={`${mashPhAdjustment.bakingSodaG.toFixed(2)} g`}
            spargeOmit
          />
        ) : null}
        {/* Estimated mash pH — mash-only target */}
        <MatrixRow
          label="Estimated mash pH"
          labelHint="target 5.2–5.6"
          mashTarget={
            estimatedMashPh != null ? estimatedMashPh.toFixed(2) : "—"
          }
          spargeOmit
        />
        {/* Final profile + Total water — share one summary row */}
        <tr>
          <td
            colSpan={5}
            style={{
              padding: "8px 12px",
              borderTop: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.ink,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ textAlign: "left" }}>
                {finalProfile ? (
                  <>
                    <span
                      style={{
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: hsTokens.muted,
                        marginRight: 10,
                      }}
                    >
                      Final profile (ppm)
                    </span>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 12,
                        color: hsTokens.ink,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Ca {Math.round(finalProfile.Ca)} · Mg{" "}
                      {Math.round(finalProfile.Mg)} · Na{" "}
                      {Math.round(finalProfile.Na)} · Cl{" "}
                      {Math.round(finalProfile.Cl)} · SO₄{" "}
                      {Math.round(finalProfile.SO4)} · HCO₃{" "}
                      {Math.round(finalProfile.HCO3)}
                    </span>
                  </>
                ) : null}
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                    marginRight: 10,
                  }}
                >
                  Total water
                </span>
                <span style={{ fontFamily: hsTokens.display, fontSize: 14 }}>
                  {totalWaterL.toFixed(1)} L · {lToGal(totalWaterL)} gal
                </span>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const matrixHeadGroupStyle: CSSProperties = {
  padding: "6px 10px",
  fontFamily: hsTokens.body,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: hsTokens.ink,
  borderTop: `1.5px solid ${hsTokens.ink}`,
  borderBottom: `1px solid ${hsTokens.ink}`,
  textAlign: "center",
};

const matrixHeadSubStyle: CSSProperties = {
  padding: "5px 8px",
  fontFamily: hsTokens.body,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderBottom: `1.5px solid ${hsTokens.ink}`,
  color: hsTokens.ink,
  textAlign: "center",
  whiteSpace: "nowrap",
};

function MatrixRow({
  label,
  labelHint,
  mashTarget,
  mashHint,
  spargeTarget,
  spargeHint,
  spargeOmit,
}: {
  label: string;
  labelHint?: string;
  mashTarget: string;
  mashHint?: string;
  spargeTarget?: string;
  spargeHint?: string;
  spargeOmit?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${hsTokens.ink}`,
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.ink,
          verticalAlign: "middle",
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        {labelHint ? <span style={hintStyle}>{labelHint}</span> : null}
      </td>
      <MatrixValueCell content={mashTarget} hint={mashHint} bordered />
      <MatrixActualCell />
      <MatrixValueCell
        content={spargeOmit ? "—" : spargeTarget ?? "—"}
        hint={spargeOmit ? undefined : spargeHint}
        bordered
        muted={spargeOmit}
      />
      {spargeOmit ? <MatrixDashCell /> : <MatrixActualCell />}
    </tr>
  );
}

function MatrixValueCell({
  content,
  hint,
  bordered,
  muted,
}: {
  content: string;
  hint?: string;
  bordered?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: bordered ? `1.5px solid ${hsTokens.ink}` : undefined,
        fontFamily: hsTokens.mono,
        fontSize: 12,
        color: muted ? hsTokens.muted : hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.3,
        background: hsTokens.paper,
      }}
    >
      {content}
      {hint ? (
        <span
          style={{
            display: "block",
            fontFamily: hsTokens.body,
            fontSize: 10,
            color: hsTokens.muted,
            marginTop: 1,
          }}
        >
          {hint}
        </span>
      ) : null}
    </td>
  );
}

function MatrixActualCell() {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        minHeight: 28,
        height: 28,
      }}
    >
      &nbsp;
    </td>
  );
}

function MatrixDashCell() {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        color: hsTokens.muted,
        fontFamily: hsTokens.mono,
        fontSize: 11,
        textAlign: "center",
        verticalAlign: "middle",
      }}
    >
      —
    </td>
  );
}

/* ─────────────────── hops list with side flavor radar ─────────────────── */

function HopsList({
  boilHops,
  whirlpoolHops,
  dryHops,
  totalHopG,
  flavor,
}: {
  boilHops: Recipe["hops"];
  whirlpoolHops: Recipe["hops"];
  dryHops: Recipe["hops"];
  totalHopG: number;
  flavor: HopFlavorVector | null;
}) {
  return (
    <div
      className="hs-print-stack"
      style={{
        display: "grid",
        gridTemplateColumns: flavor ? "minmax(0, 1fr) 200px" : "1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <HopHeaderRow />

        {boilHops.length > 0 ? <HopGroupRow label="Boil" accent={hsTokens.hops} /> : null}
        {boilHops.map((h) => (
          <HopDataRow
            key={h.id}
            timeLabel={
              h.type === "first wort"
                ? "first wort"
                : h.type === "mash"
                ? "mash"
                : `${h.timeMinutes ?? 0} min`
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
          />
        ))}

        {whirlpoolHops.length > 0 ? (
          <HopGroupRow label="Whirlpool" accent={hsTokens.honey} />
        ) : null}
        {whirlpoolHops.map((h) => (
          <HopDataRow
            key={h.id}
            timeLabel={
              h.temperatureC != null
                ? `${h.temperatureC.toFixed(0)} °C${
                    h.whirlpoolTimeMinutes != null
                      ? ` · ${h.whirlpoolTimeMinutes}′`
                      : ""
                  }`
                : "whirlpool"
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
          />
        ))}

        {dryHops.length > 0 ? (
          <HopGroupRow label="Dry hop" accent={hsTokens.hops} />
        ) : null}
        {dryHops.map((h) => (
          <HopDataRow
            key={h.id}
            timeLabel={
              h.dryHopStartDay != null
                ? `day ${h.dryHopStartDay}${
                    h.dryHopDays != null ? ` · ${h.dryHopDays}d` : ""
                  }`
                : "dry hop"
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
          />
        ))}

        <HopTotalRow totalHopG={totalHopG} />
      </div>

      {flavor ? (
        <div style={{ textAlign: "center" }} aria-label="Estimated hop flavor">
          <HopFlavorMini flavor={flavor} size={190} />
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              marginTop: -4,
            }}
          >
            Est. flavor
          </div>
        </div>
      ) : null}
    </div>
  );
}

const HOP_GRID_COLS = "minmax(96px, 110px) 1fr minmax(60px, 70px) minmax(50px, 60px)";

function HopHeaderRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: HOP_GRID_COLS,
        borderTop: `1.5px solid ${hsTokens.ink}`,
        borderBottom: `1.5px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
      }}
    >
      <HopHeaderCell>Stage / Time</HopHeaderCell>
      <HopHeaderCell>Variety</HopHeaderCell>
      <HopHeaderCell align="center">Grams</HopHeaderCell>
      <HopHeaderCell align="center">AA %</HopHeaderCell>
    </div>
  );
}

function HopHeaderCell({
  children,
  align,
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        textAlign: align ?? "left",
      }}
    >
      {children}
    </div>
  );
}

function HopGroupRow({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        background: hsTokens.cream2,
        fontFamily: hsTokens.body,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderTop: `1px solid ${hsTokens.ink}`,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent,
          border: `1px solid ${hsTokens.ink}`,
          marginRight: 8,
          verticalAlign: "middle",
        }}
      />
      {label}
    </div>
  );
}

function HopDataRow({
  timeLabel,
  name,
  grams,
  aa,
}: {
  timeLabel: string;
  name: string;
  grams: number;
  aa: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: HOP_GRID_COLS,
        borderBottom: `1px solid ${hsTokens.ink}`,
      }}
    >
      <HopDataCell font="mono">{timeLabel}</HopDataCell>
      <HopDataCell>
        <span style={{ fontWeight: 600 }}>{name || "Unnamed hop"}</span>
      </HopDataCell>
      <HopDataCell align="center" font="mono">
        {grams}
      </HopDataCell>
      <HopDataCell align="center" font="mono">
        {aa.toFixed(1)}%
      </HopDataCell>
    </div>
  );
}

function HopDataCell({
  children,
  align,
  font,
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  font?: "body" | "mono";
}) {
  return (
    <div
      className="hs-hop-data-cell"
      style={{
        padding: "8px 10px",
        fontFamily: font === "mono" ? hsTokens.mono : hsTokens.body,
        fontSize: 12,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: align ?? "left",
        verticalAlign: "middle",
        lineHeight: 1.3,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function HopTotalRow({ totalHopG }: { totalHopG: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: HOP_GRID_COLS,
        borderBottom: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
      }}
    >
      <HopDataCell>
        <span
          style={{
            fontWeight: 600,
            color: hsTokens.muted,
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          Total
        </span>
      </HopDataCell>
      <HopDataCell />
      <HopDataCell align="center" font="mono">
        <strong>{totalHopG.toFixed(0)} g</strong>
      </HopDataCell>
      <HopDataCell />
    </div>
  );
}

/* ─────────────────── table primitives ─────────────────── */

function Table({ children }: { children: ReactNode }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: hsTokens.body,
        fontSize: 13,
        tableLayout: "auto",
      }}
    >
      {children}
    </table>
  );
}

interface ColumnDef {
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  isActual?: boolean;
}

function THead({ columns }: { columns: ColumnDef[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c, i) => (
          <th
            key={i}
            style={{
              padding: "8px 10px",
              fontFamily: hsTokens.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: c.isActual ? hsTokens.muted : hsTokens.ink,
              background: c.isActual ? hsTokens.cream : hsTokens.cream2,
              borderTop: `1.5px solid ${hsTokens.ink}`,
              borderBottom: `1.5px solid ${hsTokens.ink}`,
              borderLeft: i > 0 ? `1px solid ${hsTokens.ink}` : "none",
              textAlign: c.align ?? "left",
              width: c.width,
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Td({
  children,
  align,
  font,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  font?: "body" | "mono" | "display";
  colSpan?: number;
}) {
  const fontFamily =
    font === "mono"
      ? hsTokens.mono
      : font === "display"
      ? hsTokens.display
      : hsTokens.body;
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        fontFamily,
        fontSize: 12,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: align ?? "left",
        verticalAlign: "middle",
        lineHeight: 1.3,
      }}
    >
      {children}
    </td>
  );
}

function ActualTd() {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        minHeight: 28,
        height: 28,
      }}
    >
      &nbsp;
    </td>
  );
}

function BoilNumbersMatrix({
  preBoilVolumeL,
  preBoilGravity,
  boilTimeMin,
  boilOffRateLPerHour,
  boilOff,
  postBoilHotL,
  og,
}: {
  preBoilVolumeL: number;
  preBoilGravity: number;
  boilTimeMin: number;
  boilOffRateLPerHour: number;
  boilOff: number;
  postBoilHotL: number;
  og: number;
}) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: hsTokens.body,
        fontSize: 13,
        tableLayout: "auto",
      }}
    >
      <thead>
        <tr>
          <th
            colSpan={3}
            style={{
              ...matrixHeadGroupStyle,
              textAlign: "left",
              background: hsTokens.cream2,
            }}
          >
            Pre-boil
          </th>
          <th
            colSpan={3}
            style={{
              ...matrixHeadGroupStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              textAlign: "left",
              background: hsTokens.cream2,
            }}
          >
            Post-boil
          </th>
        </tr>
      </thead>
      <tbody>
        <BoilPairRow
          leftLabel="Volume"
          leftTarget={`${preBoilVolumeL.toFixed(1)} L · ${lToGal(preBoilVolumeL)} gal`}
          rightLabel="Volume (hot)"
          rightTarget={`${postBoilHotL.toFixed(1)} L · ${lToGal(postBoilHotL)} gal`}
        />
        <BoilPairRow
          leftLabel="Gravity"
          leftTarget={preBoilGravity.toFixed(3)}
          rightLabel="Gravity (OG)"
          rightTarget={<strong>{og.toFixed(3)}</strong>}
        />
        <BoilPairRow
          leftLabel="Boil time"
          leftTarget={`${boilTimeMin} min`}
          rightLabel="Boil-off"
          rightHint={`${boilOffRateLPerHour} L/hr`}
          rightTarget={`${boilOff.toFixed(1)} L`}
        />
      </tbody>
    </table>
  );
}

function BoilPairRow({
  leftLabel,
  leftHint,
  leftTarget,
  rightLabel,
  rightHint,
  rightTarget,
}: {
  leftLabel: string;
  leftHint?: string;
  leftTarget: ReactNode;
  rightLabel: string;
  rightHint?: string;
  rightTarget: ReactNode;
}) {
  return (
    <tr>
      <td style={boilLabelCellStyle}>
        <span style={{ fontWeight: 600 }}>{leftLabel}</span>
        {leftHint ? <span style={hintStyle}>{leftHint}</span> : null}
      </td>
      <td style={boilTargetCellStyle}>{leftTarget}</td>
      <td style={boilActualCellStyle}>&nbsp;</td>
      <td style={{ ...boilLabelCellStyle, borderLeft: `1.5px solid ${hsTokens.ink}` }}>
        <span style={{ fontWeight: 600 }}>{rightLabel}</span>
        {rightHint ? <span style={hintStyle}>{rightHint}</span> : null}
      </td>
      <td style={boilTargetCellStyle}>{rightTarget}</td>
      <td style={boilActualCellStyle}>&nbsp;</td>
    </tr>
  );
}

const boilLabelCellStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${hsTokens.ink}`,
  fontFamily: hsTokens.body,
  fontSize: 12,
  color: hsTokens.ink,
  verticalAlign: "middle",
  lineHeight: 1.3,
};

const boilTargetCellStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${hsTokens.ink}`,
  borderLeft: `1px solid ${hsTokens.ink}`,
  fontFamily: hsTokens.mono,
  fontSize: 12,
  color: hsTokens.ink,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
  verticalAlign: "middle",
  background: hsTokens.paper,
  width: 160,
};

const boilActualCellStyle: CSSProperties = {
  padding: "8px 10px",
  borderBottom: `1px solid ${hsTokens.ink}`,
  borderLeft: `1px solid ${hsTokens.ink}`,
  background: hsTokens.cream,
  width: 120,
  minHeight: 28,
  height: 28,
};

function BoilAdditionsTable({
  boilHops,
  whirlpoolHops,
  otherAdditions,
}: {
  boilHops: Recipe["hops"];
  whirlpoolHops: Recipe["hops"];
  otherAdditions: Recipe["otherIngredients"];
}) {
  return (
    <Table>
      <THead
        columns={[
          { label: "When", width: "140px" },
          { label: "Addition", width: "auto" },
          { label: "Amount", width: "120px", align: "center" },
          { label: "Notes / AA", width: "120px", align: "center" },
          { label: "Added", width: "80px", align: "center", isActual: true },
        ]}
      />
      <tbody>
        {boilHops.length > 0 ? (
          <BoilGroupHeader label="During boil" accent={hsTokens.hops} />
        ) : null}
        {boilHops.map((h) => (
          <tr key={h.id}>
            <Td font="mono">
              {h.type === "first wort"
                ? "first wort"
                : h.type === "mash"
                ? "mash"
                : `${h.timeMinutes ?? 0} min`}
            </Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{h.name || "Unnamed hop"}</span>
              <span style={hintStyle}>hop</span>
            </Td>
            <Td align="center" font="mono">
              {h.grams} g
            </Td>
            <Td align="center" font="mono">
              {h.alphaAcid.toFixed(1)}% AA
            </Td>
            <AddedCheckTd />
          </tr>
        ))}
        {whirlpoolHops.length > 0 ? (
          <BoilGroupHeader label="Whirlpool" accent={hsTokens.honey} />
        ) : null}
        {whirlpoolHops.map((h) => (
          <tr key={h.id}>
            <Td font="mono">
              {h.temperatureC != null
                ? `${h.temperatureC.toFixed(0)} °C${
                    h.whirlpoolTimeMinutes != null
                      ? ` · ${h.whirlpoolTimeMinutes}′`
                      : ""
                  }`
                : "whirlpool"}
            </Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{h.name || "Unnamed hop"}</span>
              <span style={hintStyle}>hop</span>
            </Td>
            <Td align="center" font="mono">
              {h.grams} g
            </Td>
            <Td align="center" font="mono">
              {h.alphaAcid.toFixed(1)}% AA
            </Td>
            <AddedCheckTd />
          </tr>
        ))}
        {otherAdditions.length > 0 ? (
          <BoilGroupHeader label="Other" accent={hsTokens.muted} />
        ) : null}
        {otherAdditions.map((o) => (
          <tr key={o.id}>
            <Td font="mono">{o.timing}</Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{o.name}</span>
              <span style={hintStyle}>{o.category}</span>
            </Td>
            <Td align="center" font="mono">
              {o.amount} {o.unit}
            </Td>
            <Td align="center" font="mono">
              {o.notes ?? "—"}
            </Td>
            <AddedCheckTd />
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function AddedCheckTd() {
  return (
    <td
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        textAlign: "center",
        verticalAlign: "middle",
      }}
    >
      &nbsp;
    </td>
  );
}

function BoilGroupHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <tr>
      <td
        colSpan={5}
        style={{
          padding: "6px 10px",
          background: hsTokens.cream2,
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: hsTokens.ink,
          borderBottom: `1px solid ${hsTokens.ink}`,
          borderTop: `1px solid ${hsTokens.ink}`,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: accent,
            border: `1px solid ${hsTokens.ink}`,
            marginRight: 8,
            verticalAlign: "middle",
          }}
        />
        {label}
      </td>
    </tr>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        textAlign: "center",
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.muted,
        border: `1.5px dashed ${hsTokens.muted}`,
        borderRadius: 8,
        opacity: 0.75,
      }}
    >
      {text}
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 6,
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </div>
  );
}

function MashChecks({
  firstRunningsSG,
}: {
  firstRunningsSG: number | null;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <SubLabel>Mash checks</SubLabel>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: hsTokens.body,
          fontSize: 11,
          opacity: 0.92,
        }}
      >
        <tbody>
          <MashCheckRow
            label="Iodine test"
            hint="conversion check"
            expected="negative"
          />
          <MashCheckRow
            label="First runnings SG"
            hint="before sparge"
            expected={firstRunningsSG != null ? firstRunningsSG.toFixed(3) : "—"}
          />
          <MashCheckRow
            label="Last runnings SG"
            hint="end of sparge"
            expected="≥ 1.010"
          />
        </tbody>
      </table>
    </div>
  );
}

function MashCheckRow({
  label,
  hint,
  expected,
}: {
  label: string;
  hint?: string;
  expected: string;
}) {
  return (
    <tr>
      <td
        style={{
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          fontFamily: hsTokens.body,
          fontSize: 11,
          color: hsTokens.ink,
          width: "auto",
          verticalAlign: "middle",
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        {hint ? (
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              color: hsTokens.muted,
              marginLeft: 8,
              fontWeight: 400,
            }}
          >
            · {hint}
          </span>
        ) : null}
      </td>
      <td
        style={{
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          width: 140,
        }}
      >
        {expected}
      </td>
      <td
        style={{
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          borderLeft: `1px solid ${hsTokens.muted}`,
          background: hsTokens.cream,
          width: 140,
          minHeight: 22,
          height: 22,
        }}
      >
        &nbsp;
      </td>
    </tr>
  );
}

function FermentRow({
  step,
  index,
}: {
  step: FermentationStep;
  index: number;
}) {
  return (
    <tr>
      <td style={mashStepCellStyle}>
        <span style={mashStepIndexStyle}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={mashStepNameStyle}>
          {step.name || formatFermentationType(step.type)}
        </span>
      </td>
      <td style={mashStepCellStyle}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            background: fermentationStepColor(step.type),
            color: hsTokens.paper,
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1.4,
          }}
        >
          {formatFermentationType(step.type)}
        </span>
      </td>
      <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
        <span style={mashStepValueStyle}>
          {step.temperatureC.toFixed(1)} °C
        </span>
        <span style={mashStepHintStyle}>{cToF(step.temperatureC)} °F</span>
      </td>
      <td style={{ ...mashStepCellStyle, textAlign: "center" }}>
        <span style={mashStepValueStyle}>{step.durationDays} d</span>
      </td>
      <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>&nbsp;</td>
      <td style={{ ...mashStepCellStyle, ...mashStepActualStyle }}>&nbsp;</td>
    </tr>
  );
}

function PitchTempChip({ pitchTempC }: { pitchTempC: number | undefined }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        marginLeft: 48,
        marginBottom: 12,
        fontFamily: hsTokens.body,
        fontSize: 10,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Pitch @
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontWeight: 600,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {pitchTempC != null
          ? `${pitchTempC.toFixed(1)} °C · ${cToF(pitchTempC)} °F`
          : "—"}
      </span>
    </div>
  );
}

/* ─────────────────── print styles ─────────────────── */

function PrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .hs-print-only { display: none; }
          @media print {
            @page { size: A4 portrait; margin: 10mm; }

            /* Reset html/body so they don't carry pre-print height */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
              color: #000000 !important;
            }

            /* Hide only elements that are NOT in the print-area path.
               An element is "in the path" if it contains the print area
               as a descendant, IS the print area, or descends from it.
               This preserves the inline display values (grid/flex/table)
               on the print path. */
            body *:not(:has(.hs-print-area)):not(.hs-print-area):not(.hs-print-area *) {
              display: none !important;
            }

            /* Strip chrome from the revealed ancestors (don't touch display). */
            body *:has(.hs-print-area) {
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              transform: none !important;
              animation: none !important;
              max-width: none !important;
              width: auto !important;
              height: auto !important;
              min-height: 0 !important;
              position: static !important;
            }

            /* Print area: clean container, no chrome, full width of page. */
            .hs-print-area {
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 10pt !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            /* Force grid column counts on print — auto-fit minmax collapses
               on narrower print-page widths. */
            .hs-print-area .hs-print-cols-3 {
              grid-template-columns: repeat(3, 1fr) !important;
            }
            .hs-print-area .hs-print-cols-2 {
              grid-template-columns: repeat(2, 1fr) !important;
            }

            /* Stack nested 2-col grids vertically on print — they don't have
               room when their parent is already a half-page column. */
            .hs-print-area .hs-print-stack {
              grid-template-columns: 1fr !important;
            }
            /* Shrink the flavor radar so the stacked vertical version
               doesn't dominate the printed hops sub-card. */
            .hs-print-area .hs-print-stack svg {
              max-width: 140px !important;
              height: auto !important;
            }

            /* Allow value cells in MiniTable cards to wrap on spaces so
               paired Yeast rows and split-right Brew Data cells don't clip.
               Labels stay nowrap so "STRAIN", "ATTENUATION", etc. don't get
               broken mid-word. */
            .hs-print-area .hs-mini-value-cell {
              white-space: normal !important;
              font-size: 8pt !important;
              padding: 2px 6px !important;
            }
            /* Force label columns to shrink to content width — width: 1% with
               table-layout: auto + nowrap = column fits the label text only,
               giving the value cell the rest of the row. */
            .hs-print-area .hs-mini-label-cell {
              white-space: nowrap !important;
              font-size: 6pt !important;
              padding: 2px 4px !important;
              letter-spacing: 0.04em !important;
              width: 1% !important;
            }
            .hs-print-area .hs-mini-title {
              font-size: 10pt !important;
              padding: 6px 6px 4px !important;
              letter-spacing: 0.1em !important;
            }
            /* Tighter gap between the three top-strip cards */
            .hs-print-area .hs-print-cols-3 {
              gap: 6px !important;
            }
            /* Hop variety wraps on spaces (no mid-word break — that produced
               "East Kent..." or worse). */
            .hs-print-area .hs-hop-data-cell {
              white-space: normal !important;
              overflow: visible !important;
              text-overflow: clip !important;
            }

            /* Re-hide the explicit "hide on print" elements */
            .hs-print-hide { display: none !important; }
            /* Reveal print-only annotations */
            .hs-print-only { display: block !important; }

            /* Keep each section together on the page */
            .hs-print-area .hs-print-block {
              box-shadow: none !important;
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 8px;
            }

            /* Tighter tables for paper */
            .hs-print-area table {
              font-size: 9pt !important;
              table-layout: auto !important;
            }
            .hs-print-area th, .hs-print-area td {
              padding: 4px 6px !important;
              overflow-wrap: break-word !important;
            }
            /* Drop fixed pixel widths on schedule tables — they sum past the
               printable A4 width and squeeze the Step column to nothing. */
            .hs-print-area .hs-mash-schedule th,
            .hs-print-area .hs-mash-schedule td,
            .hs-print-area .hs-ferment-schedule th,
            .hs-print-area .hs-ferment-schedule td {
              width: auto !important;
            }
          }
        `,
      }}
    />
  );
}

/* ─────────────────── helpers ─────────────────── */

function formatFermentationType(type: FermentationStepType): string {
  switch (type) {
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "conditioning":
      return "Conditioning";
    case "cold-crash":
      return "Cold crash";
    case "diacetyl-rest":
      return "Diacetyl rest";
  }
}

function fermentationStepColor(type: FermentationStepType): string {
  switch (type) {
    case "primary":
      return hsTokens.yeast;
    case "secondary":
      return hsTokens.honey;
    case "conditioning":
      return hsTokens.malt;
    case "cold-crash":
      return hsTokens.water;
    case "diacetyl-rest":
      return hsTokens.roast;
  }
}

function formatYeastType(t: string): string {
  switch (t) {
    case "liquid-100":
      return "Liquid (100B)";
    case "liquid-200":
      return "Liquid (200B)";
    case "dry":
      return "Dry";
    case "slurry":
      return "Slurry";
    default:
      return t;
  }
}

function buildYeastRows(
  recipe: Recipe,
  pitchTempC: number | undefined,
): MiniRowEntry[] {
  if (recipe.yeasts.length === 0) {
    return [{ label: "Strain", target: "—" }];
  }

  const rows: MiniRowEntry[] = [
    [
      {
        label: "Strain",
        target: recipe.yeasts.map((y) => y.name).join(" + "),
      },
      {
        label: "Lab",
        target:
          recipe.yeasts
            .map((y) => y.laboratory)
            .filter(Boolean)
            .join(" / ") || "—",
      },
    ],
    [
      {
        label: "Attenuation",
        target: `${Math.round((recipe.yeasts[0]?.attenuation ?? 0) * 100)} %`,
      },
      {
        label: "Pitch Temp",
        target:
          pitchTempC != null
            ? `${pitchTempC.toFixed(1)} °C / ${cToF(pitchTempC)} °F`
            : "—",
        actualSlot: true,
      },
    ],
    [
      { label: "Pitch Date", actualSlot: true },
      { label: "Count", actualSlot: true },
    ],
  ];

  // Starter info from the primary yeast (if configured)
  const primary = recipe.yeasts[0];
  const starter = primary?.starter;
  if (starter && (starter.packs > 0 || starter.steps.length > 0)) {
    const packsRow: MiniRow =
      starter.packs > 0
        ? {
            label: "Pack(s)",
            target: `${starter.packs} × ${formatYeastType(starter.yeastType)}`,
          }
        : { label: "Pack(s)", target: "—" };
    const mfgRow: MiniRow = starter.mfgDate
      ? { label: "Mfg Date", target: starter.mfgDate }
      : { label: "Mfg Date", actualSlot: true };
    rows.push([packsRow, mfgRow]);

    if (starter.yeastType === "slurry" && starter.slurryLiters != null) {
      rows.push({
        label: "Slurry",
        target: `${starter.slurryLiters.toFixed(2)} L${
          starter.slurryBillionPerMl != null
            ? ` @ ${starter.slurryBillionPerMl}B/mL`
            : ""
        }`,
      });
    }
    starter.steps.forEach((step, i) => {
      rows.push({
        label: `Starter ${i + 1}`,
        target: `${step.liters.toFixed(1)} L @ ${step.gravity.toFixed(3)}`,
        hint:
          step.model.kind === "white"
            ? `White / ${step.model.aeration}`
            : "Braukaiser",
      });
    });
  }

  return rows;
}

/* ─────────────────── hop flavor aggregate + mini radar ─────────────────── */

const HOP_FLAVOR_KEYS = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  "grassy",
  "herbal",
  "spice",
  "resinPine",
] as const;

const HOP_FLAVOR_LABELS: Record<(typeof HOP_FLAVOR_KEYS)[number], string> = {
  citrus: "Citrus",
  tropicalFruit: "Tropical",
  stoneFruit: "Stone",
  berry: "Berry",
  floral: "Floral",
  grassy: "Grassy",
  herbal: "Herbal",
  spice: "Spice",
  resinPine: "Pine",
};

type HopFlavorVector = Record<(typeof HOP_FLAVOR_KEYS)[number], number>;

function computeAggregateHopFlavor(hops: Recipe["hops"]): HopFlavorVector | null {
  let totalGrams = 0;
  const sums: HopFlavorVector = {
    citrus: 0,
    tropicalFruit: 0,
    stoneFruit: 0,
    berry: 0,
    floral: 0,
    grassy: 0,
    herbal: 0,
    spice: 0,
    resinPine: 0,
  };
  let anyFlavored = false;
  for (const h of hops) {
    if (!h.flavor) continue;
    anyFlavored = true;
    const w = Math.max(0, h.grams);
    if (w === 0) continue;
    totalGrams += w;
    for (const k of HOP_FLAVOR_KEYS) {
      sums[k] += (h.flavor[k] ?? 0) * w;
    }
  }
  if (!anyFlavored || totalGrams === 0) return null;
  const out: HopFlavorVector = { ...sums };
  for (const k of HOP_FLAVOR_KEYS) {
    out[k] = sums[k] / totalGrams;
  }
  return out;
}

function HopFlavorMini({
  flavor,
  size = 180,
}: {
  flavor: HopFlavorVector;
  size?: number;
}) {
  const axes = HOP_FLAVOR_KEYS.length;
  const max = 5;
  const pad = 28;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const dataPoints = HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, flavor[k] ?? 0));
  const dataPolyPoints = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-label="Estimated hop flavor profile"
    >
      {/* rings */}
      {[0.25, 0.5, 0.75, 1].map((mult) => (
        <polygon
          key={mult}
          points={ringPoints(mult)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          opacity={mult === 1 ? 0.35 : 0.2}
        />
      ))}
      {/* axes */}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [x, y] = pointAt(i, max);
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.3}
            opacity={0.25}
          />
        );
      })}
      {/* data polygon */}
      <polygon
        points={dataPolyPoints}
        fill={hsTokens.hops}
        fillOpacity={0.32}
        stroke={hsTokens.hops}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* data dots */}
      {dataPoints.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.8}
          fill={hsTokens.hops}
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
        />
      ))}
      {/* axis labels */}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
        const lx = cx + (radius + 12) * Math.cos(angle);
        const ly = cy + (radius + 12) * Math.sin(angle);
        return (
          <text
            key={k}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={hsTokens.body}
            fontSize={7}
            fontWeight={700}
            fill="var(--hs-muted)"
            style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {HOP_FLAVOR_LABELS[k]}
          </text>
        );
      })}
    </svg>
  );
}



