import { describe, test, expect } from 'vitest';
import { correctHydrometer } from './hydrometerCorrection';

describe('Hydrometer Temperature Correction', () => {
  test('no correction when sample is at calibration temperature', () => {
    const result = correctHydrometer(1.050, 20, 20);
    expect(result).toBeCloseTo(1.050, 4);
  });

  test('corrects upward when sample is warmer than calibration (20°C cal)', () => {
    // At 30°C, water is less dense → hydrometer reads low → correction adds
    const result = correctHydrometer(1.050, 30, 20);
    expect(result).toBeGreaterThan(1.050);
    expect(result).toBeCloseTo(1.052, 2);
  });

  test('corrects downward when sample is cooler than calibration', () => {
    // At 10°C, water is denser → hydrometer reads high → correction subtracts
    const result = correctHydrometer(1.050, 10, 20);
    expect(result).toBeLessThan(1.050);
  });

  test('handles 15°C calibration (older hydrometers)', () => {
    const result = correctHydrometer(1.050, 15, 15);
    expect(result).toBeCloseTo(1.050, 4);
  });

  test('hot wort sample at 60°C', () => {
    // Large correction for hot wort
    const result = correctHydrometer(1.050, 60, 20);
    expect(result).toBeGreaterThan(1.060);
  });

  test('correction increases with higher temperature difference', () => {
    const at25 = correctHydrometer(1.050, 25, 20);
    const at40 = correctHydrometer(1.050, 40, 20);
    const at60 = correctHydrometer(1.050, 60, 20);

    expect(at25 - 1.050).toBeLessThan(at40 - 1.050);
    expect(at40 - 1.050).toBeLessThan(at60 - 1.050);
  });

  test('works for pure water (SG 1.000)', () => {
    const result = correctHydrometer(1.000, 30, 20);
    expect(result).toBeCloseTo(1.000, 2);
  });

  test('works for high gravity wort', () => {
    const result = correctHydrometer(1.100, 30, 20);
    expect(result).toBeGreaterThan(1.100);
  });
});
