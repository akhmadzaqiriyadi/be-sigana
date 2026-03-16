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

let originalGetThresholdConfig: unknown;
let originalUpdateThresholdConfig: unknown;
let originalGetAccessConfig: unknown;
let originalUpdateAccessConfig: unknown;
let originalGetWhoDatasets: unknown;
let originalGetBootstrapStatus: unknown;
let originalUpdateWhoDataset: unknown;

describe("SettingsController", () => {
  beforeEach(async () => {
    sendSuccess.mockClear();
    sendCreated.mockClear();

    const { settingsService } = await import("./settings.service");
    originalGetThresholdConfig ??= settingsService.getThresholdConfig;
    originalUpdateThresholdConfig ??= settingsService.updateThresholdConfig;
    originalGetAccessConfig ??= settingsService.getAccessConfig;
    originalUpdateAccessConfig ??= settingsService.updateAccessConfig;
    originalGetWhoDatasets ??= settingsService.getWhoDatasets;
    originalGetBootstrapStatus ??= settingsService.getBootstrapStatus;
    originalUpdateWhoDataset ??= settingsService.updateWhoDataset;
  });

  afterEach(async () => {
    const { settingsService } = await import("./settings.service");
    settingsService.getThresholdConfig = originalGetThresholdConfig as any;
    settingsService.updateThresholdConfig =
      originalUpdateThresholdConfig as any;
    settingsService.getAccessConfig = originalGetAccessConfig as any;
    settingsService.updateAccessConfig = originalUpdateAccessConfig as any;
    settingsService.getWhoDatasets = originalGetWhoDatasets as any;
    settingsService.getBootstrapStatus = originalGetBootstrapStatus as any;
    settingsService.updateWhoDataset = originalUpdateWhoDataset as any;
  });

  it("should return threshold config", async () => {
    const { getThresholdConfig } = await import("./settings.controller");
    const { settingsService } = await import("./settings.service");
    const res = createResponse();
    const next = mock();
    const config = { minDataPoints: 3 };
    settingsService.getThresholdConfig = mock(async () => config) as any;

    getThresholdConfig({} as any, res, next as any);
    await flushAsyncHandler();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Konfigurasi threshold berhasil diambil",
      config
    );
  });

  it("should update access config using authenticated user email", async () => {
    const { updateAccessConfig } = await import("./settings.controller");
    const { settingsService } = await import("./settings.service");
    const res = createResponse();
    const next = mock();
    const config = {
      auditLogging: true,
      sessionTimeout: 30,
      multiDeviceLogin: false,
      emailVerification: true,
    };
    settingsService.updateAccessConfig = mock(async () => config) as any;

    updateAccessConfig(
      {
        body: config,
        user: { email: "admin@sigana.id" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(settingsService.updateAccessConfig).toHaveBeenCalledWith(
      config,
      "admin@sigana.id"
    );
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Konfigurasi akses berhasil diperbarui",
      config
    );
  });

  it("should update WHO dataset using route param and authenticated user email", async () => {
    const { updateWhoDataset } = await import("./settings.controller");
    const { settingsService } = await import("./settings.service");
    const res = createResponse();
    const next = mock();
    const dataset = { id: 9, code: "BB_U" };
    settingsService.updateWhoDataset = mock(async () => dataset) as any;

    updateWhoDataset(
      {
        params: { id: "9" },
        body: { version: "WHO 2006" },
        user: { email: "admin@sigana.id" },
      } as any,
      res,
      next as any
    );
    await flushAsyncHandler();

    expect(settingsService.updateWhoDataset).toHaveBeenCalledWith(9, {
      version: "WHO 2006",
      updatedBy: "admin@sigana.id",
    });
    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Dataset WHO berhasil diperbarui",
      dataset
    );
  });

  it("should return bootstrap status", async () => {
    const { getBootstrapStatus } = await import("./settings.controller");
    const { settingsService } = await import("./settings.service");
    const res = createResponse();
    const next = mock();
    const status = {
      isComplete: true,
      kbm: {
        expectedMonths: 61,
        totalRows: 61,
        missingMonths: [],
        isComplete: true,
      },
      whoDatasets: {
        expectedCodes: ["BB_U", "PB_U", "BB_TB", "LK_U", "IMT_U", "LILA_U"],
        totalRows: 6,
        missingCodes: [],
        isComplete: true,
      },
    };
    settingsService.getBootstrapStatus = mock(async () => status) as any;

    getBootstrapStatus({} as any, res, next as any);
    await flushAsyncHandler();

    expect(sendSuccess).toHaveBeenCalledWith(
      res,
      "Status bootstrap master data berhasil diambil",
      status
    );
  });

  it("should pass UnauthorizedError to next when user is missing on update", async () => {
    const { updateThresholdConfig } = await import("./settings.controller");
    const next = mock();

    updateThresholdConfig(
      { body: { minDataPoints: 3 } } as any,
      createResponse(),
      next as any
    );
    await flushAsyncHandler();

    expect(next).toHaveBeenCalled();
    const [error] = next.mock.calls[0];
    expect(error.statusCode).toBe(401);
  });
});
