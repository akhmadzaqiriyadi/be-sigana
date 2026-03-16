import { describe, expect, test } from "bun:test";
import { ZScoreCalculator } from "./calculator";
import { WHO_STANDARDS } from "./standards";

function calculateLmsZ(val: number, L: number, M: number, S: number): number {
  if (Math.abs(L) < 0.0000001) {
    return Math.log(val / M) / S;
  }

  return (Math.pow(val / M, L) - 1) / (L * S);
}

describe("ZScoreCalculator", () => {
  const calculator = new ZScoreCalculator();

  test("interpolates LMS correctly", () => {
    const bbUStandardsBoy = WHO_STANDARDS.find(
      (s) => s.sex === "L" && s.measure === "bb_u"
    );
    const month6 = bbUStandardsBoy?.data.find((d) => d.month === 6);

    if (!month6) {
      throw new Error("Missing WHO standard for BB/U boy month 6");
    }

    // If weight equals median M at exact month, Z-score should be ~0.
    const result = calculator.calculate(6, month6.M, 60, 0, 0, "L");
    expect(Math.abs(result.zScores.bb_u)).toBeLessThan(0.000001);
    expect(result.bb_u_status).toBe("Berat Badan Normal");
  });

  test("interpolates between months", () => {
    const bbUStandardsBoy = WHO_STANDARDS.find(
      (s) => s.sex === "L" && s.measure === "bb_u"
    );
    const data = bbUStandardsBoy?.data;
    const targetMonth = 3.5;

    if (!data?.length) {
      throw new Error("Missing WHO standards for BB/U interpolation test");
    }

    const prev = [...data]
      .filter((d) => d.month <= targetMonth)
      .sort((a, b) => b.month - a.month)[0];
    const next = [...data]
      .filter((d) => d.month >= targetMonth)
      .sort((a, b) => a.month - b.month)[0];

    if (!prev || !next || prev.month === next.month) {
      throw new Error("Could not resolve interpolation bounds for BB/U test");
    }

    const fraction = (targetMonth - prev.month) / (next.month - prev.month);
    const interpolatedM = prev.M + (next.M - prev.M) * fraction;

    // If weight equals interpolated median M, Z-score should be ~0.
    const result = calculator.calculate(
      targetMonth,
      interpolatedM,
      60,
      0,
      0,
      "L"
    );
    expect(Math.abs(result.zScores.bb_u)).toBeLessThan(0.000001);
  });

  test("calculates positive Z-score correctly", () => {
    const bbUStandardsBoy = WHO_STANDARDS.find(
      (s) => s.sex === "L" && s.measure === "bb_u"
    );
    const month12 = bbUStandardsBoy?.data.find((d) => d.month === 12);

    if (!month12) {
      throw new Error("Missing WHO standard for BB/U boy month 12");
    }

    const result = calculator.calculate(12, 11, 75, 0, 0, "L");
    const expected = calculateLmsZ(11, month12.L, month12.M, month12.S);

    expect(result.zScores.bb_u).toBeCloseTo(expected, 6);
    expect(result.zScores.bb_u).toBeGreaterThan(0);
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
