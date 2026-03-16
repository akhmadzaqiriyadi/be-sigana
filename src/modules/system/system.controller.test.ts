import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const sendSuccess = mock();
const sendCreated = mock();

mock.module("@/utils/response", () => ({
  sendSuccess,
  sendCreated,
}));

function createResponse() {
  return {} as any;
}

async function flushAsyncHandler() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let originalGetInfo: unknown;
let originalTriggerBackup: unknown;
let originalGetLogs: unknown;

describe("SystemController", () => {
  beforeEach(async () => {
    sendSuccess.mockClear();
    sendCreated.mockClear();

    const { systemService } = await import("./system.service");
    originalGetInfo ??= systemService.getInfo;
    originalTriggerBackup ??= systemService.triggerBackup;
    originalGetLogs ??= systemService.getLogs;
  });

  afterEach(async () => {
    const { systemService } = await import("./system.service");
    systemService.getInfo = originalGetInfo as any;
    systemService.triggerBackup = originalTriggerBackup as any;
    systemService.getLogs = originalGetLogs as any;
  });

  it("should return system info", async () => {
    const { getSystemInfo } = await import("./system.controller");
    const { systemService } = await import("./system.service");
    const res = createResponse();
    const next = mock();
    const info = { appVersion: "1.0.0", serverStatus: "online" };
    systemService.getInfo = mock(async () => info) as any;

    getSystemInfo({} as any, res, next as any);
    await flushAsyncHandler();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Informasi sistem berhasil diambil",
      info
    );
  });

  it("should trigger backup using authenticated user email", async () => {
    const { triggerSystemBackup } = await import("./system.controller");
    const { systemService } = await import("./system.service");
    const res = createResponse();
    const next = mock();
    const result = { message: "ok" };
    systemService.triggerBackup = mock(async () => result) as any;

    triggerSystemBackup(
      { user: { email: "admin@sigana.id" } } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(systemService.triggerBackup).toHaveBeenCalledWith("admin@sigana.id");
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Backup database berhasil dipicu",
      result
    );
  });

  it("should parse pagination params when fetching logs", async () => {
    const { getSystemLogs } = await import("./system.controller");
    const { systemService } = await import("./system.service");
    const res = createResponse();
    const next = mock();
    const result = { data: [{ level: "error" }], meta: { total: 1 } };
    systemService.getLogs = mock(async () => result) as any;

    getSystemLogs(
      {
        query: { page: "2", limit: "25", level: "error" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(systemService.getLogs).toHaveBeenCalledWith(2, 25, "error");
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Log sistem berhasil diambil",
      result.data,
      result.meta
    );
  });
});
