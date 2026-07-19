import { describe, expect, test } from "bun:test";
import { ZScoreCalculator } from "./calculator";
import { WHO_STANDARDS } from "./standards";

function findLms(
  measure: string,
  sex: "L" | "P",
  month: number
): { L: number; M: number; S: number } | null {
  const std = WHO_STANDARDS.find((s) => s.sex === sex && s.measure === measure);
  if (!std || !("data" in std)) return null;
  const rec = std.data.find((d: any) => d.month === month);
  if (!rec) return null;
  return { L: rec.L, M: rec.M, S: rec.S };
}

function findHeightLms(
  sex: "L" | "P",
  height: number
): { L: number; M: number; S: number } | null {
  const std = WHO_STANDARDS.find(
    (s) => s.sex === sex && s.measure === "bb_tb"
  ) as any;
  if (!std?.data) return null;
  const rec = std.data.find((d: any) => d.height === height);
  if (!rec) return null;
  return { L: rec.L, M: rec.M, S: rec.S };
}

function generateRandomInputs(count: number) {
  const inputs: Array<{
    ageMonths: number;
    weight: number;
    height: number;
    headCirc: number;
    armCirc: number;
    gender: "L" | "P";
  }> = [];
  for (let i = 0; i < count; i++) {
    const ageMonths = Math.floor(Math.random() * 60);
    const lms = findLms("bb_u", "L", ageMonths) || { L: 0, M: 9, S: 0.1 };
    // Generate weight between -3SD and +3SD
    const z = (Math.random() - 0.5) * 6;
    const weight = lms.M * Math.pow(1 + lms.L * lms.S * z, 1 / lms.L);
    inputs.push({
      ageMonths,
      weight: Math.round(weight * 10) / 10,
      height: 50 + Math.random() * 60,
      headCirc: 30 + Math.random() * 20,
      armCirc: 10 + Math.random() * 10,
      gender: Math.random() > 0.5 ? "L" : "P",
    });
  }
  return inputs;
}

// ──────────────────────────────────────
// Cycle 1: BB/U (Weight-for-age)
// ──────────────────────────────────────
describe("BB/U — Weight-for-age", () => {
  const calc = new ZScoreCalculator();

  test("rejects negative weight", () => {
    expect(() => calc.calculate(12, -1, 75, 0, 0, "L")).toThrow(
      "Weight must be positive"
    );
  });

  test("rejects zero weight", () => {
    expect(() => calc.calculate(12, 0, 75, 0, 0, "L")).toThrow(
      "Weight must be positive"
    );
  });

  test("classifies severe underweight for BB/U < -3SD", () => {
    // Boy 12mo: L=0.013, M=9.6, S=0.113898
    // Weight for Z=-3: 9.6 * (1 + 0.013*-3*0.113898)^(1/0.013)
    // ≈ 9.6 * 0.99556^(76.92) ≈ 9.6 * 0.71 ≈ 6.8
    const lms = findLms("bb_u", "L", 12)!;
    const w = lms.M * Math.pow(1 + lms.L * -3 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w - 0.1, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeLessThan(-3);
    expect(result.bb_u_status).toBe("Berat Badan Sangat Kurang");
  });

  test("classifies underweight for BB/U between -3SD and -2SD", () => {
    const lms = findLms("bb_u", "L", 12)!;
    const w = lms.M * Math.pow(1 + lms.L * -2.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeGreaterThanOrEqual(-3);
    expect(result.zScores.bb_u).toBeLessThan(-2);
    expect(result.bb_u_status).toBe("Berat Badan Kurang");
  });

  test("classifies normal weight for BB/U between -2SD and +1SD", () => {
    // At median M=9.6, Z≈0
    const result = calc.calculate(12, 9.6, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeGreaterThanOrEqual(-2);
    expect(result.zScores.bb_u).toBeLessThanOrEqual(1);
    expect(result.bb_u_status).toBe("Berat Badan Normal");
  });

  test("classifies risk overweight for BB/U > +1SD", () => {
    const lms = findLms("bb_u", "L", 12)!;
    const w = lms.M * Math.pow(1 + lms.L * 1.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeGreaterThan(1);
    expect(result.bb_u_status).toBe("Risiko Berat Badan Lebih");
  });
});

// ──────────────────────────────────────
// Cycle 2: TB/U (Height-for-age)
// ──────────────────────────────────────
describe("TB/U — Height-for-age", () => {
  const calc = new ZScoreCalculator();

  test("rejects zero height", () => {
    expect(() => calc.calculate(12, 10, 0, 0, 0, "L")).toThrow(
      "Height must be positive"
    );
  });

  test("rejects negative height", () => {
    expect(() => calc.calculate(12, 10, -5, 0, 0, "L")).toThrow(
      "Height must be positive"
    );
  });

  test("classifies severely stunted for TB/U < -3SD", () => {
    // Boy 12mo: L=0.867, M=75.7, S=0.031042
    const lms = findLms("tb_u", "L", 12)!;
    const h = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, h, 0, 0, "L");
    expect(result.zScores.tb_u).toBeLessThan(-3);
    expect(result.tb_u_status).toBe("Sangat Pendek");
  });

  test("classifies stunted for TB/U between -3SD and -2SD", () => {
    const lms = findLms("tb_u", "L", 12)!;
    const h = lms.M * Math.pow(1 + lms.L * -2.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, h, 0, 0, "L");
    expect(result.zScores.tb_u).toBeGreaterThanOrEqual(-3);
    expect(result.zScores.tb_u).toBeLessThan(-2);
    expect(result.tb_u_status).toBe("Pendek");
  });

  test("classifies normal height for TB/U", () => {
    // At median M=75.7, L=0.867
    const result = calc.calculate(12, 9.6, 75.7, 0, 0, "L");
    expect(Math.abs(result.zScores.tb_u)).toBeLessThan(1);
    expect(result.tb_u_status).toBe("Normal");
  });

  test("classifies tall for TB/U > +3SD", () => {
    const lms = findLms("tb_u", "L", 12)!;
    const h = lms.M * Math.pow(1 + lms.L * 3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, h, 0, 0, "L");
    expect(result.zScores.tb_u).toBeGreaterThan(3);
    expect(result.tb_u_status).toBe("Tinggi");
  });
});

// ──────────────────────────────────────
// Cycle 3: BB/TB (Weight-for-height)
// ──────────────────────────────────────
describe("BB/TB — Weight-for-height", () => {
  const calc = new ZScoreCalculator();

  test("classifies severely wasted for BB/TB < -3SD", () => {
    // Boy height=75cm: L=-0.513, M=9.6, S=0.082392
    const lms = findHeightLms("L", 75)!;
    const w = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_tb).toBeLessThan(-3);
    expect(result.bb_tb_status).toBe("Gizi Buruk");
  });

  test("classifies wasted for BB/TB between -3SD and -2SD", () => {
    const lms = findHeightLms("L", 75)!;
    const w = lms.M * Math.pow(1 + lms.L * -2.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_tb).toBeGreaterThanOrEqual(-3);
    expect(result.zScores.bb_tb).toBeLessThan(-2);
    expect(result.bb_tb_status).toBe("Gizi Kurang");
  });

  test("classifies normal for BB/TB", () => {
    const lms = findHeightLms("L", 75)!;
    const result = calc.calculate(12, lms.M, 75, 0, 0, "L");
    expect(Math.abs(result.zScores.bb_tb)).toBeLessThan(0.5);
    expect(result.bb_tb_status).toBe("Gizi Baik");
  });

  test("classifies obese for BB/TB > +3SD", () => {
    const lms = findHeightLms("L", 75)!;
    const w = lms.M * Math.pow(1 + lms.L * 3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_tb).toBeGreaterThan(3);
    expect(result.bb_tb_status).toBe("Obesitas");
  });
});

// ──────────────────────────────────────
// Cycle 4: IMT/U (BMI-for-age)
// ──────────────────────────────────────
describe("IMT/U — BMI-for-age", () => {
  const calc = new ZScoreCalculator();

  test("classifies severely thin for IMT/U < -3SD", () => {
    // Boy 12mo: L=-0.406, M=16.8, S=0.080313
    const lms = findLms("imt_u", "L", 12)!;
    const bmi = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    // BMI = weight(kg) / (height(m))^2 → weight = BMI * height^2
    const heightCm = 75;
    const weight = bmi * Math.pow(heightCm / 100, 2);
    const result = calc.calculate(12, weight, heightCm, 0, 0, "L");
    expect(result.zScores.imt_u).toBeLessThan(-3);
    expect(result.imt_u_status).toBe("Sangat Kurus");
  });

  test("classifies normal for IMT/U", () => {
    const lms = findLms("imt_u", "L", 12)!;
    const heightCm = 75;
    const weight = lms.M * Math.pow(heightCm / 100, 2);
    const result = calc.calculate(12, weight, heightCm, 0, 0, "L");
    expect(Math.abs(result.zScores.imt_u)).toBeLessThan(1);
    expect(result.imt_u_status).toBe("Gizi Baik");
  });
});

// ──────────────────────────────────────
// Cycle 5: LK/U (Head circumference)
// ──────────────────────────────────────
describe("LK/U — Head circumference", () => {
  const calc = new ZScoreCalculator();

  test("classifies microcephaly for LK/U < -2SD", () => {
    // Boy 12mo: L=1.0, M=46.0661, S=0.02789
    const lms = findLms("lk_u", "L", 12)!;
    const val = lms.M * (1 + lms.L * -2.5 * lms.S);
    const result = calc.calculate(12, 9.6, 75, val, 0, "L");
    expect(result.zScores.lk_u).toBeLessThan(-2);
    expect(result.lk_u_status).toBe("Mikrocepali");
  });

  test("classifies macrocephaly for LK/U > +2SD", () => {
    const lms = findLms("lk_u", "L", 12)!;
    const val = lms.M * (1 + lms.L * 2.5 * lms.S);
    const result = calc.calculate(12, 9.6, 75, val, 0, "L");
    expect(result.zScores.lk_u).toBeGreaterThan(2);
    expect(result.lk_u_status).toBe("Makrocepali");
  });

  test("classifies normal for LK/U", () => {
    const lms = findLms("lk_u", "L", 12)!;
    const result = calc.calculate(12, 9.6, 75, lms.M, 0, "L");
    expect(Math.abs(result.zScores.lk_u)).toBeLessThan(0.5);
    expect(result.lk_u_status).toBe("Normal");
  });
});

// ──────────────────────────────────────
// Cycle 6: LiLA/U (MUAC)
// ──────────────────────────────────────
describe("LiLA/U — MUAC", () => {
  const calc = new ZScoreCalculator();

  test("classifies severe malnutrition for LiLA/U < -3SD", () => {
    const lms = findLms("lila_u", "L", 12)!;
    const val = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, 75, 0, val, "L");
    expect(result.zScores.lila_u).toBeLessThan(-3);
    expect(result.lila_u_status).toBe("Gizi Buruk");
  });

  test("classifies moderate malnutrition for LiLA/U between -3SD and -2SD", () => {
    const lms = findLms("lila_u", "L", 12)!;
    const val = lms.M * Math.pow(1 + lms.L * -2.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, 75, 0, val, "L");
    expect(result.zScores.lila_u).toBeGreaterThanOrEqual(-3);
    expect(result.zScores.lila_u).toBeLessThan(-2);
    expect(result.lila_u_status).toBe("Gizi Kurang");
  });

  test("classifies normal MUAC", () => {
    const lms = findLms("lila_u", "L", 12)!;
    const result = calc.calculate(12, 9.6, 75, 0, lms.M, "L");
    expect(Math.abs(result.zScores.lila_u)).toBeLessThan(0.5);
    expect(result.lila_u_status).toBe("Gizi Baik");
  });
});

// ──────────────────────────────────────
// Cycle 7: Permenkes 2/2020 statusAkhir
// ──────────────────────────────────────
describe("statusAkhir — Permenkes 2/2020 classification", () => {
  const calc = new ZScoreCalculator();

  test("statusAkhir is MERAH when BB/U < -3SD", () => {
    const lms = findLms("bb_u", "L", 12)!;
    const w = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeLessThan(-3);
    expect(result.statusAkhir).toBe("MERAH");
  });

  test("statusAkhir is MERAH when TB/U < -3SD", () => {
    const lms = findLms("tb_u", "L", 12)!;
    const h = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, 9.6, h, 0, 0, "L");
    expect(result.zScores.tb_u).toBeLessThan(-3);
    expect(result.statusAkhir).toBe("MERAH");
  });

  test("statusAkhir is MERAH when BB/TB < -3SD", () => {
    const lms = findHeightLms("L", 75)!;
    const w = lms.M * Math.pow(1 + lms.L * -3.5 * lms.S, 1 / lms.L);
    const result = calc.calculate(12, w, 75, 0, 0, "L");
    expect(result.zScores.bb_tb).toBeLessThan(-3);
    expect(result.statusAkhir).toBe("MERAH");
  });

  test("statusAkhir is KUNING when TB/U between -3SD and -2SD", () => {
    // Boy 12mo: height=70 → TB/U Z ≈ -2.4 (yellow)
    // All other measures normal
    const result = calc.calculate(12, 9.6, 70, 46.1, 14.6, "L");
    expect(result.zScores.tb_u).toBeGreaterThanOrEqual(-3);
    expect(result.zScores.tb_u).toBeLessThan(-2);
    expect(result.statusAkhir).toBe("KUNING");
  });

  test("statusAkhir is HIJAU when all indicators normal", () => {
    // All at median values
    const result = calc.calculate(12, 9.6, 75.7, 46.1, 14.6, "L");
    expect(result.statusAkhir).toBe("HIJAU");
  });
});

// ──────────────────────────────────────
// Cycle 8: Edge cases
// ──────────────────────────────────────
describe("Edge cases", () => {
  const calc = new ZScoreCalculator();

  test("rejects negative age", () => {
    expect(() => calc.calculate(-1, 9.6, 75, 0, 0, "L")).toThrow(
      "Age cannot be negative"
    );
  });

  test("rejects invalid gender", () => {
    expect(() => calc.calculate(12, 9.6, 75, 0, 0, "X" as any)).toThrow(
      "Gender must be L or P"
    );
  });

  test("handles age > 60 months by clamping to max data", () => {
    // Should not throw — clamped to last available month
    const result = calc.calculate(72, 9.6, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeDefined();
    expect(typeof result.zScores.bb_u).toBe("number");
  });

  test("handles age at exact boundary (month 0)", () => {
    const result = calc.calculate(0, 3.3, 49.9, 34.5, 0, "L");
    expect(result.zScores.bb_u).toBeDefined();
  });

  test("handles age at max boundary (month 60)", () => {
    const result = calc.calculate(60, 9.6, 75, 0, 0, "L");
    expect(result.zScores.bb_u).toBeDefined();
  });

  test("handles zero head circumference without error", () => {
    const result = calc.calculate(12, 9.6, 75, 0, 0, "L");
    expect(result.zScores.lk_u).toBeDefined();
  });

  test("rejects negative head circumference", () => {
    expect(() => calc.calculate(12, 9.6, 75, -1, 0, "L")).toThrow(
      "Head circumference cannot be negative"
    );
  });
});

// ──────────────────────────────────────
// Cycle 9: Performance
// ──────────────────────────────────────
describe("Performance", () => {
  const calc = new ZScoreCalculator();

  test("1000 random calculations complete in under 100ms", () => {
    const inputs = generateRandomInputs(1000);
    const start = performance.now();
    for (const input of inputs) {
      calc.calculate(
        input.ageMonths,
        input.weight,
        input.height,
        input.headCirc,
        input.armCirc,
        input.gender
      );
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
    // ponytail: skip if passes — already fast enough
  });
});

// ──────────────────────────────────────
// Cross-validation: internal consistency
// ──────────────────────────────────────
describe("Cross-validation", () => {
  const calc = new ZScoreCalculator();

  test("statusAkhir is internally consistent: MERAH > KUNING > HIJAU", () => {
    const inputs = generateRandomInputs(100);
    for (const input of inputs) {
      const result = calc.calculate(
        input.ageMonths,
        input.weight,
        input.height,
        input.headCirc,
        input.armCirc,
        input.gender
      );
      // statusAkhir is always one of three values
      expect(["MERAH", "KUNING", "HIJAU"]).toContain(result.statusAkhir);
      // MERAH when any Z-score exceeds thresholds
      const hasRed = (z: number) => z < -3 || z > 3;
      const _hasYellow = (z: number) =>
        (z >= -3 && z < -2) || (z > 2 && z <= 3);
      const zs = result.zScores;
      if (result.statusAkhir === "MERAH") {
        const redFound =
          hasRed(zs.bb_u) ||
          hasRed(zs.tb_u) ||
          hasRed(zs.bb_tb) ||
          hasRed(zs.lila_u) ||
          hasRed(zs.imt_u) ||
          zs.lk_u < -2 ||
          zs.lk_u > 2;
        expect(redFound).toBe(true);
      }
    }
  });
});
