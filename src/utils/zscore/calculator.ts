import { WHO_STANDARDS, LMSRecord } from "./standards";

type Gender = "L" | "P";

export interface AnthropometryResult {
  bb_u_status: string; // Berat/Umur
  tb_u_status: string; // Tinggi/Umur
  bb_tb_status: string; // Berat/Tinggi
  statusAkhir: string;
  zScores: {
    bb_u: number;
    tb_u: number;
    bb_tb: number;
  };
}

export class ZScoreCalculator {
  private interpolateLMS(
    data: LMSRecord[],
    targetMonth: number
  ): LMSRecord | null {
    // Exact match
    const exact = data.find((d) => d.month === targetMonth);
    if (exact) return exact;

    // Boundary check
    if (targetMonth < data[0].month) return data[0];
    if (targetMonth > data.at(-1)!.month) return data.at(-1)!;

    // Find neighbors
    let prev = data[0];
    let next = data.at(-1)!;

    for (let i = 0; i < data.length - 1; i++) {
      if (data[i].month <= targetMonth && data[i + 1].month >= targetMonth) {
        prev = data[i];
        next = data[i + 1];
        break;
      }
    }

    // Linear Interpolation
    const fraction = (targetMonth - prev.month) / (next.month - prev.month);

    return {
      month: targetMonth,
      L: prev.L + (next.L - prev.L) * fraction,
      M: prev.M + (next.M - prev.M) * fraction,
      S: prev.S + (next.S - prev.S) * fraction,
    };
  }

  private calculateZ(val: number, lms: LMSRecord): number {
    const { L, M, S } = lms;

    // Formula: Z = ((y/M)^L - 1) / (L*S)
    if (Math.abs(L) < 0.0000001) {
      return Math.log(val / M) / S;
    }

    return (Math.pow(val / M, L) - 1) / (L * S);
  }

  private getWeightForAgeStatus(zScore: number): string {
    if (zScore < -3) return "Berat Badan Sangat Kurang";
    if (zScore < -2) return "Berat Badan Kurang";
    if (zScore > 1) return "Risiko Berat Badan Lebih";
    return "Berat Badan Normal";
  }

  private getHeightForAgeStatus(zScore: number): string {
    if (zScore < -3) return "Sangat Pendek";
    if (zScore < -2) return "Pendek";
    if (zScore > 3) return "Tinggi";
    return "Normal";
  }

  private getWeightForHeightStatus(zScore: number): string {
    if (zScore < -3) return "Gizi Buruk";
    if (zScore < -2) return "Gizi Kurang";
    if (zScore > 3) return "Obesitas";
    if (zScore > 2) return "Gizi Lebih";
    if (zScore > 1) return "Berisiko Gizi Lebih";
    return "Gizi Baik";
  }

  private getStatusLabel(
    zScore: number,
    type: "BB_U" | "TB_U" | "BB_TB"
  ): string {
    // Permenkes No 2 2020 Standards
    switch (type) {
      case "BB_U":
        return this.getWeightForAgeStatus(zScore);
      case "TB_U":
        return this.getHeightForAgeStatus(zScore);
      case "BB_TB":
        return this.getWeightForHeightStatus(zScore);
      default:
        return "Normal";
    }
  }

  private determineFinalStatus(zScores: {
    bb_u: number;
    tb_u: number;
    bb_tb: number;
  }): string {
    // Priority: MERAH > KUNING > HIJAU
    // MERAH: < -3SD or > +3SD (for some)
    // KUNING: -3SD < Z < -2SD or > +2SD

    const isRed = (z: number) => z < -3 || z > 3;
    const isYellow = (z: number) => (z >= -3 && z < -2) || (z > 2 && z <= 3);

    if (isRed(zScores.bb_u) || isRed(zScores.tb_u) || isRed(zScores.bb_tb)) {
      return "MERAH";
    }
    if (
      isYellow(zScores.bb_u) ||
      isYellow(zScores.tb_u) ||
      isYellow(zScores.bb_tb)
    ) {
      return "KUNING";
    }
    return "HIJAU";
  }

  public calculate(
    ageInMonths: number,
    weight: number,
    height: number,
    gender: Gender
  ): AnthropometryResult {
    // 1. Get LMS Parameters for Age/Sex
    const standards = WHO_STANDARDS.filter((s) => s.sex === gender);

    const bb_u_lms = this.interpolateLMS(
      standards.find((s) => s.measure === "bb_u")?.data || [],
      ageInMonths
    );

    const tb_u_lms = this.interpolateLMS(
      standards.find((s) => s.measure === "tb_u")?.data || [],
      ageInMonths
    );

    // For BB_TB, usually it's length-based lookup, not age-based.
    // Simplifying via Mock for now as requested plan focused on logic replacement
    // In full implementation, BB_TB lookup table relies on Height (cm) not Age.
    // We will use Age-based for now given the data struct, OR mock the z-score for BB/TB until table added
    const bb_tb_z = 0; // Placeholder until Height-based table added

    const bb_u_z = bb_u_lms ? this.calculateZ(weight, bb_u_lms) : 0;
    const tb_u_z = tb_u_lms ? this.calculateZ(height, tb_u_lms) : 0;

    return {
      bb_u_status: this.getStatusLabel(bb_u_z, "BB_U"),
      tb_u_status: this.getStatusLabel(tb_u_z, "TB_U"),
      bb_tb_status: this.getStatusLabel(bb_tb_z, "BB_TB"),
      statusAkhir: this.determineFinalStatus({
        bb_u: bb_u_z,
        tb_u: tb_u_z,
        bb_tb: bb_tb_z,
      }),
      zScores: {
        bb_u: bb_u_z,
        tb_u: tb_u_z,
        bb_tb: bb_tb_z,
      },
    };
  }
}

export const calculateAnthropometry = (
  ageInMonths: number,
  weight: number,
  height: number,
  gender: string
) => {
  const calculator = new ZScoreCalculator();
  return calculator.calculate(ageInMonths, weight, height, gender as Gender);
};
