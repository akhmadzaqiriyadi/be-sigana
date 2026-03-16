const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const FE_BASE = "C:/Users/user/Downloads/fe-sigana/extacted Antropometri";
const WHO_EXCEL_BASE = path.join(FE_BASE, "lila n lku");
const OUT_BASE = path.join(process.cwd(), "src", "config", "datasets");

function parseSimpleCsv(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return rows;
}

function toNumber(value, label) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new TypeError(`Invalid numeric value for ${label}: ${value}`);
  }
  return n;
}

function lmsPredict(M, L, S, z) {
  if (Math.abs(L) < 1e-12) {
    return M * Math.exp(S * z);
  }

  const inside = 1 + L * S * z;
  if (inside <= 0) return Number.NaN;
  return M * Math.pow(inside, 1 / L);
}

function buildLoss(M, observed) {
  return (L, S) => {
    let loss = 0;
    for (const [z, obs] of observed) {
      const pred = lmsPredict(M, L, S, z);
      if (!Number.isFinite(pred) || pred <= 0) return Number.POSITIVE_INFINITY;
      const relErr = (pred - obs) / obs;
      loss += relErr * relErr;
    }
    return loss;
  };
}

function estimateLmsFromSd(row) {
  const M = toNumber(row["Median"], "Median");
  const xNeg3 = toNumber(row["-3 SD"], "-3 SD");
  const xNeg2 = toNumber(row["-2 SD"], "-2 SD");
  const xNeg1 = toNumber(row["-1 SD"], "-1 SD");
  const xPos1 = toNumber(row["+1 SD"], "+1 SD");
  const xPos2 = toNumber(row["+2 SD"], "+2 SD");
  const xPos3 = toNumber(row["+3 SD"], "+3 SD");

  const observed = [
    [-3, xNeg3],
    [-2, xNeg2],
    [-1, xNeg1],
    [1, xPos1],
    [2, xPos2],
    [3, xPos3],
  ];

  const lossFn = buildLoss(M, observed);

  // Candidate L=0 (log-normal).
  const sZero = (Math.log(xPos1 / M) - Math.log(xNeg1 / M)) / 2;
  let best = { L: 0, S: sZero, loss: lossFn(0, sZero) };

  // Coarse search for L.
  for (let L = -2; L <= 2; L += 0.05) {
    if (Math.abs(L) < 1e-9) continue;
    const a = Math.pow(xPos1 / M, L);
    const b = Math.pow(xNeg1 / M, L);
    const S1 = (a - 1) / L;
    const S2 = (1 - b) / L;
    const S = (S1 + S2) / 2;
    const loss = lossFn(L, S);
    if (loss < best.loss) {
      best = { L, S, loss };
    }
  }

  // Fine search around best L.
  const start = Math.max(-2, best.L - 0.1);
  const end = Math.min(2, best.L + 0.1);
  for (let L = start; L <= end; L += 0.001) {
    if (Math.abs(L) < 1e-12) continue;
    const a = Math.pow(xPos1 / M, L);
    const b = Math.pow(xNeg1 / M, L);
    const S1 = (a - 1) / L;
    const S2 = (1 - b) / L;
    const S = (S1 + S2) / 2;
    const loss = lossFn(L, S);
    if (loss < best.loss) {
      best = { L, S, loss };
    }
  }

  return {
    L: Number(best.L.toFixed(6)),
    M: Number(M.toFixed(4)),
    S: Number(best.S.toFixed(6)),
  };
}

function monthRowsFromCsv(filePath, sex) {
  const rows = parseSimpleCsv(filePath);
  return rows.map((row) => {
    const monthKey = Object.keys(row).find((k) => k.toLowerCase().includes("umur"));
    if (!monthKey) throw new Error(`Missing month column in ${filePath}`);
    const referenceValue = toNumber(row[monthKey], `month in ${filePath}`);
    const { L, M, S } = estimateLmsFromSd(row);
    return {
      sex,
      referenceType: "month",
      referenceValue,
      L,
      M,
      S,
    };
  });
}

function heightRowsFromCsv(filePath, sex) {
  const rows = parseSimpleCsv(filePath);
  return rows.map((row) => {
    const heightKey = Object.keys(row).find(
      (k) => k.toLowerCase().includes("panjang") || k.toLowerCase().includes("tinggi")
    );
    if (!heightKey) throw new Error(`Missing height column in ${filePath}`);
    const referenceValue = toNumber(row[heightKey], `height in ${filePath}`);
    const { L, M, S } = estimateLmsFromSd(row);
    return {
      sex,
      referenceType: "height",
      referenceValue,
      L,
      M,
      S,
    };
  });
}

function monthRowsFromExcel(filePath, sex) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  return rows.map((row) => ({
    sex,
    referenceType: "month",
    referenceValue: toNumber(row.Month, `Month in ${filePath}`),
    L: toNumber(row.L, `L in ${filePath}`),
    M: toNumber(row.M, `M in ${filePath}`),
    S: toNumber(row.S, `S in ${filePath}`),
  }));
}

function dedupeByReference(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.sex}|${row.referenceType}|${row.referenceValue}`, row);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.sex !== b.sex) return a.sex.localeCompare(b.sex);
    return a.referenceValue - b.referenceValue;
  });
}

function writeDataset(fileName, metadata, rows) {
  const target = path.join(OUT_BASE, fileName);
  const lines = [
    `# version: ${metadata.version}`,
    `# lastUpdated: ${metadata.lastUpdated}`,
    `# source: ${metadata.source}`,
    "sex,referenceType,referenceValue,L,M,S",
  ];

  for (const row of rows) {
    lines.push(
      [
        row.sex,
        row.referenceType,
        row.referenceValue,
        row.L,
        row.M,
        row.S,
      ].join(",")
    );
  }

  fs.writeFileSync(target, `${lines.join("\n")}\n`, "utf8");
}

function printSummary(name, rows) {
  const values = rows.map((r) => r.referenceValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  console.log(`${name}: rows=${rows.length}, min=${min}, max=${max}`);
}

function main() {
  const bbUBoys = monthRowsFromCsv(
    path.join(FE_BASE, "01 Standar Berat Badan menurut Umur (BBU) Anak Laki-Laki Umur 0-60 Bulan.csv"),
    "L"
  );
  const bbUGirls = monthRowsFromCsv(
    path.join(FE_BASE, "12 Standar Berat Badan menurut Umur (BBU) Anak Perempuan Umur 0-60 Bulan.csv"),
    "P"
  );
  const bbURows = dedupeByReference([...bbUBoys, ...bbUGirls]);

  const tbUBoys = dedupeByReference([
    ...monthRowsFromCsv(
      path.join(FE_BASE, "02 Standar Panjang Badan menurut Umur (PBU) Anak Laki-Laki Umur 0 - 24 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue < 24),
    ...monthRowsFromCsv(
      path.join(FE_BASE, "03 Standar Tinggi Badan menurut Umur (TBU) Anak Laki-Laki Umur 24-60 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue >= 24),
  ]);
  const tbUGirls = dedupeByReference([
    ...monthRowsFromCsv(
      path.join(FE_BASE, "13 Standar Panjang Badan menurut Umur (PBU) Anak Perempuan Umur 0-24 Bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue < 24),
    ...monthRowsFromCsv(
      path.join(FE_BASE, "14 Standar Tinggi Badan menurut Umur (TBU) Anak perempuan Umur 24-60 Bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue >= 24),
  ]);
  const tbURows = dedupeByReference([...tbUBoys, ...tbUGirls]);

  const bbTbBoys = dedupeByReference([
    ...heightRowsFromCsv(
      path.join(FE_BASE, "04 Standar Berat Badan menurut Panjang Badan (BBPB) Anak Laki-Laki Umur 0-24 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue < 65),
    ...heightRowsFromCsv(
      path.join(FE_BASE, "05 Standar Berat Badan menurut Tinggi Badan (BBTB) Anak Laki-Laki Umur 24-60 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue >= 65),
  ]);
  const bbTbGirls = dedupeByReference([
    ...heightRowsFromCsv(
      path.join(FE_BASE, "15 Standar Berat Badan menurut Panjang Badan (BBPB) Anak Perempuan Umur 0-24 Bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue < 65),
    ...heightRowsFromCsv(
      path.join(FE_BASE, "16 Standar Berat Badan menurut Tinggi Badan (BBTB) Anak perempuan umur 24-60 bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue >= 65),
  ]);
  const bbTbRows = dedupeByReference([...bbTbBoys, ...bbTbGirls]);

  const imtUBoys = dedupeByReference([
    ...monthRowsFromCsv(
      path.join(FE_BASE, "06 Standar Indeks Massa Tubuh menurut Umur (IMTU) Anak Laki-Laki Umur 0-24 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue < 24),
    ...monthRowsFromCsv(
      path.join(FE_BASE, "07 Standar Indeks Massa Tubuh menurut Umur (IMTU) Anak Laki-Laki Umur 24-60 Bulan.csv"),
      "L"
    ).filter((r) => r.referenceValue >= 24),
  ]);
  const imtUGirls = dedupeByReference([
    ...monthRowsFromCsv(
      path.join(FE_BASE, "17 Standar Indeks Massa Tubuh menurut Umur (IMTU) Anak Perempuan Umur 0-24 Bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue < 24),
    ...monthRowsFromCsv(
      path.join(FE_BASE, "18 Standar Indeks Massa Tubuh menurut Umur (IMTU) Anak perempuan umur 24-60 bulan.csv"),
      "P"
    ).filter((r) => r.referenceValue >= 24),
  ]);
  const imtURows = dedupeByReference([...imtUBoys, ...imtUGirls]);

  const lkURows = dedupeByReference([
    ...monthRowsFromExcel(
      path.join(WHO_EXCEL_BASE, "hcfa-boys-0-5-zscores (1).xlsx"),
      "L"
    ),
    ...monthRowsFromExcel(
      path.join(WHO_EXCEL_BASE, "hcfa-girls-0-5-zscores (1).xlsx"),
      "P"
    ),
  ]);

  const lilaURows = dedupeByReference([
    ...monthRowsFromExcel(
      path.join(WHO_EXCEL_BASE, "tab_acfa_boys_p_3_5.xlsx"),
      "L"
    ),
    ...monthRowsFromExcel(
      path.join(WHO_EXCEL_BASE, "tab_acfa_girls_p_3_5.xlsx"),
      "P"
    ),
  ]);

  writeDataset(
    "who_growth_bb_u.csv",
    {
      version: "Permenkes 2/2020",
      lastUpdated: "2026-03-16",
      source: "Permenkes No. 2 Tahun 2020 (FE extracted Antropometri)",
    },
    bbURows
  );

  writeDataset(
    "who_growth_tb_u.csv",
    {
      version: "Permenkes 2/2020",
      lastUpdated: "2026-03-16",
      source: "Permenkes No. 2 Tahun 2020 (FE extracted Antropometri)",
    },
    tbURows
  );

  writeDataset(
    "who_growth_bb_tb.csv",
    {
      version: "Permenkes 2/2020",
      lastUpdated: "2026-03-16",
      source: "Permenkes No. 2 Tahun 2020 (FE extracted Antropometri)",
    },
    bbTbRows
  );

  writeDataset(
    "who_growth_imt_u.csv",
    {
      version: "Permenkes 2/2020",
      lastUpdated: "2026-03-16",
      source: "Permenkes No. 2 Tahun 2020 (FE extracted Antropometri)",
    },
    imtURows
  );

  writeDataset(
    "who_growth_lk_u.csv",
    {
      version: "WHO 2006",
      lastUpdated: "2026-03-16",
      source: "WHO 2006 (hcfa boys/girls excel)",
    },
    lkURows
  );

  writeDataset(
    "who_growth_lila_u.csv",
    {
      version: "WHO 2006",
      lastUpdated: "2026-03-16",
      source: "WHO 2006 (acfa boys/girls excel)",
    },
    lilaURows
  );

  printSummary("who_growth_bb_u.csv", bbURows);
  printSummary("who_growth_tb_u.csv", tbURows);
  printSummary("who_growth_bb_tb.csv", bbTbRows);
  printSummary("who_growth_imt_u.csv", imtURows);
  printSummary("who_growth_lk_u.csv", lkURows);
  printSummary("who_growth_lila_u.csv", lilaURows);
}

main();
