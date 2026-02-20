import { WHO_STANDARDS, LMSRecord, GrowthStandard } from "./standards";

type Gender = "L" | "P";

export interface AnthropometryResult {
  bb_u_status: string;
  tb_u_status: string;
  bb_tb_status: string;
  lk_u_status: string;
  lila_u_status: string;
  imt_u_status: string;
  statusAkhir: string;
  zScores: {
    bb_u: number;
    tb_u: number;
    bb_tb: number;
    lk_u: number;
    lila_u: number;
    imt_u: number;
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
    if (targetMonth > data[data.length - 1].month) return data[data.length - 1];

    // Find neighbors
    let prev = data[0];
    let next = data[data.length - 1];

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

  private getHeadCircumferenceStatus(zScore: number): string {
    if (zScore < -2) return "Mikrocepali";
    if (zScore > 2) return "Makrocepali";
    return "Normal";
  }

  private getArmCircumferenceStatus(zScore: number): string {
    if (zScore < -3) return "Gizi Buruk";
    if (zScore < -2) return "Gizi Kurang";
    if (zScore > 2) return "Gizi Lebih";
    return "Gizi Baik";
  }

  private getBMIStatus(zScore: number): string {
    if (zScore < -3) return "Sangat Kurus";
    if (zScore < -2) return "Kurus";
    if (zScore > 3) return "Obesitas";
    if (zScore > 2) return "Gemuk";
    if (zScore > 1) return "Berisiko Gemuk";
    return "Gizi Baik";
  }

  private getStatusLabel(
    zScore: number,
    type: "BB_U" | "TB_U" | "BB_TB" | "LK_U" | "LiLA_U" | "IMT_U"
  ): string {
    // Permenkes No 2 2020 Standards
    switch (type) {
      case "BB_U":
        return this.getWeightForAgeStatus(zScore);
      case "TB_U":
        return this.getHeightForAgeStatus(zScore);
      case "BB_TB":
        return this.getWeightForHeightStatus(zScore);
      case "LK_U":
        return this.getHeadCircumferenceStatus(zScore);
      case "LiLA_U":
        return this.getArmCircumferenceStatus(zScore);
      case "IMT_U":
        return this.getBMIStatus(zScore);
      default:
        return "Normal";
    }
  }

  private determineFinalStatus(zScores: {
    bb_u: number;
    tb_u: number;
    bb_tb: number;
    lk_u: number;
    lila_u: number;
    imt_u: number;
  }): string {
    // Priority: MERAH > KUNING > HIJAU
    // MERAH: < -3SD or > +3SD (for some)
    // KUNING: -3SD < Z < -2SD or > +2SD

    const isRed = (z: number) => z < -3 || z > 3;
    const isYellow = (z: number) => (z >= -3 && z < -2) || (z > 2 && z <= 3);

    if (
      isRed(zScores.bb_u) ||
      isRed(zScores.tb_u) ||
      isRed(zScores.bb_tb) ||
      isRed(zScores.lila_u) ||
      isRed(zScores.imt_u) ||
      zScores.lk_u < -2 ||
      zScores.lk_u > 2 // LK has diff standards
    ) {
      return "MERAH";
    }
    if (
      isYellow(zScores.bb_u) ||
      isYellow(zScores.tb_u) ||
      isYellow(zScores.bb_tb) ||
      isYellow(zScores.lila_u) ||
      isYellow(zScores.imt_u)
    ) {
      return "KUNING";
    }
    return "HIJAU";
  }

  public calculate(
    ageInMonths: number,
    weight: number,
    height: number,
    headCirc: number,
    armCirc: number,
    gender: Gender
  ): AnthropometryResult {
    // 1. Get LMS Parameters for Age/Sex
    const bb_u_std = WHO_STANDARDS.find(
      (s): s is GrowthStandard => s.sex === gender && s.measure === "bb_u"
    );

    const tb_u_std = WHO_STANDARDS.find(
      (s): s is GrowthStandard => s.sex === gender && s.measure === "tb_u"
    );

    const lk_u_std = WHO_STANDARDS.find(
      (s): s is GrowthStandard => s.sex === gender && s.measure === "lk_u"
    );

    const lila_u_std = WHO_STANDARDS.find(
      (s): s is GrowthStandard => s.sex === gender && s.measure === "lila_u"
    );

    const imt_u_std = WHO_STANDARDS.find(
      (s): s is GrowthStandard => s.sex === gender && s.measure === "imt_u"
    );

    const bb_u_lms = this.interpolateLMS(bb_u_std?.data || [], ageInMonths);

    const tb_u_lms = this.interpolateLMS(tb_u_std?.data || [], ageInMonths);

    const lk_u_lms = this.interpolateLMS(lk_u_std?.data || [], ageInMonths);

    const lila_u_lms = this.interpolateLMS(lila_u_std?.data || [], ageInMonths);

    const imt_u_lms = this.interpolateLMS(imt_u_std?.data || [], ageInMonths);

    // For BB_TB, usually it's length-based lookup, not age-based.
    // Simplifying via Mock for now as requested plan focused on logic replacement
    // In full implementation, BB_TB lookup table relies on Height (cm) not Age.
    // We will use Age-based for now given the data struct, OR mock the z-score for BB/TB until table added
    const bb_tb_z = 0; // Placeholder until Height-based table added

    // Calculate BMI
    const heightM = height / 100;
    const bmi = heightM > 0 ? weight / (heightM * heightM) : 0;

    const bb_u_z = bb_u_lms ? this.calculateZ(weight, bb_u_lms) : 0;
    const tb_u_z = tb_u_lms ? this.calculateZ(height, tb_u_lms) : 0;
    const lk_u_z = lk_u_lms ? this.calculateZ(headCirc, lk_u_lms) : 0;
    const lila_u_z = lila_u_lms ? this.calculateZ(armCirc, lila_u_lms) : 0;
    const imt_u_z = imt_u_lms ? this.calculateZ(bmi, imt_u_lms) : 0;

    return {
      bb_u_status: this.getStatusLabel(bb_u_z, "BB_U"),
      tb_u_status: this.getStatusLabel(tb_u_z, "TB_U"),
      bb_tb_status: this.getStatusLabel(bb_tb_z, "BB_TB"),
      lk_u_status: this.getStatusLabel(lk_u_z, "LK_U"),
      lila_u_status: this.getStatusLabel(lila_u_z, "LiLA_U"),
      imt_u_status: this.getStatusLabel(imt_u_z, "IMT_U"),
      statusAkhir: this.determineFinalStatus({
        bb_u: bb_u_z,
        tb_u: tb_u_z,
        bb_tb: bb_tb_z,
        lk_u: lk_u_z,
        lila_u: lila_u_z,
        imt_u: imt_u_z,
      }),
      zScores: {
        bb_u: bb_u_z,
        tb_u: tb_u_z,
        bb_tb: bb_tb_z,
        lk_u: lk_u_z,
        lila_u: lila_u_z,
        imt_u: imt_u_z,
      },
    };
  }
}

export const calculateAnthropometry = (
  ageInMonths: number,
  weight: number,
  height: number,
  headCirc: number,
  armCirc: number,
  gender: string
) => {
  const calculator = new ZScoreCalculator();
  return calculator.calculate(
    ageInMonths,
    weight,
    height,
    headCirc,
    armCirc,
    gender as Gender
  );
};
