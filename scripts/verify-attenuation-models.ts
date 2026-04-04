/**
 * Verification Script: Do our FG attenuation models fit empirical data?
 *
 * Generates:
 *   1. Console tables — single infusion sweep + step mash scenarios
 *   2. HTML chart file — visual comparison of model curves vs real data points
 *
 * Usage:
 *   npx tsx scripts/verify-attenuation-models.ts
 *   open scripts/attenuation-charts.html
 */

import { RecipeCalculationService, type AttenuationModel } from '../src/modules/beta-builder/domain/services/RecipeCalculationService';
import type { Recipe, MashStep } from '../src/modules/beta-builder/domain/models/Recipe';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const service = new RecipeCalculationService();

function makeRecipe(
  mashSteps: Array<{ temperatureC: number; durationMinutes: number }>,
  attenuation: number,
): Recipe {
  const steps: MashStep[] = mashSteps.map((s, i) => ({
    id: `step-${i}`,
    name: `Step ${i + 1}`,
    temperatureC: s.temperatureC,
    durationMinutes: s.durationMinutes,
  }));

  return {
    id: 'verify-test',
    name: 'Verification Recipe',
    currentVersion: 1,
    batchVolumeL: 19,
    equipment: {
      boilTimeMin: 60,
      boilOffRateLPerHour: 2.5,
      mashEfficiencyPercent: 75,
      mashThicknessLPerKg: 3.0,
      grainAbsorptionLPerKg: 1.04,
      mashTunDeadspaceLiters: 0,
      mashTunLossLiters: 0,
      kettleLossLiters: 0,
      hopsAbsorptionLPerKg: 0,
      chillerLossLiters: 0,
      fermenterLossLiters: 0,
      coolingShrinkagePercent: 4,
    },
    fermentables: [{
      id: 'f1', name: '2-Row', weightKg: 4.5,
      colorLovibond: 2, ppg: 37, efficiencyPercent: 75,
      fermentability: 1.0,
    }],
    hops: [],
    yeasts: [{ id: 'y1', name: 'Test Yeast', attenuation }],
    otherIngredients: [],
    mashSteps: steps,
    fermentationSteps: [],
    createdAt: '2026-03-08T00:00:00Z',
    updatedAt: '2026-03-08T00:00:00Z',
  };
}

function runModel(
  mashSteps: Array<{ temperatureC: number; durationMinutes: number }>,
  attenuation: number,
  model: AttenuationModel,
): { og: number; fg: number; appAtt: number } {
  const recipe = makeRecipe(mashSteps, attenuation);
  const result = service.calculate(recipe, { attenuationModel: model });
  const og = result.og;
  const fg = result.fg;
  const appAtt = og > 1 ? ((og - fg) / (og - 1)) * 100 : 0;
  return { og, fg, appAtt };
}

// ─── Standalone enzyme kinetics with configurable BASE_S ─────────────────────
// Reimplements the enzyme model logic so we can test different damping values
// without modifying the actual codebase.

function enzymeAttenuationWithBaseS(
  mashTemp: number,
  mashTime: number,
  baseAtt: number,
  BASE_S: number,
  ACCEL: number = 0.008,
): number {
  const betaActivity  = (T: number) => Math.exp(-0.5 * ((T - 63) / 5) ** 2);
  const alphaActivity = (T: number) => Math.exp(-0.5 * ((T - 70) / 6) ** 2);

  const R_GAS = 8.314;
  const BETA_KD_A = 7.6e60, BETA_KD_EA = 410700, BETA_RESIDUAL = 0.13;
  const ALPHA_KD_A = 6.9e30, ALPHA_KD_EA = 224200;

  const betaKd  = (T: number) => BETA_KD_A  * Math.exp(-BETA_KD_EA  / (R_GAS * (T + 273.15)));
  const alphaKd = (T: number) => ALPHA_KD_A * Math.exp(-ALPHA_KD_EA / (R_GAS * (T + 273.15)));

  function computeWork(T: number, t: number, bLabile: number, aLabile: number) {
    const bRate = betaActivity(T);
    const aRate = alphaActivity(T);
    const bKd = betaKd(T);
    const aKd = alphaKd(T);

    const bLabileInt = bKd * t > 1e-6 ? (1 - Math.exp(-bKd * t)) / bKd : t;
    const bWork = bRate * (BETA_RESIDUAL * t + bLabile * (1 - BETA_RESIDUAL) * bLabileInt);
    const aLabileInt = aKd * t > 1e-6 ? (1 - Math.exp(-aKd * t)) / aKd : t;
    const aWork = aRate * aLabile * aLabileInt;

    return { bWork, aWork };
  }

  const actual = computeWork(mashTemp, mashTime, 1.0, 1.0);
  const totalWork = actual.bWork + actual.aWork;
  if (totalWork <= 0) return 0;
  const fraction = actual.bWork / totalWork;

  const ref = computeWork(67, 60, 1.0, 1.0);
  const refFraction = ref.bWork / (ref.bWork + ref.aWork);

  if (fraction <= 0) return 0;

  const logRatio = Math.log(fraction / refFraction);
  const sensitivity = BASE_S + ACCEL * logRatio * logRatio;
  const scaledAtt = baseAtt * Math.exp(logRatio * sensitivity);

  return Math.max(0, Math.min(0.95, scaledAtt)) * 100;
}

// ─── Empirical Data Points ───────────────────────────────────────────────────
// Collected from published experiments and controlled homebrew trials.
// Each point is normalized to apparent attenuation (%).

interface DataPoint {
  temp: number;
  appAtt: number;
  source: string;
  baseAtt?: number; // yeast attenuation if known
}

// For comparison we normalize all data to a common baseAtt.
// We plot raw data points and note the yeast used.
const EMPIRICAL_DATA: DataPoint[] = [
  // ── Brulosophy Munich Helles (2018) ──
  // Yeast: unknown lager. OG ~1.046 (computed from ABV+FG)
  // Low: 64°C → FG 1.008, ABV 4.9%  → AA = (1.046-1.008)/0.046 = 82.6%
  // High: 73°C → FG 1.023, ABV 3.3% → AA = (1.048-1.023)/0.048 = 52.1%
  { temp: 64, appAtt: 82.6, source: 'Brulosophy Helles' },
  { temp: 73, appAtt: 52.1, source: 'Brulosophy Helles' },

  // ── Brulosophy Czech Lager (2016) ──
  // 65°C → FG 1.008, 67°C → FG 1.009. OG ~1.050
  // AA: (1.050-1.008)/0.050=84%, (1.050-1.009)/0.050=82%
  { temp: 65, appAtt: 84.0, source: 'Brulosophy Czech' },
  { temp: 67, appAtt: 82.0, source: 'Brulosophy Czech' },

  // ── Brulosophy Belgian Golden Strong (2020) ──
  // Low: 81% att, FG 1.014, ABV 8.4% → OG ~1.078
  // High: 74% att, FG 1.020, ABV 8.0% → OG ~1.081
  // Typical brulosophy low=148°F(64°C), high=158°F(70°C)
  { temp: 64, appAtt: 81.0, source: 'Brulosophy Belgian' },
  { temp: 70, appAtt: 74.0, source: 'Brulosophy Belgian' },

  // ── Brulosophy Blonde Ale (2015) ──
  // Low temp → FG 1.005, High temp → FG 1.014. OG ~1.048
  // Typical low=148°F(64°C), high=162°F(72°C)
  // AA: (1.048-1.005)/0.048=89.6%, (1.048-1.014)/0.048=70.8%
  { temp: 64, appAtt: 89.6, source: 'Brulosophy Blonde' },
  { temp: 72, appAtt: 70.8, source: 'Brulosophy Blonde' },

  // ── HBT Controlled Experiment (2025) ──
  // 3 identical APA batches, OG ~1.052 (computed from ABV+FG)
  // 64.4°C → FG 1.008, 66.7°C → FG 1.012, 70°C → FG 1.016
  { temp: 64.4, appAtt: 84.6, source: 'HBT APA 2025' },
  { temp: 66.7, appAtt: 76.9, source: 'HBT APA 2025' },
  { temp: 70,   appAtt: 69.2, source: 'HBT APA 2025' },

  // ── Brulosophy German Pils (2022) ──
  // OG low 1.049, OG high 1.053. Yeast: Imperial L17 Harvest lager.
  // 64°C → FG 1.007, AA = (1.049-1.007)/0.049 = 85.7%
  // 71°C → FG 1.021, AA = (1.053-1.021)/0.053 = 60.4%
  { temp: 64, appAtt: 85.7, source: 'Brulosophy Pils' },
  { temp: 71, appAtt: 60.4, source: 'Brulosophy Pils' },

  // ── Brulosophy English Porter (2020) ──
  // OG low 1.053, OG high 1.055. Yeast: Imperial A01 House.
  // 64°C → FG 1.012, AA = (1.053-1.012)/0.053 = 77.4%
  // 73°C → FG 1.025, AA = (1.055-1.025)/0.055 = 54.5%
  // NOTE: specialty malts (crystal, roast) lower base fermentability
  { temp: 64, appAtt: 77.4, source: 'Brulosophy Porter' },
  { temp: 73, appAtt: 54.5, source: 'Brulosophy Porter' },

  // ── UK HomeBrew Forum (63°C mash) ──
  // Mash at 63°C, OG ~1.046, measured FG 1.009
  // AA = (1.046-1.009)/0.046 = 80.4%
  { temp: 63, appAtt: 80.4, source: 'UK Forum 63°C' },

  // ── Braukaiser Mash Time Experiment ──
  // At 66.6°C, 60-100 min, Wyeast 2206 lager, OG ~11°P (~1.044)
  // 40 min: 77.9% att, 100 min: 82.2% att
  // Using the ~60 min value (interpolated ~78.5%)
  { temp: 66.6, appAtt: 79.0, source: 'Braukaiser 66.6°C', baseAtt: 0.81 },
];

// ─── Single Infusion Temperature Sweep ───────────────────────────────────────

interface SweepRow {
  temp: number;
  linear: number;
  enzyme: number;
  ode: number;
  linearFG: number;
  enzymeFG: number;
  odeFG: number;
}

function runSingleInfusionSweep(baseAtt: number): SweepRow[] {
  const rows: SweepRow[] = [];
  for (let t = 58; t <= 82; t++) {
    const steps = [{ temperatureC: t, durationMinutes: 60 }];
    const lin = runModel(steps, baseAtt, 'linear');
    const enz = runModel(steps, baseAtt, 'enzyme_kinetics');
    const ode = runModel(steps, baseAtt, 'brandam_ode');
    rows.push({
      temp: t,
      linear: lin.appAtt, enzyme: enz.appAtt, ode: ode.appAtt,
      linearFG: lin.fg, enzymeFG: enz.fg, odeFG: ode.fg,
    });
  }
  return rows;
}

function computeSlopes(rows: SweepRow[]): Array<{ temp: number; linear: number; enzyme: number; ode: number }> {
  const slopes: Array<{ temp: number; linear: number; enzyme: number; ode: number }> = [];
  for (let i = 1; i < rows.length - 1; i++) {
    slopes.push({
      temp: rows[i].temp,
      linear: (rows[i - 1].linear - rows[i + 1].linear) / 2,
      enzyme: (rows[i - 1].enzyme - rows[i + 1].enzyme) / 2,
      ode: (rows[i - 1].ode - rows[i + 1].ode) / 2,
    });
  }
  return slopes;
}

// ─── Proposed Recalibrations ─────────────────────────────────────────────────

interface ProposedCurve {
  label: string;
  baseS: number;
  accel: number;
  data: number[]; // apparent attenuation at each temp
}

function computeProposedCurves(baseAtt: number): ProposedCurve[] {
  const configs = [
    { label: 'Proposed BASE_S=0.16 (~2%/°C)', baseS: 0.16, accel: 0.008 },
    { label: 'Proposed BASE_S=0.24 (~3%/°C)', baseS: 0.24, accel: 0.008 },
    { label: 'Proposed BASE_S=0.32 (~4%/°C)', baseS: 0.32, accel: 0.008 },
  ];

  return configs.map((cfg) => ({
    ...cfg,
    data: Array.from({ length: 82 - 58 + 1 }, (_, i) => {
      const t = 58 + i;
      return enzymeAttenuationWithBaseS(t, 60, baseAtt, cfg.baseS, cfg.accel);
    }),
  }));
}

// ─── Step Mash Scenarios ─────────────────────────────────────────────────────

const STEP_MASH_SCENARIOS = [
  { name: 'Single 67°C/60min (reference)', steps: [{ temperatureC: 67, durationMinutes: 60 }] },
  { name: 'Protein + Sacch (52°C/15 → 67°C/45)', steps: [{ temperatureC: 52, durationMinutes: 15 }, { temperatureC: 67, durationMinutes: 45 }] },
  { name: 'Low→High (63°C/20 → 72°C/40)', steps: [{ temperatureC: 63, durationMinutes: 20 }, { temperatureC: 72, durationMinutes: 40 }] },
  { name: 'High→Low (72°C/20 → 63°C/40)', steps: [{ temperatureC: 72, durationMinutes: 20 }, { temperatureC: 63, durationMinutes: 40 }] },
  { name: 'Extended Low (63°C/45 → 72°C/15)', steps: [{ temperatureC: 63, durationMinutes: 45 }, { temperatureC: 72, durationMinutes: 15 }] },
  { name: 'Hochkurz (63°C/30 → 72°C/30)', steps: [{ temperatureC: 63, durationMinutes: 30 }, { temperatureC: 72, durationMinutes: 30 }] },
  { name: 'Single Hot (72°C/60)', steps: [{ temperatureC: 72, durationMinutes: 60 }] },
  { name: 'Single Cool (63°C/60)', steps: [{ temperatureC: 63, durationMinutes: 60 }] },
];

function runStepMashScenarios(baseAtt: number) {
  return STEP_MASH_SCENARIOS.map((scenario) => {
    const lin = runModel(scenario.steps, baseAtt, 'linear');
    const enz = runModel(scenario.steps, baseAtt, 'enzyme_kinetics');
    const ode = runModel(scenario.steps, baseAtt, 'brandam_ode');
    return {
      name: scenario.name,
      linear: lin.appAtt, enzyme: enz.appAtt, ode: ode.appAtt,
      linearFG: lin.fg, enzymeFG: enz.fg, odeFG: ode.fg,
    };
  });
}

// ─── HTML Chart Generation ───────────────────────────────────────────────────

function generateHTML(
  sweep75: SweepRow[],
  slopes75: Array<{ temp: number; linear: number; enzyme: number; ode: number }>,
  proposed75: ProposedCurve[],
  stepMash75: ReturnType<typeof runStepMashScenarios>,
): string {
  // Compute proposed slopes
  const proposedSlopes = proposed75.map((curve) => ({
    label: curve.label,
    slopes: Array.from({ length: curve.data.length - 2 }, (_, i) => ({
      temp: 59 + i,
      slope: (curve.data[i] - curve.data[i + 2]) / 2,
    })),
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attenuation Model Verification</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0f;
      color: #e0e0e0;
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 { font-size: 1.6rem; margin-bottom: 0.5rem; color: #fff; }
    h2 { font-size: 1.1rem; margin: 2.5rem 0 0.75rem; color: #ccc; font-weight: 500; }
    .subtitle { color: #888; font-size: 0.85rem; margin-bottom: 2rem; line-height: 1.5; }
    .chart-container {
      background: #14141f;
      border: 1px solid #2a2a3a;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .chart-title {
      font-size: 0.95rem;
      color: #ccc;
      margin-bottom: 1rem;
      font-weight: 500;
    }
    .chart-note {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.5rem;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    canvas { width: 100% !important; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      background: #14141f;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    th { background: #1a1a2e; color: #aaa; text-align: right; padding: 0.5rem 0.75rem; font-weight: 500; }
    td { text-align: right; padding: 0.4rem 0.75rem; border-top: 1px solid #1e1e2e; }
    th:first-child, td:first-child { text-align: left; }
    tr:hover td { background: #1a1a2e; }
    .source-legend { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0; font-size: 0.8rem; }
    .source-legend span { display: flex; align-items: center; gap: 0.4rem; color: #aaa; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  </style>
</head>
<body>
  <h1>Attenuation Model Verification</h1>
  <p class="subtitle">
    Current models (Linear / Enzyme / ODE) vs. proposed recalibrations vs. empirical data.<br>
    All-base-malt recipe, 60 min single infusion, baseAtt = 0.75.
  </p>

  <div class="chart-container">
    <div class="chart-title">Chart 1: Apparent Attenuation vs Mash Temperature — Current Models + Proposed + Data</div>
    <canvas id="chart1" height="220"></canvas>
    <div class="chart-note">
      Solid lines = current models. Dashed lines = proposed recalibrations (different BASE_S values).
      Scatter points = real measured data from Brulosophy, HBT, and Braukaiser experiments.
      Data points use various yeasts (baseAtt 0.75–0.85) so absolute values vary — compare the SLOPE.
    </div>
  </div>

  <div class="chart-row">
    <div class="chart-container">
      <div class="chart-title">Chart 2: Local Slope (%/°C) — How steep is each curve?</div>
      <canvas id="chart2"></canvas>
    </div>
    <div class="chart-container">
      <div class="chart-title">Chart 3: Step Mash Comparison (baseAtt = 0.75)</div>
      <canvas id="chart3"></canvas>
    </div>
  </div>

  <div class="chart-container">
    <div class="chart-title">Chart 4: FG vs Mash Temperature (OG ~1.050) — Current + Proposed + Data</div>
    <canvas id="chart4" height="220"></canvas>
    <div class="chart-note">
      This chart shows Final Gravity directly — the number brewers actually measure.
      Lower FG = more fermentable wort. Compare model curves against the scatter points.
    </div>
  </div>

  <h2>Empirical Data Sources</h2>
  <div class="source-legend">
    <span><span class="dot" style="background:#ef4444"></span> Brulosophy Helles (64°C vs 73°C)</span>
    <span><span class="dot" style="background:#f97316"></span> Brulosophy Czech Lager (65°C vs 67°C)</span>
    <span><span class="dot" style="background:#eab308"></span> Brulosophy Belgian (64°C vs 70°C)</span>
    <span><span class="dot" style="background:#84cc16"></span> Brulosophy Blonde (64°C vs 72°C)</span>
    <span><span class="dot" style="background:#10b981"></span> Brulosophy German Pils (64°C vs 71°C)</span>
    <span><span class="dot" style="background:#f472b6"></span> Brulosophy English Porter (64°C vs 73°C)</span>
    <span><span class="dot" style="background:#94a3b8"></span> UK Forum (63°C)</span>
    <span><span class="dot" style="background:#06b6d4"></span> HBT APA 2025 (64, 67, 70°C)</span>
    <span><span class="dot" style="background:#a855f7"></span> Braukaiser 66.6°C</span>
    <span><span class="dot" style="background:#ffffff; border: 1px solid #666"></span> Woodland Brewing Regression (meta-analysis curve)</span>
  </div>

  <h2>Sweep Table — baseAtt = 0.75</h2>
  <table id="sweepTable"></table>

  <h2>Step Mash — baseAtt = 0.75</h2>
  <table id="stepTable"></table>

  <script>
    // ── Data ──
    const sweep = ${JSON.stringify(sweep75)};
    const slopes = ${JSON.stringify(slopes75)};
    const proposed = ${JSON.stringify(proposed75)};
    const proposedSlopes = ${JSON.stringify(proposedSlopes)};
    const stepMash = ${JSON.stringify(stepMash75)};
    const empirical = ${JSON.stringify(EMPIRICAL_DATA)};
    const temps = sweep.map(r => r.temp);

    // ── Colors ──
    const C = {
      linear:  '#6b7280',
      enzyme:  '#3b82f6',
      ode:     '#8b5cf6',
      prop1:   '#22d3ee', // BASE_S=0.16
      prop2:   '#f59e0b', // BASE_S=0.24
      prop3:   '#ef4444', // BASE_S=0.32
    };
    const SOURCE_COLORS = {
      'Brulosophy Helles':  '#ef4444',
      'Brulosophy Czech':   '#f97316',
      'Brulosophy Belgian': '#eab308',
      'Brulosophy Blonde':  '#84cc16',
      'Brulosophy Pils':    '#10b981',
      'Brulosophy Porter':  '#f472b6',
      'UK Forum 63°C':      '#94a3b8',
      'HBT APA 2025':       '#06b6d4',
      'Braukaiser 66.6°C':  '#a855f7',
    };

    // ── Woodland Brewing regression curve (meta-analysis of Braukaiser + Wyeast + own data) ──
    // Equation: Att = -0.000663 * T_F^2 + 0.1964 * T_F - 13.692  (T_F in °F)
    // Shows peak around 148°F (64.4°C), slight decline below due to incomplete gelatinization
    const woodlandCurve = temps.map(tC => {
      const tF = tC * 9/5 + 32;
      return { x: tC, y: -0.000663 * tF * tF + 0.1964 * tF - 13.692 };
    });

    const chartOpts = (yLabel, yMin, yMax) => ({
      responsive: true,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { labels: { color: '#aaa', font: { size: 11 }, usePointStyle: true } } },
      scales: {
        x: { ticks: { color: '#666' }, grid: { color: '#1e1e2e' }, title: { display: true, text: 'Mash Temperature (°C)', color: '#888' } },
        y: { ticks: { color: '#666' }, grid: { color: '#1e1e2e' }, title: { display: true, text: yLabel, color: '#888' }, min: yMin, max: yMax },
      }
    });

    // Helper: make a scatter dataset from empirical data
    function scatterDataset(source, color) {
      const pts = empirical.filter(d => d.source === source);
      return {
        label: source,
        data: pts.map(p => ({ x: p.temp, y: p.appAtt })),
        backgroundColor: color,
        borderColor: color,
        pointRadius: 7,
        pointStyle: 'circle',
        showLine: false,
        type: 'scatter',
      };
    }
    function scatterFGDataset(source, color, og) {
      const pts = empirical.filter(d => d.source === source);
      return {
        label: source,
        data: pts.map(p => ({ x: p.temp, y: 1 + (og - 1) * (1 - p.appAtt / 100) })),
        backgroundColor: color,
        borderColor: color,
        pointRadius: 7,
        pointStyle: 'circle',
        showLine: false,
        type: 'scatter',
      };
    }

    // ── Helper: convert array data to {x, y} points for linear x-axis ──
    function toXY(data, tempsArr) {
      return data.map((val, i) => ({ x: tempsArr[i], y: val }));
    }

    // ── Chart 1: Attenuation vs Temp ──
    new Chart(document.getElementById('chart1'), {
      type: 'scatter',
      data: {
        datasets: [
          // Current models (as lines via showLine)
          { label: 'Current Linear', data: toXY(sweep.map(r => r.linear), temps), showLine: true, borderColor: C.linear, borderDash: [4, 2], borderWidth: 2, pointRadius: 0, fill: false },
          { label: 'Current Enzyme (BASE_S=0.10)', data: toXY(sweep.map(r => r.enzyme), temps), showLine: true, borderColor: C.enzyme, borderWidth: 2.5, pointRadius: 0, fill: false },
          { label: 'Current ODE (BASE_S=0.10)', data: toXY(sweep.map(r => r.ode), temps), showLine: true, borderColor: C.ode, borderWidth: 2.5, pointRadius: 0, fill: false },
          // Proposed recalibrations
          { label: proposed[0].label, data: toXY(proposed[0].data, temps), showLine: true, borderColor: C.prop1, borderDash: [6, 3], borderWidth: 2, pointRadius: 0, fill: false },
          { label: proposed[1].label, data: toXY(proposed[1].data, temps), showLine: true, borderColor: C.prop2, borderDash: [6, 3], borderWidth: 2, pointRadius: 0, fill: false },
          { label: proposed[2].label, data: toXY(proposed[2].data, temps), showLine: true, borderColor: C.prop3, borderDash: [6, 3], borderWidth: 2, pointRadius: 0, fill: false },
          // Woodland Brewing regression (meta-analysis reference curve)
          { label: 'Woodland Brewing Regression', data: woodlandCurve, showLine: true, borderColor: '#ffffff', borderDash: [2, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
          // Empirical data (scatter points)
          ...Object.entries(SOURCE_COLORS).map(([src, col]) => scatterDataset(src, col)),
        ]
      },
      options: chartOpts('Apparent Attenuation (%)', 30, 100),
    });

    // ── Chart 2: Slope ──
    const slopeTemps = slopes.map(r => r.temp);
    new Chart(document.getElementById('chart2'), {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Current Enzyme', data: toXY(slopes.map(r => r.enzyme), slopeTemps), showLine: true, borderColor: C.enzyme, borderWidth: 2.5, pointRadius: 0, fill: false },
          { label: 'Current ODE', data: toXY(slopes.map(r => r.ode), slopeTemps), showLine: true, borderColor: C.ode, borderWidth: 2.5, pointRadius: 0, fill: false },
          ...proposedSlopes.map((ps, i) => ({
            label: ps.label.replace('Proposed ', ''),
            data: toXY(ps.slopes.map(s => s.slope), ps.slopes.map(s => s.temp)),
            showLine: true,
            borderColor: [C.prop1, C.prop2, C.prop3][i],
            borderDash: [6, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          })),
        ]
      },
      options: chartOpts('Slope (%/°C)', 0, 15),
    });

    // ── Chart 3: Step Mash ──
    new Chart(document.getElementById('chart3'), {
      type: 'bar',
      data: {
        labels: stepMash.map(r => r.name),
        datasets: [
          { label: 'Linear', data: stepMash.map(r => r.linear), backgroundColor: C.linear },
          { label: 'Enzyme', data: stepMash.map(r => r.enzyme), backgroundColor: C.enzyme },
          { label: 'ODE', data: stepMash.map(r => r.ode), backgroundColor: C.ode },
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#666' }, grid: { color: '#1e1e2e' }, title: { display: true, text: 'Apparent Attenuation (%)', color: '#888' }, min: 40, max: 95 },
          y: { ticks: { color: '#ccc', font: { size: 9 } }, grid: { color: '#1e1e2e' } },
        }
      }
    });

    // ── Chart 4: FG vs Temp ──
    const nominalOG = sweep[0] ? (1 + (sweep[0].linearFG - 1) / (1 - sweep.find(r=>r.temp===67).linear/100)) : 1.055;
    // Use actual OG from the recipe
    const ogVal = ${JSON.stringify(runModel([{ temperatureC: 67, durationMinutes: 60 }], 0.75, 'linear').og)};
    new Chart(document.getElementById('chart4'), {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Current Linear', data: toXY(sweep.map(r => r.linearFG), temps), showLine: true, borderColor: C.linear, borderDash: [4, 2], borderWidth: 2, pointRadius: 0, fill: false },
          { label: 'Current Enzyme', data: toXY(sweep.map(r => r.enzymeFG), temps), showLine: true, borderColor: C.enzyme, borderWidth: 2.5, pointRadius: 0, fill: false },
          { label: 'Current ODE', data: toXY(sweep.map(r => r.odeFG), temps), showLine: true, borderColor: C.ode, borderWidth: 2.5, pointRadius: 0, fill: false },
          // Proposed FG curves
          ...proposed.map((p, i) => ({
            label: p.label,
            data: toXY(p.data.map(att => ogVal - (ogVal - 1) * att / 100), temps),
            showLine: true,
            borderColor: [C.prop1, C.prop2, C.prop3][i],
            borderDash: [6, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          })),
          // Empirical FG data
          ...Object.entries(SOURCE_COLORS).map(([src, col]) => scatterFGDataset(src, col, ogVal)),
        ]
      },
      options: chartOpts('Final Gravity', 0.990, 1.060),
    });

    // ── Tables ──
    function buildSweepTable() {
      const slopeMap = new Map(slopes.map(s => [s.temp, s]));
      let html = '<tr><th>Temp</th><th>Lin AA%</th><th>Enz AA%</th><th>ODE AA%</th><th>Enz FG</th><th>Enz Δ/°C</th>';
      proposed.forEach(p => { html += '<th>' + p.label.split(' ')[1] + '</th>'; });
      html += '</tr>';
      for (const row of sweep) {
        const s = slopeMap.get(row.temp);
        html += '<tr><td>' + row.temp + '°C</td>'
          + '<td>' + row.linear.toFixed(1) + '</td>'
          + '<td>' + row.enzyme.toFixed(1) + '</td>'
          + '<td>' + row.ode.toFixed(1) + '</td>'
          + '<td>' + row.enzymeFG.toFixed(3) + '</td>'
          + '<td>' + (s ? s.enzyme.toFixed(1) : '—') + '</td>';
        const idx = row.temp - 58;
        proposed.forEach(p => { html += '<td>' + p.data[idx].toFixed(1) + '</td>'; });
        html += '</tr>';
      }
      document.getElementById('sweepTable').innerHTML = html;
    }

    function buildStepTable() {
      let html = '<tr><th>Scenario</th><th>Linear</th><th>Enzyme</th><th>ODE</th><th>Enz FG</th><th>ODE FG</th></tr>';
      for (const r of stepMash) {
        html += '<tr><td>' + r.name + '</td>'
          + '<td>' + r.linear.toFixed(1) + '%</td>'
          + '<td>' + r.enzyme.toFixed(1) + '%</td>'
          + '<td>' + r.ode.toFixed(1) + '%</td>'
          + '<td>' + r.enzymeFG.toFixed(3) + '</td>'
          + '<td>' + r.odeFG.toFixed(3) + '</td></tr>';
      }
      document.getElementById('stepTable').innerHTML = html;
    }

    buildSweepTable();
    buildStepTable();
  </script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('\n=== Attenuation Model Verification ===\n');

  // Single infusion sweep
  const sweep75 = runSingleInfusionSweep(0.75);
  const slopes75 = computeSlopes(sweep75);

  // Proposed recalibrations
  const proposed75 = computeProposedCurves(0.75);

  // Print proposed slopes at key temps
  console.log('─── Proposed Recalibration Slopes at Key Temperatures ───');
  console.log('Temp   │ Current Enz │ BASE_S=0.16 │ BASE_S=0.24 │ BASE_S=0.32');
  console.log('───────┼─────────────┼─────────────┼─────────────┼────────────');
  for (const t of [62, 64, 66, 67, 68, 70, 72, 74, 76]) {
    const idx = t - 58;
    const currSlope = slopes75.find((s) => s.temp === t);
    const propSlopes = proposed75.map((p) => {
      if (idx <= 0 || idx >= p.data.length - 1) return '—';
      return ((p.data[idx - 1] - p.data[idx + 1]) / 2).toFixed(1);
    });
    console.log(
      `  ${t}°C  │    ${(currSlope?.enzyme ?? 0).toFixed(1).padStart(4)}     │    ${propSlopes[0].toString().padStart(4)}     │    ${propSlopes[1].toString().padStart(4)}     │    ${propSlopes[2].toString().padStart(4)}`,
    );
  }

  // Print empirical data
  console.log('\n─── Empirical Data Points ───');
  console.log('Source                    │ Temp    │ App Att%');
  console.log('──────────────────────────┼─────────┼─────────');
  for (const d of EMPIRICAL_DATA) {
    console.log(`${d.source.padEnd(26)}│ ${d.temp.toFixed(1).padStart(5)}°C │ ${d.appAtt.toFixed(1)}%`);
  }

  // Print empirical implied slopes
  console.log('\n─── Implied Slopes from Empirical Data ───');
  const sources = [...new Set(EMPIRICAL_DATA.map((d) => d.source))];
  for (const src of sources) {
    const pts = EMPIRICAL_DATA.filter((d) => d.source === src).sort((a, b) => a.temp - b.temp);
    if (pts.length >= 2) {
      const slope = (pts[0].appAtt - pts[pts.length - 1].appAtt) / (pts[pts.length - 1].temp - pts[0].temp);
      console.log(`  ${src}: ${slope.toFixed(1)}%/°C (${pts[0].temp}→${pts[pts.length - 1].temp}°C)`);
    }
  }

  // Step mash
  console.log('\n─── Step Mash Scenarios (baseAtt = 0.75) ───');
  const stepMash75 = runStepMashScenarios(0.75);
  for (const row of stepMash75) {
    console.log(`  ${row.name.padEnd(45)} Lin: ${row.linear.toFixed(1)}%  Enz: ${row.enzyme.toFixed(1)}%  ODE: ${row.ode.toFixed(1)}%`);
  }

  // Generate HTML
  const htmlContent = generateHTML(sweep75, slopes75, proposed75, stepMash75);
  const outPath = resolve(dirname(new URL(import.meta.url).pathname), 'attenuation-charts.html');
  writeFileSync(outPath, htmlContent, 'utf-8');
  console.log(`\n✅ Charts written to: ${outPath}`);
  console.log('   Open with: open scripts/attenuation-charts.html');
}

main();
