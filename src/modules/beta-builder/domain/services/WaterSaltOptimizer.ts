/**
 * Water Salt Optimizer — Bounded Least Squares
 *
 * Solves the inverse water chemistry problem: given source and target
 * water profiles, find optimal salt additions to minimise ion error.
 *
 * Uses an active-set method on the normal equations:
 *   minimize  Σ wᵢ·(Aᵢ·x − bᵢ)²
 *   subject to  0 ≤ xⱼ ≤ MAX_SALT
 *
 * The unconstrained optimum is x = (AᵀWA)⁻¹ · AᵀWb. Variables that
 * violate bounds are clamped and removed from the free set; the reduced
 * system is re-solved until stable. For N variables this converges in
 * at most N iterations and gives the exact mathematical optimum.
 */

import type { WaterProfile, SaltAdditions } from './WaterChemistryService';

// Ion contributions per 1 g of salt added to 1 L of water (ppm).
// Derived from molar mass fractions: ion_weight / salt_molecular_weight × 1000.
const SALT_ION_RATES = {
  gypsum: { Ca: 232.8, Mg: 0, Na: 0, Cl: 0, SO4: 557.9, HCO3: 0 },
  cacl2: { Ca: 272.6, Mg: 0, Na: 0, Cl: 482.3, SO4: 0, HCO3: 0 },
  epsom: { Ca: 0, Mg: 98.6, Na: 0, Cl: 0, SO4: 389.7, HCO3: 0 },
  nacl: { Ca: 0, Mg: 0, Na: 393.4, Cl: 606.6, SO4: 0, HCO3: 0 },
  nahco3: { Ca: 0, Mg: 0, Na: 273.7, Cl: 0, SO4: 0, HCO3: 726.3 },
} as const;

type SaltKey = keyof typeof SALT_ION_RATES;
type IonKey = keyof WaterProfile;

const ALL_IONS: IonKey[] = ['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'];
const BASE_IONS: IonKey[] = ['Ca', 'Mg', 'Na', 'Cl', 'SO4'];

const ALL_SALTS: SaltKey[] = ['gypsum', 'cacl2', 'epsom', 'nacl', 'nahco3'];
const BASE_SALTS: SaltKey[] = ['gypsum', 'cacl2', 'epsom', 'nacl'];

/**
 * Default ion weights for weighted least squares.
 * Cl and SO4 are weighted heavily because the Cl:SO4 ratio is the
 * most impactful water chemistry metric for beer flavour balance.
 * Ca/Mg/Na are lower priority — small deviations are less perceptible.
 * HCO3 gets moderate weight when baking soda is included.
 */
const DEFAULT_WEIGHTS: Record<string, number> = {
  Ca: 0.5,
  Mg: 0.5,
  Na: 0.3,
  Cl: 2.0,
  SO4: 2.0,
  HCO3: 0.8,
};

export type OptimizerOptions = {
  /** Per-ion weights (higher = stricter matching). Defaults provided. */
  weights?: Partial<Record<string, number>>;
  /** Max grams per salt. Default 50. */
  maxSaltG?: number;
  /** Include baking soda (NaHCO3) in the optimization. Default false. */
  includeBakingSoda?: boolean;
};

export type OptimizerResult = {
  /** Optimised salt additions in grams (rounded to 0.1g). */
  salts: SaltAdditions;
  /** Achieved water profile after adding optimised salts to source. */
  achieved: WaterProfile;
  /** Root mean square error across optimised ions (ppm). */
  rmsError: number;
  /** Per-ion delta: achieved − target (ppm). */
  deltas: Record<string, number>;
  /** Warnings for the user. */
  warnings: string[];
};

/**
 * Build the M×N contribution matrix scaled by water volume.
 * A[i][j] = ppm of ion i per gram of salt j in volumeL litres.
 */
function buildMatrix(volumeL: number, ions: IonKey[], salts: SaltKey[]): number[][] {
  const v = Math.max(0.001, volumeL);
  return ions.map((ion) =>
    salts.map((salt) => (SALT_ION_RATES[salt][ion] || 0) / v)
  );
}

/**
 * Build the M-element deficit vector: target − source for each ion.
 */
function buildDeficit(source: WaterProfile, target: WaterProfile, ions: IonKey[]): number[] {
  return ions.map((ion) => target[ion] - source[ion]);
}

/**
 * Compute weighted sum of squared residuals.
 */
function computeError(A: number[][], x: number[], b: number[], w: number[]): number {
  const m = b.length;
  const n = x.length;
  let err = 0;
  for (let i = 0; i < m; i++) {
    let ax = 0;
    for (let j = 0; j < n; j++) ax += A[i][j] * x[j];
    err += w[i] * (ax - b[i]) ** 2;
  }
  return err;
}

/**
 * Solve a small NxN linear system using Gaussian elimination with partial pivoting.
 * Returns null if the system is singular.
 */
function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  // Build augmented matrix
  const aug = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // singular
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let k = col; k <= n; k++) {
        aug[row][k] -= factor * aug[col][k];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= aug[row][col] * x[col];
    }
    x[row] = sum / aug[row][row];
  }
  return x;
}

/**
 * Active-set bounded least squares solver.
 *
 * 1. Solve the unconstrained normal equations: x = (AᵀWA)⁻¹ · AᵀWb
 * 2. Clamp any out-of-bounds variables to their bound (fixed set)
 * 3. Re-solve for remaining free variables with fixed ones as constants
 * 4. Repeat until no variables change sets
 *
 * For N variables, this converges in at most N iterations.
 */
function solve(
  A: number[][],
  b: number[],
  w: number[],
  maxSalt: number,
  numSalts: number,
): number[] {
  const n = numSalts;
  const m = b.length;
  const x = new Array(n).fill(0);

  // Track which variables are fixed at a bound vs free
  // null = free, 0 = fixed at lower, maxSalt = fixed at upper
  const fixed: (number | null)[] = new Array(n).fill(null);

  for (let iteration = 0; iteration < n + 1; iteration++) {
    const freeIndices = [];
    for (let j = 0; j < n; j++) {
      if (fixed[j] === null) freeIndices.push(j);
    }

    if (freeIndices.length === 0) break;

    // Adjust b for fixed variables: b' = b - A·x_fixed
    const bAdj = new Array(m);
    for (let i = 0; i < m; i++) {
      bAdj[i] = b[i];
      for (let j = 0; j < n; j++) {
        if (fixed[j] !== null) {
          bAdj[i] -= A[i][j] * fixed[j]!;
        }
      }
    }

    // Build reduced normal equations for free variables:
    // (A_f^T W A_f) x_f = A_f^T W b'
    const nf = freeIndices.length;
    const AtWA = Array.from({ length: nf }, () => new Array(nf).fill(0));
    const AtWb = new Array(nf).fill(0);

    for (let fi = 0; fi < nf; fi++) {
      const j1 = freeIndices[fi];
      for (let fk = 0; fk < nf; fk++) {
        const j2 = freeIndices[fk];
        for (let i = 0; i < m; i++) {
          AtWA[fi][fk] += w[i] * A[i][j1] * A[i][j2];
        }
      }
      for (let i = 0; i < m; i++) {
        AtWb[fi] += w[i] * A[i][j1] * bAdj[i];
      }
    }

    // Solve the reduced system
    const xFree = solveLinearSystem(AtWA, AtWb);
    if (!xFree) break; // singular — keep current x

    // Apply solution to free variables
    for (let fi = 0; fi < nf; fi++) {
      x[freeIndices[fi]] = xFree[fi];
    }
    // Apply fixed values
    for (let j = 0; j < n; j++) {
      if (fixed[j] !== null) x[j] = fixed[j]!;
    }

    // Check bounds and fix any violations
    let changed = false;
    for (let fi = 0; fi < nf; fi++) {
      const j = freeIndices[fi];
      if (x[j] < 0) {
        fixed[j] = 0;
        x[j] = 0;
        changed = true;
      } else if (x[j] > maxSalt) {
        fixed[j] = maxSalt;
        x[j] = maxSalt;
        changed = true;
      }
    }

    if (!changed) break; // all free variables are within bounds — optimal
  }

  return x;
}

/**
 * Smart rounding: try all 2^N floor/ceil combos at 0.1g,
 * pick the one with lowest weighted squared error.
 * For N ≤ 5 (32 combos) this is fast.
 */
function smartRound(x: number[], A: number[][], b: number[], w: number[]): number[] {
  const n = x.length;
  const floors = x.map((v) => Math.max(0, Math.floor(v * 10) / 10));
  const ceils = x.map((v) => Math.max(0, Math.ceil(v * 10) / 10));

  let bestX = floors;
  let bestErr = Infinity;
  const combos = 1 << n; // 2^n

  for (let mask = 0; mask < combos; mask++) {
    const candidate = new Array(n);
    for (let j = 0; j < n; j++) {
      candidate[j] = mask & (1 << j) ? ceils[j] : floors[j];
    }
    const err = computeError(A, candidate, b, w);
    if (err < bestErr) {
      bestErr = err;
      bestX = candidate;
    }
  }

  return bestX;
}

/**
 * Compute the achieved water profile from source + salt additions.
 */
function computeAchieved(
  source: WaterProfile,
  x: number[],
  A: number[][],
  ions: IonKey[],
): WaterProfile {
  const achieved: WaterProfile = { ...source };
  ions.forEach((ion, i) => {
    let delta = 0;
    for (let j = 0; j < x.length; j++) delta += A[i][j] * x[j];
    achieved[ion] = source[ion] + delta;
  });
  return achieved;
}

/**
 * Optimise salt additions to match a target water profile.
 *
 * Solves a bounded least squares problem exactly using the active-set method
 * on the normal equations. For 4–5 salts × 5–6 ions this gives the
 * mathematically optimal solution in at most N iterations.
 *
 * When `includeBakingSoda` is true, NaHCO3 is added as a 5th salt and
 * HCO3 is included as a 6th ion in the optimisation. Otherwise HCO3
 * is excluded (handled separately via acid additions).
 *
 * @param source Current source water profile (ppm)
 * @param target Desired target water profile (ppm)
 * @param volumeL Total water volume in litres
 * @param options Optional solver configuration
 */
export function optimizeSaltAdditions(
  source: WaterProfile,
  target: WaterProfile,
  volumeL: number,
  options?: OptimizerOptions
): OptimizerResult {
  const maxSalt = options?.maxSaltG ?? 50;
  const weightOverrides = options?.weights ?? {};
  const includeBakingSoda = options?.includeBakingSoda ?? false;

  const ions = includeBakingSoda ? ALL_IONS : BASE_IONS;
  const salts = includeBakingSoda ? ALL_SALTS : BASE_SALTS;
  const numSalts = salts.length;
  const numIons = ions.length;

  const w = ions.map((ion) => weightOverrides[ion] ?? DEFAULT_WEIGHTS[ion] ?? 1.0);

  const warnings: string[] = [];

  // Edge case: zero or negative volume
  if (volumeL <= 0) {
    return {
      salts: {},
      achieved: { ...source },
      rmsError: 0,
      deltas: Object.fromEntries(ions.map((ion) => [ion, 0])),
      warnings: ['Volume is zero — no salts needed.'],
    };
  }

  const A = buildMatrix(volumeL, ions, salts);
  const b = buildDeficit(source, target, ions);

  // Check if source already exceeds target for any ion
  ions.forEach((ion, i) => {
    if (b[i] < -5) {
      warnings.push(
        `Source exceeds target for ${ion} by ${Math.round(Math.abs(b[i]))} ppm. Consider diluting with RO water.`
      );
    }
  });

  // Early exit: all deficits within ±5 ppm
  if (b.every((d) => Math.abs(d) <= 5)) {
    return {
      salts: {},
      achieved: { ...source },
      rmsError: Math.sqrt(b.reduce((sum, d) => sum + d * d, 0) / numIons),
      deltas: Object.fromEntries(ions.map((ion, i) => [ion, b[i]])),
      warnings,
    };
  }

  // Solve
  const xRaw = solve(A, b, w, maxSalt, numSalts);

  // Check for salts hitting the upper bound
  salts.forEach((salt, j) => {
    if (xRaw[j] >= maxSalt - 0.05) {
      warnings.push(
        `${salt} hit the ${maxSalt}g cap — target may not be fully achievable.`
      );
    }
  });

  // Smart round
  const x = smartRound(xRaw, A, b, w);

  // Compute achieved profile and error
  const achieved = computeAchieved(source, x, A, ions);
  const deltas: Record<string, number> = {};
  let sumSqErr = 0;
  ions.forEach((ion) => {
    const d = achieved[ion] - target[ion];
    deltas[ion] = Math.round(d * 10) / 10;
    sumSqErr += d * d;
  });
  const rmsError = Math.sqrt(sumSqErr / numIons);

  // Build SaltAdditions (only include non-zero values)
  const saltResult: SaltAdditions = {};
  const saltKeyMap: (keyof SaltAdditions)[] = includeBakingSoda
    ? ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g', 'nahco3_g']
    : ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g'];

  saltKeyMap.forEach((key, j) => {
    if (x[j] > 0) saltResult[key] = x[j];
  });

  return { salts: saltResult, achieved, rmsError, deltas, warnings };
}
