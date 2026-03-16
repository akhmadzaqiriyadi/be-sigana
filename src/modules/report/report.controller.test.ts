import { beforeEach, describe, expect, it, mock } from "bun:test";

const sendSuccess = mock();
const sendCreated = mock();
const reportService = {
  generate: mock(),
  getStatus: mock(),
  getFilePath: mock(),
  getHistory: mock(),
};

mock.module("@/utils/response", () => ({
  sendSuccess,
  sendCreated,
}));

mock.module("./report.service", () => ({
  reportService,
}));

mock.module("node:fs", () => ({
  promises: {
    readFile: mock(),
    mkdir: mock(),
    readdir: mock(),
  },
  existsSync: mock(() => true),
  mkdirSync: mock(),
  writeFileSync: mock(),
  createReadStream: mock(() => ({ pipe: mock() })),
  statSync: mock(() => ({ size: 123 })),
}));

function createResponse() {
  return {
    setHeader: mock(),
  } as any;
}

async function flushAsyncHandler() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("ReportController", () => {
  beforeEach(() => {
    sendSuccess.mockClear();
    sendCreated.mockClear();
    Object.values(reportService).forEach((fn: any) => fn.mockClear?.());
  });

  it("should reject generate when period is missing", async () => {
    const { generateReport } = await import("./report.controller");
    const next = mock();

    generateReport(
      {
        body: { format: "pdf" },
        user: { userId: "u1" },
      } as any,
      createResponse(),
      next as any
    );
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const [error] = next.mock.calls[0];
    expect(error.statusCode).toBe(400);
  });

  it("should create report generation request", async () => {
    const { generateReport } = await import("./report.controller");
    const res = createResponse();
    const next = mock();
    const result = { reportId: "r1", status: "processing" };
    reportService.generate.mockResolvedValue(result);

    generateReport(
      {
        body: { period: "3_months", format: "pdf" },
        user: { userId: "u1" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(reportService.generate).toHaveBeenCalledWith(
      {
        period: "3_months",
        startDate: undefined,
        endDate: undefined,
        wilayah: undefined,
        statusGizi: undefined,
        parameterGrafik: undefined,
        faktorRisiko: undefined,
        format: "pdf",
      },
      "u1"
    );
    expect(sendCreated).toHaveBeenCalledWith(
      res,
      "Laporan sedang diproses",
      result
    );
  });

  it("should return report history with pagination meta", async () => {
    const { getReportHistory } = await import("./report.controller");
    const res = createResponse();
    const next = mock();
    const history = { data: [{ id: "r1" }], meta: { page: 2, limit: 5 } };
    reportService.getHistory.mockResolvedValue(history);

    getReportHistory(
      {
        query: { page: "2", limit: "5" },
        user: { userId: "u1", role: "ADMIN" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(reportService.getHistory).toHaveBeenCalledWith(2, 5, "u1", "ADMIN");
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Riwayat laporan berhasil diambil",
      history.data,
      history.meta
    );
  });
});
