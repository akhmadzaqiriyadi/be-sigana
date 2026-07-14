import { describe, expect, it } from "bun:test";
import { buildRows } from "./report.service";

function makeMeasurement(overrides: Record<string, any> = {}): any {
  return {
    id: "meas-1",
    createdAt: new Date("2026-06-01"),
    beratBadan: 10,
    tinggiBadan: 80,
    lila: 15,
    lingkarKepala: 45,
    bb_u_status: "NORMAL",
    tb_u_status: "NORMAL",
    bb_tb_status: "NORMAL",
    lk_u_status: "NORMAL",
    lila_u_status: "NORMAL",
    imt_u_status: "NORMAL",
    statusAkhir: "HIJAU",
    balita: {
      namaAnak: "Anak Test",
      namaOrtu: "Ortu Test",
      jenisKelamin: "L",
      tanggalLahir: new Date("2020-01-01"),
      village: { id: 1, name: "Desa Test", districts: "Kec Test" },
    },
    relawan: { id: "r1", name: "Relawan Test" },
    ...overrides,
  };
}

describe("ReportService - PRD v1.4 columns", () => {
  it("should include PRD v1.4 clinical columns in buildRows output", () => {
    const m = makeMeasurement({
      tinggiBadanOrtu: 165.5,
      isDisasterArea: true,
      klinikData: {
        riwayatObatCacing: { status: "Ya", tanggal: "2026-01-15" },
        riwayatInfeksiCacing: "Tidak",
        kadarHb: 12.5,
      },
    });

    const { headers, rows } = buildRows([m], {
      period: "3_months",
      format: "excel",
    });

    expect(headers).toContain("Tinggi Badan Orang Tua (cm)");
    expect(headers).toContain("Riwayat Obat Cacing");
    expect(headers).toContain("Tanggal Obat Cacing");
    expect(headers).toContain("Riwayat Infeksi Cacing");
    expect(headers).toContain("Kadar Hemoglobin (gr/dL)");
    expect(headers).toContain("Wilayah Bencana");

    const row = rows[0];
    const rowObj = Object.fromEntries(
      headers.map((h: string, i: number) => [h, row[i]])
    );
    expect(rowObj["Tinggi Badan Orang Tua (cm)"]).toBe(165.5);
    expect(rowObj["Riwayat Obat Cacing"]).toBe("Ya");
    expect(rowObj["Tanggal Obat Cacing"]).toBe("2026-01-15");
    expect(rowObj["Riwayat Infeksi Cacing"]).toBe("Tidak");
    expect(rowObj["Kadar Hemoglobin (gr/dL)"]).toBe(12.5);
    expect(rowObj["Wilayah Bencana"]).toBe("Ya");
  });

  it("should use fallback values when klinikData is null", () => {
    const m = makeMeasurement({
      tinggiBadanOrtu: null,
      isDisasterArea: false,
      klinikData: null,
    });

    const { headers, rows } = buildRows([m], {
      period: "3_months",
      format: "excel",
    });

    const row = rows[0];
    const rowObj = Object.fromEntries(
      headers.map((h: string, i: number) => [h, row[i]])
    );
    expect(rowObj["Tinggi Badan Orang Tua (cm)"]).toBe("-");
    expect(rowObj["Riwayat Obat Cacing"]).toBe("Tidak");
    expect(rowObj["Tanggal Obat Cacing"]).toBe("-");
    expect(rowObj["Riwayat Infeksi Cacing"]).toBe("Tidak");
    expect(rowObj["Kadar Hemoglobin (gr/dL)"]).toBe("-");
    expect(rowObj["Wilayah Bencana"]).toBe("Tidak");
  });
});
