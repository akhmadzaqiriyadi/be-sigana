import { BB_U_BOY, BB_U_GIRL, TB_U_BOY, TB_U_GIRL } from "./constants";

type Gender = "L" | "P";
export type Status = "HIJAU" | "KUNING" | "MERAH";

interface AnthropometryResult {
  bb_u_status: string; // Berat/Umur
  tb_u_status: string; // Tinggi/Umur
  bb_tb_status: string; // Berat/Tinggi
  statusAkhir: Status; // Gabungan
}

export const calculateAnthropometry = (
  ageInMonths: number,
  weight: number,
  height: number,
  gender: string
): AnthropometryResult => {
  const sex = gender as Gender;
  const index = Math.min(Math.floor(ageInMonths), 24); // Cap at 24 months

  // 1. BB/U (Berat Badan per Umur) - Underweight Check
  const bbRef = sex === "L" ? BB_U_BOY : BB_U_GIRL;
  let bb_u_status = "Normal";
  let scoreBbU = "HIJAU";

  if (weight < bbRef.minus3SD[index]) {
    bb_u_status = "Sangat Kurang (Gizi Buruk)";
    scoreBbU = "MERAH";
  } else if (weight < bbRef.minus2SD[index]) {
    bb_u_status = "Kurang (Gizi Kurang)";
    scoreBbU = "KUNING";
  }

  // 2. TB/U (Tinggi Badan per Umur) - Stunting Check
  const tbRef = sex === "L" ? TB_U_BOY : TB_U_GIRL;
  let tb_u_status = "Normal";
  let scoreTbU = "HIJAU";

  if (height < tbRef.minus3SD[index]) {
    tb_u_status = "Sangat Pendek (Severely Stunted)";
    scoreTbU = "MERAH";
  } else if (height < tbRef.minus2SD[index]) {
    tb_u_status = "Pendek (Stunted)";
    scoreTbU = "KUNING";
  }

  // 3. BB/TB (Berat Badan per Tinggi) - Wasting Check (Approx Logic)
  // Logic: Ideal Weight = 2.5 + 0.3 * (Height - 50)?
  // Simplified logic using IMT-like ratio for babies: Weight / Height^2 is tricky
  // We'll use a proportional check: If Weight is very low for Height.
  // Using a conservative ratio: Weight should be at least ~0.0125 * Height^2 (roughly)
  // Let's stick to Mock logic for BB/TB as strict WHO table is huge (45-110cm lookup)
  // Approximation:
  let bb_tb_status = "Normal";
  let scoreBbTb = "HIJAU";

  // Very rough Warning Threshold for Wasting
  const minWeightForHeight = height * height * 0.0013; // e.g. 70cm -> 4.9kg * 1.3 = 6.3kg

  if (weight < minWeightForHeight * 0.8) {
    bb_tb_status = "Sangat Kurus (Severe Wasting)";
    scoreBbTb = "MERAH";
  } else if (weight < minWeightForHeight) {
    bb_tb_status = "Kurus (Wasting)";
    scoreBbTb = "KUNING";
  }

  // 4. Final Status (Prioritas: MERAH > KUNING > HIJAU)
  // Fokus Bencana: Wasting (BB/TB) dan Underweight (BB/U) adalah indikator akut.
  // Stunting (TB/U) adalah kronis.
  // Jika BB/U atau BB/TB Merah -> MERAH.

  let statusAkhir: Status = "HIJAU";
  if (scoreBbU === "MERAH" || scoreBbTb === "MERAH" || scoreTbU === "MERAH") {
    statusAkhir = "MERAH";
  } else if (
    scoreBbU === "KUNING" ||
    scoreBbTb === "KUNING" ||
    scoreTbU === "KUNING"
  ) {
    statusAkhir = "KUNING";
  }

  return {
    bb_u_status,
    tb_u_status,
    bb_tb_status,
    statusAkhir,
  };
};
