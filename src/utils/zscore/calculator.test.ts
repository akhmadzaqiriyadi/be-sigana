import { describe, expect, test } from "bun:test";
import { ZScoreCalculator } from "./calculator";

describe("ZScoreCalculator", () => {
  const calculator = new ZScoreCalculator();

  test("interpolates LMS correctly", () => {
    // Test internal interpolation logic implicitly via calculation
    // Age 6 months (exact match in our constants)
    // Boy: L=0.0435, M=7.9392, S=0.11438
    // Weight: 7.9392 (Median) -> Z should be 0
    const result = calculator.calculate(6, 7.9392, 60, 0, 0, "L");
    expect(Math.abs(result.zScores.bb_u)).toBeLessThan(0.01);
    expect(result.bb_u_status).toBe("Berat Badan Normal");
  });

  test("interpolates between months", () => {
    // Age 3 months (between 1 and 6)
    // Checkpoints:
    // 1mo: L=0.1360, M=4.4709, S=0.12643
    // 6mo: L=0.0435, M=7.9392, S=0.11438
    // Fraction for 3mo: (3-1)/(6-1) = 2/5 = 0.4
    // Expected M = 4.4709 + (7.9392 - 4.4709)*0.4 = 4.4709 + 1.38732 = 5.858

    // If weight = 5.858, Z should be approx 0
    const result = calculator.calculate(3, 5.858, 60, 0, 0, "L");
    expect(Math.abs(result.zScores.bb_u)).toBeLessThan(0.05);
  });

  test("calculates positive Z-score correctly", () => {
    // Age 12 months BOY
    // M=9.6480, S=0.11181, L=0.0324
    // Case: Weight = 11kg
    // Formula: ((11/9.648)^0.0324 - 1) / (0.0324 * 0.11181)
    // 1.140132^0.0324 = 1.00427
    // Num = 0.00427
    // Denom = 0.003622
    // Z = 1.18
    const result = calculator.calculate(12, 11, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeGreaterThan(1);
    expect(result.zScores.bb_u).toBeLessThan(1.3);
  });

  test("identifies Stunting (TB/U)", () => {
    // Age 12 months BOY
    // TB/U M=75.75, S=0.034
    // Case: Height = 68cm
    // Z approx -3
    const result = calculator.calculate(12, 9.6, 68, 0, 0, "L");
    expect(result.tb_u_status).toBe("Sangat Pendek");
    expect(result.statusAkhir).toBe("MERAH");
  });
});
